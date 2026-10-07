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

async function analyzeAndScrape(url, name) {
  const browser = await puppeteer.launch({
    headless: "new",
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

    // === 1. NETZWERK-SNIFFER: Alle versteckten Myfxbook-Abfragen protokollieren ===
    page.on('response', async response => {
      const request = response.request();
      const type = request.resourceType();
      const resUrl = response.url();

      if (type === 'xhr' || type === 'fetch') {
        console.log(`[NETZWERK] ${response.status()} ${request.method()} ${resUrl}`);
        if (resUrl.includes('history') || resUrl.includes('portfolio')) {
          try {
            const text = await response.text();
            console.log(`[NETZWERK-DATEN] Potenzielle History-Daten geladen! (${text.length} Zeichen)`);
          } catch (e) {
            // Ignoriere Fehler beim Lesen des Streams
          }
        }
      }
    });

    console.log(`\nLade Webseite: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log(`Titel: "${await page.title()}"`);

    // Kurz warten, bis Cloudflare durch ist
    await new Promise(r => setTimeout(r, 8000));

    // === 2. ROBUSTER HISTORY-KLICK ===
    console.log('Suche History-Tab...');
    const clicked = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('a, button, [role="tab"], li'));
      const historyTab = candidates.find(el => {
        const text = (el.innerText || el.textContent || '').trim().toLowerCase();
        return text.includes('history ('); // Myfxbook schreibt meist "History (123)"
      });

      if (historyTab) {
        historyTab.click();
        return true;
      }
      
      const fallback = document.querySelector('a[href="#history"]');
      if (fallback) {
        fallback.click();
        return true;
      }
      return false;
    });
    console.log(`History Tab geklickt: ${clicked}`);

    // === 3. INTELLIGENTES WARTEN AUF TRADES ===
    console.log('Warte darauf, dass Trade-Daten im DOM auftauchen...');
    try {
      await page.waitForFunction(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('buy') || text.includes('sell');
      }, { timeout: 25000 });
      console.log('Erfolg: Trades sind jetzt sichtbar!');
    } catch (e) {
      console.log('Timeout: Keine Trades im DOM erschienen. (Möglicherweise leere Historie oder geblockt)');
    }

    // === 4. DOM DIAGNOSE & EXTRAKTION ===
    const debugInfo = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('table')).map((t, i) => ({
        index: i,
        id: t.id,
        rows: t.querySelectorAll('tr').length
      }));
    });
    console.log(`Gefundene Tabellen: ${debugInfo.filter(t => t.rows > 2).length} (mit mehr als 2 Zeilen)`);

    const trades = await page.evaluate(() => {
      const data = [];
      const allRows = document.querySelectorAll('tr');

      allRows.forEach(row => {
        const cols = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim().replace(/\s+/g, ' '));
        
        // Finde die Spalte, die exakt "Buy" oder "Sell" (case-insensitive) enthält
        const actionIdx = cols.findIndex(c => /^buy$\vert{}^sell$/i.test(c));

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

    console.log(`${trades.length} Trades geparst.`);
    await browser.close();
    return trades;

  } catch (err) {
    console.error(`Scraping-Fehler bei ${name}:`, err.message);
    await browser.close();
    return [];
  }
}

async function getTradesWithRetry(url, name) {
  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- ${name} (Versuch ${i}/3) ---`);
    const trades = await analyzeAndScrape(url, name);
    if (trades.length > 0) {
      return trades;
    }
    console.log('Neustart in 5 Sekunden...');
    await new Promise(r => setTimeout(r, 5000));
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
    console.log('Sonic_TradesData.json gespeichert.');
  }

  if (neoTrades.length > 0) {
    fs.writeFileSync(path.join(targetDir, 'NEO_TradesData.json'), JSON.stringify(neoTrades, null, 2), 'utf-8');
    console.log('NEO_TradesData.json gespeichert.');
  }
}

run();