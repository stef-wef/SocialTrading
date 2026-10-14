class DualEngineApp {
    constructor() {
        this.rawTrades = [];
        this.liveTableTrades = null;

        this.btChart = null;
        this.equityChart = null;
        this.drawdownChart = null;
        this.rrChart = null;
        this.currentLang = 'de';
        this.timeframe = 'ALL';

        this.isNeo = window.location.pathname.toLowerCase().includes('neofx');

        // 24x Broker-Skalierung abzgl. 30% Erfolgsbeteiligung = 16.8x Netto-Faktor
        this.backtestLeverageMult = 24 * 0.70;

        // Werden nach dem Laden der JSON-Daten dynamisch aus den echten Trades berechnet
        this.baseMonthlyAvg = this.isNeo ? 0.57 : 1.14;
        this.rates = this.isNeo
            ? { cons: 0.050, avg: 0.145, opt: 0.220 }
            : { cons: 0.0588, avg: 0.19152, opt: 0.3528 };

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
            projResSub: document.getElementById('proj-res-sub') || document.getElementById('proj-res-invested')?.parentElement,
            projResMult: document.getElementById('proj-res-mult'),
            projConsBal: document.getElementById('proj-cons-balance'),
            projOptBal: document.getElementById('proj-opt-balance'),
            projSubText: document.getElementById('proj-sub-text'),
            projConsLabel: document.getElementById('proj-cons-label'),
            projOptLabel: document.getElementById('proj-opt-label'),

            btDepInput: document.getElementById('bt-capital'),
            btDepSlider: document.getElementById('bt-capital-slider'),
            btTopInput: document.getElementById('bt-topup'),
            btTopSlider: document.getElementById('bt-topup-slider'),
            btStart: document.getElementById('bt-start-date'),
            btEnd: document.getElementById('bt-end-date'),
            btMode: document.getElementById('bt-mode-select'),
            btResBal: document.getElementById('bt-res-balance'),
            btResBalSub: document.getElementById('bt-res-balance-sub'),
            btResProf: document.getElementById('bt-res-profit'),
            btResProfSub: document.getElementById('bt-res-profit-sub'),
            btResGrowth: document.getElementById('bt-res-growth'),
            btResGrowthSub: document.getElementById('bt-res-growth-sub'),
            btSimLabel: document.getElementById('bt-sim-label'),

            statTotal: document.getElementById('stat-total'),
            tradesBody: document.getElementById('trades-table-body'),
            langToggle: document.getElementById('langToggle'),
            exportBtn: document.getElementById('export-csv-btn'),
            tfBtns: document.querySelectorAll('.tf-btn')
        };

        this.init();
    }

    getBaseLabel() {
        if (typeof translations !== 'undefined' && translations[this.currentLang]?.baseLabel) {
            return translations[this.currentLang].baseLabel;
        }
        return this.currentLang === 'de' ? 'Basis' : 'Base';
    }

    async init() {
        if (this.dom.langToggle) {
            this.dom.langToggle.addEventListener('click', () => {
                this.currentLang = this.currentLang === 'de' ? 'en' : 'de';
                this.dom.langToggle.innerText = this.currentLang === 'de' ? 'EN' : 'DE';
                this.applyTranslations();
                this.refreshDash();
                this.calcProjection();
                this.renderStatsAndTable();
                this.updateChartLocales();
            });
        }
        this.applyTranslations();
        this.setupTooltips();

        if (!this.isNeo && this.dom.tradesBody) {
            const loadingText = (typeof translations !== 'undefined' && translations[this.currentLang])
                ? (translations[this.currentLang].loadingLive || "Lade Live-Daten... Bitte warten.")
                : "Lade Live-Daten... Bitte warten.";
            this.dom.tradesBody.innerHTML = `<tr><td colspan="9" class="px-6 py-8 text-center text-zinc-500 font-sans"><div class="flex justify-center items-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>${loadingText}</span></div></td></tr>`;
        }

        await this.loadTradesData();
        this.calculateProjectionRatesFromData();

        const tradesOnly = this.rawTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        const chronologicalTrades = [...tradesOnly].sort((a, b) => a.ts - b.ts);

        if (chronologicalTrades.length > 0 && this.dom.btStart && this.dom.btEnd) {
            this.dom.btStart.value = chronologicalTrades[0].dt;
            this.dom.btEnd.value = chronologicalTrades[chronologicalTrades.length - 1].dt;
        }

        this.initAdvancedCharts();
        this.setupListeners();
        this.setupAccordions();
        this.initBacktestChart();
        this.refreshDash();
        this.calcProjection();

        if (!this.isNeo) {
            this.loadLiveTableData().then(() => {
                this.renderStatsAndTable();
            });
        } else {
            this.renderStatsAndTable();
        }
    }

    // Berechnet die monatlichen Raten (avg, cons, opt) für die Projektions-Engine direkt aus den JSON-Daten
    calculateProjectionRatesFromData() {
        const tradesOnly = this.rawTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        if (tradesOnly.length === 0) return;

        const chronological = [...tradesOnly].sort((a, b) => a.ts - b.ts);
        const firstDate = new Date(chronological[0].dt);
        const lastDate = new Date(chronological[chronological.length - 1].dt);
        const daysDiff = Math.max((lastDate - firstDate) / (1000 * 60 * 60 * 24), 1);
        const monthsDiff = Math.max(daysDiff / 30.44, 1);

        let totalBaseGain = 0;
        const monthlyGains = {};

        chronological.forEach(t => {
            const g = t.parsedGain || 0;
            totalBaseGain += g;
            const mKey = t.dt.substring(0, 7);
            if (!monthlyGains[mKey]) monthlyGains[mKey] = 0;
            monthlyGains[mKey] += g;
        });

        this.baseMonthlyAvg = totalBaseGain / monthsDiff;
        const avgNetMonthlyPercent = this.baseMonthlyAvg * this.backtestLeverageMult;

        const monthValuesNet = Object.values(monthlyGains)
            .map(g => g * this.backtestLeverageMult)
            .filter(v => v > 0)
            .sort((a, b) => a - b);

        let consNetPercent = avgNetMonthlyPercent * 0.35;
        let optNetPercent = avgNetMonthlyPercent * 1.65;

        if (monthValuesNet.length >= 3) {
            const q20Idx = Math.max(0, Math.floor(monthValuesNet.length * 0.2));
            const q85Idx = Math.min(monthValuesNet.length - 1, Math.floor(monthValuesNet.length * 0.85));
            consNetPercent = monthValuesNet[q20Idx];
            optNetPercent = monthValuesNet[q85Idx];
        }

        this.rates = {
            cons: Math.max(consNetPercent / 100, 0.01),
            avg: Math.max(avgNetMonthlyPercent / 100, 0.01),
            opt: Math.max(optNetPercent / 100, 0.02)
        };
    }

    setupTooltips() {
        const wrappers = document.querySelectorAll('.tt-wrapper');

        const adjustPosition = (wrapper) => {
            wrapper.classList.remove('tt-left', 'tt-right');
            const rect = wrapper.getBoundingClientRect();
            const vw = window.innerWidth;

            if (rect.left < 120) {
                wrapper.classList.add('tt-left');
            } else if (vw - rect.right < 120) {
                wrapper.classList.add('tt-right');
            }
        };

        wrappers.forEach(wrapper => {
            wrapper.addEventListener('mouseenter', () => adjustPosition(wrapper));
            wrapper.addEventListener('click', (e) => {
                e.stopPropagation();
                const isActive = wrapper.classList.contains('tt-active');
                wrappers.forEach(w => w.classList.remove('tt-active'));
                if (!isActive) {
                    adjustPosition(wrapper);
                    wrapper.classList.add('tt-active');
                }
            });
        });

        document.addEventListener('click', () => {
            wrappers.forEach(w => w.classList.remove('tt-active'));
        });
    }

    updateChartLocales() {
        if (this.rrChart && typeof translations !== 'undefined' && translations[this.currentLang]) {
            this.rrChart.data.labels = [
                translations[this.currentLang].typWin || 'Typischer Win',
                translations[this.currentLang].typLoss || 'Typischer Loss'
            ];
            this.rrChart.update();
        }
        if (this.btChart) this.btChart.update();
        if (this.drawdownChart) this.drawdownChart.update();
        if (this.equityChart) this.equityChart.update();
    }

    refreshDash() {
        const filtered = this.getFilteredTrades(this.rawTrades);
        this.updateKPIs(filtered);
        this.initEquityGrowthChart(filtered);
        this.renderHeatmap(filtered);

        if (this.dom.btStart && this.dom.btEnd && filtered.length > 0) {
            const tradesOnly = filtered.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
            if (tradesOnly.length > 0) {
                const chronologicalTrades = [...tradesOnly].sort((a, b) => a.ts - b.ts);
                this.dom.btStart.value = chronologicalTrades[0].dt;
                this.dom.btEnd.value = chronologicalTrades[chronologicalTrades.length - 1].dt;
                this.calcBacktest();
            }
        }
    }

    getFilteredTrades(source) {
        if (this.timeframe === 'ALL') return source;

        const tradesOnly = source.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        const sorted = [...tradesOnly].sort((a, b) => a.ts - b.ts);
        if (sorted.length === 0) return source;

        const lastDate = new Date(sorted[sorted.length - 1].dt);
        const cutoff = new Date(lastDate);

        if (this.timeframe === '1M') cutoff.setMonth(cutoff.getMonth() - 1);
        if (this.timeframe === '3M') cutoff.setMonth(cutoff.getMonth() - 3);
        if (this.timeframe === '6M') cutoff.setMonth(cutoff.getMonth() - 6);

        return source.filter(t => !t.Action || (t.Action.toUpperCase() !== 'BUY' && t.Action.toUpperCase() !== 'SELL') || new Date(t.dt) >= cutoff);
    }

    parseDate(dateStr) {
        let dt = "2025-01-01";
        let d = "01.01.2025";
        let ts = 0;
        if (!dateStr) return { dt, d, ts };

        const parts = dateStr.trim().split(" ");
        const datePart = parts[0];
        const timePart = parts[1] || "00:00";

        if (datePart.includes("/")) {
            const p = datePart.split("/");
            if (p.length === 3) {
                dt = `${p[2]}-${p[0].padStart(2, '0')}-${p[1].padStart(2, '0')}`;
                d = `${p[1].padStart(2, '0')}.${p[0].padStart(2, '0')}.${p[2]} ${timePart}`;
            }
        } else if (datePart.includes(".")) {
            const p = datePart.split(".");
            if (p.length === 3) {
                dt = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                d = `${p[0].padStart(2, '0')}.${p[1].padStart(2, '0')}.${p[2]} ${timePart}`;
            }
        } else if (datePart.includes("-")) {
            const p = datePart.split("-");
            if (p.length === 3) {
                dt = datePart;
                d = `${p[2]}.${p[1]}.${p[0]} ${timePart}`;
            }
        }

        const timeNorm = timePart.length === 5 ? `${timePart}:00` : timePart;
        ts = new Date(`${dt}T${timeNorm}`).getTime() || new Date(dt).getTime() || 0;
        return { dt, d, ts };
    }

    async loadTradesData() {
        let data = null;

        const candidateFiles = this.isNeo
            ? ['../data/NEO_TradesData.json', '../data/Neo_TradesData.json', '../data/neo_tradesdata.json', '/data/NEO_TradesData.json', 'data/NEO_TradesData.json']
            : ['../data/Sonic_TradesData.json', '../data/Sonic_tradesdata.json', '../data/trades_data.json', '/data/Sonic_TradesData.json', 'data/Sonic_TradesData.json'];

        for (const file of candidateFiles) {
            try {
                const response = await fetch(file);
                if (response.ok) {
                    data = await response.json();
                    break;
                }
            } catch (e) {}
        }

        if (!data || !Array.isArray(data)) {
            console.warn("Konnte lokale JSON Daten nicht laden.");
            this.rawTrades = [];
            return;
        }

        this.rawTrades = data.map(t => {
            const dateObj = this.parseDate(t["Open Date"]);
            const gain = parseFloat(t["Gain"] || 0);
            return {
                ...t,
                dt: dateObj.dt,
                d: dateObj.d,
                ts: dateObj.ts,
                parsedGain: isNaN(gain) ? 0 : gain
            };
        });
    }

    async loadLiveTableData() {
        try {
            const response = await fetch('https://tagmarkets-backend.onrender.com/api/live-trades');
            if (response.ok) {
                const responseData = await response.json();
                const rawTradesArray = responseData.trades || [];

                if (Array.isArray(rawTradesArray)) {
                    this.liveTableTrades = rawTradesArray.map(t => {
                        const dateObj = this.parseDate(t["Open Date"]);
                        let rawLots = t["Units/Lots"];
                        if (typeof rawLots === 'object' && rawLots !== null) rawLots = rawLots.value;
                        const lots = parseFloat(rawLots) || 0;
                        const profit = parseFloat(t["Profit"] || 0);
                        let gain = parseFloat(t["Gain"] || 0);

                        // Sicherheits-Korrektur: Falls das Backend den Gain aus einer stark erhöhten
                        // Lot-Grösse (> 0.005 Lots) über den fixen Teiler 1200.52 berechnet hat,
                        // normieren wir ihn hier auf die 1x-Basis-Lotgrösse (0.001 Lots).
                        if (lots > 0.005 && Math.abs(gain) > 0.5) {
                            if (profit !== 0) {
                                const normalizedProfit = (profit / lots) * 0.001;
                                gain = (normalizedProfit / 1200.52) * 100;
                            } else {
                                gain = (gain / lots) * 0.001;
                            }
                        }

                        return {
                            ...t,
                            dt: dateObj.dt,
                            d: dateObj.d,
                            ts: dateObj.ts,
                            parsedGain: isNaN(gain) ? 0 : gain
                        };
                    });

                    const syncEl = document.getElementById('live-sync-time');
                    if (syncEl && responseData.lastSync) {
                        const syncDate = new Date(responseData.lastSync);
                        const today = new Date();

                        let datePrefix = "heute";
                        if (syncDate.getDate() !== today.getDate() || syncDate.getMonth() !== today.getMonth()) {
                            datePrefix = syncDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                        }

                        const timeStr = syncDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                        syncEl.innerText = `Letzter Sync: ${datePrefix} um ${timeStr}`;
                    }
                }
            }
        } catch (error) {
            console.warn("Fehler beim Laden der Live-Tabelle vom Backend:", error);
            this.liveTableTrades = [];
        }
    }

    initAdvancedCharts() {
        Chart.defaults.font.family = "'JetBrains Mono', monospace";
        Chart.defaults.color = '#94A3B8';

        const isMobile = window.innerWidth < 768;

        const ddCanvas = document.getElementById('drawdownChart');
        if (ddCanvas) {
            const ctx = ddCanvas.getContext('2d');
            this.drawdownChart = new Chart(ctx, {
                data: {
                    labels: [],
                    datasets: [
                        {
                            type: 'line',
                            label: 'Drawdown',
                            data: [],
                            borderColor: '#F43F5E',
                            backgroundColor: 'rgba(244, 63, 94, 0.15)',
                            borderWidth: 1.5,
                            fill: true,
                            pointRadius: 0,
                            tension: 0.2,
                            order: 2
                        },
                        {
                            type: 'bar',
                            label: 'Daily PnL',
                            data: [],
                            backgroundColor: (context) => {
                                const val = context.raw || 0;
                                return val > 0 ? '#34D399' : '#F43F5E';
                            },
                            borderRadius: 2,
                            barPercentage: 0.7,
                            categoryPercentage: 0.82,
                            maxBarThickness: isMobile ? 8 : 14,
                            minBarLength: 2,
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            left: isMobile ? 2 : 4,
                            right: isMobile ? 2 : 6,
                            top: 8,
                            bottom: 0
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#0A101C',
                            titleColor: '#00E5FF',
                            bodyColor: '#E2E8F0',
                            borderColor: '#1A2436',
                            borderWidth: 1,
                            padding: 10,
                            callbacks: {
                                title: (items) => {
                                    const isDe = this.currentLang === 'de';
                                    const d = new Date(items[0].label);
                                    if (isNaN(d.getTime())) return `${isDe ? 'Datum' : 'Date'}: ${items[0].label}`;
                                    return `${isDe ? 'Datum' : 'Date'}: ${d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
                                },
                                label: (c) => {
                                    const isDe = this.currentLang === 'de';
                                    const baseLbl = this.getBaseLabel();
                                    const netVal = c.parsed.y;
                                    const baseVal = netVal / this.backtestLeverageMult;
                                    if (c.datasetIndex === 0) {
                                        return `Drawdown: ${netVal.toFixed(2)}% (${baseLbl}: ${baseVal.toFixed(2)}%)`;
                                    }
                                    const sign = netVal > 0 ? '+' : '';
                                    return `${isDe ? 'Tages-PnL: ' : 'Daily PnL: '}${sign}${netVal.toFixed(2)}% (${baseLbl}: ${sign}${baseVal.toFixed(2)}%)`;
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
                            display: true,
                            offset: true,
                            grid: { color: 'rgba(255, 255, 255, 0.02)', drawTicks: false },
                            border: { display: false },
                            ticks: {
                                maxTicksLimit: isMobile ? 4 : 6,
                                maxRotation: 0,
                                autoSkip: true,
                                align: 'inner',
                                font: { size: isMobile ? 8 : 10 },
                                color: '#94A3B8',
                                padding: 6,
                                callback: function(val) {
                                    const label = this.getLabelForValue(val);
                                    if (!label) return '';
                                    const d = new Date(label);
                                    if (isNaN(d.getTime())) return label;
                                    return d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: '2-digit' });
                                }
                            }
                        },
                        y: {
                            position: 'right',
                            grid: { color: 'rgba(255, 255, 255, 0.05)', drawTicks: false },
                            border: { dash: [4, 4], display: false },
                            ticks: {
                                maxTicksLimit: 6,
                                callback: (v) => Number(v.toFixed(1)) + '%',
                                color: '#94A3B8',
                                font: { size: isMobile ? 8 : 10 },
                                padding: isMobile ? 6 : 8
                            }
                        }
                    }
                }
            });
        }

        const rrCanvas = document.getElementById('rrChart');
        if (rrCanvas) {
            const ctx = rrCanvas.getContext('2d');
            const winLbl = (typeof translations !== 'undefined' && translations[this.currentLang]?.typWin) || 'Typischer Win';
            const lossLbl = (typeof translations !== 'undefined' && translations[this.currentLang]?.typLoss) || 'Typischer Loss';

            this.rrChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: [winLbl, lossLbl],
                    datasets: [{
                        data: [1, 1],
                        backgroundColor: ['#34D399', '#FB7185'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#0A101C',
                            bodyColor: '#E2E8F0',
                            borderColor: '#1A2436',
                            borderWidth: 1,
                            padding: 10,
                            callbacks: {
                                label: (c) => {
                                    const baseLbl = this.getBaseLabel();
                                    const netVal = c.raw || 0;
                                    const baseVal = netVal / this.backtestLeverageMult;
                                    return `${c.label}: $${netVal.toFixed(2)} (${baseLbl}: $${baseVal.toFixed(2)})`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    updateKPIs(activeTrades) {
        if (!activeTrades || activeTrades.length === 0) return;

        const tradesOnly = activeTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        const chronologicalTrades = [...tradesOnly].sort((a, b) => a.ts - b.ts);
        const totalTrades = chronologicalTrades.length;
        if (totalTrades === 0) return;

        let wins = 0, losses = 0;
        let grossProfit = 0, grossLoss = 0;
        const durations = [];
        const winBaseArray = [], lossBaseArray = [];

        let deposits = 0, withdrawals = 0, currentBal = 0, highestBal = 0;
        let currentBaseGain = 0, peakBaseGain = 0, maxBaseDrawdown = 0;
        const dailyData = {};
        const baseCapital = 1000;
        let simCurrentBal = baseCapital;

        chronologicalTrades.forEach(t => {
            const action = (t.Action || "").toUpperCase();
            const g = t.parsedGain || 0;
            const date = t.dt;

            if (action === 'BUY' || action === 'SELL') {
                const simulatedBaseProfit = simCurrentBal * (g / 100);
                simCurrentBal += simulatedBaseProfit;

                if (simulatedBaseProfit > 0) {
                    wins++;
                    grossProfit += simulatedBaseProfit;
                    winBaseArray.push(simulatedBaseProfit);
                } else if (simulatedBaseProfit < 0) {
                    losses++;
                    grossLoss += Math.abs(simulatedBaseProfit);
                    lossBaseArray.push(Math.abs(simulatedBaseProfit));
                }

                currentBaseGain += g;
                if (currentBaseGain > peakBaseGain) peakBaseGain = currentBaseGain;
                const ddBase = currentBaseGain - peakBaseGain;
                if (Math.abs(ddBase) > maxBaseDrawdown) maxBaseDrawdown = Math.abs(ddBase);

                if (!dailyData[date]) dailyData[date] = { pnlBase: 0, drawdownBase: 0 };
                dailyData[date].pnlBase += g;
                dailyData[date].drawdownBase = ddBase;

                if (t["Duration (DD:HH:MM:SS)"]) {
                    const parts = t["Duration (DD:HH:MM:SS)"].split(':');
                    if (parts.length === 4) {
                        durations.push((parseInt(parts[0]) * 86400 + parseInt(parts[1]) * 3600 + parseInt(parts[2]) * 60 + parseInt(parts[3])) * 1000);
                    }
                }
            }
        });

        const drawdownLabels = Object.keys(dailyData);
        const drawdownNetPoints = drawdownLabels.map(d => dailyData[d].drawdownBase * this.backtestLeverageMult);
        const tradeGainNetPoints = drawdownLabels.map(d => dailyData[d].pnlBase * this.backtestLeverageMult);

        const getMedian = (arr) => {
            if (arr.length === 0) return 0;
            arr.sort((a, b) => a - b);
            const mid = Math.floor(arr.length / 2);
            return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
        };

        const typBaseWin = getMedian(winBaseArray);
        const typBaseLoss = getMedian(lossBaseArray);
        const typNetWin = typBaseWin * this.backtestLeverageMult;
        const typNetLoss = typBaseLoss * this.backtestLeverageMult;

        const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? grossProfit.toFixed(2) : "0.00");

        durations.sort((a, b) => a - b);
        const medianDurationMs = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0;
        let avgDurationStr = "~12 min";
        if (durations.length > 0) {
            const mins = Math.round(medianDurationMs / 60000);
            if (mins > 1440) avgDurationStr = "~" + Math.round(mins / 1440) + " d";
            else if (mins > 60) avgDurationStr = "~" + Math.round(mins / 60) + " h";
            else avgDurationStr = "~" + (mins < 1 ? 1 : mins) + " min";
        }

        const setEl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };
        const setHtml = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = val;
        };

        const firstDate = new Date(chronologicalTrades[0].dt);
        const lastDate = new Date(chronologicalTrades[chronologicalTrades.length - 1].dt);
        const daysDiff = Math.max((lastDate - firstDate) / (1000 * 60 * 60 * 24), 1);
        const monthsDiff = Math.max(daysDiff / 30.44, 1);

        const dailyBaseGain = currentBaseGain / daysDiff;
        const monthlyBaseGain = currentBaseGain / monthsDiff;

        const currentNetGain = currentBaseGain * this.backtestLeverageMult;
        const maxNetDrawdown = maxBaseDrawdown * this.backtestLeverageMult;
        const dailyNetGain = dailyBaseGain * this.backtestLeverageMult;
        const monthlyNetGain = monthlyBaseGain * this.backtestLeverageMult;

        const dailyReturnsArr = Object.values(dailyData).map(d => d.pnlBase);
        let sharpe = "0.00";
        if (dailyReturnsArr.length > 1) {
            const mean = dailyReturnsArr.reduce((a, b) => a + b, 0) / dailyReturnsArr.length;
            const variance = dailyReturnsArr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (dailyReturnsArr.length - 1);
            const stdDev = Math.sqrt(variance);
            if (stdDev > 0) sharpe = ((mean / stdDev) * Math.sqrt(252)).toFixed(2);
        }

        const longs = chronologicalTrades.filter(t => t.Action.toUpperCase() === 'BUY');
        const shorts = chronologicalTrades.filter(t => t.Action.toUpperCase() === 'SELL');
        const winRateLong = longs.length > 0 ? ((longs.filter(t => (t.parsedGain || 0) > 0).length / longs.length) * 100).toFixed(1) + '%' : '-';
        const winRateShort = shorts.length > 0 ? ((shorts.filter(t => (t.parsedGain || 0) > 0).length / shorts.length) * 100).toFixed(1) + '%' : '-';
        const recoveryFactor = maxBaseDrawdown > 0 ? (currentBaseGain / maxBaseDrawdown).toFixed(2) : "0.00";

        const baseLbl = this.getBaseLabel();

        // Option A: 16.8x Netto oben, 1x Basis darunter
        setEl('kpi-total-gain', (currentNetGain >= 0 ? '+' : '') + currentNetGain.toFixed(2) + '%');
        setEl('kpi-total-gain-sub', `${baseLbl}: ${currentBaseGain >= 0 ? '+' : ''}${currentBaseGain.toFixed(2)}%`);

        setEl('kpi-max-drawdown', maxNetDrawdown.toFixed(2) + '%');
        setEl('kpi-max-drawdown-sub', `${baseLbl}: ${maxBaseDrawdown.toFixed(2)}%`);

        setEl('kpi-trades', totalTrades);

        setEl('kpi-monthly-gain', (monthlyNetGain >= 0 ? '+' : '') + monthlyNetGain.toFixed(2) + '%');
        setEl('kpi-monthly-gain-sub', `${baseLbl}: ${monthlyBaseGain >= 0 ? '+' : ''}${monthlyBaseGain.toFixed(2)}%`);

        setEl('kpi-daily-avg', (dailyNetGain >= 0 ? '+' : '') + dailyNetGain.toFixed(2) + '%');
        setEl('kpi-daily-avg-sub', `${baseLbl}: ${dailyBaseGain >= 0 ? '+' : ''}${dailyBaseGain.toFixed(2)}%`);

        setEl('kpi-profit-factor', profitFactor);
        setEl('kpi-avg-duration', avgDurationStr);
        setEl('kpi-sharpe', sharpe);
        setEl('kpi-win-long', winRateLong);
        setEl('kpi-win-short', winRateShort);
        setEl('kpi-recovery', recoveryFactor);

        let lossMonths = 0;
        let prevM = null, mGain = 0;
        chronologicalTrades.forEach(t => {
            const m = t.dt.substring(0, 7);
            if (m !== prevM && prevM !== null) {
                if (mGain < 0) lossMonths++;
                mGain = 0;
            }
            mGain += t.parsedGain || 0;
            prevM = m;
        });
        if (mGain < 0) lossMonths++;
        setEl('kpi-loss-months', lossMonths);

        // Live Metrics Panel (Option A)
        setHtml('myfx-gain', `${currentNetGain >= 0 ? '+' : ''}${currentNetGain.toFixed(2)}% <span class="text-[9px] text-zinc-500 font-normal block">${baseLbl}: +${currentBaseGain.toFixed(2)}%</span>`);
        setHtml('myfx-abs-gain', `${currentNetGain >= 0 ? '+' : ''}${currentNetGain.toFixed(2)}% <span class="text-[9px] text-zinc-500 font-normal block">${baseLbl}: +${currentBaseGain.toFixed(2)}%</span>`);
        setHtml('myfx-daily', `${dailyNetGain >= 0 ? '+' : ''}${dailyNetGain.toFixed(2)}% <span class="text-[9px] text-zinc-500 font-normal block">${baseLbl}: +${dailyBaseGain.toFixed(2)}%</span>`);
        setHtml('myfx-monthly', `${monthlyNetGain >= 0 ? '+' : ''}${monthlyNetGain.toFixed(2)}% <span class="text-[9px] text-zinc-500 font-normal block">${baseLbl}: +${monthlyBaseGain.toFixed(2)}%</span>`);
        setHtml('myfx-drawdown', `${maxNetDrawdown.toFixed(2)}% <span class="text-[9px] text-zinc-500 font-normal block">${baseLbl}: ${maxBaseDrawdown.toFixed(2)}%</span>`);

        // Risk / Reward (Option A)
        setEl('avg-win-text', '+$' + typNetWin.toFixed(2));
        setEl('avg-win-sub', `${baseLbl}: +$${typBaseWin.toFixed(2)}`);
        setEl('avg-loss-text', '-$' + typNetLoss.toFixed(2));
        setEl('avg-loss-sub', `${baseLbl}: -$${typBaseLoss.toFixed(2)}`);

        const winLossHeaderEl = document.getElementById('kpi-win-loss-text');
        if (winLossHeaderEl) {
            winLossHeaderEl.innerHTML = `<span class="text-emerald-400 font-bold">${wins} Win</span> <span class="text-zinc-500 font-normal">/</span> <span class="text-rose-400 font-bold">${losses} Lose</span>`;
        }

        if (this.rrChart) {
            this.rrChart.data.datasets[0].data = [typNetWin, typNetLoss];
            this.rrChart.update();
        }
        if (this.drawdownChart) {
            this.drawdownChart.data.labels = drawdownLabels;
            this.drawdownChart.data.datasets[0].data = drawdownNetPoints;
            if (this.drawdownChart.data.datasets[1]) {
                this.drawdownChart.data.datasets[1].data = tradeGainNetPoints;
            }
            this.drawdownChart.update();
        }

        const allChronological = [...activeTrades].sort((a, b) => a.ts - b.ts);
        allChronological.forEach(t => {
            const action = (t.Action || "").toUpperCase();
            const p = parseFloat(t.Profit) || 0;
            if (action === 'DEPOSIT') {
                deposits += p;
                currentBal += p;
            } else if (action === 'WITHDRAWAL') {
                withdrawals += Math.abs(p);
                currentBal += p;
            } else if (action === 'BUY' || action === 'SELL') {
                currentBal += p;
            }
            if (currentBal > highestBal) highestBal = currentBal;
        });

        if (deposits === 0) {
            deposits = 10000;
            currentBal += 10000;
            highestBal += 10000;
        }

        const formatMoney = (val) => '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        setEl('myfx-balance', formatMoney(currentBal));
        setEl('myfx-equity', `(100.00%) ${formatMoney(currentBal)}`);
        setEl('myfx-highest', formatMoney(highestBal));
        setEl('myfx-profit', formatMoney(currentBal - deposits + withdrawals));
        setEl('myfx-deposits', formatMoney(deposits));
        setEl('myfx-withdrawals', formatMoney(withdrawals));
        setEl('stat-total', totalTrades);
    }

    initEquityGrowthChart(activeTrades) {
        const canvas = document.getElementById('equityGrowthChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const labels = [];
        const netGrowthData = [];

        if (activeTrades && activeTrades.length > 0) {
            const tradesOnly = activeTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
            const chronologicalTrades = [...tradesOnly].sort((a, b) => a.ts - b.ts);
            const dailyGrowth = {};
            let accumBaseGain = 0;

            chronologicalTrades.forEach(t => {
                accumBaseGain += t.parsedGain || 0;
                dailyGrowth[t.dt] = accumBaseGain;
            });

            Object.keys(dailyGrowth).forEach(date => {
                const d = new Date(date);
                labels.push(d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: '2-digit' }));
                netGrowthData.push((dailyGrowth[date] * this.backtestLeverageMult).toFixed(2));
            });
        }

        const gradient = ctx.createLinearGradient(0, 0, 0, 280);
        gradient.addColorStop(0, 'rgba(0, 229, 255, 0.15)');
        gradient.addColorStop(1, 'rgba(0, 229, 255, 0.0)');

        if (this.equityChart) {
            this.equityChart.data.labels = labels;
            this.equityChart.data.datasets[0].data = netGrowthData;
            this.equityChart.update();
            return;
        }

        const isMobile = window.innerWidth < 768;

        this.equityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Growth',
                    data: netGrowthData,
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
                layout: { padding: { left: 2, right: 2, top: 5, bottom: 0 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0A101C',
                        titleColor: '#00E5FF',
                        titleFont: { size: 12, family: "'JetBrains Mono', monospace", weight: 'bold' },
                        bodyColor: '#E2E8F0',
                        bodyFont: { size: 11, family: "'JetBrains Mono', monospace" },
                        borderColor: '#1A2436',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: (context) => {
                                const baseLbl = this.getBaseLabel();
                                const netVal = parseFloat(context.parsed.y) || 0;
                                const baseVal = netVal / this.backtestLeverageMult;
                                return `Growth: +${netVal.toFixed(2)}% (${baseLbl}: +${baseVal.toFixed(2)}%)`;
                            }
                        }
                    }
                },
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.02)', drawTicks: false },
                        border: { display: false },
                        ticks: {
                            color: '#94A3B8',
                            font: { size: isMobile ? 8 : 10 },
                            maxTicksLimit: isMobile ? 4 : 6,
                            maxRotation: 0,
                            align: 'inner',
                            padding: 6
                        }
                    },
                    y: {
                        position: 'right',
                        grid: { color: 'rgba(255, 255, 255, 0.04)', drawTicks: false },
                        border: { dash: [4, 4], display: false },
                        ticks: {
                            color: '#94A3B8',
                            font: { size: isMobile ? 8 : 10 },
                            padding: isMobile ? 6 : 8,
                            callback: (v) => v + '%'
                        }
                    }
                }
            }
        });
    }

    renderHeatmap(activeTrades) {
        const body = document.getElementById('heatmap-body');
        if (!body || !activeTrades || activeTrades.length === 0) return;

        const tradesOnly = activeTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        const dataByYear = {};

        tradesOnly.forEach(t => {
            const y = t.dt.substring(0, 4);
            const m = t.dt.substring(5, 7);
            if (!dataByYear[y]) dataByYear[y] = { sum: 0 };
            if (!dataByYear[y][m]) dataByYear[y][m] = 0;
            const g = t.parsedGain || 0;
            dataByYear[y][m] += g;
            dataByYear[y].sum += g;
        });

        let html = '';
        Object.keys(dataByYear).sort((a, b) => b - a).forEach(y => {
            html += `<tr class="hover:bg-cardBorder/10 transition-colors"><td class="p-2.5 md:p-3 font-bold text-white bg-cardBg sticky left-0 z-10 border-r border-cardBorder/40">${y}</td>`;
            for (let i = 1; i <= 12; i++) {
                const mStr = i.toString().padStart(2, '0');
                const baseVal = dataByYear[y][mStr];
                if (baseVal !== undefined) {
                    const netVal = baseVal * this.backtestLeverageMult;
                    const colorClass = netVal > 0 ? 'bg-emerald-500/20 text-emerald-400 font-semibold' : (netVal < 0 ? 'bg-rose-500/20 text-rose-400 font-semibold' : 'text-zinc-500');
                    const sign = netVal > 0 ? '+' : '';
                    html += `<td class="p-2 md:p-2.5 ${colorClass} leading-tight">
                        <span class="block">${sign}${netVal.toFixed(2)}%</span>
                        <span class="block text-[8px] text-zinc-400/80 font-normal mt-0.5">1x: ${sign}${baseVal.toFixed(2)}%</span>
                    </td>`;
                } else {
                    html += `<td class="p-2.5 md:p-3 text-zinc-600">-</td>`;
                }
            }
            const baseYtd = dataByYear[y].sum;
            const netYtd = baseYtd * this.backtestLeverageMult;
            const ytdColor = netYtd > 0 ? 'text-emerald-400 font-bold' : (netYtd < 0 ? 'text-rose-400 font-bold' : 'text-zinc-500');
            const ytdSign = netYtd > 0 ? '+' : '';
            html += `<td class="p-2 md:p-2.5 bg-darkBg/50 border-l border-cardBorder/40 ${ytdColor} leading-tight">
                <span class="block">${ytdSign}${netYtd.toFixed(2)}%</span>
                <span class="block text-[8px] text-zinc-500 font-normal mt-0.5">1x: ${ytdSign}${baseYtd.toFixed(2)}%</span>
            </td></tr>`;
        });
        body.innerHTML = html;
    }

    exportCSV() {
        const currentTrades = this.getFilteredTrades(this.rawTrades);
        const tradesOnly = currentTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        if (tradesOnly.length === 0) return;

        let csvContent = "data:text/csv;charset=utf-8,Symbol,Action,Lots,Open Date,Open Price,Close Date,Close Price,Profit USD,Base Gain (1x) %,Net Gain (16.8x) %\n";
        tradesOnly.forEach(t => {
            const baseG = t.parsedGain || 0;
            const netG = (baseG * this.backtestLeverageMult).toFixed(2);
            const row = [
                t.Symbol || '',
                t.Action || '',
                t["Units/Lots"] || '',
                t["Open Date"] || '',
                t["Open Price"] || '',
                t["Close Date"] || '',
                t["Close Price"] || '',
                t.Profit || '',
                baseG.toFixed(2),
                netG
            ].map(v => `"${v}"`).join(",");
            csvContent += row + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${this.isNeo ? 'NEO_FX' : 'SONIC'}_Historical_Trades.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    applyTranslations() {
        if (typeof translations === 'undefined') return;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[this.currentLang] && translations[this.currentLang][key]) {
                el.innerText = translations[this.currentLang][key];
            }
        });
    }

    setupListeners() {
        const sync = (slider, input, cb) => {
            if (!slider || !input) return;
            slider.addEventListener('input', () => { input.value = slider.value; cb(); });
            input.addEventListener('input', () => {
                const v = parseFloat(input.value) || 0;
                slider.value = v;
                cb();
            });
        };

        sync(this.dom.projDepSlider, this.dom.projDepInput, () => this.calcProjection());
        sync(this.dom.projTopSlider, this.dom.projTopInput, () => this.calcProjection());
        sync(this.dom.projMoSlider, this.dom.projMoInput, () => this.calcProjection());

        if (this.dom.projModeSelect) {
            this.dom.projModeSelect.addEventListener('change', () => this.calcProjection());
        }

        sync(this.dom.btDepSlider, this.dom.btDepInput, () => this.calcBacktest());
        sync(this.dom.btTopSlider, this.dom.btTopInput, () => this.calcBacktest());
        if (this.dom.btStart) this.dom.btStart.addEventListener('change', () => this.calcBacktest());
        if (this.dom.btEnd) this.dom.btEnd.addEventListener('change', () => this.calcBacktest());
        if (this.dom.btMode) this.dom.btMode.addEventListener('change', () => this.calcBacktest());

        if (this.dom.exportBtn) this.dom.exportBtn.addEventListener('click', () => this.exportCSV());

        if (this.dom.tfBtns) {
            this.dom.tfBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.dom.tfBtns.forEach(b => {
                        b.classList.remove('bg-accentCyan/20', 'text-accentCyan', 'border-accentCyan/30');
                        b.classList.add('bg-cardBg', 'text-zinc-400', 'border-cardBorder');
                    });
                    e.target.classList.remove('bg-cardBg', 'text-zinc-400', 'border-cardBorder');
                    e.target.classList.add('bg-accentCyan/20', 'text-accentCyan', 'border-accentCyan/30');
                    this.timeframe = e.target.getAttribute('data-tf');
                    this.refreshDash();
                });
            });
        }
    }

    setupAccordions() {
        document.querySelectorAll('.faq-button').forEach(btn => {
            btn.addEventListener('click', () => {
                const answer = btn.nextElementSibling;
                const icon = btn.querySelector('i') || btn.querySelector('svg');
                const isHidden = answer.classList.contains('hidden');
                if (isHidden) {
                    answer.classList.remove('hidden');
                    if (icon) icon.classList.add('rotate-180');
                } else {
                    answer.classList.add('hidden');
                    if (icon) icon.classList.remove('rotate-180');
                }
            });
        });
    }

    simulateProj(deposit, topup, months, rate, mode) {
        let balance = deposit, invested = deposit, payouts = 0;
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
        return { balance, payouts, total: balance + payouts, invested };
    }

    calcProjection() {
        if (!this.dom.projDepInput) return;
        const deposit = parseFloat(this.dom.projDepInput.value) || 0;
        const topup = parseFloat(this.dom.projTopInput ? this.dom.projTopInput.value : 0) || 0;
        const months = parseInt(this.dom.projMoInput.value) || 12;
        const mode = this.dom.projModeSelect ? this.dom.projModeSelect.value : 'reinvest';

        if (this.dom.projResMo) this.dom.projResMo.innerText = months;

        const avgRatePct = (this.rates.avg * 100).toFixed(2);
        const consRatePct = (this.rates.cons * 100).toFixed(2);
        const optRatePct = (this.rates.opt * 100).toFixed(2);
        const baseAvgPct = this.baseMonthlyAvg.toFixed(2);

        if (this.dom.projSubText) {
            this.dom.projSubText.innerHTML = this.currentLang === 'de'
                ? `Berechnet aus den historischen Handelsdaten (Ø <strong>+${baseAvgPct}%</strong> Basis/Monat), skaliert mit <strong>24x</strong> Broker-Effekt abzüglich <strong>30%</strong> Erfolgsbeteiligung (= <strong>+${avgRatePct}%</strong> netto / Monat).`
                : `Calculated from historical trading data (avg <strong>+${baseAvgPct}%</strong> base/month), amplified <strong>24x</strong> by broker leverage minus <strong>30%</strong> performance fee (= <strong>+${avgRatePct}%</strong> net / month).`;
        }

        if (this.dom.projConsLabel) {
            this.dom.projConsLabel.innerText = `${this.currentLang === 'de' ? 'Konservativ' : 'Conservative'} (~${consRatePct}% / Mo)`;
        }
        if (this.dom.projOptLabel) {
            this.dom.projOptLabel.innerText = `${this.currentLang === 'de' ? 'Optimistisch' : 'Optimistic'} (~${optRatePct}% / Mo)`;
        }

        const resAvg = this.simulateProj(deposit, topup, months, this.rates.avg, mode);
        const resCons = this.simulateProj(deposit, topup, months, this.rates.cons, mode);
        const resOpt = this.simulateProj(deposit, topup, months, this.rates.opt, mode);
        const resBase = this.simulateProj(deposit, topup, months, this.baseMonthlyAvg / 100, mode);

        const multiplier = resAvg.invested > 0 ? (resAvg.total / resAvg.invested).toFixed(1) : '0.0';
        const formatMoneyNum = (val) => Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
        const baseLbl = this.getBaseLabel();

        const projScenTitle = document.getElementById('proj-scen-title');
        if (projScenTitle) {
            projScenTitle.innerHTML = this.currentLang === 'de'
                ? `Szenario nach <span id="proj-res-month">${months}</span> Monaten`
                : `Scenario After <span id="proj-res-month">${months}</span> Months`;
        }

        if (this.dom.projResBal) {
            const totalVal = resAvg.balance + resAvg.payouts;

            if (mode === 'payout') {
                this.dom.projResBal.innerHTML = `
                    <div class="flex justify-center items-center gap-3 sm:gap-6 mt-2">
                        <div class="text-center">
                            <span class="block text-[8px] sm:text-[10px] text-zinc-500 uppercase tracking-widest mb-1 md:mb-2">${this.currentLang === 'de' ? 'Startkapital' : 'Capital'}</span>
                            <span class="text-2xl sm:text-4xl md:text-5xl font-mono font-extrabold text-white leading-none">$${formatMoneyNum(resAvg.balance)}</span>
                        </div>
                        <div class="text-xl sm:text-3xl md:text-4xl font-light text-zinc-600 mt-3 sm:mt-4 md:mt-5">+</div>
                        <div class="text-center">
                            <span class="block text-[8px] sm:text-[10px] text-accentCyan uppercase tracking-widest mb-1 md:mb-2">${this.currentLang === 'de' ? 'Auszahlungen' : 'Payouts'}</span>
                            <span class="text-2xl sm:text-4xl md:text-5xl font-mono font-extrabold text-accentCyan drop-shadow-[0_0_15px_rgba(0,229,255,0.4)] leading-none">$${formatMoneyNum(resAvg.payouts)}</span>
                        </div>
                    </div>
                `;

                if (this.dom.projResSub) {
                    this.dom.projResSub.innerHTML = `<span class="text-zinc-400">${this.currentLang === 'de' ? 'Gesamtwert:' : 'Total Value:'} <strong class="text-white">$${formatMoneyNum(totalVal)}</strong> · (${baseLbl} 1x: +$${formatMoneyNum(resBase.payouts)})</span>`;
                }

                if (this.dom.projConsBal) this.dom.projConsBal.innerHTML = `$${formatMoneyNum(resCons.payouts)} <span class="text-[10px] text-zinc-500 block font-normal mt-0.5">+ $${formatMoneyNum(resCons.balance)} Kap.</span>`;
                if (this.dom.projOptBal) this.dom.projOptBal.innerHTML = `$${formatMoneyNum(resOpt.payouts)} <span class="text-[10px] text-zinc-500 block font-normal mt-0.5">+ $${formatMoneyNum(resOpt.balance)} Kap.</span>`;
            } else {
                this.dom.projResBal.innerHTML = `$${formatMoneyNum(resAvg.balance)}`;

                if (this.dom.projResSub) {
                    this.dom.projResSub.innerHTML = `<span data-i18n="fromWord">${this.currentLang === 'de' ? 'Aus' : 'From'}</span> <span class="text-white font-bold" id="proj-res-invested">$${formatMoneyNum(resAvg.invested)}</span> <span data-i18n="investedWord">${this.currentLang === 'de' ? 'investiert' : 'invested'}</span> · <strong class="text-emerald-400" id="proj-res-mult">${multiplier}x</strong> <span class="text-zinc-500">(${baseLbl} 1x: $${formatMoneyNum(resBase.balance)})</span>`;
                }

                if (this.dom.projConsBal) this.dom.projConsBal.innerHTML = `$${formatMoneyNum(resCons.balance)}`;
                if (this.dom.projOptBal) this.dom.projOptBal.innerHTML = `$${formatMoneyNum(resOpt.balance)}`;
            }
        }

        [1, 3, 6, 12].forEach(m => {
            const elAvg = document.getElementById(`ms${m}-avg`);
            if (elAvg) {
                const mRes = this.simulateProj(deposit, topup, m, this.rates.avg, mode);
                elAvg.innerText = '$' + formatMoneyNum(mRes.total);
            }
        });
    }

    calcBacktest() {
        if (!this.rawTrades || this.rawTrades.length === 0) return;

        const tradesOnly = this.rawTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        const chronologicalTrades = [...tradesOnly].sort((a, b) => a.ts - b.ts);

        const capital = parseFloat(this.dom.btDepInput.value) || 10000;
        const topup = parseFloat(this.dom.btTopInput ? this.dom.btTopInput.value : 0) || 0;
        const mode = this.dom.btMode ? this.dom.btMode.value : 'reinvest';

        const startStr = (this.dom.btStart && this.dom.btStart.value) || chronologicalTrades[0].dt;
        const endStr = (this.dom.btEnd && this.dom.btEnd.value) || chronologicalTrades[chronologicalTrades.length - 1].dt;

        const filteredTrades = chronologicalTrades.filter(t => t.dt >= startStr && t.dt <= endStr);
        if (filteredTrades.length === 0) return;

        // 16.8x Netto-Simulation & 1x Basis-Simulation parallel berechnen
        let currentBalance = capital, startOfDayBalance = capital, totalInvested = capital, totalPayouts = 0;
        let baseBalance = capital, baseStartOfDayBalance = capital, baseTotalPayouts = 0;
        let lastMonth = '', lastDay = '';
        const labels = [], dataPoints = [], investedPoints = [], payoutsPoints = [], baseTotalPoints = [], dailyBacktest = {};

        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : dateStr;
        };

        filteredTrades.forEach(t => {
            const currentMonth = t.dt.substring(0, 7);
            const currentDay = t.dt;

            if (lastMonth && currentMonth !== lastMonth && topup > 0) {
                currentBalance += topup;
                baseBalance += topup;
                totalInvested += topup;
            }
            lastMonth = currentMonth;
            if (lastDay !== currentDay) {
                startOfDayBalance = currentBalance;
                baseStartOfDayBalance = baseBalance;
            }
            lastDay = currentDay;

            const baseGainPercent = t.parsedGain || 0;
            const scaledGainPercent = baseGainPercent * this.backtestLeverageMult;

            const netTradeProfit = startOfDayBalance * (scaledGainPercent / 100);
            const baseTradeProfit = baseStartOfDayBalance * (baseGainPercent / 100);

            if (mode === 'reinvest') {
                currentBalance += netTradeProfit;
                baseBalance += baseTradeProfit;
            } else {
                totalPayouts += netTradeProfit;
                baseTotalPayouts += baseTradeProfit;
            }

            dailyBacktest[t.dt] = {
                balance: currentBalance,
                payouts: totalPayouts,
                total: currentBalance + totalPayouts,
                baseTotal: baseBalance + baseTotalPayouts,
                basePayouts: baseTotalPayouts,
                invested: totalInvested
            };
        });

        Object.keys(dailyBacktest).forEach(date => {
            labels.push(formatDate(date));
            dataPoints.push(dailyBacktest[date].total);
            investedPoints.push(dailyBacktest[date].invested);
            payoutsPoints.push(dailyBacktest[date].payouts);
            baseTotalPoints.push(dailyBacktest[date].baseTotal);
        });

        const finalTotal = dataPoints[dataPoints.length - 1];
        const finalBaseTotal = baseTotalPoints[baseTotalPoints.length - 1];
        const totalInvestedEnd = investedPoints[investedPoints.length - 1];

        const netProfit = finalTotal - totalInvestedEnd;
        const growth = totalInvestedEnd > 0 ? (netProfit / totalInvestedEnd) * 100 : 0;

        const baseProfit = finalBaseTotal - totalInvestedEnd;
        const baseGrowth = totalInvestedEnd > 0 ? (baseProfit / totalInvestedEnd) * 100 : 0;

        const formatMoneyDec = (val) => '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const baseLbl = this.getBaseLabel();

        if (this.dom.btSimLabel) {
            this.dom.btSimLabel.innerText = mode === 'payout'
                ? (this.currentLang === 'de' ? 'Generierte Auszahlungen' : 'Generated Payouts')
                : (this.currentLang === 'de' ? 'Simuliertes Endguthaben' : 'Simulated Balance');
        }

        if (this.dom.btResBal) {
            this.dom.btResBal.innerText = mode === 'payout' ? formatMoneyDec(totalPayouts) : formatMoneyDec(finalTotal);
        }
        if (this.dom.btResBalSub) {
            this.dom.btResBalSub.innerText = `${baseLbl}: ${mode === 'payout' ? formatMoneyDec(baseTotalPayouts) : formatMoneyDec(finalBaseTotal)}`;
        }

        const resInvestedEl = document.getElementById('bt-res-invested');
        if (resInvestedEl) resInvestedEl.innerText = formatMoneyDec(totalInvestedEnd);

        if (this.dom.btResProf) {
            this.dom.btResProf.innerText = (netProfit >= 0 ? '+' : '-') + formatMoneyDec(Math.abs(netProfit));
        }
        if (this.dom.btResProfSub) {
            this.dom.btResProfSub.innerText = `${baseLbl}: ${(baseProfit >= 0 ? '+' : '-')}${formatMoneyDec(Math.abs(baseProfit))}`;
        }

        if (this.dom.btResGrowth) {
            this.dom.btResGrowth.innerText = (growth >= 0 ? '+' : '') + growth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
        }
        if (this.dom.btResGrowthSub) {
            this.dom.btResGrowthSub.innerText = `${baseLbl}: ${(baseGrowth >= 0 ? '+' : '')}${baseGrowth.toFixed(2)}%`;
        }

        if (this.btChart) {
            this.btChart.data.labels = labels;
            this.btChart.data.datasets[0].data = dataPoints;
            this.btChart.data.datasets[1].data = investedPoints;
            if (!this.btChart.data.datasets[2]) {
                this.btChart.data.datasets.push({ label: 'Payouts', data: [], hidden: true });
            }
            this.btChart.data.datasets[2].data = payoutsPoints;
            if (!this.btChart.data.datasets[3]) {
                this.btChart.data.datasets.push({ label: 'BaseTotal', data: [], hidden: true });
            }
            this.btChart.data.datasets[3].data = baseTotalPoints;
            this.btChart.update();
        }
    }

    initBacktestChart() {
        const canvas = document.getElementById('backtestChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, 'rgba(52, 211, 153, 0.25)');
        gradient.addColorStop(1, 'rgba(52, 211, 153, 0.0)');

        Chart.defaults.font.family = "'JetBrains Mono', monospace";
        Chart.defaults.color = '#64748B';

        if (!Chart.Tooltip.positioners.followGreenLine) {
            Chart.Tooltip.positioners.followGreenLine = function(elements) {
                if (!elements || elements.length === 0) return false;
                const greenElement = elements.find(el => el.datasetIndex === 0) || elements[0];
                const chart = this.chart;
                const isMobile = window.innerWidth < 768;

                let x = greenElement.element.x;
                let y = greenElement.element.y;

                if (isMobile && chart && chart.chartArea) {
                    const minX = chart.chartArea.left + 85;
                    const maxX = chart.chartArea.right - 85;
                    x = Math.max(minX, Math.min(maxX, x));
                    y = Math.max(chart.chartArea.top + 20, y - 15);
                }

                return { x, y };
            };
        }

        const isMobile = window.innerWidth < 768;

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
                    },
                    {
                        label: 'Payouts',
                        data: [],
                        hidden: true
                    },
                    {
                        label: 'BaseTotal',
                        data: [],
                        hidden: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { left: 2, right: 2, top: 10, bottom: 0 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        position: 'followGreenLine',
                        backgroundColor: '#0A101C',
                        titleColor: '#00E5FF',
                        titleFont: { size: isMobile ? 11 : 13, family: "'JetBrains Mono', monospace", weight: 'bold' },
                        bodyColor: '#E2E8F0',
                        bodyFont: { size: isMobile ? 10 : 12, family: "'JetBrains Mono', monospace" },
                        bodySpacing: isMobile ? 4 : 6,
                        borderColor: '#1A2436',
                        borderWidth: 1,
                        padding: isMobile ? 10 : 14,
                        displayColors: false,
                        filter: (tooltipItem) => tooltipItem.datasetIndex === 0,
                        callbacks: {
                            title: (items) => `${this.currentLang === 'de' ? 'Datum' : 'Date'}: ${items[0].label}`,
                            label: (ctx) => {
                                const total = ctx.parsed.y;
                                const index = ctx.dataIndex;
                                const investedData = ctx.chart.data.datasets[1] ? ctx.chart.data.datasets[1].data : [];
                                const payoutsData = ctx.chart.data.datasets[2] ? ctx.chart.data.datasets[2].data : [];
                                const baseTotalData = ctx.chart.data.datasets[3] ? ctx.chart.data.datasets[3].data : [];

                                const invested = (investedData && investedData[index] !== undefined) ? investedData[index] : 0;
                                const payouts = (payoutsData && payoutsData[index] !== undefined) ? payoutsData[index] : 0;
                                const baseTotal = (baseTotalData && baseTotalData[index] !== undefined) ? baseTotalData[index] : invested;
                                const isPayoutMode = document.getElementById('bt-mode-select') && document.getElementById('bt-mode-select').value === 'payout';

                                const profit = total - invested;
                                const growth = invested > 0 ? (profit / invested) * 100 : 0;
                                const baseProfit = baseTotal - invested;
                                const baseGrowth = invested > 0 ? (baseProfit / invested) * 100 : 0;

                                const signProfit = profit >= 0 ? '+' : '-';
                                const signGrowth = growth >= 0 ? '+' : '-';
                                const isDe = this.currentLang === 'de';
                                const baseLbl = this.getBaseLabel();

                                const lines = [];
                                if (isPayoutMode) {
                                    const actualBal = total - payouts;
                                    lines.push(`${isDe ? 'Gesamtwert' : 'Total Value'}: $${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                                    lines.push(` ↳ ${isDe ? 'Kapital' : 'Capital'}:    $${actualBal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                                    lines.push(` ↳ ${isDe ? 'Auszahlung' : 'Payouts'}:   $${payouts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                                } else {
                                    lines.push(`${isDe ? 'Endguthaben' : 'Portfolio Balance'}: $${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                                }

                                lines.push(`${isDe ? 'Investiert' : 'Invested Capital'}:  $${invested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                                lines.push(`${isDe ? 'Reingewinn' : 'Net Profit'}:  ${signProfit}$${Math.abs(profit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                                lines.push(`${isDe ? 'Wachstum' : 'Growth'}:    ${signGrowth}${Math.abs(growth).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% (${baseLbl}: +${baseGrowth.toFixed(2)}%)`);

                                return lines;
                            }
                        }
                    }
                },
                interaction: { mode: 'index', intersect: false, axis: 'x' },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.02)', drawTicks: false },
                        border: { display: false },
                        ticks: {
                            maxTicksLimit: isMobile ? 4 : 6,
                            maxRotation: 0,
                            font: { size: isMobile ? 8 : 10 },
                            color: '#94A3B8',
                            align: 'inner',
                            padding: 6
                        }
                    },
                    y: {
                        position: 'right',
                        grid: { color: 'rgba(255, 255, 255, 0.04)', drawTicks: false },
                        border: { dash: [4, 4], display: false },
                        ticks: {
                            maxTicksLimit: 6,
                            font: { size: isMobile ? 8 : 10 },
                            color: '#94A3B8',
                            padding: isMobile ? 6 : 8,
                            callback: (val) => val >= 1000 ? '$' + (val / 1000).toFixed(1) + 'k' : '$' + val
                        }
                    }
                }
            }
        });
    }

    renderStatsAndTable() {
        if (!this.dom.tradesBody) return;

        // Nutzt Live-Trades vom Backend, oder fällt automatisch auf die lokalen JSON-Daten zurück
        const dataSource = this.isNeo
            ? this.rawTrades
            : (this.liveTableTrades && this.liveTableTrades.length > 0 ? this.liveTableTrades : this.rawTrades);

        const tradesOnly = dataSource.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        const tableTrades = [...tradesOnly].sort((a, b) => b.ts - a.ts);

        if (!tableTrades || tableTrades.length === 0) {
            const loadingText = (typeof translations !== 'undefined' && translations[this.currentLang])
                ? (translations[this.currentLang].loadingLive || "Lade Live-Daten... Bitte warten.")
                : "Lade Live-Daten... Bitte warten.";
            this.dom.tradesBody.innerHTML = `<tr><td colspan="9" class="px-6 py-8 text-center text-zinc-500 font-sans"><div class="flex justify-center items-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>${loadingText}</span></div></td></tr>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const statTotalEl = document.getElementById('stat-total');
        if (statTotalEl) statTotalEl.innerText = tableTrades.length;

        const baseLbl = this.getBaseLabel();
        let html = '';

        tableTrades.forEach(t => {
            const rawAction = (t.Action || "").toUpperCase();
            const isLong = rawAction === 'BUY';
            const typeLabel = isLong ? 'Long' : 'Short';
            const typeColor = isLong ? 'text-emerald-400' : 'text-rose-400';

            let displayDate = "-";
            if (t.dt) {
                const dParts = t.dt.split('-');
                displayDate = dParts.length === 3 ? `${dParts[2]}.${dParts[1]}.${dParts[0]}` : t.dt;
            }

            let entryTime = "-";
            let exitTime = "-";
            if (t["Open Date"] && t["Open Date"].includes(" ")) entryTime = t["Open Date"].split(" ")[1];
            else if (t.d && t.d.includes(" ")) entryTime = t.d.split(" ")[1];

            if (t["Close Date"] && t["Close Date"].includes(" ")) exitTime = t["Close Date"].split(" ")[1];

            const decimals = this.isNeo ? 5 : 2;
            const openPrice = t["Open Price"] !== undefined && t["Open Price"] !== null ? Number(t["Open Price"]).toFixed(decimals) : '-';
            const closePrice = t["Close Price"] !== undefined && t["Close Price"] !== null ? Number(t["Close Price"]).toFixed(decimals) : '-';

            let rawLots = t["Units/Lots"];
            if (typeof rawLots === 'object' && rawLots !== null) rawLots = rawLots.value;
            let lots = '-';
            if (rawLots !== undefined && rawLots !== null && rawLots !== '') {
                const numLots = Number(rawLots);
                lots = !isNaN(numLots) ? `${parseFloat(numLots.toFixed(4))} Lots` : `${rawLots} Lots`;
            }

            const baseG = t.parsedGain !== undefined ? t.parsedGain : (parseFloat(t.Gain) || 0);
            const netG = baseG * this.backtestLeverageMult;

            const isProfit = netG >= 0;
            const profitClass = isProfit ? 'text-emerald-400' : 'text-rose-400';
            const sign = isProfit ? '+' : '';
            const formattedNetGain = `${sign}${netG.toFixed(2)}%`;
            const formattedBaseGain = `${sign}${baseG.toFixed(2)}%`;
            const stratName = this.isNeo ? 'NEO.FX' : 'SONIC';

            const logo = `<div class="flex items-center gap-2"><div class="w-5 h-5 rounded-full ${this.isNeo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'} flex items-center justify-center text-[10px]"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5v-2.1c2.1-.3 3.5-1.7 3.5-3.4 0-1.6-1.2-2.7-2.8-2.9v-2c1.9.3 2.9 1.4 3 2.8h1.8c-.2-2.4-1.9-4.2-4.8-4.5V3h-1.4v1.4c-2.3.3-4.1 1.9-4.1 4 0 2 1.6 3.3 3.7 3.7v2.3c-2-.3-3.2-1.5-3.3-3.1H6.9c.2 2.6 2.1 4.5 4.7 4.8v2.4h1.4z"/></svg></div><span class="font-extrabold text-white text-xs tracking-wide">${stratName}</span></div>`;

            // Option A in der PnL-Zelle: Gross 16.8x Netto und direkt darunter klein Basis 1x
            html += `<tr class="hover:bg-cardBorder/25 transition-colors border-b border-cardBorder/30">
                <td class="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 font-sans">${logo}</td>
                <td class="sticky left-0 z-10 bg-cardBg px-3 sm:px-4 md:px-6 py-3 md:py-4 text-zinc-300 font-semibold border-r border-cardBorder/40 sm:border-r-0">${displayDate}</td>
                <td class="px-4 md:px-6 py-2.5 md:py-3.5 leading-tight">
                    <span class="font-extrabold ${profitClass} text-xs md:text-sm block">${formattedNetGain}</span>
                    <span class="text-[9px] text-zinc-500 font-normal block mt-0.5">${baseLbl}: ${formattedBaseGain}</span>
                </td>
                <td class="px-4 md:px-6 py-3 md:py-4 text-zinc-400">${entryTime}</td>
                <td class="px-4 md:px-6 py-3 md:py-4 text-zinc-400">${exitTime}</td>
                <td class="px-4 md:px-6 py-3 md:py-4 font-semibold ${typeColor}">${typeLabel}</td>
                <td class="px-4 md:px-6 py-3 md:py-4 text-white font-bold">${openPrice}</td>
                <td class="px-4 md:px-6 py-3 md:py-4 text-white font-bold">${closePrice}</td>
                <td class="px-4 md:px-6 py-3 md:py-4 text-zinc-400 text-right">${lots}</td>
            </tr>`;
        });
        this.dom.tradesBody.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DualEngineApp();
});