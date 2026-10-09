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
            throw new Error("MyFXBook blockiert die Anfrage (Kein JSON). HTML: " + text.substring(0, 100));
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

        // 1. Zuerst die Account-Daten abrufen, um den aktuellen Kontostand (Balance) zu erhalten
        let accRes = await fetch(`https://www.myfxbook.com/api/get-my-accounts.json?session=${sessionToken}`);
        let accData = await accRes.json();

        // Wenn Session abgelaufen, neu einloggen
        if (accData.error === true) {
            console.log("Session abgelaufen, Login wird wiederholt...");
            await loginMyfxbook();
            accRes = await fetch(`https://www.myfxbook.com/api/get-my-accounts.json?session=${sessionToken}`);
            accData = await accRes.json();
        }

        let currentBalance = 1200; // Fallback
        if (accData.accounts) {
            const account = accData.accounts.find(a => a.id.toString() === accountId.toString());
            if (account && account.balance) {
                currentBalance = account.balance;
            }
        }

        // 2. Jetzt die Trade-Historie abrufen
        let response = await fetch(`https://www.myfxbook.com/api/get-history.json?session=${sessionToken}&id=${accountId}`);
        let data = await response.json();
        
        if (data.error === true) {
            throw new Error("MyFXBook API Fehler: " + data.message);
        }

        const rawList = data.history || data.trades || [];

        // 3. Trades filtern und die Prozentuale Rendite (Gain) mit dem echten Kontostand berechnen
        const cleanTrades = rawList
            .filter(t => {
                const action = (t.action || t.Action || '').toLowerCase();
                return action === 'buy' || action === 'sell';
            })
            .map(t => {
                let lots = t["Units/Lots"] || (t.sizing ? t.sizing.value : null) || t.lots || t.volume || 0;
                let profit = t["Profit"] !== undefined ? t["Profit"] : (t.profit || 0);
                let gain = t["Gain"] !== undefined ? t["Gain"] : (t.gain || null);

                // Berechnet die korrekte Prozentzahl, da MyFXBook API sie oft weglässt
                if (gain === null || gain === 0) {
                    gain = currentBalance > 0 ? (profit / currentBalance) * 100 : 0;
                }

                return {
                    "Open Date": t["Open Date"] || t.openTime || "",
                    "Close Date": t["Close Date"] || t.closeTime || "",
                    "Symbol": t["Symbol"] || t.symbol || "",
                    "Action": (t["Action"] || t.action || "").toUpperCase(),
                    "Units/Lots": lots,
                    "Open Price": t["Open Price"] !== undefined ? t["Open Price"] : t.openPrice,
                    "Close Price": t["Close Price"] !== undefined ? t["Close Price"] : t.closePrice,
                    "Profit": profit,
                    "Gain": gain
                };
            });

        res.json(cleanTrades);
    } catch (error) {
        console.error("API Fehler:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));