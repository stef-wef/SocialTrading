const translations = {
    de: {
        back: "Zurück",
        totalGain: "Gesamtrendite",
        maxDrawdown: "Max Drawdown",
        liveTradesKpi: "Erfasste Trades",
        avgMonth: "Ø Monat Rendite",
        winRate: "Trefferquote",
        accountPoolDetails: "Account Details",
        poolSub: "Social Trading Pool",
        aumPool: "AUM Pool",
        perfFee: "Erfolgsbeteiligung",
        avgTradeDuration: "Ø Trade-Dauer",
        minInvestment: "Min. Investment",
        performanceMetrics: "Performance Metrics",
        metricsSub: "Statistische Auswertung des Myfxbook-Portfolios",
        dailyAvg: "Tages-Durchschnitt",
        profitFactor: "Profit Factor",
        lossMonths: "Verlust-Monate",
        tradesHeader: "Trades",
        tradesSub: "Historische Ausführungen direkt aus dem Broker-Feed",
        growthProj: "Wachstums-Projektion",
        projTitle: "Projektions-Engine",
        projSub: "Modelliert aus dem historischen Monatsschnitt, berechnet mit 24x Hebeleffekt, abzüglich 30% Erfolgsbeteiligung (= 19.15% netto / Monat).",
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
        btBadge: "Historische Handelsdaten",
        btTitle: "Backtest-Engine",
        btSub: "Simuliert den Verlauf mit synchronisierter Hebel-Skalierung (16.8x Netto) und monatlicher Zuzahlung.",
        btCapital: "Startkapital",
        btStart: "Startdatum",
        btEnd: "Enddatum",
        btMode: "Gewinn-Modus",
        modeReinvest: "Täglich Reinvestieren (Zinseszins)",
        modePayout: "Auszahlen (Konstantes Kapital)",
        projModeReinvest: "Täglich Reinvestieren (Zinseszins)",
        projModePayout: "Auszahlen (Konstantes Kapital)",
        btSimBal: "Simuliertes Endguthaben",
        btInvested: "Investiertes Kapital",
        btProfit: "Reingewinn",
        btGrowth: "Wachstum",
        disclaimerTitle: "Nur zur Veranschaulichung — keine Erfolgsgarantie.",
        disclaimerText: "Dies ist eine mathematische Veranschaulichung basierend auf der historischen Durchschnitts-Performance und keine verbindliche Prognose. Einzelne Monate schwankten ungehebelt zwischen +0.35% und +2.10%. Die 24× Hebelannahme ist eine rechnerische Näherung — realer gehebelter Handel unterliegt Margin-Anforderungen sowie Liquidationsrisiken, die nicht linear verlaufen. Die vergangene Wertentwicklung ist keine Garantie für zukünftige Ergebnisse. Sie können Ihr investiertes Kapital teilweise oder ganz verlieren. Handeln Sie ausschließlich mit Kapital, dessen Totalverlust Sie verkraften können."
    },
    en: {
        back: "Back",
        totalGain: "Total Gain",
        maxDrawdown: "Max Drawdown",
        liveTradesKpi: "Recorded Trades",
        avgMonth: "Avg Monthly Return",
        winRate: "Win Rate",
        accountPoolDetails: "Account Details",
        poolSub: "Social Trading Pool",
        aumPool: "AUM Pool",
        perfFee: "Performance Fee",
        avgTradeDuration: "Avg Trade Duration",
        minInvestment: "Min. Investment",
        performanceMetrics: "Performance Metrics",
        metricsSub: "Statistical evaluation of the Myfxbook portfolio",
        dailyAvg: "Daily Average",
        profitFactor: "Profit Factor",
        lossMonths: "Loss Months",
        tradesHeader: "Trades",
        tradesSub: "Documented executions directly from the broker feed",
        growthProj: "Growth Projection",
        projTitle: "Projection Engine",
        projSub: "Modeled from the historical monthly average, amplified 24x by broker leverage, minus 30% performance fee (= 19.15% net / month).",
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
        btBadge: "Historical Trading Data",
        btTitle: "Backtest Engine",
        btSub: "Simulates trade history with synchronized leverage scaling (16.8x net) and monthly top-up.",
        btCapital: "Starting Capital",
        btStart: "Start Date",
        btEnd: "End Date",
        btMode: "Profit Mode",
        modeReinvest: "Daily Reinvest (Compound)",
        modePayout: "Daily Payout (Constant Capital)",
        projModeReinvest: "Daily Reinvest (Compound)",
        projModePayout: "Daily Payout (Constant Capital)",
        btSimBal: "Simulated Balance",
        btInvested: "Invested Capital",
        btProfit: "Net Profit",
        btGrowth: "Growth",
        disclaimerTitle: "Illustrative only — not a guarantee.",
        disclaimerText: "This is a mathematical illustration based on historical average performance, not a forecast. Individual months have ranged from +0.35% to +2.10% unleveraged. The 24× leverage assumption is an approximation — real leveraged trading involves margin requirements and liquidation risk that do not scale in a perfectly linear way. Past performance does not guarantee future results, and you can lose part or all of your capital. Trade only with funds you can afford to lose."
    }
};

