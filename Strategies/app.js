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
        btSub: "Dieser Rechner simuliert deine Gewinne basierend auf den exakten historischen Prozent-Gains der vergangenen Trades. Wähle einen Zeitraum aus der Historie, gib dein Kapital ein und sieh, wie es performt hätte.",
        btCapital: "Startkapital",
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
        colAsset: "Instrument",
        colType: "Typ",
        colVol: "Volumen",
        colProfit: "Profit / Verlust"
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
        btSub: "This calculator simulates your returns based on the exact historical percentage gains of past trades. Select a timeframe from the history, input your capital, and see how it would have performed.",
        btCapital: "Starting Capital",
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
        colAsset: "Instrument",
        colType: "Type",
        colVol: "Volume",
        colProfit: "Profit / Loss"
    }
};

class DualEngineApp {
    constructor() {
        this.rawTrades = []; 
        this.chartInstance = null;
        this.currentLang = 'de';
        
        this.rates = { cons: 0.0588, avg: 0.19152, opt: 0.3528 };
        
        this.dom = {
            // Projection
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

            // Backtest
            btDepInput: document.getElementById('bt-capital'),
            btDepSlider: document.getElementById('bt-capital-slider'),
            btStart: document.getElementById('bt-start-date'),
            btEnd: document.getElementById('bt-end-date'),
            btMode: document.getElementById('bt-mode-select'),
            btResBal: document.getElementById('bt-res-balance'),
            btResProf: document.getElementById('bt-res-profit'),
            btResGrowth: document.getElementById('bt-res-growth'),

            // Stats & Tables
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

        if (!this.dom.projDepInput) return; // Nur wenn auf Sonic.html

        this.setupListeners();
        this.initBacktestChart();
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
        // Utils
        const syncSliderInput = (slider, input, callback) => {
            slider.addEventListener('input', () => { input.value = slider.value; callback(); });
            input.addEventListener('input', () => { 
                let val = parseInt(input.value) || 0; 
                slider.value = val; 
                callback(); 
            });
        };

        // Projection Engine Listeners
        syncSliderInput(this.dom.projDepSlider, this.dom.projDepInput, () => this.calcProjection());
        syncSliderInput(this.dom.projTopSlider, this.dom.projTopInput, () => this.calcProjection());
        syncSliderInput(this.dom.projMoSlider, this.dom.projMoInput, () => this.calcProjection());

        // Backtest Engine Listeners
        syncSliderInput(this.dom.btDepSlider, this.dom.btDepInput, () => this.calcBacktest());
        this.dom.btStart.addEventListener('change', () => this.calcBacktest());
        this.dom.btEnd.addEventListener('change', () => this.calcBacktest());
        this.dom.btMode.addEventListener('change', () => this.calcBacktest());
    }

    // --- PROJECTION ENGINE LOGIK ---
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

        [1, 3, 6, 12].forEach(m => {
            let avgM = this.simulateProj(deposit, topup, m, this.rates.avg).balance;
            const elAvg = document.getElementById(`ms${m}-avg`);
            if(elAvg) elAvg.innerText = this.formatMoney(avgM);
        });
    }

    // --- BACKTEST ENGINE LOGIK ---
    initBacktestChart() {
        const canvas = document.getElementById('backtestChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        let gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(52, 211, 153, 0.2)'); 
        gradient.addColorStop(1, 'rgba(52, 211, 153, 0.0)');

        Chart.defaults.font.family = "'JetBrains Mono', monospace";
        Chart.defaults.color = '#64748B';

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ 
                data: [], borderColor: '#34D399', backgroundColor: gradient, 
                borderWidth: 2, pointRadius: 0, pointHoverRadius: 6,
                pointBackgroundColor: '#040914', pointBorderColor: '#34D399', pointBorderWidth: 2,
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
    }

    async loadTrades() {
        try {
            const response = await fetch('../data/trades.json');
            if (!response.ok) throw new Error("File not found");
            const data = await response.json();
            
            // Filtern und Parsen
            this.rawTrades = data.filter(t => t.Action === 'Buy' || t.Action === 'Sell')
                .map(t => {
                    const dateStr = t["Close Date"] || t["Open Date"];
                    return {
                        ...t,
                        parsedDate: new Date(dateStr),
                        displayDate: dateStr
                    };
                })
                .sort((a, b) => a.parsedDate - b.parsedDate); // Alt -> Neu für Backtest

            this.updateStatsAndTable();

            if (this.rawTrades.length > 0) {
                const firstDate = this.rawTrades[0].parsedDate;
                const lastDate = this.rawTrades[this.rawTrades.length - 1].parsedDate;
                this.dom.btStart.value = firstDate.toISOString().split('T')[0];
                this.dom.btEnd.value = lastDate.toISOString().split('T')[0];
            }

            this.calcBacktest();

        } catch (error) {
            console.error(error);
            if (this.dom.tradesBody) this.dom.tradesBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-rose-400 font-mono">Error loading ledger. Check trades.json</td></tr>`;
        }
    }

