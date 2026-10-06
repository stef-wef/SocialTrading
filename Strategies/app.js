const translations = {
    de: {
        back: "Zurück",
        totalGain: "Gesamtrendite",
        maxDrawdown: "Max Drawdown",
        liveTradesKpi: "Verifizierte Trades",
        avgMonth: "Ø Monat Rendite",
        growthProj: "Wachstums-Projektion",
        projTitle: "Projektions-Engine",
        projSub: "Modelliert aus dem verifizierten Monatsschnitt, gehebelt mit 24x Broker-Effekt, abzüglich 30% Performance-Fee (= 19.15% netto / Monat).",
        projDeposit: "Startkapital",
        projTopup: "Monatliches Top-Up",
        projMonths: "Laufzeit (Monate)",
        projAvgScen: "Szenario nach",
        monthsWord: "Monaten",
        fromWord: "Aus",
        investedWord: "investiert",
        projCons: "Konservativ (~5.88% / Mo)",
        projOpt: "Optimistisch (~35.28% / Mo)",
        projMilestones: "Meilensteine",
        btBadge: "Echte Historische Daten",
        btTitle: "Backtest-Engine",
        btSub: "Simuliert den Trade-Verlauf mit synchronisierter Hebel-Skalierung (16.8x Netto) und monatlicher Zuzahlung.",
        btCapital: "Startkapital",
        btStart: "Startdatum",
        btEnd: "Enddatum",
        btMode: "Gewinn-Modus",
        modeReinvest: "Täglich Reinvestieren (Zinseszins)",
        modePayout: "Auszahlen (Konstantes Kapital)",
        btSimBal: "Simuliertes Endguthaben",
        btProfit: "Reingewinn",
        btGrowth: "Wachstum",
        disclaimerTitle: "Nur zur Veranschaulichung — keine Erfolgsgarantie.",
        disclaimerText: "Dies ist eine hypothetische mathematische Modellierung auf Basis des historischen Myfxbook-Durchschnitts und keine verbindliche Prognose. Einzelne Monate schwankten historisch ungehebelt zwischen +0.47% und +3.32%. Die 24× Hebel- und Skalierungsannahme ist eine rechnerische Näherung — realer Devisen- und CFD-Handel unterliegt Margin-Anforderungen sowie Liquidationsrisiken, die nicht linear verlaufen. Die vergangene Wertentwicklung ist kein verlässlicher Indikator für zukünftige Ergebnisse. Handeln Sie ausschließlich mit Kapital, dessen Totalverlust Sie problemlos verkraften können."
    },
    en: {
        back: "Back",
        totalGain: "Total Gain",
        maxDrawdown: "Max Drawdown",
        liveTradesKpi: "Verified Trades",
        avgMonth: "Avg Monthly Return",
        growthProj: "Growth Projection",
        projTitle: "Projection Engine",
        projSub: "Modeled from the verified monthly average, amplified 24x by broker leverage, minus 30% performance fee (= 19.15% net / month).",
        projDeposit: "Starting Deposit",
        projTopup: "Monthly Top-Up",
        projMonths: "Time Horizon (Months)",
        projAvgScen: "Scenario After",
        monthsWord: "Months",
        fromWord: "From",
        investedWord: "invested",
        projCons: "Conservative (~5.88% / Mo)",
        projOpt: "Optimistic (~35.28% / Mo)",
        projMilestones: "Milestones",
        btBadge: "Real Historical Data",
        btTitle: "Backtest Engine",
        btSub: "Simulates trade history with synchronized leverage scaling (16.8x net) and monthly top-up.",
        btCapital: "Starting Capital",
        btStart: "Start Date",
        btEnd: "End Date",
        btMode: "Profit Mode",
        modeReinvest: "Daily Reinvest (Compound)",
        modePayout: "Daily Payout (Constant Capital)",
        btSimBal: "Simulated Balance",
        btProfit: "Net Profit",
        btGrowth: "Growth",
        disclaimerTitle: "Illustrative only — not a guarantee.",
        disclaimerText: "This is a mathematical illustration based on historical average performance, not a forecast. Individual months have ranged from +0.47% to +3.32% unleveraged. The 24× leverage assumption is an approximation — real leveraged trading involves margin requirements and liquidation risk that do not scale in a perfectly linear way. Past performance does not guarantee future results, and you can lose part or all of your capital. Trade only with funds you can afford to lose."
    }
};