class DualEngineApp {
    constructor() {
        this.rawTrades = [];
        this.btChart = null;
        this.equityChart = null;
        this.currentLang = 'de';

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
            projModeSelect: document.getElementById('proj-mode-select'),
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
                this.calcProjection();
                if (this.btChart) this.btChart.update();
            });
        }
        this.applyTranslations();

        await this.loadTradesData();

        const tradesOnly = this.rawTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        const chronologicalTrades = [...tradesOnly].sort((a, b) => new Date(a.dt) - new Date(b.dt));

        if (chronologicalTrades.length > 0 && this.dom.btStart && this.dom.btEnd) {
            this.dom.btStart.value = chronologicalTrades[0].dt;
            this.dom.btEnd.value = chronologicalTrades[chronologicalTrades.length - 1].dt;
        }

        this.setupListeners();
        this.updateKPIs();
        this.initEquityGrowthChart();
        this.initBacktestChart();
        this.renderStatsAndTable();
        this.calcProjection();
        this.calcBacktest();
    }

    async loadTradesData() {
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
                let response = await fetch(file);
                if (response.ok) {
                    data = await response.json();
                    break;
                }
            } catch (e) {}
        }

        if (!data || !Array.isArray(data)) {
            console.warn("Konnte Daten nicht laden. Bitte prüfe das Vorhandensein im data/ Verzeichnis.");
            this.rawTrades = [];
            return;
        }

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

            const gain = parseFloat(t["Gain"] || 0);

            return {
                ...t,
                dt,
                d,
                parsedGain: isNaN(gain) ? 0 : gain
            };
        });
    }

    updateKPIs() {
        if (!this.rawTrades || this.rawTrades.length === 0) return;

        let tradesOnly = this.rawTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        let totalTrades = tradesOnly.length;
        
        let wins = 0, losses = 0;
        let grossProfit = 0, grossLoss = 0;
        let tradeProfitUSD = 0;
        let durations = [];

        tradesOnly.forEach(t => {
            let p = parseFloat(t.Profit) || 0;
            tradeProfitUSD += p;
            if (p > 0) { wins++; grossProfit += p; }
            else if (p < 0) { losses++; grossLoss += Math.abs(p); }

            if (t["Duration (DD:HH:MM:SS)"]) {
                let parts = t["Duration (DD:HH:MM:SS)"].split(':');
                if(parts.length === 4) {
                    let ms = (parseInt(parts[0])*86400 + parseInt(parts[1])*3600 + parseInt(parts[2])*60 + parseInt(parts[3])) * 1000;
                    durations.push(ms);
                }
            }
        });

        durations.sort((a, b) => a - b);
        let medianDurationMs = 0;
        if (durations.length > 0) {
            let mid = Math.floor(durations.length / 2);
            medianDurationMs = durations.length % 2 !== 0 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2;
        }

        let deposits = 0, withdrawals = 0, currentBal = 0, highestBal = 0;
        let currentGain = 0, peakGain = 0, maxDrawdown = 0;

        this.rawTrades.forEach(t => {
            let action = (t.Action || "").toUpperCase();
            let p = parseFloat(t.Profit) || 0;
            let g = parseFloat(t.Gain) || 0;

            if (action === 'DEPOSIT') {
                deposits += p;
                currentBal += p;
            } else if (action === 'WITHDRAWAL') {
                withdrawals += Math.abs(p);
                currentBal += p;
            } else if (action === 'BUY' || action === 'SELL') {
                currentBal += p;
                currentGain += g;
                if (currentGain > peakGain) peakGain = currentGain;
                let dd = peakGain - currentGain;
                if (dd > maxDrawdown) maxDrawdown = dd;
            }
            if (currentBal > highestBal) highestBal = currentBal;
        });

        if (deposits === 0) { deposits = 10000; currentBal += 10000; highestBal += 10000; }

        let winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(2) : 0;
        let profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? grossProfit.toFixed(2) : "0.00");

        let avgDurationStr = "~12 min";
        let validDurations = durations.length;
        if (validDurations > 0) {
            let mins = Math.round((medianDurationMs) / 60000);
            if (mins > 1440) avgDurationStr = "~" + Math.round(mins/1440) + " d";
            else if (mins > 60) avgDurationStr = "~" + Math.round(mins/60) + " h";
            else avgDurationStr = "~" + (mins < 1 ? 1 : mins) + " min";
        }

        const formatMoney = (val) => '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

        let chronologicalTrades = [...tradesOnly].sort((a, b) => new Date(a.dt) - new Date(b.dt));
        let firstDate = new Date(chronologicalTrades[0].dt);
        let lastDate = new Date(chronologicalTrades[chronologicalTrades.length - 1].dt);
        let daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
        if (daysDiff < 1) daysDiff = 1;
        let monthsDiff = daysDiff / 30.44;

        let dailyGain = currentGain / daysDiff;
        let monthlyGain = currentGain / monthsDiff;

        setEl('kpi-total-gain', '+' + currentGain.toFixed(2) + '%');
        setEl('kpi-max-drawdown', maxDrawdown.toFixed(2) + '%');
        setEl('kpi-trades', totalTrades);
        setEl('kpi-monthly-gain', '+' + monthlyGain.toFixed(2) + '%');
        setEl('kpi-winrate-main', winRate + '%'); 

        setEl('kpi-daily-avg', '+' + dailyGain.toFixed(2) + '%');
        setEl('kpi-profit-factor', profitFactor);
        setEl('kpi-avg-duration', avgDurationStr);
        setEl('kpi-loss-months', '0');

        setEl('kpi-winrate', winRate + '%');
        setEl('kpi-win-loss-text', `${wins} Win / ${losses} Lose`);
        setEl('kpi-trades-text', `${totalTrades} Closed Trades`);

        setEl('myfx-gain', '+' + currentGain.toFixed(2) + '%');
        setEl('myfx-abs-gain', '+' + currentGain.toFixed(2) + '%');
        setEl('myfx-daily', dailyGain.toFixed(2) + '%');
        setEl('myfx-monthly', monthlyGain.toFixed(2) + '%');
        setEl('myfx-drawdown', maxDrawdown.toFixed(2) + '%');
        
        setEl('myfx-balance', formatMoney(currentBal));
        setEl('myfx-equity', `(100.00%) ${formatMoney(currentBal)}`);
        setEl('myfx-highest', formatMoney(highestBal));
        setEl('myfx-profit', formatMoney(tradeProfitUSD));
        setEl('myfx-deposits', formatMoney(deposits));
        setEl('myfx-withdrawals', formatMoney(withdrawals));
        setEl('stat-total', totalTrades);
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

        if (this.dom.projModeSelect) this.dom.projModeSelect.addEventListener('change', () => this.calcProjection());

        sync(this.dom.btDepSlider, this.dom.btDepInput, () => this.calcBacktest());
        sync(this.dom.btTopSlider, this.dom.btTopInput, () => this.calcBacktest());
        if (this.dom.btStart) this.dom.btStart.addEventListener('change', () => this.calcBacktest());
        if (this.dom.btEnd) this.dom.btEnd.addEventListener('change', () => this.calcBacktest());
        if (this.dom.btMode) this.dom.btMode.addEventListener('change', () => this.calcBacktest());
    }

    simulateProj(deposit, topup, months, rate, mode) {
        let balance = deposit;
        let invested = deposit;
        let payouts = 0;
        for (let m = 1; m <= months; m++) {
            if (mode === 'payout') {
                payouts += balance * rate;
                if (m < months) {
                    balance += topup;
                    invested += topup;
                }
            } else {
                balance = balance * (1 + rate);
                if (m < months) {
                    balance += topup;
                    invested += topup;
                }
            }
        }
        return { balance: mode === 'payout' ? balance + payouts : balance, invested };
    }

    calcProjection() {
        if (!this.dom.projDepInput) return;
        let deposit = parseFloat(this.dom.projDepInput.value) || 0;
        let topup = parseFloat(this.dom.projTopInput ? this.dom.projTopInput.value : 0) || 0;
        let months = parseInt(this.dom.projMoInput.value) || 12;
        let mode = this.dom.projModeSelect ? this.dom.projModeSelect.value : 'reinvest';

        if (this.dom.projResMo) this.dom.projResMo.innerText = months;

        let resAvg = this.simulateProj(deposit, topup, months, this.rates.avg, mode);
        let resCons = this.simulateProj(deposit, topup, months, this.rates.cons, mode);
        let resOpt = this.simulateProj(deposit, topup, months, this.rates.opt, mode);

        let multiplier = resAvg.invested > 0 ? (resAvg.balance / resAvg.invested).toFixed(1) : '0.0';

        if (this.dom.projResBal) this.dom.projResBal.innerText = this.formatMoney(resAvg.balance);
        if (this.dom.projResInv) this.dom.projResInv.innerText = this.formatMoney(resAvg.invested);
        if (this.dom.projResMult) this.dom.projResMult.innerText = multiplier + 'x';

        if (this.dom.projConsBal) this.dom.projConsBal.innerText = this.formatMoney(resCons.balance);
        if (this.dom.projOptBal) this.dom.projOptBal.innerText = this.formatMoney(resOpt.balance);

        const projScenTitle = document.getElementById('proj-scen-title');
        if (projScenTitle) {
            if (mode === 'payout') {
                projScenTitle.innerHTML = (this.currentLang === 'de')
                    ? `Gesamtkapital + Auszahlungen nach <span id="proj-res-month">${months}</span> Monaten`
                    : `Total Capital + Payouts After <span id="proj-res-month">${months}</span> Months`;
            } else {
                projScenTitle.innerHTML = (this.currentLang === 'de')
                    ? `Szenario nach <span id="proj-res-month">${months}</span> Monaten`
                    : `Scenario After <span id="proj-res-month">${months}</span> Months`;
            }
        }

        [1, 3, 6, 12].forEach(m => {
            let avgM = this.simulateProj(deposit, topup, m, this.rates.avg, mode).balance;
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

        if (!Chart.Tooltip.positioners.followGreenLine) {
            Chart.Tooltip.positioners.followGreenLine = function(elements, eventPosition) {
                if (!elements || elements.length === 0) return false;
                const greenElement = elements.find(el => el.datasetIndex === 0) || elements[0];
                return {
                    x: greenElement.element.x,
                    y: greenElement.element.y
                };
            };
        }

        this.btChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Portfolio Balance',
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
                    },
                    {
                        label: 'Invested Capital',
                        data: [],
                        borderColor: 'transparent',
                        backgroundColor: 'transparent',
                        borderWidth: 0,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        pointHitRadius: 0,
                        fill: false,
                        tension: 0,
                        hidden: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: 20,
                        right: 20,
                        top: 15,
                        bottom: 5
                    }
                },
                plugins: {
                    legend: { 
                        display: false
                    },
                    tooltip: {
                        position: 'followGreenLine',
                        backgroundColor: '#0A101C',
                        titleColor: '#00E5FF',
                        titleFont: { size: 13, family: "'JetBrains Mono', monospace", weight: 'bold' },
                        bodyColor: '#E2E8F0',
                        bodyFont: { size: 12, family: "'JetBrains Mono', monospace" },
                        bodySpacing: 6,
                        borderColor: '#1A2436',
                        borderWidth: 1,
                        padding: 14,
                        displayColors: false,
                        filter: function(tooltipItem) {
                            return tooltipItem.datasetIndex === 0;
                        },
                        callbacks: {
                            title: (items) => `Datum: ${items[0].label}`,
                            label: (ctx) => {
                                let balance = ctx.parsed.y;
                                let index = ctx.dataIndex;
                                let investedData = ctx.chart.data.datasets[1] ? ctx.chart.data.datasets[1].data : [];
                                let invested = (investedData && investedData[index] !== undefined)
                                    ? investedData[index]
                                    : 0;
                                let profit = balance - invested;
                                let growth = invested > 0 ? (profit / invested) * 100 : 0;
                                let signProfit = profit >= 0 ? '+' : '-';
                                let signGrowth = growth >= 0 ? '+' : '-';

                                let isDe = this.currentLang === 'de';
                                let lblBalance = isDe ? 'Endguthaben' : 'Portfolio Balance';
                                let lblInvested = isDe ? 'Investiert' : 'Invested Capital';
                                let lblProfit = isDe ? 'Reingewinn' : 'Net Profit';
                                let lblGrowth = isDe ? 'Wachstum' : 'Growth';

                                return [
                                    `${lblBalance}: $${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                    `${lblInvested}:  $${invested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                    `${lblProfit}:  ${signProfit}$${Math.abs(profit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                    `${lblGrowth}:    ${signGrowth}${Math.abs(growth).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                                ];
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false,
                    axis: 'x'
                },
                scales: {
                    x: { 
                        grid: { color: 'rgba(255, 255, 255, 0.02)' }, 
                        ticks: { maxTicksLimit: 6, font: { size: 10 }, color: '#94A3B8' } 
                    },
                    y: {
                        position: 'right',
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        border: { dash: [4, 4] },
                        ticks: {
                            maxTicksLimit: 6,
                            font: { size: 10 },
                            color: '#94A3B8',
                            callback: (val) => val >= 1000 ? '$' + (val / 1000).toFixed(1) + 'k' : '$' + val
                        }
                    }
                }
            }
        });
    }

    calcBacktest() {
        if (!this.rawTrades || this.rawTrades.length === 0) return;

        let tradesOnly = this.rawTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        let chronologicalTrades = [...tradesOnly].sort((a, b) => new Date(a.dt) - new Date(b.dt));

        let capital = parseFloat(this.dom.btDepInput.value) || 10000;
        let topup = parseFloat(this.dom.btTopInput ? this.dom.btTopInput.value : 0) || 0;
        let mode = this.dom.btMode ? this.dom.btMode.value : 'reinvest';

        let startStr = (this.dom.btStart && this.dom.btStart.value) || chronologicalTrades[0].dt;
        let endStr = (this.dom.btEnd && this.dom.btEnd.value) || chronologicalTrades[chronologicalTrades.length - 1].dt;

        let filteredTrades = chronologicalTrades.filter(t => t.dt >= startStr && t.dt <= endStr);
        if (filteredTrades.length === 0) return;

        let currentBalance = capital;
        let totalInvested = capital;
        let totalPayouts = 0;
        let lastMonth = '';

        let labels = [];
        let dataPoints = [];
        let investedPoints = [];

        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            let parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
            return dateStr;
        };

        filteredTrades.forEach((t) => {
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
            investedPoints.push(totalInvested);

            labels.push(formatDate(t.dt));
        });

        let finalBalance = mode === 'reinvest' ? dataPoints[dataPoints.length - 1] : (currentBalance + totalPayouts);
        let netProfit = finalBalance - totalInvested;
        let growth = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0;

        if (this.dom.btResBal) this.dom.btResBal.innerText = '$' + finalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        let resInvestedEl = document.getElementById('bt-res-invested');
        if (resInvestedEl) resInvestedEl.innerText = '$' + totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (this.dom.btResProf) {
            let formattedProfit = (netProfit >= 0 ? '+' : '-') + '$' + Math.abs(netProfit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            this.dom.btResProf.innerText = formattedProfit;
        }

        if (this.dom.btResGrowth) this.dom.btResGrowth.innerText = (growth >= 0 ? '+' : '') + growth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

        if (this.btChart) {
            this.btChart.data.labels = labels;
            this.btChart.data.datasets[0].data = dataPoints;
            this.btChart.data.datasets[1].data = investedPoints;
            this.btChart.update();
        }
    }

    initEquityGrowthChart() {
        const canvas = document.getElementById('equityGrowthChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let labels = [];
        let growthData = [];

        if (this.rawTrades && this.rawTrades.length > 0) {
            let tradesOnly = this.rawTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
            let chronologicalTrades = [...tradesOnly].sort((a, b) => new Date(a.dt) - new Date(b.dt));
            let step = Math.max(1, Math.floor(chronologicalTrades.length / 12));
            let accumGain = 0;

            for (let i = 0; i < chronologicalTrades.length; i++) {
                accumGain += parseFloat(chronologicalTrades[i].Gain) || 0;
                
                if (i % step === 0 || i === chronologicalTrades.length - 1) {
                    let d = new Date(chronologicalTrades[i].dt);
                    labels.push(d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: '2-digit' }));
                    growthData.push(accumGain.toFixed(2));
                }
            }
        } else {
            labels = ['Nov', 'Dec', 'Jan', 'Feb'];
            growthData = [0, 5, 10, 15];
        }

        let gradient = ctx.createLinearGradient(0, 0, 0, 280);
        gradient.addColorStop(0, 'rgba(0, 229, 255, 0.15)');
        gradient.addColorStop(1, 'rgba(0, 229, 255, 0.0)');

        this.equityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Growth',
                    data: growthData,
                    borderColor: '#00E5FF',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#040914',
                    pointBorderColor: '#00E5FF',
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0A101C',
                        titleColor: '#00E5FF',
                        titleFont: { size: 13, family: "'JetBrains Mono', monospace", weight: 'bold' },
                        bodyColor: '#E2E8F0',
                        bodyFont: { size: 12, family: "'JetBrains Mono', monospace" },
                        borderColor: '#1A2436',
                        borderWidth: 1,
                        padding: 14,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return 'Growth: ' + context.parsed.y + '%';
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.02)' },
                        ticks: { color: '#94A3B8', font: { size: 10 }, maxTicksLimit: 6 }
                    },
                    y: {
                        position: 'left',
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        border: { dash: [4, 4] },
                        ticks: {
                            color: '#94A3B8',
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

        let tradesOnly = this.rawTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        let tableTrades = [...tradesOnly].sort((a, b) => new Date(b.dt) - new Date(a.dt));

        if (!tableTrades || tableTrades.length === 0) {
            this.dom.tradesBody.innerHTML = `
                <tr>
                    <td colspan="10" class="px-6 py-8 text-center text-zinc-500 font-sans">
                        Warte auf Trade-Daten. Bitte prüfe, ob die JSON-Datei im Ordner <code>data/</code> liegt.
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        tableTrades.forEach(t => {
            const rawAction = (t.Action || "").toUpperCase();
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