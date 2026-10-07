import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const URL_SONIC = 'https://www.myfxbook.com/members/SonicExperts/sonic-ai/12076857';
const URL_NEO = 'https://www.myfxbook.com/members/WordSmithyFx/neofx/11800152';
const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY;
const EMAIL = process.env.MYFXBOOK_EMAIL;
const PASSWORD = process.env.MYFXBOOK_PASSWORD;

if (!SCRAPERAPI_KEY || !EMAIL || !PASSWORD) {
  console.error('FEHLER: SCRAPERAPI_KEY, MYFXBOOK_EMAIL oder MYFXBOOK_PASSWORD fehlt in den Secrets.');
  process.exit(1);
}

// Generiere eine feste Session-ID für diesen Durchlauf, damit die IP nicht wechselt!
const PROXY_SESSION = Math.floor(Math.random() * 1000000);

async function run() {
  console.log('Starte Browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--proxy-server=http://proxy-server.scraperapi.com:8001',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--ignore-certificate-errors',
      '--lang=en-US,en'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    
    // WICHTIG: session_number erzwingt eine durchgehende IP-Adresse!
    await page.authenticate({ 
      username: `scraperapi.session_number=${PROXY_SESSION}`, 
      password: SCRAPERAPI_KEY 
    });
    await page.setViewport({ width: 1280, height: 800 });

    // === 1. LOGIN PHASE ===
    console.log('\n--- LOGIN PHASE ---');
    console.log(`Verwende Proxy Session-ID: ${PROXY_SESSION}`);
    console.log('Lade Login-Seite...');
    
    await page.goto('https://www.myfxbook.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 12000)); // Warten auf Cloudflare

    const loginTitle = await page.title();
    console.log(`Titel der Login-Seite: "${loginTitle}"`);

    // Diagnose-Check: Was genau steht auf dem Bildschirm?
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 800).replace(/\n/g, ' '));
    console.log(`Seiteninhalt Vorschau: ${pageText}`);

    try {
      const emailFound = await page.evaluate(() => !!document.querySelector('input[name="email"], #email, input[type="email"]'));
      if (!emailFound) throw new Error('Email-Feld im DOM nicht vorhanden. Wahrscheinlich von Cloudflare blockiert.');

      console.log('Login-Felder gefunden. Gebe Daten ein...');
      
      // Cookie-Banner wegklicken (falls vorhanden)
      await page.evaluate(() => {
        const cookieBtn = document.querySelector('.cky-btn-accept');
        if (cookieBtn) cookieBtn.click();
      });

      await page.type('input[name="email"], #email, input[type="email"]', EMAIL);
      await page.type('input[name="password"], #password, input[type="password"]', PASSWORD);
      
      console.log('Klicke Login-Button...');
      await Promise.all([
        page.keyboard.press('Enter'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      ]);
      
      console.log('Warte auf Login-Verarbeitung...');
      await new Promise(r => setTimeout(r, 8000));
      console.log(`Titel nach Login: "${await page.title()}"`);
    } catch (e) {
      console.log(`\n❌ LOGIN FEHLGESCHLAGEN: ${e.message}`);
      console.log('Versuche ohne Login fortzufahren (wird bei privaten Konten fehlschlagen)...\n');
    }

    // === 2. SCRAPING FUNKTION ===
    async function fetchStrategy(url, name) {
      console.log(`\n--- Lade ${name} ---`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(r => setTimeout(r, 8000));

      console.log('Suche History-Tab...');
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a, button, [role="tab"], li'));
        const historyTab = tabs.find(el => (el.innerText || '').toLowerCase().includes('history'));
        if (historyTab) historyTab.click();
        else {
          const fallback = document.querySelector('a[href="#history"]');
          if (fallback) fallback.click();
        }
      });

      console.log('Warte 10 Sekunden auf Datenabruf...');
      await new Promise(r => setTimeout(r, 10000));

      console.log('Parse Tabelle im DOM...');
      const trades = await page.evaluate(() => {
        const data = [];
        document.querySelectorAll('tr').forEach(row => {
          const cols = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim().replace(/\s+/g, ' '));
          const actionIdx = cols.findIndex(c => /^(buy|sell)$/i.test(c));
          if (actionIdx >= 3 && cols.length >= actionIdx + 5) {
            data.push({
              openDate: cols[actionIdx - 3] || '',
              closeDate: cols[actionIdx - 2] || '',
              symbol: cols[actionIdx - 1] || '',
              action: cols[actionIdx],
              pips: cols[actionIdx + 6] || '',
              profit: cols[actionIdx + 7] || '',
              gain: cols[actionIdx + 9] || ''
            });
          }
        });
        return data;
      });

      console.log(`${trades.length} Trades gefunden.`);
      return trades;
    }

    // === 3. DURCHLAUF MIT RETRY ===
    async function getTradesWithRetry(url, name) {
      for (let i = 1; i <= 3; i++) {
        console.log(`\n>> ${name} (Versuch ${i}/3) <<`);
        try {
          const trades = await fetchStrategy(url, name);
          if (trades.length > 0) return trades;
        } catch (e) {
          console.log(`Fehler in Versuch ${i}: ${e.message}`);
        }
        console.log('Keine Trades gefunden. Kurze Pause...');
        await new Promise(r => setTimeout(r, 5000));
      }
      return [];
    }

    const sonicTrades = await getTradesWithRetry(URL_SONIC, 'Sonic AI');
    const neoTrades = await getTradesWithRetry(URL_NEO, 'NeoFX');

    await browser.close();

    const targetDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    if (sonicTrades.length > 0) {
      fs.writeFileSync(path.join(targetDir, 'Sonic_TradesData.json'), JSON.stringify(sonicTrades, null, 2), 'utf-8');
      console.log('\n✅ Sonic_TradesData.json gespeichert.');
    } else {
      console.log('\n❌ Sonic_TradesData.json NICHT überschrieben.');
    }

    if (neoTrades.length > 0) {
      fs.writeFileSync(path.join(targetDir, 'NEO_TradesData.json'), JSON.stringify(neoTrades, null, 2), 'utf-8');
      console.log('✅ NEO_TradesData.json gespeichert.');
    } else {
      console.log('❌ NEO_TradesData.json NICHT überschrieben.');
    }

  } catch (err) {
    console.error('Kritischer Fehler im Browser-Ablauf:', err.message);
    await browser.close();
  }
}

run();