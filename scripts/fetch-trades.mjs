import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const URL_SONIC = 'https://www.myfxbook.com/members/SonicExperts/sonic-ai/12076857';
const URL_NEO = 'https://www.myfxbook.com/members/WordSmithyFx/neofx/11800152';

async function scrapeTrades(url, name) {
  console.log(`\nStarte Scraping für ${name}...`);
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();
  // Simuliere einen echten Browser, damit Myfxbook uns nicht blockiert
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  try {
    console.log(`Lade Webseite: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

    // Kurz warten und versuchen, auf den "History" Tab zu klicken
    console.log('Öffne History-Tab...');
    try {
      await page.waitForSelector('a[href="#history"]', { timeout: 10000 });
      await page.click('a[href="#history"]');
    } catch (e) {
      console.log('History-Tab war schon offen oder nicht gefunden.');
    }

    // 4 Sekunden warten, damit die Trade-Tabelle sicher geladen ist
    await new Promise(r => setTimeout(r, 4000));

    console.log('Lese Trades aus der Tabelle aus...');
    const trades = await page.evaluate(() => {
      const data = [];
      // Wir holen uns alle Tabellenzeilen auf der ganzen Seite
      const allRows = document.querySelectorAll('tr');
      
      allRows.forEach(row => {
        const cols = row.querySelectorAll('td');
        // Ein typischer Myfxbook-Trade hat viele Spalten, und die 5. Spalte (Index 4) ist "Buy" oder "Sell"
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

  // Zielordner sicherstellen
  const targetDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Dateien abspeichern
  fs.writeFileSync(path.join(targetDir, 'Sonic_TradesData.json'), JSON.stringify(sonicTrades, null, 2), 'utf-8');
  console.log('Sonic_TradesData.json aktualisiert.');

  fs.writeFileSync(path.join(targetDir, 'NEO_TradesData.json'), JSON.stringify(neoTrades, null, 2), 'utf-8');
  console.log('NEO_TradesData.json aktualisiert.');
}

run();