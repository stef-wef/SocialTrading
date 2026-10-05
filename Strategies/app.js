// --- i18n Dictionary ---
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
        btSub: "Simuliert Gewinne basierend auf allen vergangenen Trades. Gib dein Startkapital ein und wähle den Gewinn-Modus.",
        btCapital: "Startkapital",
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
        colDate: "Datum",
        colType: "Typ",
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
        btSub: "Simulates returns based on all exact historical trades. Input your capital and select the profit mode.",
        btCapital: "Starting Capital",
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
        colDate: "Date",
        colType: "Type",
        colProfit: "Profit %"
    }
};

class DualEngineApp {
    constructor() {
        this.rawTrades = []; 
        this.projChart = null;
        this.btChart = null;
        this.currentLang = 'de';
        
        this.rates = { cons: 0.0588, avg: 0.19152, opt: 0.3528 };
        
        this.dom = {
            // Projection UI
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

            // Backtest UI
            btDepInput: document.getElementById('bt-capital'),
            btDepSlider: document.getElementById('bt-capital-slider'),
            btMode: document.getElementById('bt-mode-select'),
            btResBal: document.getElementById('bt-res-balance'),
            btResProf: document.getElementById('bt-res-profit'),
            btResGrowth: document.getElementById('bt-res-growth'),

            // Stats & Table UI
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

    init() {
        if(this.dom.langToggle) {
            this.dom.langToggle.addEventListener('click', () => {
                this.currentLang = this.currentLang === 'de' ? 'en' : 'de';
                this.dom.langToggle.innerText = this.currentLang === 'de' ? 'EN' : 'DE';
                this.applyTranslations();
            });
        }
        this.applyTranslations();

        if (!this.dom.projDepInput) return; // Nur wenn Rechner geladen ist

        this.setupListeners();
        this.initCharts();
        this.calcProjection();
        this.loadTrades(); 
    }

    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if(translations[this.currentLang] && translations[this.currentLang][key]) {
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
                let val = parseInt(input.value) || 0; 
                slider.value = val; 
                callback(); 
            });
        };

        // Projection 
        syncSliderInput(this.dom.projDepSlider, this.dom.projDepInput, () => this.calcProjection());
        syncSliderInput(this.dom.projTopSlider, this.dom.projTopInput, () => this.calcProjection());
        syncSliderInput(this.dom.projMoSlider, this.dom.projMoInput, () => this.calcProjection());

