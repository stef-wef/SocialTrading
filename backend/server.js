const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

// CORS für alle Ursprünge erlauben, damit dein Frontend zugreifen kann
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

let sessionToken = null;

async function loginMyfxbook() {
    try {
        const res = await fetch(`https://www.myfxbook.com/api/login.json?email=${process.env.MYFXBOOK_EMAIL}&password=${process.env.MYFXBOOK_PASSWORD}`);
        const data = await res.json();
        if (data.error === false) {
            sessionToken = data.session;
            console.log("Myfxbook Login erfolgreich!");
        } else {
            console.error("Myfxbook Login Fehler:", data.message);
        }
    } catch (err) {
        console.error("Login-Verbindungsfehler:", err);
    }
}

app.get('/api/live-trades', async (req, res) => {
    try {
        if (!sessionToken) await loginMyfxbook();

        const response = await fetch(`https://www.myfxbook.com/api/get-history.json?session=${sessionToken}&id=12076857`);
        const data = await response.json();

        if (data.error === true) {
            // Session abgelaufen? Erneut versuchen
            await loginMyfxbook();
            const retryRes = await fetch(`https://www.myfxbook.com/api/get-history.json?session=${sessionToken}&id=12076857`);
            const retryData = await retryRes.json();
            return res.json(retryData.history || []);
        }

        res.json(data.history || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));