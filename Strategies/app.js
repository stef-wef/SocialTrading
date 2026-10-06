const translations = {
    de: {
        back: "Zurück",
        verifiedLive: "Verified by Myfxbook - Live",
        totalGain: "Gesamtrendite",
        maxDrawdown: "Max Drawdown",
        liveTradesKpi: "Live Trades",
        avgMonth: "Ø Monat",
        growthProj: "Wachstums-Projektion",
        projTitle: "Projektions-Engine",
        projSub: "Basierend auf dem verifizierten Durchschnitt von 1.14%, multipliziert mit 24x Hebelwirkung, abzüglich 30% Performance-Fee.",
        projDeposit: "Startkapital",
        projTopup: "Monatliches Top-Up",
        projMonths: "Laufzeit (Monate)",
        projAvgScen: "Szenario nach",
        monthsWord: "Monaten",
        fromWord: "Aus",
        investedWord: "investiert",
        projCons: "Konservativ",
        projOpt: "Optimistisch",
        projMilestones: "Meilensteine",
        btBadge: "Echte Historische Daten",
        btTitle: "Backtest-Engine",
        btSub: "Simuliert den Gewinnverlauf über historische Trades. Wähle Zeitraum, Startkapital und Gewinn-Modus.",
        btCapital: "Startkapital",
        btRiskLabel: "Risiko-Faktor (Hebel)",
        btStart: "Startdatum",
        btEnd: "Enddatum",
        btMode: "Gewinn-Modus",
        modeReinvest: "Täglich Reinvestieren (Zinseszins)",
        modePayout: "Auszahlen (Konstantes Kapital)",
        btSimBal: "Simuliertes Endguthaben",
        btProfit: "Gewinn",
        btGrowth: "Wachstum",
        tradeStats: "Trade Statistiken",
        totalTrades: "Total Trades",
        winningTrades: "Gewonnen",
        losingTrades: "Verloren",
        winRate: "Win Rate",
        ledgerTitle1: "Die komplette Trade-Historie,",
        ledgerTitle2: "Zeile für Zeile.",
        colDate: "Datum / Zeit",
        colAsset: "Asset / Typ",
        colProfit: "Profit %"
    },
    en: {
        back: "Back",
        verifiedLive: "Verified by Myfxbook - Live",
        totalGain: "Total Gain",
        maxDrawdown: "Max Drawdown",
        liveTradesKpi: "Live Trades",
        avgMonth: "Avg / Month",
        growthProj: "Growth Projection",
        projTitle: "Projection Engine",
        projSub: "Modeled from the verified MyFXBook average monthly return of 1.14%, amplified 24x by broker leverage, minus a 30% performance fee.",
        projDeposit: "Starting Deposit",
        projTopup: "Monthly Top-Up",
        projMonths: "Time Horizon (Months)",
        projAvgScen: "Scenario After",
        monthsWord: "Months",
        fromWord: "From",
        investedWord: "invested",
        projCons: "Conservative",
        projOpt: "Optimistic",
        projMilestones: "Milestones",
        btBadge: "Real Historical Data",
        btTitle: "Backtest Engine",
        btSub: "Simulates returns across historical trades. Select timeframe, capital, and mode.",
        btCapital: "Starting Capital",
        btRiskLabel: "Risk Multiplier (Leverage)",
        btStart: "Start Date",
        btEnd: "End Date",
        btMode: "Profit Mode",
        modeReinvest: "Daily Reinvest (Compound)",
        modePayout: "Daily Payout (Constant Capital)",
        btSimBal: "Simulated Balance",
        btProfit: "Profit",
        btGrowth: "Growth",
        tradeStats: "Trade Statistics",
        totalTrades: "Total Trades",
        winningTrades: "Wins",
        losingTrades: "Losses",
        winRate: "Win Rate",
        ledgerTitle1: "A live trade ledger,",
        ledgerTitle2: "line by line.",
        colDate: "Date / Time",
        colAsset: "Asset / Type",
        colProfit: "Profit %"
    }
};

