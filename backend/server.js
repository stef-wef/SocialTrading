const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

let sessionToken = null;

async function loginMyfxbook() {
    try {
        const email = encodeURIComponent(process.env.MYFXBOOK_EMAIL);
        const password = encodeURIComponent(process.env.MYFXBOOK_PASSWORD);
        const res = await fetch(`https://www.myfxbook.com/api/login.json?email=${email}&password=${password}`);
        
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text();
            throw new Error("MyFXBook blockiert die Anfrage (Kein JSON).");
        }

        const data = await res.json();
        if (data.error === false) {
            sessionToken = data.session;
            console.log("Myfxbook Login erfolgreich!");
        } else {
            console.error("Myfxbook Login Fehler:", data.message);
        }
    } catch (err) {
        console.error("Login-Verbindungsfehler:", err.message);
    }
}

// Wir filtern HIER nichts mehr heraus, damit das Frontend die Deposits für die %-Rechnung kennt!
function processTrades(rawList) {
    if (!Array.isArray(rawList)) return [];

    return rawList.map(t => ({
        ...t,
        "Open Date": t["Open Date"] || t.openTime || "",
        "Close Date": t["Close Date"] || t.closeTime || "",
        "Symbol": t["Symbol"] || t.symbol || "",
        "Action": (t["Action"] || t.action || "").toUpperCase(),
        "Units/Lots": t["Units/Lots"] || (t.sizing ? t.sizing.value : null) || t.lots || t.volume || 0,
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

        const accountId = req.query.id || '12249114'; 

        if (!sessionToken) {
             return res.status(500).json({ error: "Login bei MyFXBook ist fehlgeschlagen." });
        }

        let response = await fetch(`https://www.myfxbook.com/api/get-history.json?session=${sessionToken}&id=${accountId}`);
        
        let contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
             throw new Error("API-Antwort für History ist kein JSON.");
        }
        
        let data = await response.json();

        if (data.error === true) {
            await loginMyfxbook();
            response = await fetch(`https://www.myfxbook.com/api/get-history.json?session=${sessionToken}&id=${accountId}`);
            data = await response.json();
        }
        
        if (data.error === true) {
            throw new Error("MyFXBook API Fehler: " + data.message);
        }

        const rawList = data.history || data.trades || [];
        const cleanTrades = processTrades(rawList);

        res.json(cleanTrades);
    } catch (error) {
        console.error("API Fehler:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));