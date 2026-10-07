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
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--proxy-server=http://proxy-server.scraperapi.com:8001',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--ignore-certificate-errors'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.authenticate({ username: 'scraperapi', password: SCRAPERAPI_KEY });
    await page.setViewport({ width: 1280, height: 800 });

    console.log(`Lade Webseite: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const pageTitle = await page.title();
    console.log(`Titel: "${pageTitle}"`);
    
    // 8 Sekunden warten, damit alles geladen ist
    await new Promise(r => setTimeout(r, 8000));

    console.log('Erzwinge Klick auf History-Tab...');
    await page.evaluate(() => {
      const tab = document.querySelector('a[href="#history"]');
      if (tab) tab.click();
    });
    
    // 5 Sekunden warten, bis die Ajax-Tabelle da ist
    await new Promise(r => setTimeout(r, 5000));

    console.log('Lese Tabelle aus...');
    const trades = await page.evaluate(() => {
      const data = [];
      const allRows = document.querySelectorAll('tr');
      
      allRows.forEach(row => {
        const cols = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
        
        // Finde die Spalte, in der "Buy" oder "Sell" steht
        const actionIdx = cols.findIndex(c => c === 'Buy' || c === 'Sell');
        
        // Wenn es eine Trade-Zeile ist und genug Spalten danach kommen
        if (actionIdx >= 3 && cols.length > actionIdx + 5) {
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

    await browser.close();
    return trades;

  } catch (err) {
    console.error(`Scraping-Fehler bei ${name}:`, err.message);
    await browser.close();
    return [];
  }
}

// Hilfsfunktion: Versucht das Scrapen bis zu 3 Mal pro Strategie
async function getTradesWithRetry(url, name) {
  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- ${name} (Versuch ${i}/3) ---`);
    const trades = await scrapeTrades(url, name);
    
    if (trades.length > 0) {
      console.log(`Erfolg! ${trades.length} Trades gefunden.`);
      return trades;
    }
    console.log('Keine Trades gefunden oder Fehler. Kurze Pause vor Neustart...');
    await new Promise(r => setTimeout(r, 5000)); // 5 Sekunden Pause vor neuem Versuch
  }
  return [];
}

async function run() {
  const sonicTrades = await getTradesWithRetry(URL_SONIC, 'Sonic AI');
  const neoTrades = await getTradesWithRetry(URL_NEO, 'NeoFX');

  const targetDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  if (sonicTrades.length > 0) {
    fs.writeFileSync(path.join(targetDir, 'Sonic_TradesData.json'), JSON.stringify(sonicTrades, null, 2), 'utf-8');
    console.log('Sonic_TradesData.json aktualisiert.');
  } else {
    console.log('Sonic_TradesData.json wurde nicht überschrieben (keine Daten).');
  }

  if (neoTrades.length > 0) {
    fs.writeFileSync(path.join(targetDir, 'NEO_TradesData.json'), JSON.stringify(neoTrades, null, 2), 'utf-8');
    console.log('NEO_TradesData.json aktualisiert.');
  } else {
    console.log('NEO_TradesData.json wurde nicht überschrieben (keine Daten).');
  }
}

run();