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

async function scrapePage(page, url, name) {
  console.log(`Lade Webseite: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  // Cookie-Banner wegklicken, falls er das Layout blockiert
  try {
    await page.evaluate(() => {
      const cookieBtn = document.querySelector('.cky-btn-accept');
      if (cookieBtn) cookieBtn.click();
    });
  } catch (e) {}

  await new Promise(r => setTimeout(r, 8000));

  console.log('Suche History-Tab...');
  await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('a, button, [role="tab"], li'));
    const historyTab = candidates.find(el => {
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return text.includes('history (');
    });
    
    if (historyTab) {
      historyTab.click();
    } else {
      const fallback = document.querySelector('a[href="#history"]');
      if (fallback) fallback.click();
    }
  });

  console.log('Warte auf Trade-Daten vom Server...');
  await new Promise(r => setTimeout(r, 10000));

  return await page.evaluate(() => {
    const data = [];
    const allRows = document.querySelectorAll('tr');
    
    allRows.forEach(row => {
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
}

async function getTradesWithRetry(page, url, name) {
  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- ${name} (Versuch ${i}/3) ---`);
    try {
      const trades = await scrapePage(page, url, name);
      if (trades.length > 0) {
        console.log(`Erfolg: ${trades.length} Trades gefunden.`);
        return trades;
      }
    } catch (e) {
      console.log(`Fehler in Versuch ${i}: ${e.message}`);
    }
    console.log('Keine Trades gefunden. Kurze Pause vor Neustart...');
    await new Promise(r => setTimeout(r, 5000));
  }
  return [];
}

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
    await page.authenticate({ username: 'scraperapi', password: SCRAPERAPI_KEY });
    await page.setViewport({ width: 1280, height: 800 });

    console.log('\nLogge bei Myfxbook ein...');
    await page.goto('https://www.myfxbook.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    try {
      await page.type('input[name="email"]', EMAIL);
      await page.type('input[name="password"]', PASSWORD);
      await page.keyboard.press('Enter');
      console.log('Login-Daten gesendet, warte auf Weiterleitung...');
      await new Promise(r => setTimeout(r, 12000));
    } catch (e) {
      console.log('Konnte Login-Felder nicht finden. Versuche ohne Login weiterzumachen.');
    }

    const sonicTrades = await getTradesWithRetry(page, URL_SONIC, 'Sonic AI');
    const neoTrades = await getTradesWithRetry(page, URL_NEO, 'NeoFX');

    await browser.close();

    const targetDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (sonicTrades.length > 0) {
      fs.writeFileSync(path.join(targetDir, 'Sonic_TradesData.json'), JSON.stringify(sonicTrades, null, 2), 'utf-8');
      console.log('Sonic_TradesData.json gespeichert.');
    } else {
      console.log('Sonic_TradesData.json wurde nicht überschrieben.');
    }

    if (neoTrades.length > 0) {
      fs.writeFileSync(path.join(targetDir, 'NEO_TradesData.json'), JSON.stringify(neoTrades, null, 2), 'utf-8');
      console.log('NEO_TradesData.json gespeichert.');
    } else {
      console.log('NEO_TradesData.json wurde nicht überschrieben.');
    }

  } catch (err) {
    console.error('Kritischer Fehler:', err.message);
    await browser.close();
  }
}

run();