class DualEngineApp {
    constructor() {
        this.rawTrades = [];
        this.btChart = null;
        this.equityChart = null;
        this.currentLang = 'de';

        // Erkennt sicher, ob NEO.FX aktiv ist
        this.isNeo = window.location.pathname.toLowerCase().includes('neofx');

        this.rates = this.isNeo
            ? { cons: 0.050, avg: 0.145, opt: 0.220 }
            : { cons: 0.0588, avg: 0.19152, opt: 0.3528 };

        this.backtestLeverageMult = 24 * 0.70;

        this.dom = {
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

            btDepInput: document.getElementById('bt-capital'),
            btDepSlider: document.getElementById('bt-capital-slider'),
            btTopInput: document.getElementById('bt-topup'),
            btTopSlider: document.getElementById('bt-topup-slider'),
            btStart: document.getElementById('bt-start-date'),
            btEnd: document.getElementById('bt-end-date'),
            btMode: document.getElementById('bt-mode-select'),
            btResBal: document.getElementById('bt-res-balance'),
            btResProf: document.getElementById('bt-res-profit'),
            btResGrowth: document.getElementById('bt-res-growth'),

            statTotal: document.getElementById('stat-total'),
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

        if (this.rawTrades.length > 0 && this.dom.btStart && this.dom.btEnd) {
            this.dom.btStart.value = this.rawTrades[0].dt;
            this.dom.btEnd.value = this.rawTrades[this.rawTrades.length - 1].dt;
        }

        this.setupListeners();
        this.initEquityGrowthChart();
        this.initBacktestChart();
        this.renderStatsAndTable();
        this.calcProjection();
        this.calcBacktest();
    }

    async loadTradesData() {
        // Robuste Liste möglicher Dateipfade
        const candidateFiles = this.isNeo
            ? [
                '../data/Neo_TradesData.json',
                '../data/NEO_TradesData.json',
                '../data/NEO_tradesdata.json',
                '../data/neo_tradesdata.json',
                '/data/Neo_TradesData.json',
                'data/Neo_TradesData.json'
            ]
            : [
                '../data/Sonic_TradesData.json',
                '../data/Sonic_tradesdata.json',
                '../data/trades_data.json',
                '/data/Sonic_TradesData.json',
                'data/Sonic_TradesData.json'
            ];

        let data = null;
        for (const file of candidateFiles) {
            try {
                const response = await fetch(file);
                if (response.ok) {
                    data = await response.json();
                    break;
                }
            } catch (e) {
                // Nächsten Pfad versuchen
            }
        }

        if (!data || !Array.isArray(data)) {
            console.warn("Konnte Daten nicht laden. Bitte prüfe das Vorhandensein im data/ Verzeichnis.");
            this.rawTrades = [];
            return;
        }

        // Filter: Nur BUY und SELL
        const filteredTrades = data.filter(t => {
            const action = (t["Action"] || "").toUpperCase();
            return action === 'BUY' || action === 'SELL';
        });

        this.rawTrades = filteredTrades.map(t => {
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

            const gain = parseFloat(t["Gain"] || 0);

            return {
                ...t,
                dt,
                d,
                parsedGain: isNaN(gain) ? 0 : gain
            };
        }).reverse();
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
        const sync = (slider, input, cb) => {
            if (!slider || !input) return;
            slider.addEventListener('input', () => { input.value = slider.value; cb(); });
            input.addEventListener('input', () => {
                let v = parseFloat(input.value) || 0;
                slider.value = v;
                cb();
            });
        };

        sync(this.dom.projDepSlider, this.dom.projDepInput, () => this.calcProjection());
        sync(this.dom.projTopSlider, this.dom.projTopInput, () => this.calcProjection());
        sync(this.dom.projMoSlider, this.dom.projMoInput, () => this.calcProjection());

        sync(this.dom.btDepSlider, this.dom.btDepInput, () => this.calcBacktest());
        sync(this.dom.btTopSlider, this.dom.btTopInput, () => this.calcBacktest());
        if (this.dom.btStart) this.dom.btStart.addEventListener('change', () => this.calcBacktest());
        if (this.dom.btEnd) this.dom.btEnd.addEventListener('change', () => this.calcBacktest());
        if (this.dom.btMode) this.dom.btMode.addEventListener('change', () => this.calcBacktest());
    }

    simulateProj(deposit, topup, months, rate) {
        let balance = deposit;
        let invested = deposit;
        for (let m = 1; m <= months; m++) {
            balance = balance * (1 + rate);
            if (m < months) {
                balance += topup;
                invested += topup;
            }
        }
        return { balance, invested };
    }

    calcProjection() {
        if (!this.dom.projDepInput) return;
        let deposit = parseFloat(this.dom.projDepInput.value) || 0;
        let topup = parseFloat(this.dom.projTopInput ? this.dom.projTopInput.value : 0) || 0;
        let months = parseInt(this.dom.projMoInput.value) || 12;

        if (this.dom.projResMo) this.dom.projResMo.innerText = months;

        let resAvg = this.simulateProj(deposit, topup, months, this.rates.avg);
        let resCons = this.simulateProj(deposit, topup, months, this.rates.cons);
        let resOpt = this.simulateProj(deposit, topup, months, this.rates.opt);

        let multiplier = resAvg.invested > 0 ? (resAvg.balance / resAvg.invested).toFixed(1) : '0.0';

        if (this.dom.projResBal) this.dom.projResBal.innerText = this.formatMoney(resAvg.balance);
        if (this.dom.projResInv) this.dom.projResInv.innerText = this.formatMoney(resAvg.invested);
        if (this.dom.projResMult) this.dom.projResMult.innerText = multiplier + 'x';

        if (this.dom.projConsBal) this.dom.projConsBal.innerText = this.formatMoney(resCons.balance);
        if (this.dom.projOptBal) this.dom.projOptBal.innerText = this.formatMoney(resOpt.balance);

        [1, 3, 6, 12].forEach(m => {
            let avgM = this.simulateProj(deposit, topup, m, this.rates.avg).balance;
            const elAvg = document.getElementById(`ms${m}-avg`);
            if (elAvg) elAvg.innerText = this.formatMoney(avgM);
        });
    }

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
        let topup = parseFloat(this.dom.btTopInput ? this.dom.btTopInput.value : 0) || 0;
        let mode = this.dom.btMode ? this.dom.btMode.value : 'reinvest';

        let startStr = (this.dom.btStart && this.dom.btStart.value) || this.rawTrades[0].dt;
        let endStr = (this.dom.btEnd && this.dom.btEnd.value) || this.rawTrades[this.rawTrades.length - 1].dt;

        let filteredTrades = this.rawTrades.filter(t => t.dt >= startStr && t.dt <= endStr);

        let currentBalance = capital;
        let totalInvested = capital;
        let totalPayouts = 0;
        let lastMonth = '';

        let labels = [startStr];
        let dataPoints = [capital];

        filteredTrades.forEach((t, i) => {
            const currentMonth = t.dt.substring(0, 7);
            if (lastMonth && currentMonth !== lastMonth && topup > 0) {
                currentBalance += topup;
                totalInvested += topup;
            }
            lastMonth = currentMonth;

            let scaledGainPercent = t.parsedGain * this.backtestLeverageMult;
            let tradeProfit = currentBalance * (scaledGainPercent / 100);

            if (mode === 'reinvest') {
                currentBalance += tradeProfit;
                dataPoints.push(currentBalance);
            } else {
                totalPayouts += tradeProfit;
                dataPoints.push(currentBalance + totalPayouts);
            }

            if (i % 15 === 0 || i === filteredTrades.length - 1) {
                labels.push(t.dt);
            } else {
                labels.push('');
            }
        });

        let finalBalance = mode === 'reinvest' ? dataPoints[dataPoints.length - 1] : (currentBalance + totalPayouts);
        let netProfit = finalBalance - totalInvested;
        let growth = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0;

        if (this.dom.btResBal) this.dom.btResBal.innerText = '$' + finalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (this.dom.btResProf) this.dom.btResProf.innerText = (netProfit >= 0 ? '+' : '') + '$' + netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (this.dom.btResGrowth) this.dom.btResGrowth.innerText = (growth >= 0 ? '+' : '') + growth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

        if (this.btChart) {
            this.btChart.data.labels = labels;
            this.btChart.data.datasets[0].data = dataPoints;
            this.btChart.update();
        }
    }

