const translations = {
    de: {
        back: "Zurück",
        totalGain: "Gesamtrendite",
        maxDrawdown: "Max Drawdown",
        liveTradesKpi: "Live Trades",
        avgMonth: "Ø Monat",
        growthProj: "Wachstums-Projektion",
        projTitle: "Projektions-Engine",
        projSub: "Basierend auf dem monatlichen Performance-Schnitt der Historie, hochgerechnet mit Hebelwirkung abzüglich 30% Performance-Fee.",
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
        winRate: "Win Rate"
    },
    en: {
        back: "Back",
        totalGain: "Total Gain",
        maxDrawdown: "Max Drawdown",
        liveTradesKpi: "Live Trades",
        avgMonth: "Avg / Month",
        growthProj: "Growth Projection",
        projTitle: "Projection Engine",
        projSub: "Based on the verified monthly performance average, amplified by leverage minus a 30% performance fee.",
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
        winRate: "Win Rate"
    }
};

class DualEngineApp {
    constructor() {
        this.rawTrades = [];
        this.btChart = null;
        this.currentLang = 'de';
        // Dynamische Raten, basieren auf aggregierten Monatsdaten
        this.rates = { cons: 0.08, avg: 0.25, opt: 0.40 };

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
            kpiTotalGain: document.getElementById('kpi-total-gain'),
            kpiAvgMonth: document.getElementById('kpi-avg-month'),
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

        await this.loadTradesData();

        if (this.rawTrades.length > 0) {
            this.dom.btStart.value = this.rawTrades[0].dt;
            this.dom.btEnd.value = this.rawTrades[this.rawTrades.length - 1].dt;
        }

        this.setupListeners();
        this.initBacktestChart();
        this.renderStatsAndTable();
        this.calcProjection();
        this.calcBacktest();
    }

