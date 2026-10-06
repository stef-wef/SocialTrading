const EMAIL = process.env.MYFXBOOK_EMAIL;
const PASSWORD = process.env.MYFXBOOK_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Fehlende Umgebungsvariablen.');
  process.exit(1);
}

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

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

    console.log('Frage alle verknüpften Konten ab...');
    const accUrl = `https://www.myfxbook.com/api/get-my-accounts.json?session=${session}`;
    const accRes = await fetch(accUrl, { headers });
    const accData = await accRes.json();

    console.log('=== GEFUNDENE MYFXBOOK KONTEN ===');
    if (accData.accounts && accData.accounts.length > 0) {
      accData.accounts.forEach((acc) => {
        console.log(`Name: "${acc.name}" --> ID: ${acc.id}`);
      });
    } else {
      console.log('Keine Konten gefunden. Rückgabe:', JSON.stringify(accData));
    }
    console.log('=================================');

    await fetch(`https://www.myfxbook.com/api/logout.json?session=${session}`, { headers });
  } catch (error) {
    console.error('Fehler:', error);
    process.exit(1);
  }
}

run();