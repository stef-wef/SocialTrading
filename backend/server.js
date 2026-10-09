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

// Filtert Ein- und Auszahlungen heraus und mappt Felder auf das Format von app.js
function processTrades(rawList) {
    if (!Array.isArray(rawList)) return [];

    return rawList
        .filter(t => {
            const action = (t.action || t.Action || '').toLowerCase();
            // Nur Buy und Sell behalten; Deposit und Withdrawal werden verworfen
            return action === 'buy' || action === 'sell';
        })
        .map(t => ({
            ...t,
            "Open Date": t["Open Date"] || t.openTime || "",
            "Close Date": t["Close Date"] || t.closeTime || "",
            "Symbol": t["Symbol"] || t.symbol || "",
            "Action": (t["Action"] || t.action || "").toUpperCase(),
            "Units/Lots": t["Units/Lots"] || (t.sizing ? t.sizing.value : null) || t.lots || 0,
            "Open Price": t["Open Price"] !== undefined ? t["Open Price"] : t.openPrice,
            "Close Price": t["Close Price"] !== undefined ? t["Close Price"] : t.closePrice,
            "Profit": t["Profit"] !== undefined ? t["Profit"] : t.profit,
            "Gain": t["Gain"] !== undefined ? t["Gain"] : (t.gain || 0)
        }));
}

app.get('/', (req, res) => {
    res.send('TAG Markets Backend läuft erfolgreich! API erreichbar unter /api/live-trades');
});

app.get('/api/live-trades', async (req, res) => {
    try {
        if (!sessionToken) await loginMyfxbook();

        // Nutzt primär deine NEUE Sonic Account ID
        const accountId = req.query.id || '12249114'; 

        let response = await fetch(`https://www.myfxbook.com/api/get-history.json?session=${sessionToken}&id=${accountId}`);
        let data = await response.json();

        // Session abgelaufen? Erneut anmelden und Request wiederholen
        if (data.error === true) {
            console.log("Session abgelaufen, Login wird wiederholt...");
            await loginMyfxbook();
            response = await fetch(`https://www.myfxbook.com/api/get-history.json?session=${sessionToken}&id=${accountId}`);
            data = await response.json();
        }

        const rawList = data.history || data.trades || [];
        const cleanTrades = processTrades(rawList);

        res.json(cleanTrades);
    } catch (error) {
        console.error("API Fehler:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));