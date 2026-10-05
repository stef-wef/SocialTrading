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
        this.rawTrades = []; 
        this.chartInstance = null;
        this.currentLang = 'de';
        
        this.dom = {
            // Rechner Controls
            depInput: document.getElementById('calc-deposit'),
            depSlider: document.getElementById('calc-deposit-slider'),
            startDate: document.getElementById('calc-start-date'),
            endDate: document.getElementById('calc-end-date'),
            modeSelect: document.getElementById('calc-mode-select'),
            
            // Rechner Resultate
            resBal: document.getElementById('res-balance'),
            resProf: document.getElementById('res-profit'),
            resGrowth: document.getElementById('res-growth'),
            
            // Trade Statistik Controls & Elemente
            statStart: document.getElementById('stats-start-date'),
            statEnd: document.getElementById('stats-end-date'),
            statTotal: document.getElementById('stat-total'),
            statWins: document.getElementById('stat-wins'),
            statLosses: document.getElementById('stat-losses'),
            statWinrate: document.getElementById('stat-winrate'),

            // Tabelle & Andere
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

        if (!this.dom.depInput) return; // Nur ausführen, wenn auf Sonic.html

        this.setupListeners();
        this.initChart();
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

    setupListeners() {
        // Backtest Controls
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

        // Trade Stats Controls
        const triggerStats = () => this.updateStats();
        if(this.dom.statStart) this.dom.statStart.addEventListener('change', triggerStats);
        if(this.dom.statEnd) this.dom.statEnd.addEventListener('change', triggerStats);
    }

    initChart() {
        const canvas = document.getElementById('projectionChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        let gradient = ctx.createLinearGradient(0, 0, 0, 300);
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
        let data = [];
        try {
            // Fallback System falls Pfad auf Servern abweicht
            const response = await fetch('../data/trades.json').catch(() => fetch('/data/trades.json'));
            if (!response || !response.ok) throw new Error("JSON Fetch failed");
            data = await response.json();
        } catch (error) {
            console.error("Fehler beim Laden der trades.json:", error);
            if (this.dom.tradesBody) this.dom.tradesBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-rose-400 font-mono">Verbindungsfehler zur Historie. Bitte prüfen Sie den /data Ordner.</td></tr>`;
            return;
        }

        // Parsen und Säubern der JSON
        this.rawTrades = data.filter(t => {
            const action = (t.Action || t.action || "").toLowerCase();
            return action === 'buy' || action === 'sell';
        }).map(t => {
            const dateStr = t["Close Date"] || t["Open Date"] || t.date || "";
            let parsedDate = new Date(dateStr);
            if(isNaN(parsedDate.getTime())) parsedDate = new Date(); // Fallback
            
            return {
                ...t,
                parsedDate,
                displayDate: dateStr,
                Profit: parseFloat(t.Profit || t.profit || 0),
                Gain: parseFloat(t.Gain || t.gain || 0), // Gain = Prozentgewinn (z.B. 0.04 bedeutet 0.04%)
                Action: (t.Action || t.action || "Buy").toUpperCase()
            };
        }).sort((a, b) => a.parsedDate - b.parsedDate); // Sortierung: Alt nach Neu

        // Setze Standard-Daten (Letzter Monat der Historie)
        if (this.rawTrades.length > 0) {
            const firstDate = this.rawTrades[0].parsedDate;
            const lastDate = this.rawTrades[this.rawTrades.length - 1].parsedDate;
            
            // Rechner Datumsfelder (Gesamter Zeitraum)
            this.dom.startDate.value = firstDate.toISOString().split('T')[0];
            this.dom.endDate.value = lastDate.toISOString().split('T')[0];

            // Statistik Datumsfelder (Nur letzter Monat)
            if(this.dom.statStart && this.dom.statEnd) {
                const oneMonthAgo = new Date(lastDate);
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                this.dom.statStart.value = oneMonthAgo.toISOString().split('T')[0];
                this.dom.statEnd.value = lastDate.toISOString().split('T')[0];
            }
        }

        this.updateStats();
        this.runBacktest();
        this.renderTable();
    }

    updateStats() {
        if (!this.dom.statStart || !this.dom.statEnd) return;
        
        let startD = new Date(this.dom.statStart.value);
        let endD = new Date(this.dom.statEnd.value);
        endD.setHours(23,59,59);

        // Filtern für die 4 Statistik-Boxen
        const statsTrades = this.rawTrades.filter(t => t.parsedDate >= startD && t.parsedDate <= endD);

        let wins = 0; let losses = 0;
        statsTrades.forEach(t => { if (t.Profit >= 0) wins++; else losses++; });
        let total = wins + losses;
        let winRate = total > 0 ? ((wins / total) * 100).toFixed(2) : 0;

        if(this.dom.statTotal) this.dom.statTotal.innerText = total;
        if(this.dom.statWins) this.dom.statWins.innerText = wins;
        if(this.dom.statLosses) this.dom.statLosses.innerText = losses;
        if(this.dom.statWinrate) this.dom.statWinrate.innerText = winRate + "%";
    }

    renderTable() {
        if (!this.dom.tradesBody) return;
        if (this.rawTrades.length === 0) return;

        let html = '';
        // Für die Tabelle drehen wir die Reihenfolge um (Neueste ganz oben)
        const reversedForTable = [...this.rawTrades].reverse(); 

        reversedForTable.forEach(t => {
            const isProfit = t.Profit >= 0;
            const profitClass = isProfit ? 'text-emerald-400' : 'text-rose-400';
            const actionBadge = t.Action === 'BUY' 
                ? `<span class="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">BUY</span>` 
                : `<span class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">SELL</span>`;
            
            html += `
                <tr class="hover:bg-cardBorder/30 transition-colors">
                    <td class="px-6 py-4 text-zinc-400">${t.displayDate}</td>
                    <td class="px-6 py-4 font-bold text-white">${t.Symbol || 'XAUUSD'}</td>
                    <td class="px-6 py-4 font-semibold">${actionBadge}</td>
                    <td class="px-6 py-4 text-zinc-400">${parseFloat(t["Units/Lots"] || 1).toFixed(2)} Lots</td>
                    <td class="px-6 py-4 text-right font-bold ${profitClass}">${isProfit ? '+' : ''}$${t.Profit.toFixed(2)}</td>
                </tr>
            `;
        });
        this.dom.tradesBody.innerHTML = html;
    }

    runBacktest() {
        if (this.rawTrades.length === 0) return;

        let capital = parseFloat(this.dom.depInput.value) || 10000;
        let mode = this.dom.modeSelect.value; 

        let startD = new Date(this.dom.startDate.value);
        let endD = new Date(this.dom.endDate.value);
        endD.setHours(23,59,59); 

        // Relevanten Zeitraum filtern
        let validTrades = this.rawTrades.filter(t => t.parsedDate >= startD && t.parsedDate <= endD);

        let currentBalance = capital;
        let totalPayouts = 0;
        
        let labels = [startD.toISOString().split('T')[0]];
        let dataPoints = [capital];

        // Echte Gain-Simulation (Zinseszins vs. Auszahlung)
        validTrades.forEach(t => {
            let percentFactor = t.Gain / 100; // t.Gain ist z.B. 0.04 (steht für 0.04%)
            let tradeProfit = currentBalance * percentFactor;

            if (mode === 'reinvest') {
                currentBalance += tradeProfit;
                dataPoints.push(currentBalance);
            } else {
                totalPayouts += tradeProfit;
                // Bei Auszahlung: Chart zeigt das gesammelte Vermögen (Kapital + Payouts), 
                // damit die Linie nicht komplett flach ist.
                dataPoints.push(capital + totalPayouts);
            }
            labels.push(t.parsedDate.toISOString().split('T')[0]);
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