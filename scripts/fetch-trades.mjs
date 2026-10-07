import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const URL_SONIC = 'https://www.myfxbook.com/members/SonicExperts/sonic-ai/12076857';
const URL_NEO = 'https://www.myfxbook.com/members/WordSmithyFx/neofx/11800152';
const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY;

if (!SCRAPERAPI_KEY) {
  console.error('Fehlender SCRAPERAPI_KEY in den GitHub Secrets.');
  process.exit(1);
}

async function scrapeTrades(url, name) {
  console.log(`\nStarte Scraping für ${name} über Proxy...`);
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--proxy-server=http://proxy-server.scraperapi.com:8001',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  
  // ScraperAPI Authentifizierung für den Proxy
  await page.authenticate({ username: 'scraperapi', password: SCRAPERAPI_KEY });
  await page.setViewport({ width: 1280, height: 800 });

  try {
    console.log(`Lade Webseite: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const pageTitle = await page.title();
    console.log(`Webseiten-Titel: "${pageTitle}"`);
    
    if (pageTitle.includes('Just a moment') || pageTitle.includes('Cloudflare')) {
      console.warn(`WARNUNG: Myfxbook blockiert den Zugriff trotz Proxy.`);
    }

    // 8 Sekunden warten, damit der Proxy alle Skripte durchlässt
    await new Promise(r => setTimeout(r, 8000));

    console.log('Versuche History-Tab zu öffnen...');
    try {
      await page.waitForSelector('a[href="#history"]', { timeout: 10000 });
      await page.click('a[href="#history"]');
      await new Promise(r => setTimeout(r, 5000)); // Warten, bis Tabelle gerendert ist
    } catch (e) {
      console.log('History-Tab nicht klickbar (vielleicht schon aktiv).');
    }

    console.log('Lese Trades aus der Tabelle aus...');
    const trades = await page.evaluate(() => {
      const data = [];
      const allRows = document.querySelectorAll('tr');
      
      allRows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 10) {
          const action = cols[4]?.innerText?.trim();
          if (action === 'Buy' || action === 'Sell') {
            data.push({
              openDate: cols[1]?.innerText?.trim() || '',
              closeDate: cols[2]?.innerText?.trim() || '',
              symbol: cols[3]?.innerText?.trim() || '',
              action: action,
              pips: cols[7]?.innerText?.trim() || '',
              profit: cols[8]?.innerText?.trim() || '',
              gain: cols[9]?.innerText?.trim() || ''
            });
          }
        }
      });
      return data;
    });

    console.log(`${trades.length} Trades erfolgreich gefunden.`);
    await browser.close();
    return trades;

  } catch (err) {
    console.error(`Fehler beim Scrapen von ${name}:`, err.message);
    await browser.close();
    return [];
  }
}

async function run() {
  const sonicTrades = await scrapeTrades(URL_SONIC, 'Sonic AI');
  const neoTrades = await scrapeTrades(URL_NEO, 'NeoFX');

  const targetDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(path.join(targetDir, 'Sonic_TradesData.json'), JSON.stringify(sonicTrades, null, 2), 'utf-8');
  console.log('Sonic_TradesData.json aktualisiert.');

  fs.writeFileSync(path.join(targetDir, 'NEO_TradesData.json'), JSON.stringify(neoTrades, null, 2), 'utf-8');
  console.log('NEO_TradesData.json aktualisiert.');
}

run();