    updateStatsAndTable() {
        let wins = 0; let losses = 0;
        this.rawTrades.forEach(t => { if (parseFloat(t.Profit) >= 0) wins++; else losses++; });
        let total = wins + losses;
        let winRate = total > 0 ? ((wins / total) * 100).toFixed(2) : 0;

        if(this.dom.statTotal) this.dom.statTotal.innerText = total;
        if(this.dom.kpiTrades) this.dom.kpiTrades.innerText = total; // Header KPI
        if(this.dom.statWins) this.dom.statWins.innerText = wins;
        if(this.dom.statLosses) this.dom.statLosses.innerText = losses;
        if(this.dom.statWinrate) this.dom.statWinrate.innerText = winRate + "%";

        if (!this.dom.tradesBody) return;
        let html = '';
        
        // Alle Trades in der Tabelle anzeigen, Neueste zuerst
        const reversedForTable = [...this.rawTrades].reverse(); 

        reversedForTable.forEach(t => {
            const profitVal = parseFloat(t.Profit || 0);
            const isProfit = profitVal >= 0;
            const profitClass = isProfit ? 'text-emerald-400' : 'text-rose-400';
            const action = (t.Action || 'Buy').toUpperCase();
            const actionBadge = action === 'BUY' 
                ? `<span class="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">${action}</span>` 
                : `<span class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">${action}</span>`;
            
            html += `
                <tr class="hover:bg-cardBorder/30 transition-colors">
                    <td class="px-6 py-4 text-zinc-400">${t.displayDate}</td>
                    <td class="px-6 py-4 font-bold text-white">${t.Symbol || 'XAUUSD'}</td>
                    <td class="px-6 py-4 font-semibold">${actionBadge}</td>
                    <td class="px-6 py-4 text-zinc-400">${parseFloat(t["Units/Lots"] || 1).toFixed(2)} Lots</td>
                    <td class="px-6 py-4 text-right font-bold ${profitClass}">${isProfit ? '+' : ''}$${profitVal.toFixed(2)}</td>
                </tr>
            `;
        });
        this.dom.tradesBody.innerHTML = html;
    }

    calcBacktest() {
        if (this.rawTrades.length === 0) return;

        let startD = new Date(this.dom.btStart.value);
        let endD = new Date(this.dom.btEnd.value);
        endD.setHours(23,59,59);

        let validTrades = this.rawTrades.filter(t => t.parsedDate >= startD && t.parsedDate <= endD);

        let capital = parseFloat(this.dom.btDepInput.value) || 10000;
        let mode = this.dom.btMode.value; // reinvest oder payout

        let currentBalance = capital;
        let totalPayouts = 0;
        
        let labels = [startD.toISOString().split('T')[0]];
        let dataPoints = [capital];

        validTrades.forEach(t => {
            // Echte Gain-% aus der JSON nutzen
            let rawPercent = parseFloat(t.Gain || 0); 
            let percentFactor = rawPercent / 100;

            let tradeProfit = currentBalance * percentFactor;

            if (mode === 'reinvest') {
                currentBalance += tradeProfit;
            } else {
                totalPayouts += tradeProfit;
            }

            labels.push(t.parsedDate.toISOString().split('T')[0]);
            dataPoints.push(mode === 'reinvest' ? currentBalance : capital);
        });

        let finalBalance = mode === 'reinvest' ? dataPoints[dataPoints.length - 1] : capital;
        let netProfit = mode === 'reinvest' ? (finalBalance - capital) : totalPayouts;
        let growth = capital > 0 ? (netProfit / capital) * 100 : 0;

        this.dom.btResBal.innerText = '$' + finalBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        this.dom.btResProf.innerText = (netProfit >= 0 ? '+' : '') + '$' + netProfit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        this.dom.btResGrowth.innerText = (growth >= 0 ? '+' : '') + growth.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%';

        if (this.chartInstance) {
            this.chartInstance.data.labels = labels;
            this.chartInstance.data.datasets[0].data = dataPoints;
            this.chartInstance.update();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DualEngineApp();
});