    initEquityGrowthChart() {
        const canvas = document.getElementById('equityGrowthChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const labels = ['Nov 03, \'24', 'Jan 15, \'25', 'Mar 06, \'25', 'May 10, \'25', 'Jul 14, \'25', 'Sep 20, \'25', 'Nov 27, \'25', 'Jan 30, \'26', 'Mar 27, \'26', 'May 20, \'26', 'Jul 08, \'26', 'Oct 03, \'26'];
        const growthData = [0, 2.8, 5.2, 8.4, 12.1, 15.6, 17.8, 20.2, 21.6, 23.4, 25.1, 26.63];

        this.equityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Growth',
                    data: growthData,
                    borderColor: '#E15241',
                    borderWidth: 1.8,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: false,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: { color: '#64748B', font: { size: 10 }, maxTicksLimit: 6 }
                    },
                    y: {
                        position: 'left',
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: {
                            color: '#64748B',
                            font: { size: 10 },
                            callback: (v) => v + '%'
                        }
                    }
                }
            }
        });
    }

    renderStatsAndTable() {
        if (!this.dom.tradesBody) return;

        if (!this.rawTrades || this.rawTrades.length === 0) {
            this.dom.tradesBody.innerHTML = `
                <tr>
                    <td colspan="10" class="px-6 py-8 text-center text-zinc-500 font-sans">
                        Warte auf Trade-Daten. Bitte prüfe, ob die JSON-Datei im Ordner <code>data/</code> liegt.
                    </td>
                </tr>
            `;
            return;
        }

        if (this.dom.statTotal) this.dom.statTotal.innerText = this.rawTrades.length;

        let html = '';
        const reversedTrades = [...this.rawTrades].reverse();

        reversedTrades.forEach(t => {
            const rawAction = (t["Action"] || "").toUpperCase();
            const isLong = rawAction === 'BUY';
            const typeLabel = isLong ? 'Long' : 'Short';
            const typeColor = isLong ? 'text-emerald-400' : 'text-rose-400';

            const openParts = (t["Open Date"] || "").split(" ");
            const closeParts = (t["Close Date"] || "").split(" ");

            let dateStr = t.dt || "-";
            let entryTime = openParts[1] || "-";
            let exitTime = closeParts[1] || "-";

            const symbol = t["Symbol"] || (this.isNeo ? 'EURUSD' : 'XAUUSD');
            const isForex = symbol.includes('EUR') || symbol.includes('USD') && !symbol.includes('XAU');
            const decimals = isForex ? 5 : 2;

            const openPrice = t["Open Price"] !== undefined ? Number(t["Open Price"]).toFixed(decimals) : '-';
            const closePrice = t["Close Price"] !== undefined ? Number(t["Close Price"]).toFixed(decimals) : '-';
            const lots = t["Units/Lots"] !== undefined ? `${Number(t["Units/Lots"]).toFixed(2)} Lots` : '-';

            const isProfit = t.parsedGain >= 0;
            const profitClass = isProfit ? 'text-emerald-400' : 'text-rose-400';
            const formattedGain = `${isProfit ? '+' : ''}${t.parsedGain.toFixed(2)}%`;

            const stratName = this.isNeo ? 'NEO.FX' : 'SONIC';

            const logo = `
                <div class="flex items-center gap-2">
                    <div class="w-5 h-5 rounded-full ${this.isNeo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'} flex items-center justify-center text-[10px]">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5v-2.1c2.1-.3 3.5-1.7 3.5-3.4 0-1.6-1.2-2.7-2.8-2.9v-2c1.9.3 2.9 1.4 3 2.8h1.8c-.2-2.4-1.9-4.2-4.8-4.5V3h-1.4v1.4c-2.3.3-4.1 1.9-4.1 4 0 2 1.6 3.3 3.7 3.7v2.3c-2-.3-3.2-1.5-3.3-3.1H6.9c.2 2.6 2.1 4.5 4.7 4.8v2.4h1.4z"/>
                        </svg>
                    </div>
                    <span class="font-extrabold text-white text-xs tracking-wide">${stratName}</span>
                </div>
            `;

            html += `
                <tr class="hover:bg-cardBorder/25 transition-colors border-b border-cardBorder/30">
                    <td class="px-6 py-4 font-sans">${logo}</td>
                    <td class="px-6 py-4 font-semibold text-zinc-300">${symbol}.f</td>
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