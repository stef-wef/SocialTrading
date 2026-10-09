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

function processTrades(rawList) {
    if (!Array.isArray(rawList)) return [];

    return rawList
        .filter(t => {
            const action = (t.action || t.Action || '').toLowerCase();
            return action.startsWith('buy') || action.startsWith('sell');
        })
        .map(t => {
            let lots = t["Units/Lots"] || (t.sizing ? t.sizing.value : null) || t.lots || t.volume || 0;
            let profit = parseFloat(t["Profit"] !== undefined ? t["Profit"] : (t.profit || 0));
            let gain = t["Gain"] !== undefined ? parseFloat(t["Gain"]) : (t.gain !== undefined ? parseFloat(t.gain) : 0);

            if (gain === 0 && profit !== 0) {
                gain = (profit / 1200.52) * 100;
            }

            return {
                "Open Date": t["Open Date"] || t.openTime || "",
                "Close Date": t["Close Date"] || t.closeTime || "",
                "Symbol": t["Symbol"] || t.symbol || "XAUUSD",
                "Action": (t["Action"] || t.action || "").toUpperCase(),
                "Units/Lots": lots,
                "Open Price": t["Open Price"] !== undefined ? t["Open Price"] : t.openPrice,
                "Close Price": t["Close Price"] !== undefined ? t["Close Price"] : t.closePrice,
                "Profit": profit,
                "Gain": gain
            };
        });
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
        let data = await response.json();

        if (data.error === true) {
            console.log("Session abgelaufen, Login wird wiederholt...");
            await loginMyfxbook();
            response = await fetch(`https://www.myfxbook.com/api/get-history.json?session=${sessionToken}&id=${accountId}`);
            data = await response.json();
        }

        if (data.error === true) {
            throw new Error("MyFXBook API Fehler: " + data.message);
        }

        const rawList = data.history || data.trades || [];
        res.json(processTrades(rawList));
    } catch (error) {
        console.error("API Fehler:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));