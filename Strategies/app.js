// --- i18n Dictionary für Sonic.html ---
const translations = {
    de: {
        back: "Zurück",
        verifiedLive: "Verified by Myfxbook - Live",
        backtestTitle1: "Historical",
        backtestTitle2: "Backtest-Engine",
        backtestSub: "Dieser Rechner simuliert deine Gewinne basierend auf den exakten, realen historischen Prozent-Gains der vergangenen Trades. Wähle einen Zeitraum aus der Historie, gib dein Kapital ein und sieh, wie es performt hätte.",
        startCapital: "Startkapital (USD)",
        startDate: "Startdatum",
        endDate: "Enddatum",
        profitMode: "Gewinn-Modus",
        modeReinvest: "Täglich Reinvestieren (Zinseszins)",
        modePayout: "Gewinne Auszahlen (Konstantes Kapital)",
        simulatedBalance: "Simuliertes Endguthaben",
        generatedProfit: "Gewinn",
        totalGrowth: "Wachstum",
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
        backtestTitle1: "Historical",
        backtestTitle2: "Backtest Engine",
        backtestSub: "This calculator simulates your returns based on the exact, real historical percentage gains of past trades. Select a timeframe from the history, input your capital, and see how it would have performed.",
        startCapital: "Starting Capital (USD)",
        startDate: "Start Date",
        endDate: "End Date",
        profitMode: "Profit Mode",
        modeReinvest: "Daily Reinvest (Compound)",
        modePayout: "Daily Payout (Constant Capital)",
        simulatedBalance: "Simulated Balance",
        generatedProfit: "Profit",
        totalGrowth: "Total Growth",
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

class StrategyCalculator {
    constructor() {
        this.rawTrades = []; // Alle geladenen Trades
        this.chartInstance = null;
        this.currentLang = 'de';
        
        this.dom = {
            depInput: document.getElementById('calc-deposit'),
            depSlider: document.getElementById('calc-deposit-slider'),
            startDate: document.getElementById('calc-start-date'),
            endDate: document.getElementById('calc-end-date'),
            modeSelect: document.getElementById('calc-mode-select'),
            
            resBal: document.getElementById('res-balance'),
            resProf: document.getElementById('res-profit'),
            resGrowth: document.getElementById('res-growth'),
            
            statTotal: document.getElementById('stat-total'),
            statWins: document.getElementById('stat-wins'),
            statLosses: document.getElementById('stat-losses'),
            statWinrate: document.getElementById('stat-winrate'),

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

        if (!this.dom.depInput) return; // Nur wenn Rechner da ist
        this.setupListeners();
        this.initChart();
        this.loadTrades(); // Startet den gesamten Prozess
    }

    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if(translations[this.currentLang] && translations[this.currentLang][key]) {
                el.innerText = translations[this.currentLang][key];
            }
        });
    }

    setupListeners() {
        const triggerCalc = () => this.runBacktest();

        this.dom.depSlider.addEventListener('input', () => {
            this.dom.depInput.value = this.dom.depSlider.value;
            triggerCalc();
        });
        this.dom.depInput.addEventListener('input', () => {
            let val = parseInt(this.dom.depInput.value) || 0;
            this.dom.depSlider.value = val;
            triggerCalc();
        });

        this.dom.startDate.addEventListener('change', triggerCalc);
        this.dom.endDate.addEventListener('change', triggerCalc);
        this.dom.modeSelect.addEventListener('change', triggerCalc);
    }

    initChart() {
        const canvas = document.getElementById('projectionChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        let gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(0, 229, 255, 0.2)'); 
        gradient.addColorStop(1, 'rgba(0, 229, 255, 0.0)');

        Chart.defaults.font.family = "'JetBrains Mono', monospace";
        Chart.defaults.color = '#64748B';

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ 
                data: [], borderColor: '#00E5FF', backgroundColor: gradient, 
                borderWidth: 2, pointRadius: 0, pointHoverRadius: 6,
                pointBackgroundColor: '#040914', pointBorderColor: '#00E5FF', pointBorderWidth: 2,
                fill: true, tension: 0.1 
            }]},
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0A101C', titleColor: '#94A3B8', bodyColor: '#FFFFFF',
                        borderColor: '#1A2436', borderWidth: 1, padding: 12, displayColors: false,
                        callbacks: {
                            label: (ctx) => '$' + ctx.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})
                        }
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
            
            // Nur echte Trades, Datum parsen, aufsteigend sortieren (alt -> neu)
            this.rawTrades = data.filter(t => t.Action === 'Buy' || t.Action === 'Sell')
                .map(t => {
                    const dateStr = t["Close Date"] || t["Open Date"];
                    return {
                        ...t,
                        parsedDate: new Date(dateStr),
                        displayDate: dateStr
                    };
                })
                .sort((a, b) => a.parsedDate - b.parsedDate);

            // Statistik & Tabelle berechnen
            this.updateStatsAndTable();

            // Datum-Inputs vorbelegen
            if (this.rawTrades.length > 0) {
                const firstDate = this.rawTrades[0].parsedDate;
                const lastDate = this.rawTrades[this.rawTrades.length - 1].parsedDate;
                this.dom.startDate.value = firstDate.toISOString().split('T')[0];
                this.dom.endDate.value = lastDate.toISOString().split('T')[0];
            }

            this.runBacktest();

        } catch (error) {
            console.error(error);
            if (this.dom.tradesBody) this.dom.tradesBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-rose-400 font-mono">Error loading ledger.</td></tr>`;
        }
    }

    updateStatsAndTable() {
        // Alle Trades für Stats nutzen
        let wins = 0; let losses = 0;
        this.rawTrades.forEach(t => { if (t.Profit >= 0) wins++; else losses++; });
        let total = wins + losses;
        let winRate = total > 0 ? ((wins / total) * 100).toFixed(2) : 0;

        if(this.dom.statTotal) this.dom.statTotal.innerText = total;
        if(this.dom.statWins) this.dom.statWins.innerText = wins;
        if(this.dom.statLosses) this.dom.statLosses.innerText = losses;
        if(this.dom.statWinrate) this.dom.statWinrate.innerText = winRate + "%";

        // Tabelle rendern (Neueste zuerst für die Tabelle)
        if (!this.dom.tradesBody) return;
        let html = '';
        const reversedForTable = [...this.rawTrades].reverse(); // Für Tabelle neu -> alt

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

    runBacktest() {
        if (this.rawTrades.length === 0) return;

        let startD = new Date(this.dom.startDate.value);
        let endD = new Date(this.dom.endDate.value);
        endD.setHours(23,59,59); // End of day

        // Filtern nach Zeitraum
        let validTrades = this.rawTrades.filter(t => t.parsedDate >= startD && t.parsedDate <= endD);

        let capital = parseFloat(this.dom.depInput.value) || 10000;
        let mode = this.dom.modeSelect.value; // reinvest oder payout

        let currentBalance = capital;
        let totalPayouts = 0;
        
        let labels = [startD.toISOString().split('T')[0]];
        let dataPoints = [capital];

        // Echte Zinseszins-Simulation basierend auf Gain (z.B. Gain 0.04 = 0.04%)
        validTrades.forEach(t => {
            let rawPercent = parseFloat(t.Gain || 0); // Gain aus CSV ist z.B. 0.04 für 0.04%
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

        // UI Updates
        this.dom.resBal.innerText = '$' + finalBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        this.dom.resProf.innerText = (netProfit >= 0 ? '+' : '') + '$' + netProfit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        this.dom.resGrowth.innerText = (growth >= 0 ? '+' : '') + growth.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%';

        if (this.chartInstance) {
            this.chartInstance.data.labels = labels;
            this.chartInstance.data.datasets[0].data = dataPoints;
            this.chartInstance.update();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StrategyCalculator();
});