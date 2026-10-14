const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 Minuten

const STRATEGIES = {
    sonic: {
        id: process.env.MYFXBOOK_SONIC_ID || process.env.MYFXBOOK_ACCOUNT_ID || '12249114',
        symbol: 'XAUUSD',
        baseBalance: 1200.52,
        baseLots: 0.001,
        maxNormalLots: 0.005
    },
    neofx: {
        id: process.env.MYFXBOOK_NEO_ID || '12258114',
        symbol: 'EURUSD',
        baseBalance: 12000.00,
        baseLots: 0.10,
        maxNormalLots: 0.50
    }
};

let sessionToken = null;
let cachedTrades = {
    sonic: [],
    neofx: []
};
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

function processTrades(rawList, config) {
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

            if (gain === 0 && profit !== 0) {
                const normalizedProfit = (lots > config.maxNormalLots)
                    ? (profit / lots) * config.baseLots
                    : profit;
                gain = (normalizedProfit / config.baseBalance) * 100;
            }

            return {
                "Open Date": t["Open Date"] || t.openTime || "",
                "Close Date": t["Close Date"] || t.closeTime || "",
                "Symbol": t["Symbol"] || t.symbol || config.symbol,
                "Action": (t["Action"] || t.action || "").toUpperCase(),
                "Units/Lots": lots,
                "Open Price": t["Open Price"] !== undefined ? t["Open Price"] : t.openPrice,
                "Close Price": t["Close Price"] !== undefined ? t["Close Price"] : t.closePrice,
                "Profit": profit,
                "Gain": gain
            };
        });
}

async function fetchAccountHistory(accountId) {
    let response = await fetch(`https://www.myfxbook.com/api/get-history.json?session=${sessionToken}&id=${accountId}`);
    let data = await response.json();

    if (data.error === true) {
        console.log("Session abgelaufen, Login wird wiederholt...");
        const loggedIn = await loginMyfxbook();
        if (!loggedIn) return null;

        response = await fetch(`https://www.myfxbook.com/api/get-history.json?session=${sessionToken}&id=${accountId}`);
        data = await response.json();
    }

    if (data && data.error === false) {
        return data.history || data.trades || [];
    }

    console.error(`MyFXBook API Fehler (Account ${accountId}):`, data ? data.message : 'Unbekannt');
    return null;
}

async function updateTradesBackground() {
    console.log("Starte Hintergrund-Sync mit MyFXBook...");
    try {
        if (!sessionToken) {
            const loggedIn = await loginMyfxbook();
            if (!loggedIn) return;
        }

        for (const [key, config] of Object.entries(STRATEGIES)) {
            const rawList = await fetchAccountHistory(config.id);
            if (rawList) {
                cachedTrades[key] = processTrades(rawList, config);
                console.log(`[${key.toUpperCase()}] ${cachedTrades[key].length} Trades geladen.`);
            }
        }

        lastSyncTime = new Date().toISOString();
    } catch (error) {
        console.error("Hintergrund-Sync Fehler:", error.message);
    }
}

app.get('/', (req, res) => {
    res.send('TAG Markets Backend läuft erfolgreich! API erreichbar unter /api/live-trades');
});

app.get('/api/live-trades', async (req, res) => {
    if (cachedTrades.sonic.length === 0 && cachedTrades.neofx.length === 0) {
        await updateTradesBackground();
    }

    const strat = (req.query.strategy || '').toLowerCase();
    if (strat === 'neofx' || strat === 'neo') {
        return res.json({
            lastSync: lastSyncTime,
            trades: cachedTrades.neofx
        });
    }
    if (strat === 'sonic') {
        return res.json({
            lastSync: lastSyncTime,
            trades: cachedTrades.sonic
        });
    }

    res.json({
        lastSync: lastSyncTime,
        trades: cachedTrades.sonic,
        sonic: cachedTrades.sonic,
        neofx: cachedTrades.neofx
    });
});

updateTradesBackground();
setInterval(updateTradesBackground, SYNC_INTERVAL_MS);

app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));