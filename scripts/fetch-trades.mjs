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
  console.error('FEHLER: SCRAPERAPI_KEY, MYFXBOOK_EMAIL oder MYFXBOOK_PASSWORD fehlt.');
  process.exit(1);
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

    console.log('\n--- LOGIN PHASE ---');
    await page.goto('https://www.myfxbook.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    try {
      console.log('Warte auf Login-Felder...');
      await page.waitForSelector('input[name="email"], #email', { timeout: 15000 });
      
      await page.evaluate(() => {
        const cookieBtn = document.querySelector('.cky-btn-accept');
        if (cookieBtn) cookieBtn.click();
      });

      await page.type('input[name="email"], #email', EMAIL);
      await page.type('input[name="password"], #password', PASSWORD);
      await Promise.all([
        page.keyboard.press('Enter'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      ]);
      console.log('Login erfolgreich gesendet.');
    } catch (e) {
      console.log(`Login fehlgeschlagen: ${e.message}`);
      await page.screenshot({ path: 'debug-login.png', fullPage: true });
    }

    page.on('response', async response => {
      const req = response.request();
      if (req.resourceType() === 'xhr' || req.resourceType() === 'fetch') {
        const url = response.url().toLowerCase();
        if (url.includes('history') || url.includes('portfolio') || url.includes('data')) {
          console.log(`[NETZWERK] ${req.method()} ${response.url()} - Status: ${response.status()}`);
        }
      }
    });

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
      if (trades.length === 0) {
        const cleanName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        await page.screenshot({ path: `debug-${cleanName}.png`, fullPage: true });
      }
      return trades;
    }

    const sonicTrades = await fetchStrategy(URL_SONIC, 'Sonic AI');
    const neoTrades = await fetchStrategy(URL_NEO, 'NeoFX');

    await browser.close();

    const targetDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    if (sonicTrades.length > 0) {
      fs.writeFileSync(path.join(targetDir, 'Sonic_TradesData.json'), JSON.stringify(sonicTrades, null, 2), 'utf-8');
      console.log('Sonic_TradesData.json gespeichert.');
    } else {
      console.log('Sonic_TradesData.json NICHT überschrieben.');
    }

    if (neoTrades.length > 0) {
      fs.writeFileSync(path.join(targetDir, 'NEO_TradesData.json'), JSON.stringify(neoTrades, null, 2), 'utf-8');
      console.log('NEO_TradesData.json gespeichert.');
    } else {
      console.log('NEO_TradesData.json NICHT überschrieben.');
    }

  } catch (err) {
    console.error('Kritischer Fehler:', err.message);
    await browser.close();
  }
}

run();