class DualEngineApp {
    constructor() {
        this.rawTrades = [];
        this.btChart = null;
        this.currentLang = 'de';
        this.rates = { cons: 0.0588, avg: 0.19152, opt: 0.3528 };

        this.dom = {
            // Rechner 1
            projDepInput: document.getElementById('proj-deposit'),
            projDepSlider: document.getElementById('proj-deposit-slider'),
            projTopInput: document.getElementById('proj-topup'),
            projTopSlider: document.getElementById('proj-topup-slider'),
            projMoInput: document.getElementById('proj-months'),
            projMoSlider: document.getElementById('proj-months-slider'),
            projResMo: document.getElementById('proj-res-month'),
            projResBal: document.getElementById('proj-res-balance'),
            projResInv: document.getElementById('proj-res-invested'),
            projResMult: document.getElementById('proj-res-mult'),
            projConsBal: document.getElementById('proj-cons-balance'),
            projOptBal: document.getElementById('proj-opt-balance'),

            // Rechner 2
            btDepInput: document.getElementById('bt-capital'),
            btDepSlider: document.getElementById('bt-capital-slider'),
            btRiskInput: document.getElementById('bt-risk'),
            btRiskSlider: document.getElementById('bt-risk-slider'),
            btStart: document.getElementById('bt-start-date'),
            btEnd: document.getElementById('bt-end-date'),
            btMode: document.getElementById('bt-mode-select'),
            btResBal: document.getElementById('bt-res-balance'),
            btResProf: document.getElementById('bt-res-profit'),
            btResGrowth: document.getElementById('bt-res-growth'),

            // Stats & Tabelle
            statTotal: document.getElementById('stat-total'),
            statWins: document.getElementById('stat-wins'),
            statLosses: document.getElementById('stat-losses'),
            statWinrate: document.getElementById('stat-winrate'),
            kpiTrades: document.getElementById('kpi-trades'),
            tradesBody: document.getElementById('trades-table-body'),
            langToggle: document.getElementById('langToggle')
        };

        this.init();
    }

    async init() {
        if (this.dom.langToggle) {
            this.dom.langToggle.addEventListener('click', () => {
                this.currentLang = this.currentLang === 'de' ? 'en' : 'de';
                this.dom.langToggle.innerText = this.currentLang === 'de' ? 'EN' : 'DE';
                this.applyTranslations();
            });
        }
        this.applyTranslations();

        // Asynchrones Laden der JSON-Daten aus dem Data Ordner
        await this.loadTradesData();

        if (!this.dom.projDepInput) return;

        // Start und Enddatum für den Backtest automatisch belegen
        if (this.rawTrades.length > 0) {
            this.dom.btStart.value = this.rawTrades[0].dt;
            this.dom.btEnd.value = this.rawTrades[this.rawTrades.length - 1].dt;
        }

        this.setupListeners();
        this.initBacktestChart();
        this.calcProjection();
        this.renderStatsAndTable();
        this.calcBacktest();
    }