    async loadTradesData() {
        try {
            // Suchpfad relativ zum Ordner "Strategies"
            let response = await fetch('../data/trades_data.json');
            if (!response.ok) {
                response = await fetch('../trades_data.json');
            }
            const data = await response.json();
            
            this.rawTrades = data.map(t => {
                const dateString = t["Open Date"] || "";
                let dt = "2025-01-01"; 
                let d = "01.01.2025";

                if (dateString) {
                    const datePart = dateString.split(" ")[0];
                    const parts = datePart.split("/");
                    if (parts.length === 3) {
                        const MM = parts[0].padStart(2, '0');
                        const DD = parts[1].padStart(2, '0');
                        const YYYY = parts[2];
                        dt = `${YYYY}-${MM}-${DD}`;
                        d = `${DD}.${MM}.${YYYY} ${dateString.split(" ")[1] || ''}`;
                    }
                }

                return {
                    ...t,
                    dt: dt,
                    d: d
                };
            }).reverse();

        } catch (e) {
            console.error("Trades konnten nicht geladen werden:", e);
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

        syncSliderInput(this.dom.projDepSlider, this.dom.projDepInput, () => this.calcProjection());
        syncSliderInput(this.dom.projTopSlider, this.dom.projTopInput, () => this.calcProjection());
        syncSliderInput(this.dom.projMoSlider, this.dom.projMoInput, () => this.calcProjection());

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

    // --- RECHNER 2: HISTORISCHER BACKTEST ---
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
                        titleColor: '#94959A',
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
        let riskMult = parseFloat(this.dom.btRiskInput.value) || 1;
        let mode = this.dom.btMode.value;

        let startStr = this.dom.btStart.value || '2025-01-01';
        let endStr = this.dom.btEnd.value || '2099-12-31';

        let filteredTrades = this.rawTrades.filter(t => t.dt >= startStr && t.dt <= endStr);

        let currentBalance = capital;
        let totalPayouts = 0;

        let labels = [startStr];
        let dataPoints = [capital];

        filteredTrades.forEach((t, i) => {
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
                labels.push(t.d.split(" ")[0]);
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

    // --- MONATLICHE AGGREGATION & TABELLEN RENDERING ---
    renderStatsAndTable() {
        if (!this.rawTrades || this.rawTrades.length === 0) return;

        let wins = 0;
        let losses = 0;
        let activeTrades = 0;
        let totalGainSum = 0;
        const monthlyGains = {};

        this.rawTrades.forEach(t => {
            const action = (t["Action"] || "").toLowerCase();
            if (action === 'buy' || action === 'sell') {
                activeTrades++;
                const gain = parseFloat(t["Gain"] || 0);
                totalGainSum += gain;

                if (gain >= 0) wins++;
                else losses++;

                // Monatliche Renditen zusammenrechnen
                const monthKey = (t.dt || "").substring(0, 7);
                if (monthKey) {
                    monthlyGains[monthKey] = (monthlyGains[monthKey] || 0) + gain;
                }
            }
        });

        // Echten monatlichen Durchschnitt ermitteln
        const months = Object.keys(monthlyGains);
        const avgMonthlyGain = months.length > 0 
            ? (Object.values(monthlyGains).reduce((a, b) => a + b, 0) / months.length)
            : 0;

        let total = wins + losses;
        let winRate = total > 0 ? ((wins / total) * 100).toFixed(2) : '0.00';

        if (this.dom.statTotal) this.dom.statTotal.innerText = activeTrades;
        if (this.dom.kpiTrades) this.dom.kpiTrades.innerText = activeTrades;
        if (this.dom.statWins) this.dom.statWins.innerText = wins;
        if (this.dom.statLosses) this.dom.statLosses.innerText = losses;
        if (this.dom.statWinrate) this.dom.statWinrate.innerText = winRate + '%';

        if (this.dom.kpiTotalGain) this.dom.kpiTotalGain.innerText = '+' + totalGainSum.toFixed(2) + '%';
        if (this.dom.kpiAvgMonth) this.dom.kpiAvgMonth.innerText = '+' + avgMonthlyGain.toFixed(2) + '%';

        // Rechner-Raten dynamisch anpassen
        this.rates.avg = (avgMonthlyGain * 24 * 0.7) / 100;
        this.rates.cons = this.rates.avg * 0.4;
        this.rates.opt = this.rates.avg * 1.8;

        if (!this.dom.tradesBody) return;

        let html = '';
        const reversedTrades = [...this.rawTrades].reverse();

        reversedTrades.forEach(t => {
            const rawAction = (t["Action"] || "").toUpperCase();
            if (rawAction !== 'BUY' && rawAction !== 'SELL') return;

            const isLong = rawAction === 'BUY';
            const typeLabel = isLong ? 'Long' : 'Short';
            const typeColor = isLong ? 'text-emerald-400' : 'text-rose-400';

            const openParts = (t["Open Date"] || "").split(" ");
            const closeParts = (t["Close Date"] || "").split(" ");
            
            let dateStr = t.dt || "-";
            let entryTime = openParts[1] || "-";
            let exitTime = closeParts[1] || "-";

            const openPrice = t["Open Price"] !== undefined ? Number(t["Open Price"]).toFixed(2) : '-';
            const closePrice = t["Close Price"] !== undefined ? Number(t["Close Price"]).toFixed(2) : '-';
            const lots = t["Units/Lots"] !== undefined ? `${Number(t["Units/Lots"]).toFixed(2)} Lots` : '-';

            const gainVal = parseFloat(t["Gain"] || 0);
            const isProfit = gainVal >= 0;
            const profitClass = isProfit ? 'text-emerald-400' : 'text-rose-400';
            const formattedGain = `${isProfit ? '+' : ''}${gainVal.toFixed(2)}%`;

            const sonicLogo = `
                <div class="flex items-center gap-2">
                    <div class="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5v-2.1c2.1-.3 3.5-1.7 3.5-3.4 0-1.6-1.2-2.7-2.8-2.9v-2c1.9.3 2.9 1.4 3 2.8h1.8c-.2-2.4-1.9-4.2-4.8-4.5V3h-1.4v1.4c-2.3.3-4.1 1.9-4.1 4 0 2 1.6 3.3 3.7 3.7v2.3c-2-.3-3.2-1.5-3.3-3.1H6.9c.2 2.6 2.1 4.5 4.7 4.8v2.4h1.4z"/>
                        </svg>
                    </div>
                    <span class="font-extrabold text-white text-xs tracking-wide">SONIC</span>
                </div>
            `;

            html += `
                <tr class="hover:bg-cardBorder/25 transition-colors border-b border-cardBorder/30">
                    <td class="px-6 py-4 font-sans">${sonicLogo}</td>
                    <td class="px-6 py-4 font-semibold text-zinc-300">${t["Symbol"] || 'XAUUSD'}.f</td>
                    <td class="px-6 py-4 font-semibold ${typeColor}">${typeLabel}</td>
                    <td class="px-6 py-4 text-zinc-400">${lots}</td>
                    <td class="px-6 py-4 text-zinc-300 font-semibold">${dateStr}</td>
                    <td class="px-6 py-4 text-white font-bold">${openPrice}</td>
                    <td class="px-6 py-4 text-white font-bold">${closePrice}</td>
                    <td class="px-6 py-4 text-zinc-400">${entryTime}</td>
                    <td class="px-6 py-4 text-zinc-400">${exitTime}</td>
                    <td class="px-6 py-4 text-right font-extrabold ${profitClass} text-sm">${formattedGain}</td>
                </tr>
            `;
        });

        this.dom.tradesBody.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DualEngineApp();
});