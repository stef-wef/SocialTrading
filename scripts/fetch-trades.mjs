import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const URL_SONIC = 'https://www.myfxbook.com/members/SonicExperts/sonic-ai/12076857';
const URL_NEO = 'https://www.myfxbook.com/members/WordSmithyFx/neofx/11800152';
const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY;

if (!SCRAPERAPI_KEY) {
  console.error('FEHLER: SCRAPERAPI_KEY fehlt in den GitHub Secrets.');
  process.exit(1);
}

async function analyzeAndScrape(url, name) {
  let browser;
  try {
    browser = await puppeteer.launch({
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

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });
    await page.authenticate({
      username: 'scraperapi',
      password: SCRAPERAPI_KEY
    });
    await page.setViewport({
      width: 1280,
      height: 800
    });

    // =========================================================
    // 1. NETZWERK-DIAGNOSE
    // =========================================================
    page.on('request', request => {
      const type = request.resourceType();
      if (type === 'xhr' || type === 'fetch') {
        console.log(`[REQUEST] ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', async response => {
      const request = response.request();
      const type = request.resourceType();
      const responseUrl = response.url();
      if (type !== 'xhr' && type !== 'fetch') {
        return;
      }
      console.log(`[RESPONSE] ${response.status()} ${request.method()} ${responseUrl}`);
      
      const interesting =
        responseUrl.toLowerCase().includes('history') ||
        responseUrl.toLowerCase().includes('portfolio') ||
        responseUrl.toLowerCase().includes('trade') ||
        responseUrl.toLowerCase().includes('system') ||
        responseUrl.toLowerCase().includes('data') ||
        responseUrl.toLowerCase().includes('api');
        
      if (!interesting) return;

      try {
        const contentType = response.headers()['content-type'] || '';
        console.log(`[NETZWERK-DETAIL] Content-Type: ${contentType}`);
        if (contentType.includes('json') || contentType.includes('text')) {
          const text = await response.text();
          console.log(`[NETZWERK-DATEN] ${text.substring(0, 2000)}`);
        }
      } catch (error) {
        console.log(`[NETZWERK-DATEN] Konnte Response nicht lesen: ${error.message}`);
      }
    });

    // =========================================================
    // 2. SEITE LADEN
    // =========================================================
    console.log(`\n========================================`);
    console.log(`${name}`);
    console.log(`========================================`);
    console.log(`Lade Webseite: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log(`Titel: "${await page.title()}"`);
    console.log(`URL: ${page.url()}`);
    await new Promise(resolve => setTimeout(resolve, 8000));

    // =========================================================
    // 3. DOM-DIAGNOSE
    // =========================================================
    const initialDebug = await page.evaluate(() => {
      return {
        title: document.title,
        url: location.href,
        bodyLength: document.body?.innerText?.length || 0,
        bodyText: document.body?.innerText?.substring(0, 5000) || '',
        tableCount: document.querySelectorAll('table').length,
        rowCount: document.querySelectorAll('tr').length,
        tabs: Array.from(document.querySelectorAll('a, button, [role="tab"], li'))
          .map(el => ({
            text: (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' '),
            href: el.getAttribute('href'),
            role: el.getAttribute('role'),
            className: el.className
          }))
          .filter(x => x.text)
          .slice(0, 100)
      };
    });
    
    console.log(`[DOM] bodyLength=${initialDebug.bodyLength}`);
    console.log(`[DOM] tables=${initialDebug.tableCount}, rows=${initialDebug.rowCount}`);
    console.log(`[DOM-TEXT] ${initialDebug.bodyText.substring(0, 2000)}`);
    console.log(`[TABS] ${JSON.stringify(initialDebug.tabs, null, 2)}`);

    // =========================================================
    // 4. HISTORY TAB FINDEN
    // =========================================================
    console.log('Suche History-Tab...');
    const clicked = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('a, button, [role="tab"], li'));
      const historyTab = candidates.find(el => {
        const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();
        return (
          text === 'history' ||
          text.startsWith('history (') ||
          text === 'historie' ||
          text === 'historique' ||
          text === 'historial'
        );
      });
      
      if (historyTab) {
        historyTab.click();
        return { found: true, text: (historyTab.innerText || historyTab.textContent || '').trim(), href: historyTab.getAttribute('href') };
      }
      const fallback = document.querySelector('a[href="#history"]');
      if (fallback) {
        fallback.click();
        return { found: true, text: 'fallback #history', href: '#history' };
      }
      return { found: false };
    });
    
    console.log(`[HISTORY] ${JSON.stringify(clicked)}`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // =========================================================
    // 6. DOM NACH HISTORY ERNEUT UNTERSUCHEN
    // =========================================================
    const afterHistory = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table')).map((table, index) => ({
        index,
        id: table.id,
        className: table.className,
        rows: table.querySelectorAll('tr').length,
        text: table.innerText.substring(0, 3000)
      }));
      return {
        bodyLength: document.body?.innerText?.length || 0,
        bodyText: document.body?.innerText?.substring(0, 10000) || '',
        tableCount: tables.length,
        rowCount: document.querySelectorAll('tr').length,
        tables
      };
    });
    
    console.log(`[AFTER HISTORY] bodyLength=${afterHistory.bodyLength}`);
    console.log(`[AFTER HISTORY] tables=${afterHistory.tableCount}, rows=${afterHistory.rowCount}`);
    console.log(`[AFTER HISTORY TEXT]\n${afterHistory.bodyText.substring(0, 5000)}`);
    console.log(`[TABLES]\n${JSON.stringify(afterHistory.tables, null, 2)}`);

    // =========================================================
    // 7. TRADE-DATEN AUS HTML-TABELLEN LESEN
    // =========================================================
    const trades = await page.evaluate(() => {
      const result = [];
      const rows = Array.from(document.querySelectorAll('tr'));
      
      for (const row of rows) {
        const cols = Array.from(row.querySelectorAll('td, th'))
          .map(cell => (cell.innerText || cell.textContent || '').trim().replace(/\s+/g, ' '))
          .filter(Boolean);
          
        if (cols.length === 0) continue;
        
        const actionIdx = cols.findIndex(col => /^(buy|sell)$/i.test(col));
        if (actionIdx === -1) continue;

        result.push({
          raw: cols,
          openDate: cols[actionIdx - 3] || '',
          closeDate: cols[actionIdx - 2] || '',
          symbol: cols[actionIdx - 1] || '',
          action: cols[actionIdx] || '',
          pips: cols[actionIdx + 6] || '',
          profit: cols[actionIdx + 7] || '',
          gain: cols[actionIdx + 9] || ''
        });
      }
      return result;
    });
    
    console.log(`${trades.length} mögliche Trades aus dem DOM geparst.`);

    // =========================================================
    // 8. SCREENSHOT + HTML FALLS NICHTS GEFUNDEN WIRD
    // =========================================================
    if (trades.length === 0) {
      const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      await page.screenshot({ path: `debug-${safeName}.png`, fullPage: true });
      fs.writeFileSync(`debug-${safeName}.html`, await page.content(), 'utf8');
      console.log(`[DEBUG] Screenshot gespeichert: debug-${safeName}.png`);
      console.log(`[DEBUG] HTML gespeichert: debug-${safeName}.html`);
    }
    await browser.close();
    return trades;
  } catch (error) {
    console.error(`Scraping-Fehler bei ${name}:`, error.message);
    if (browser) await browser.close();
    return [];
  }
}

async function getTradesWithRetry(url, name) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`\n--- ${name} (Versuch ${attempt}/3) ---`);
    const trades = await analyzeAndScrape(url, name);
    if (trades.length > 0) {
      console.log(`ERFOLG: ${trades.length} Trades gefunden.`);
      return trades;
    }
    if (attempt < 3) {
      console.log('Keine Trades gefunden. Neustart in 5 Sekunden...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
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
    fs.writeFileSync(path.join(targetDir, 'Sonic_TradesData.json'), JSON.stringify(sonicTrades, null, 2), 'utf8');
    console.log('Sonic_TradesData.json gespeichert.');
  } else {
    console.log('Sonic_TradesData.json NICHT überschrieben.');
  }
  
  if (neoTrades.length > 0) {
    fs.writeFileSync(path.join(targetDir, 'NEO_TradesData.json'), JSON.stringify(neoTrades, null, 2), 'utf8');
    console.log('NEO_TradesData.json gespeichert.');
  } else {
    console.log('NEO_TradesData.json NICHT überschrieben.');
  }
}

run();