    async loadTradesData() {
        try {
            // Lade die genaue Datei aus dem Ordner, der im Screenshot referenziert ist
            const response = await fetch('../data/trades_data_2.json');
            const data = await response.json();
            
            // Die Trades sind meistens aktuellste zuerst (Index 0 = z.B. 2026), 
            // für die Backtest Kurve brauchen wir sie chronologisch aufsteigend (älteste zuerst).
            this.rawTrades = data.map(t => {
                const dateString = t["Open Date"] || "";
                let dt = "2024-01-01"; 
                let d = "01.01.2024";

                if (dateString) {
                    const datePart = dateString.split(" ")[0]; // "10/02/2026"
                    const parts = datePart.split("/");
                    if(parts.length === 3) {
                        const MM = parts[0].padStart(2, '0');
                        const DD = parts[1].padStart(2, '0');
                        const YYYY = parts[2];
                        dt = `${YYYY}-${MM}-${DD}`; // Datumsformat für HTML input type=date
                        d = `${DD}.${MM}.${YYYY} ${dateString.split(" ")[1] || ''}`; // Format für Tabelle
                    }
                }

                return {
                    ...t,
                    dt: dt,
                    d: d
                };
            }).reverse();

        } catch (e) {
            console.error("Trades konnten nicht geladen werden. Läuft das Projekt über einen lokalen Server?", e);
            this.rawTrades = [];
        }
    }

    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[this.currentLang] && translations[this.currentLang][key]) {
                el.innerText = translations[this.currentLang][key];
            }
        });
    }

    formatMoney(amount) {
        return '$' + Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    }

    setupListeners() {
        const syncSliderInput = (slider, input, callback) => {
            slider.addEventListener('input', () => { input.value = slider.value; callback(); });
            input.addEventListener('input', () => {
                let val = parseFloat(input.value) || 0;
                slider.value = val;
                callback();
            });
        };

        // Rechner 1
        syncSliderInput(this.dom.projDepSlider, this.dom.projDepInput, () => this.calcProjection());
        syncSliderInput(this.dom.projTopSlider, this.dom.projTopInput, () => this.calcProjection());
        syncSliderInput(this.dom.projMoSlider, this.dom.projMoInput, () => this.calcProjection());

        // Rechner 2
        syncSliderInput(this.dom.btDepSlider, this.dom.btDepInput, () => this.calcBacktest());
        syncSliderInput(this.dom.btRiskSlider, this.dom.btRiskInput, () => this.calcBacktest());
        this.dom.btStart.addEventListener('change', () => this.calcBacktest());
        this.dom.btEnd.addEventListener('change', () => this.calcBacktest());
        this.dom.btMode.addEventListener('change', () => this.calcBacktest());
    }

    // --- RECHNER 1: PROJEKTION ---
    simulateProj(deposit, topup, months, rate) {
        let balance = deposit;
        let invested = deposit;
        for (let m = 1; m <= months; m++) {
            balance = balance * (1 + rate);
            if (m < months) { balance += topup; invested += topup; }
        }
        return { balance, invested };
    }

    calcProjection() {
        let deposit = parseFloat(this.dom.projDepInput.value) || 0;
        let topup = parseFloat(this.dom.projTopInput.value) || 0;
        let months = parseInt(this.dom.projMoInput.value) || 0;

        this.dom.projResMo.innerText = months;

        let resAvg = this.simulateProj(deposit, topup, months, this.rates.avg);
        let resCons = this.simulateProj(deposit, topup, months, this.rates.cons);
        let resOpt = this.simulateProj(deposit, topup, months, this.rates.opt);

        let multiplier = resAvg.invested > 0 ? (resAvg.balance / resAvg.invested).toFixed(1) : 0;

        this.dom.projResBal.innerText = this.formatMoney(resAvg.balance);
        this.dom.projResInv.innerText = this.formatMoney(resAvg.invested);
        this.dom.projResMult.innerText = multiplier + 'x';

        this.dom.projConsBal.innerText = this.formatMoney(resCons.balance);
        this.dom.projOptBal.innerText = this.formatMoney(resOpt.balance);

        [1, 3, 6, 12].forEach(m => {
            let avgM = this.simulateProj(deposit, topup, m, this.rates.avg).balance;
            const elAvg = document.getElementById(`ms${m}-avg`);
            if (elAvg) elAvg.innerText = this.formatMoney(avgM);
        });
    }

    // --- RECHNER 2: BACKTEST (HISTORISCHE TRADES) ---
    initBacktestChart() {
        const canvas = document.getElementById('backtestChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let gradient = ctx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, 'rgba(52, 211, 153, 0.25)');
        gradient.addColorStop(1, 'rgba(52, 211, 153, 0.0)');

        Chart.defaults.font.family = "'JetBrains Mono', monospace";
        Chart.defaults.color = '#64748B';

        this.btChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    borderColor: '#34D399',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#040914',
                    pointBorderColor: '#34D399',
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0A101C',
                        titleColor: '#94A3B8',
                        bodyColor: '#FFFFFF',
                        borderColor: '#1A2436',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => '$' + ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.02)' }, ticks: { maxTicksLimit: 6 } },
                    y: {
                        position: 'right',
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        border: { dash: [4, 4] },
                        ticks: {
                            maxTicksLimit: 6,
                            callback: (val) => val >= 1000 ? '$' + (val / 1000).toFixed(1) + 'k' : '$' + val
                        }
                    }
                },
                interaction: { mode: 'index', intersect: false }
            }
        });
    }

    calcBacktest() {
        if (!this.rawTrades || this.rawTrades.length === 0) return;

        let capital = parseFloat(this.dom.btDepInput.value) || 10000;
        let riskMult = parseFloat(this.dom.btRiskInput.value) || 1; // Der neue Risiko-Faktor
        let mode = this.dom.btMode.value;

        let startStr = this.dom.btStart.value || '2024-01-01';
        let endStr = this.dom.btEnd.value || '2099-12-31';

        // Filter nach Zeitraum
        let filteredTrades = this.rawTrades.filter(t => t.dt >= startStr && t.dt <= endStr);

        let currentBalance = capital;
        let totalPayouts = 0;

        let labels = [startStr];
        let dataPoints = [capital];

        filteredTrades.forEach((t, i) => {
            // Gain berechnen unter Berücksichtigung des gewählten Risiko-Faktors
            let gainPercent = parseFloat(t["Gain"] || 0) * riskMult;
            let tradeProfit = currentBalance * (gainPercent / 100);

            if (mode === 'reinvest') {
                currentBalance += tradeProfit;
                dataPoints.push(currentBalance);
            } else {
                totalPayouts += tradeProfit;
                dataPoints.push(capital + totalPayouts);
            }

            if (i % 15 === 0 || i === filteredTrades.length - 1) {
                labels.push(t.d.split(" ")[0]); // Nur das Datum fürs Chart
            } else {
                labels.push('');
            }
        });

        let finalBalance = mode === 'reinvest' ? dataPoints[dataPoints.length - 1] : capital;
        let netProfit = mode === 'reinvest' ? (finalBalance - capital) : totalPayouts;
        let growth = capital > 0 ? (netProfit / capital) * 100 : 0;

        this.dom.btResBal.innerText = '$' + finalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.dom.btResProf.innerText = (netProfit >= 0 ? '+' : '') + '$' + netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.dom.btResGrowth.innerText = (growth >= 0 ? '+' : '') + growth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

        if (this.btChart) {
            this.btChart.data.labels = labels;
            this.btChart.data.datasets[0].data = dataPoints;
            this.btChart.update();
        }
    }

    // --- STATISTIKEN & HISTORIE TABELLE ---
    renderStatsAndTable() {
        if (!this.rawTrades || this.rawTrades.length === 0) return;

        let wins = 0;
        let losses = 0;
        let activeTrades = 0;

        this.rawTrades.forEach(t => {
            const action = (t["Action"] || "").toLowerCase();
            // Ein- und Auszahlungen ignorieren
            if(action === 'buy' || action === 'sell') {
                activeTrades++;
                if (parseFloat(t["Gain"] || 0) >= 0) wins++;
                else losses++;
            }
        });

        let total = wins + losses;
        let winRate = total > 0 ? ((wins / total) * 100).toFixed(2) : '0.00';

        if (this.dom.statTotal) this.dom.statTotal.innerText = activeTrades;
        if (this.dom.kpiTrades) this.dom.kpiTrades.innerText = activeTrades;
        if (this.dom.statWins) this.dom.statWins.innerText = wins;
        if (this.dom.statLosses) this.dom.statLosses.innerText = losses;
        if (this.dom.statWinrate) this.dom.statWinrate.innerText = winRate + '%';

        if (!this.dom.tradesBody) return;

        // Tabelle von neustem Datum zu ältestem
        let html = '';
        const reversedTrades = [...this.rawTrades].reverse();

        reversedTrades.forEach(t => {
            const action = (t["Action"] || "").toUpperCase();
            if(action !== 'BUY' && action !== 'SELL') return; // Deposits/Withdrawals ausblenden

            const gainVal = parseFloat(t["Gain"] || 0);
            const isProfit = gainVal >= 0;
            const profitClass = isProfit ? 'text-emerald-400' : 'text-rose-400';
            
            const badgeClass = action === 'BUY' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

            const typeBadge = `<span class="px-2 py-0.5 rounded border font-bold ${badgeClass}">${action}</span> <span class="ml-2 text-zinc-400 text-[10px]">${t["Symbol"] || 'XAUUSD'}</span>`;
            
            // Reale Daten aus der JSON verwenden
            const openPrice = t["Open Price"] !== undefined ? t["Open Price"] : '-';
            const closePrice = t["Close Price"] !== undefined ? t["Close Price"] : '-';
            const priceFlow = `${openPrice} &rarr; ${closePrice}`;
            const duration = t["Duration (DD:HH:MM:SS)"] || '-';
            const pips = t["Pips"] !== undefined ? t["Pips"] : '-';

            html += `
                <tr class="hover:bg-cardBorder/30 transition-colors">
                    <td class="px-6 py-3.5 text-zinc-400">${t.d}</td>
                    <td class="px-6 py-3.5 font-semibold">${typeBadge}</td>
                    <td class="px-6 py-3.5 text-zinc-400">${priceFlow}</td>
                    <td class="px-6 py-3.5 text-zinc-400">${duration}</td>
                    <td class="px-6 py-3.5 text-zinc-400">${pips}</td>
                    <td class="px-6 py-3.5 text-right font-bold ${profitClass}">${isProfit ? '+' : ''}${gainVal.toFixed(2)}%</td>
                </tr>
            `;
        });

        this.dom.tradesBody.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DualEngineApp();
});