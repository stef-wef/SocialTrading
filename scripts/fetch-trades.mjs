import fs from 'fs';
import path from 'path';

const EMAIL = process.env.MYFXBOOK_EMAIL;
const PASSWORD = process.env.MYFXBOOK_PASSWORD;
const ACCOUNT_ID_1 = process.env.MYFXBOOK_ACCOUNT_ID_1;
const ACCOUNT_ID_2 = process.env.MYFXBOOK_ACCOUNT_ID_2;

if (!EMAIL || !PASSWORD || !ACCOUNT_ID_1) {
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
    // 1. Login
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

    // 2. Historie beider Accounts laden
    console.log('Lade Daten für Account 1...');
    const trades1 = await fetchAccountHistory(session, ACCOUNT_ID_1);

    let trades2 = [];
    if (ACCOUNT_ID_2) {
      console.log('Lade Daten für Account 2...');
      trades2 = await fetchAccountHistory(session, ACCOUNT_ID_2);
    }

    // 3. Logout
    await fetch(`https://www.myfxbook.com/api/logout.json?session=${session}`, { headers });

    // 4. In public/trades.json speichern
    const output = {
      lastUpdated: new Date().toISOString(),
      strategy1: trades1,
      strategy2: trades2,
    };

    const targetDir = path.resolve(process.cwd(), 'public');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filePath = path.join(targetDir, 'trades.json');
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`Erfolgreich gespeichert in: ${filePath}`);
  } catch (error) {
    console.error('Fehler beim Abrufen der Trades:', error);
    process.exit(1);
  }
}

run();