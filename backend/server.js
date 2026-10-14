const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const ACCOUNT_ID = process.env.MYFXBOOK_ACCOUNT_ID || '12249114';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 Minuten

// Referenzwerte für den 1x Basis-Account
const BASE_REFERENCE_BALANCE = 1200.52;
const BASE_REFERENCE_LOTS = 0.001;

let sessionToken = null;
let cachedTrades = [];
let lastSyncTime = null;

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

async function loginMyfxbook() {
    try {
        const email = encodeURIComponent(process.env.MYFXBOOK_EMAIL);
        const password = encodeURIComponent(process.env.MYFXBOOK_PASSWORD);
        const res = await fetch(`https://www.myfxbook.com/api/login.json?email=${email}&password=${password}`);
        const data = await res.json();

        if (data.error === false) {
            sessionToken = data.session;
            console.log("Myfxbook Login erfolgreich!");
            return true;
        } else {
            console.error("Myfxbook Login Fehler:", data.message);
            return false;
        }
    } catch (err) {
        console.error("Login-Verbindungsfehler:", err.message);
        return false;
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
            const rawLots = t["Units/Lots"] || (t.sizing ? t.sizing.value : null) || t.lots || t.volume || 0;
            const lots = parseFloat(rawLots) || 0;
            const profit = parseFloat(t["Profit"] !== undefined ? t["Profit"] : (t.profit || 0));
            let gain = t["Gain"] !== undefined ? parseFloat(t["Gain"]) : (t.gain !== undefined ? parseFloat(t.gain) : 0);

            // Fallback: 1x Basis-Gain berechnen, falls MyFXBook 0 sendet
            if (gain === 0 && profit !== 0) {
                // Falls ein Trade mit deutlich höherer Lot-Grösse (> 0.005 Lots) ausgeführt wurde,
                // auf die 1x-Basis-Lotgrösse (0.001 Lots) normieren, um doppelte Hebelung zu verhindern
                const normalizedProfit = (lots > 0.005)
                    ? (profit / lots) * BASE_REFERENCE_LOTS
                    : profit;
                gain = (normalizedProfit / BASE_REFERENCE_BALANCE) * 100;
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

async function updateTradesBackground() {
    console.log("Starte Hintergrund-Sync mit MyFXBook...");
    try {
        if (!sessionToken) {
            const loggedIn = await loginMyfxbook();
            if (!loggedIn) return;
        }

        let response = await fetch(`https://www.myfxbook.com/api/get-history.json?session=${sessionToken}&id=${ACCOUNT_ID}`);
        let data = await response.json();

        // Wenn die Session abgelaufen ist, erneut einloggen
        if (data.error === true) {
            console.log("Session abgelaufen, Login wird wiederholt...");
            const loggedIn = await loginMyfxbook();
            if (!loggedIn) return;

            response = await fetch(`https://www.myfxbook.com/api/get-history.json?session=${sessionToken}&id=${ACCOUNT_ID}`);
            data = await response.json();
        }

        if (data.error === false) {
            const rawList = data.history || data.trades || [];
            cachedTrades = processTrades(rawList);
            lastSyncTime = new Date().toISOString();
            console.log(`Daten erfolgreich synchronisiert. ${cachedTrades.length} Trades geladen um ${lastSyncTime}.`);
        } else {
            console.error("MyFXBook API Fehler:", data.message);
        }
    } catch (error) {
        console.error("Hintergrund-Sync Fehler:", error.message);
    }
}

app.get('/', (req, res) => {
    res.send('TAG Markets Backend läuft erfolgreich! API erreichbar unter /api/live-trades');
});

app.get('/api/live-trades', async (req, res) => {
    if (cachedTrades.length === 0) {
        await updateTradesBackground();
    }
    
    res.json({
        lastSync: lastSyncTime,
        trades: cachedTrades
    });
});

updateTradesBackground();
setInterval(updateTradesBackground, SYNC_INTERVAL_MS);

app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));