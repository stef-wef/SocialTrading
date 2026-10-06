import fs from 'fs';
import path from 'path';

const EMAIL = process.env.MYFXBOOK_EMAIL;
const PASSWORD = process.env.MYFXBOOK_PASSWORD;
const SONIC_ACCOUNT_ID = process.env.MYFXBOOK_ACCOUNT_ID_1; // Sonic Strategy
const NEO_ACCOUNT_ID = process.env.MYFXBOOK_ACCOUNT_ID_2;   // Neo Strategy

if (!EMAIL || !PASSWORD || !SONIC_ACCOUNT_ID) {
  console.error('Fehlende Umgebungsvariablen.');
  process.exit(1);
}

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function fetchAccountHistory(session, accountId) {
  if (!accountId) return [];
  const url = `https://www.myfxbook.com/api/get-history.json?session=${session}&id=${accountId}`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  if (data.error) {
    console.warn(`Fehler bei Account ${accountId}:`, data.message);
    return [];
  }
  return data.history || [];
}

async function run() {
  try {
    console.log('Logge bei Myfxbook ein...');
    const loginUrl = `https://www.myfxbook.com/api/login.json?email=${encodeURIComponent(
      EMAIL
    )}&password=${encodeURIComponent(PASSWORD)}`;
    const loginRes = await fetch(loginUrl, { headers });
    const loginData = await loginRes.json();

    if (loginData.error || !loginData.session) {
      throw new Error(loginData.message || 'Login fehlgeschlagen');
    }

    const session = loginData.session;

    const targetDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. Sonic Trades holen und speichern
    console.log('Lade Daten für Sonic...');
    const sonicTrades = await fetchAccountHistory(session, SONIC_ACCOUNT_ID);
    const sonicPath = path.join(targetDir, 'Sonic_TradesData.json');
    fs.writeFileSync(sonicPath, JSON.stringify(sonicTrades, null, 2), 'utf-8');
    console.log(`Sonic gespeichert in: ${sonicPath}`);

    // 2. NEO Trades holen und speichern (falls Secret vorhanden)
    if (NEO_ACCOUNT_ID) {
      console.log('Lade Daten für NEO...');
      const neoTrades = await fetchAccountHistory(session, NEO_ACCOUNT_ID);
      const neoPath = path.join(targetDir, 'NEO_TradesData.json');
      fs.writeFileSync(neoPath, JSON.stringify(neoTrades, null, 2), 'utf-8');
      console.log(`NEO gespeichert in: ${neoPath}`);
    }

    // Logout
    await fetch(`https://www.myfxbook.com/api/logout.json?session=${session}`, { headers });
    console.log('Erfolgreich abgeschlossen.');
  } catch (error) {
    console.error('Fehler beim Abrufen der Trades:', error);
    process.exit(1);
  }
}

run();