        // Backtest (Kein Datum mehr!)
        syncSliderInput(this.dom.btDepSlider, this.dom.btDepInput, () => this.calcBacktest());
        this.dom.btMode.addEventListener('change', () => this.calcBacktest());
    }

    initCharts() {
        Chart.defaults.font.family = "'JetBrains Mono', monospace";
        Chart.defaults.color = '#64748B';

        const createChart = (canvasId, color, gStart, gEnd) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return null;
            const ctx = canvas.getContext('2d');
            let gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, gStart); gradient.addColorStop(1, gEnd);

            return new Chart(ctx, {
                type: 'line',
                data: { labels: [], datasets: [{ 
                    data: [], borderColor: color, backgroundColor: gradient, 
                    borderWidth: 2, pointRadius: 0, pointHoverRadius: 6,
                    pointBackgroundColor: '#040914', pointBorderColor: color, pointBorderWidth: 2,
                    fill: true, tension: 0.1 
                }]},
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#0A101C', titleColor: '#94A3B8', bodyColor: '#FFFFFF',
                            borderColor: '#1A2436', borderWidth: 1, padding: 12, displayColors: false,
                            callbacks: { label: (ctx) => '$' + ctx.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) }
                        }
                    },
                    scales: {
                        x: { grid: { color: 'rgba(255, 255, 255, 0.02)', drawBorder: false }, ticks: { maxTicksLimit: 6 } },
                        y: { position: 'right', grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false }, border: { dash: [4, 4] },
                             ticks: { maxTicksLimit: 6, callback: (val) => val >= 1000 ? '$' + (val/1000).toFixed(1) + 'k' : '$' + val }
                        }
                    },
                    interaction: { mode: 'index', intersect: false }
                }
            });
        };

        this.projChart = createChart('projectionChart', '#00E5FF', 'rgba(0, 229, 255, 0.2)', 'rgba(0, 229, 255, 0.0)');
        this.btChart = createChart('backtestChart', '#34D399', 'rgba(52, 211, 153, 0.2)', 'rgba(52, 211, 153, 0.0)');
    }

    // --- PROJECTION LOGIC ---
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

        this.dom.projResAvgBal.innerText = this.formatMoney(resAvg.balance);
        this.dom.projResInv.innerText = this.formatMoney(resAvg.invested);
        this.dom.projResMult.innerText = multiplier + 'x';
        this.dom.projResMult.className = multiplier >= 1 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold";

        this.dom.projConsBal.innerText = this.formatMoney(resCons.balance);
        this.dom.projOptBal.innerText = this.formatMoney(resOpt.balance);

        let pLabels = ['0']; let pData = [deposit];
        let curr = deposit;
        for (let m = 1; m <= months; m++) {
            curr = curr * (1 + this.rates.avg);
            if (m < months) curr += topup;
            pLabels.push(m.toString());
            pData.push(curr);
        }

        if (this.projChart) {
            this.projChart.data.labels = pLabels;
            this.projChart.data.datasets[0].data = pData;
            this.projChart.update();
        }

        [1, 3, 6, 12].forEach(m => {
            let avgM = this.simulateProj(deposit, topup, m, this.rates.avg).balance;
            const elAvg = document.getElementById(`ms${m}-avg`);
            if(elAvg) elAvg.innerText = this.formatMoney(avgM);
        });
    }

    // --- DATA LOADING LOGIC ---
    async loadTrades() {
        let data = [];
        try {
            // Robustes Fetching
            const res = await fetch('../data/trades.json').catch(() => fetch('/data/trades.json')).catch(() => fetch('./data/trades.json'));
            if (!res || !res.ok) throw new Error("JSON Fetch failed");
            data = await res.json();
        } catch (error) {
            console.error("Fehler beim Laden:", error);
            if (this.dom.tradesBody) this.dom.tradesBody.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-rose-400 font-mono">Lade-Fehler. Keine Daten.</td></tr>`;
            return;
        }

        // Alle gültigen Buy/Sell Trades extrahieren
        this.rawTrades = data.filter(t => {
            const action = (t.Action || t.action || "").toLowerCase();
            return action === 'buy' || action === 'sell';
        }).map(t => {
            const dateStr = t["Close Date"] || t["Open Date"] || t.date || "";
            // Robustes Fallback für das Datum
            let parsedDate = new Date(dateStr);
            if(isNaN(parsedDate.getTime())) parsedDate = new Date(); 
            
            return {
                ...t,
                parsedDate,
                displayDate: dateStr, // String Anzeige so wie er reinkommt
                Gain: parseFloat(t.Gain || t.gain || 0), // Profit in Prozent
                Action: (t.Action || t.action || "Buy").toUpperCase()
            };
        }).sort((a, b) => a.parsedDate - b.parsedDate); // Alt nach Neu sortiert

        this.updateStatsAndTable();
        this.calcBacktest();
    }

    // --- STATS & TABLE LOGIC (ALLE TRADES) ---
    updateStatsAndTable() {
        if (this.rawTrades.length === 0) return;

        let wins = 0; let losses = 0;
        this.rawTrades.forEach(t => { if (t.Gain >= 0) wins++; else losses++; });
        let total = wins + losses;
        let winRate = total > 0 ? ((wins / total) * 100).toFixed(2) : 0;

        if(this.dom.statTotal) this.dom.statTotal.innerText = total;
        if(this.dom.kpiTrades) this.dom.kpiTrades.innerText = total;
        if(this.dom.statWins) this.dom.statWins.innerText = wins;
        if(this.dom.statLosses) this.dom.statLosses.innerText = losses;
        if(this.dom.statWinrate) this.dom.statWinrate.innerText = winRate + "%";

        if (!this.dom.tradesBody) return;
        let html = '';
        
        // Alle Trades: Neuste ganz oben
        const reversedForTable = [...this.rawTrades].reverse(); 

        reversedForTable.forEach(t => {
            const isProfit = t.Gain >= 0;
            const profitClass = isProfit ? 'text-emerald-400' : 'text-rose-400';
            const actionBadge = t.Action === 'BUY' 
                ? `<span class="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">BUY</span>` 
                : `<span class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">SELL</span>`;
            
            html += `
                <tr class="hover:bg-cardBorder/30 transition-colors">
                    <td class="px-6 py-4 text-zinc-400">${t.displayDate}</td>
                    <td class="px-6 py-4 font-semibold">${actionBadge}</td>
                    <td class="px-6 py-4 text-right font-bold ${profitClass}">${isProfit ? '+' : ''}${t.Gain.toFixed(2)}%</td>
                </tr>
            `;
        });
        this.dom.tradesBody.innerHTML = html;
    }

    // --- BACKTEST LOGIC (ALLE TRADES) ---
    calcBacktest() {
        if (this.rawTrades.length === 0) return;

        let capital = parseFloat(this.dom.btDepInput.value) || 10000;
        let mode = this.dom.btMode.value; 

        let currentBalance = capital;
        let totalPayouts = 0;
        
        let labels = ['Start'];
        let dataPoints = [capital];

        // Berechnet über ALLE historischen Trades
        this.rawTrades.forEach(t => {
            let percentFactor = t.Gain / 100; // Aus Gain 0.04 wird hier 0.0004
            let tradeProfit = currentBalance * percentFactor;

            if (mode === 'reinvest') {
                currentBalance += tradeProfit;
                dataPoints.push(currentBalance);
            } else {
                totalPayouts += tradeProfit;
                dataPoints.push(capital + totalPayouts); // Wachsende Linie trotz Auszahlung
            }
            labels.push(t.displayDate.split(' ')[0]); // Nur das Datum für den Chart anzeigen
        });

        let finalBalance = mode === 'reinvest' ? dataPoints[dataPoints.length - 1] : capital;
        let netProfit = mode === 'reinvest' ? (finalBalance - capital) : totalPayouts;
        let growth = capital > 0 ? (netProfit / capital) * 100 : 0;

        // UI Updates
        this.dom.btResBal.innerText = '$' + finalBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        this.dom.btResProf.innerText = (netProfit >= 0 ? '+' : '') + '$' + netProfit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        this.dom.btResGrowth.innerText = (growth >= 0 ? '+' : '') + growth.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%';

        if (this.btChart) {
            this.btChart.data.labels = labels;
            this.btChart.data.datasets[0].data = dataPoints;
            this.btChart.update();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DualEngineApp();
});