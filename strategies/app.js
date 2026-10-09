class DualEngineApp {
    constructor() {
        this.rawTrades = [];
        this.liveTableTrades = null; 
        this.btChart = null;
        this.equityChart = null;
        this.drawdownChart = null;
        this.rrChart = null;
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
            langToggle: document.getElementById('langToggle'),
            exportBtn: document.getElementById('export-csv-btn')
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

        // Lädt statische JSON Daten für Charts und Berechnungen SOFORT
        await this.loadTradesData();

        const tradesOnly = this.rawTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        const chronologicalTrades = [...tradesOnly].sort((a, b) => new Date(a.dt) - new Date(b.dt));

        if (chronologicalTrades.length > 0 && this.dom.btStart && this.dom.btEnd) {
            this.dom.btStart.value = chronologicalTrades[0].dt;
            this.dom.btEnd.value = chronologicalTrades[chronologicalTrades.length - 1].dt;
        }

        this.initAdvancedCharts();
        this.setupListeners();
        this.setupAccordions();
        this.updateKPIs();
        this.initEquityGrowthChart();
        this.initBacktestChart();
        this.renderStatsAndTable(); 
        this.renderHeatmap();
        this.calcProjection();
        this.calcBacktest();

        // Lade Live-Daten vom Backend NUR für die Sonic-Tabelle
        if (!this.isNeo) {
            this.loadLiveTableData().then(() => {
                if (this.liveTableTrades && this.liveTableTrades.length > 0) {
                    this.renderStatsAndTable(); 
                }
            });
        }
    }

    parseDate(dateStr) {
        let dt = "2025-01-01";
        let d = "01.01.2025";
        if (!dateStr) return { dt, d };

        const timePart = dateStr.split(" ")[1] || "";
        const datePart = dateStr.split(" ")[0];

        if (datePart.includes("/")) { // MM/DD/YYYY Format
            const p = datePart.split("/");
            if(p.length === 3) {
                dt = `${p[2]}-${p[0].padStart(2,'0')}-${p[1].padStart(2,'0')}`;
                d = `${p[1].padStart(2,'0')}.${p[0].padStart(2,'0')}.${p[2]} ${timePart}`;
            }
        } else if (datePart.includes(".")) { // DD.MM.YYYY Format
            const p = datePart.split(".");
            if(p.length === 3) {
                dt = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
                d = `${p[0].padStart(2,'0')}.${p[1].padStart(2,'0')}.${p[2]} ${timePart}`;
            }
        } else if (datePart.includes("-")) { // YYYY-MM-DD Format
            const p = datePart.split("-");
            if(p.length === 3) {
                dt = datePart;
                d = `${p[2]}.${p[1]}.${p[0]} ${timePart}`;
            }
        }
        return { dt, d };
    }

    async loadTradesData() {
        let data = null;
        
        const candidateFiles = this.isNeo
            ? ['../data/Neo_TradesData.json', '../data/NEO_TradesData.json', '../data/NEO_tradesdata.json', '../data/neo_tradesdata.json', '/data/Neo_TradesData.json', 'data/Neo_TradesData.json']
            : ['../data/Sonic_TradesData.json', '../data/Sonic_tradesdata.json', '../data/trades_data.json', '/data/Sonic_TradesData.json', 'data/Sonic_TradesData.json'];

        for (const file of candidateFiles) {
            try {
                let response = await fetch(file);
                if (response.ok) {
                    data = await response.json();
                    break;
                }
            } catch (e) {}
        }

        // NOTFALL-FALLBACK: Wenn die lokale Datei fehlt, lade über die API (damit die Seite nicht kaputt ist!)
        if ((!data || !Array.isArray(data) || data.length === 0) && !this.isNeo) {
            console.warn("Lokale JSON fehlt! Lade Notfall-Daten über die API...");
            try {
                const response = await fetch('https://tagmarkets-backend.onrender.com/api/live-trades?id=12249114');
                if (response.ok) {
                    data = await response.json();
                }
            } catch (e) {
                console.error("API Fallback fehlgeschlagen.");
            }
        }

        if (!data || !Array.isArray(data)) {
            console.warn("Konnte überhaupt keine Daten laden.");
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
                parsedGain: isNaN(gain) ? 0 : gain
            };
        });
    }

    async loadLiveTableData() {
        try {
            const response = await fetch('https://tagmarkets-backend.onrender.com/api/live-trades?id=12249114');            
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    this.liveTableTrades = data.map(t => {
                        const dateObj = this.parseDate(t["Open Date"]);
                        return {
                            ...t,
                            dt: dateObj.dt,
                            d: dateObj.d,
                            parsedGain: parseFloat(t["Gain"] || 0)
                        };
                    });
                }
            }
        } catch (error) {
            console.warn("Fehler beim Laden der Live-Tabelle vom Backend:", error);
        }
    }

    initAdvancedCharts() {
        Chart.defaults.font.family = "'JetBrains Mono', monospace";
        Chart.defaults.color = '#94A3B8';

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
                            barPercentage: 0.6,
                            order: 1
                        }
                    ] 
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    layout: { padding: { left: 0, right: 15, top: 10, bottom: 0 } },
                    plugins: { 
                        legend: { display: false }, 
                        tooltip: { 
                            callbacks: { 
                                title: (items) => {
                                    let d = new Date(items[0].label);
                                    if(isNaN(d.getTime())) return `Datum: ${items[0].label}`;
                                    return `Datum: ${d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
                                },
                                label: (c) => {
                                    let isDe = this.currentLang === 'de';
                                    if (c.datasetIndex === 0) return 'Drawdown: ' + c.parsed.y.toFixed(2) + '%';
                                    return (isDe ? 'Tages-PnL: ' : 'Daily PnL: ') + (c.parsed.y > 0 ? '+' : '') + c.parsed.y.toFixed(2) + '%';
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
                                maxTicksLimit: 6, 
                                font: { size: 10 }, 
                                color: '#94A3B8',
                                padding: 5,
                                callback: function(val, index) {
                                    let label = this.getLabelForValue(val);
                                    if(!label) return '';
                                    let d = new Date(label);
                                    if(isNaN(d.getTime())) return label;
                                    return d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: '2-digit' });
                                }
                            }
                        },
                        y: { 
                            position: 'right', 
                            grid: { color: 'rgba(255, 255, 255, 0.05)', drawTicks: false }, 
                            border: { dash: [4, 4], display: false }, 
                            ticks: { 
                                callback: (v) => v + '%',
                                color: '#94A3B8',
                                font: { size: 10 },
                                padding: 8
                            } 
                        }
                    }
                }
            });
        }

        const rrCanvas = document.getElementById('rrChart');
        if (rrCanvas) {
            const ctx = rrCanvas.getContext('2d');
            this.rrChart = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: ['Typischer Win', 'Typischer Loss'], datasets: [{ data: [1, 1], backgroundColor: ['#34D399', '#FB7185'], borderWidth: 0, hoverOffset: 4 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.label + ': $' + c.raw.toFixed(2) } } } }
            });
        }
    }

    updateKPIs() {
        if (!this.rawTrades || this.rawTrades.length === 0) return;

        let tradesOnly = this.rawTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        let chronologicalTrades = [...tradesOnly].sort((a, b) => new Date(a.dt) - new Date(b.dt));
        let totalTrades = chronologicalTrades.length;
        
        let wins = 0, losses = 0;
        let grossProfit = 0, grossLoss = 0;
        let tradeProfitUSD = 0;
        let durations = [];

        let winArray = [];
        let lossArray = [];

        let deposits = 0, withdrawals = 0, currentBal = 0, highestBal = 0;
        let currentGain = 0, peakGain = 0, maxDrawdown = 0;
        
        let dailyData = {};
        let baseCapital = 1000;
        let simCurrentBal = baseCapital;

        chronologicalTrades.forEach(t => {
            let action = (t.Action || "").toUpperCase();
            let g = parseFloat(t.Gain) || 0;
            let date = t.dt;

            if (action === 'BUY' || action === 'SELL') {
                let simulatedProfit = simCurrentBal * (g / 100);
                simCurrentBal += simulatedProfit;
                tradeProfitUSD += simulatedProfit;
                
                if (simulatedProfit > 0) { 
                    wins++; 
                    grossProfit += simulatedProfit; 
                    winArray.push(simulatedProfit);
                }
                else if (simulatedProfit < 0) { 
                    losses++; 
                    grossLoss += Math.abs(simulatedProfit); 
                    lossArray.push(Math.abs(simulatedProfit));
                }

                currentGain += g;
                if (currentGain > peakGain) peakGain = currentGain;
                
                let dd = currentGain - peakGain; 
                if (Math.abs(dd) > maxDrawdown) maxDrawdown = Math.abs(dd);

                if (!dailyData[date]) {
                    dailyData[date] = { pnl: 0, drawdown: 0 };
                }
                dailyData[date].pnl += g;
                dailyData[date].drawdown = dd; 

                if (t["Duration (DD:HH:MM:SS)"]) {
                    let parts = t["Duration (DD:HH:MM:SS)"].split(':');
                    if(parts.length === 4) {
                        let ms = (parseInt(parts[0])*86400 + parseInt(parts[1])*3600 + parseInt(parts[2])*60 + parseInt(parts[3])) * 1000;
                        durations.push(ms);
                    }
                }
            }
        });

        let drawdownLabels = Object.keys(dailyData);
        let drawdownDataPoints = drawdownLabels.map(d => dailyData[d].drawdown);
        let tradeGainDataPoints = drawdownLabels.map(d => dailyData[d].pnl);

        const getMedian = (arr) => {
            if (arr.length === 0) return 0;
            arr.sort((a, b) => a - b);
            let mid = Math.floor(arr.length / 2);
            return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
        };

        let typWin = getMedian(winArray);
        let typLoss = getMedian(lossArray);

        let winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(2) : 0;
        let profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? grossProfit.toFixed(2) : "0.00");

        durations.sort((a, b) => a - b);
        let medianDurationMs = 0;
        if (durations.length > 0) {
            let mid = Math.floor(durations.length / 2);
            medianDurationMs = durations.length % 2 !== 0 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2;
        }
        let avgDurationStr = "~12 min";
        let validDurations = durations.length;
        if (validDurations > 0) {
            let mins = Math.round((medianDurationMs) / 60000);
            if (mins > 1440) avgDurationStr = "~" + Math.round(mins/1440) + " d";
            else if (mins > 60) avgDurationStr = "~" + Math.round(mins/60) + " h";
            else avgDurationStr = "~" + (mins < 1 ? 1 : mins) + " min";
        }

        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

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

        setEl('kpi-daily-avg', '+' + dailyGain.toFixed(2) + '%');
        setEl('kpi-profit-factor', profitFactor);
        setEl('kpi-avg-duration', avgDurationStr);
        
        let lossMonths = 0;
        let prevM = null;
        let mGain = 0;
        chronologicalTrades.forEach(t => {
            let m = t.dt.substring(0,7);
            if(m !== prevM && prevM !== null) {
                if(mGain < 0) lossMonths++;
                mGain = 0;
            }
            mGain += parseFloat(t.Gain) || 0;
            prevM = m;
        });
        if(mGain < 0) lossMonths++;
        setEl('kpi-loss-months', lossMonths);

        setEl('myfx-gain', '+' + currentGain.toFixed(2) + '%');
        setEl('myfx-abs-gain', '+' + currentGain.toFixed(2) + '%');
        setEl('myfx-daily', dailyGain.toFixed(2) + '%');
        setEl('myfx-monthly', monthlyGain.toFixed(2) + '%');
        setEl('myfx-drawdown', maxDrawdown.toFixed(2) + '%');
        
        setEl('avg-win-text', '+$' + typWin.toFixed(2));
        setEl('avg-loss-text', '-$' + typLoss.toFixed(2));
        
        const avgWinLabel = document.getElementById('avg-win-text')?.previousElementSibling;
        const avgLossLabel = document.getElementById('avg-loss-text')?.previousElementSibling;
        if(avgWinLabel) avgWinLabel.innerText = "Typischer Win";
        if(avgLossLabel) avgLossLabel.innerText = "Typischer Loss";

        const winLossHeaderEl = document.getElementById('kpi-win-loss-text');
        if (winLossHeaderEl) {
            winLossHeaderEl.innerHTML = `<span class="text-emerald-400 font-bold">${wins} Win</span> <span class="text-zinc-500 font-normal">/</span> <span class="text-rose-400 font-bold">${losses} Lose</span>`;
        }

        if (this.rrChart) {
            this.rrChart.data.datasets[0].data = [typWin, typLoss];
            this.rrChart.update();
        }
        if (this.drawdownChart) {
            this.drawdownChart.data.labels = drawdownLabels;
            this.drawdownChart.data.datasets[0].data = drawdownDataPoints; 
            if(this.drawdownChart.data.datasets[1]) {
                this.drawdownChart.data.datasets[1].data = tradeGainDataPoints; 
            }
            this.drawdownChart.update();
        }

        this.rawTrades.forEach(t => {
            let action = (t.Action || "").toUpperCase();
            let p = parseFloat(t.Profit) || 0;
            if (action === 'DEPOSIT') { deposits += p; currentBal += p; } 
            else if (action === 'WITHDRAWAL') { withdrawals += Math.abs(p); currentBal += p; } 
            else if (action === 'BUY' || action === 'SELL') { currentBal += p; }
            if (currentBal > highestBal) highestBal = currentBal;
        });
        if (deposits === 0) { deposits = 10000; currentBal += 10000; highestBal += 10000; }
        
        const formatMoney = (val) => '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        setEl('myfx-balance', formatMoney(currentBal));
        setEl('myfx-equity', `(100.00%) ${formatMoney(currentBal)}`);
        setEl('myfx-highest', formatMoney(highestBal));
        setEl('myfx-profit', formatMoney(currentBal - deposits + withdrawals));
        setEl('myfx-deposits', formatMoney(deposits));
        setEl('myfx-withdrawals', formatMoney(withdrawals));
        setEl('stat-total', totalTrades);
    }

    renderHeatmap() {
        const body = document.getElementById('heatmap-body');
        if (!body || this.rawTrades.length === 0) return;

        let tradesOnly = this.rawTrades.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        let dataByYear = {};

        tradesOnly.forEach(t => {
            let y = t.dt.substring(0, 4);
            let m = t.dt.substring(5, 7);
            if (!dataByYear[y]) Object.assign(dataByYear, { [y]: { sum: 0 } });
            if (!dataByYear[y][m]) dataByYear[y][m] = 0;
            let g = parseFloat(t.Gain) || 0;
            dataByYear[y][m] += g;
            dataByYear[y].sum += g;
        });

        let html = '';
        Object.keys(dataByYear).sort((a,b) => b - a).forEach(y => {
            html += `<tr class="hover:bg-cardBorder/10 transition-colors"><td class="p-3 font-bold text-white bg-darkBg/50 border-r border-cardBorder/40">${y}</td>`;
            for (let i = 1; i <= 12; i++) {
                let mStr = i.toString().padStart(2, '0');
                let val = dataByYear[y][mStr];
                if (val !== undefined) {
                    let colorClass = val > 0 ? 'bg-emerald-500/20 text-emerald-400 font-semibold' : (val < 0 ? 'bg-rose-500/20 text-rose-400 font-semibold' : 'text-zinc-500');
                    html += `<td class="p-3 ${colorClass}">${val > 0 ? '+' : ''}${val.toFixed(2)}%</td>`;
                } else {
                    html += `<td class="p-3 text-zinc-600">-</td>`;
                }
            }
            let ytd = dataByYear[y].sum;
            let ytdColor = ytd > 0 ? 'text-emerald-400 font-bold' : (ytd < 0 ? 'text-rose-400 font-bold' : 'text-zinc-500');
            html += `<td class="p-3 bg-darkBg/50 border-l border-cardBorder/40 ${ytdColor}">${ytd > 0 ? '+' : ''}${ytd.toFixed(2)}%</td></tr>`;
        });
        body.innerHTML = html;
    }

    exportCSV() {
        const dataSource = (this.liveTableTrades && this.liveTableTrades.length > 0) ? this.liveTableTrades : this.rawTrades;
        let tradesOnly = dataSource.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        if(tradesOnly.length === 0) return;
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Symbol,Action,Lots,Open Date,Open Price,Close Date,Close Price,Profit USD,Gain %\n";
        
        tradesOnly.forEach(t => {
            let row = [
                t.Symbol || '', t.Action || '', t["Units/Lots"] || '',
                t["Open Date"] || '', t["Open Price"] || '',
                t["Close Date"] || '', t["Close Price"] || '',
                t.Profit || '', t.Gain || ''
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
        if (typeof translations === 'undefined') {
            console.error("translations.js wurde nicht geladen.");
            return;
        }

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

        if (this.dom.exportBtn) this.dom.exportBtn.addEventListener('click', () => this.exportCSV());
    }

    setupAccordions() {
        const buttons = document.querySelectorAll('.faq-button');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const answer = btn.nextElementSibling;
                const icon = btn.querySelector('i');
                const isHidden = answer.classList.contains('hidden');

                if (isHidden) {
                    answer.classList.remove('hidden');
                    icon.classList.add('rotate-180');
                } else {
                    answer.classList.add('hidden');
                    icon.classList.remove('rotate-180');
                }
            });
        });
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

        const formatMoney = (val) => '$' + Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");

        if (this.dom.projResBal) this.dom.projResBal.innerText = formatMoney(resAvg.balance);
        if (this.dom.projResInv) this.dom.projResInv.innerText = formatMoney(resAvg.invested);
        if (this.dom.projResMult) this.dom.projResMult.innerText = multiplier + 'x';

        if (this.dom.projConsBal) this.dom.projConsBal.innerText = formatMoney(resCons.balance);
        if (this.dom.projOptBal) this.dom.projOptBal.innerText = formatMoney(resOpt.balance);

        const projScenTitle = document.getElementById('proj-scen-title');
        if (projScenTitle) {
            if (typeof translations !== 'undefined' && translations[this.currentLang]) {
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
        }

        [1, 3, 6, 12].forEach(m => {
            let avgM = this.simulateProj(deposit, topup, m, this.rates.avg, mode).balance;
            const elAvg = document.getElementById(`ms${m}-avg`);
            if (elAvg) elAvg.innerText = formatMoney(avgM);
        });
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
            
            let dailyGrowth = {};
            let accumGain = 0;
            chronologicalTrades.forEach(t => {
                accumGain += parseFloat(t.Gain) || 0;
                dailyGrowth[t.dt] = accumGain;
            });

            Object.keys(dailyGrowth).forEach(date => {
                let d = new Date(date);
                labels.push(d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: '2-digit' }));
                growthData.push(dailyGrowth[date].toFixed(2));
            });
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
                    label: 'Growth', data: growthData, borderColor: '#00E5FF', backgroundColor: gradient,
                    borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointBackgroundColor: '#040914',
                    pointBorderColor: '#00E5FF', pointBorderWidth: 2, fill: true, tension: 0.2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                layout: { padding: { left: 0, right: 0, top: 5, bottom: 0 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0A101C', titleColor: '#00E5FF',
                        titleFont: { size: 13, family: "'JetBrains Mono', monospace", weight: 'bold' },
                        bodyColor: '#E2E8F0', bodyFont: { size: 12, family: "'JetBrains Mono', monospace" },
                        borderColor: '#1A2436', borderWidth: 1, padding: 14, displayColors: false,
                        callbacks: { label: function(context) { return 'Growth: ' + context.parsed.y + '%'; } }
                    }
                },
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { 
                        grid: { color: 'rgba(255, 255, 255, 0.02)', drawTicks: false }, 
                        border: { display: false },
                        ticks: { 
                            color: '#94A3B8', 
                            font: { size: 10 }, 
                            maxTicksLimit: 6,
                            padding: 5
                        } 
                    },
                    y: { 
                        position: 'right', 
                        grid: { color: 'rgba(255, 255, 255, 0.04)', drawTicks: false }, 
                        border: { dash: [4, 4], display: false }, 
                        ticks: { 
                            color: '#94A3B8', font: { size: 10 }, 
                            padding: 8, 
                            callback: (v) => v + '%' 
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
        let startOfDayBalance = capital; 
        let totalInvested = capital;
        let totalPayouts = 0;
        let lastMonth = '';
        let lastDay = ''; 

        let labels = [];
        let dataPoints = [];
        let investedPoints = [];

        let dailyBacktest = {};

        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            let parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
            return dateStr;
        };

        filteredTrades.forEach((t) => {
            const currentMonth = t.dt.substring(0, 7);
            const currentDay = t.dt;

            if (lastMonth && currentMonth !== lastMonth && topup > 0) {
                currentBalance += topup;
                totalInvested += topup;
            }
            lastMonth = currentMonth;

            if (lastDay !== currentDay) {
                startOfDayBalance = currentBalance;
            }
            lastDay = currentDay;

            let scaledGainPercent = t.parsedGain * this.backtestLeverageMult;
            let tradeProfit = startOfDayBalance * (scaledGainPercent / 100);

            if (mode === 'reinvest') {
                currentBalance += tradeProfit;
            } else {
                totalPayouts += tradeProfit;
            }
            
            dailyBacktest[t.dt] = {
                balance: mode === 'reinvest' ? currentBalance : currentBalance + totalPayouts,
                invested: totalInvested
            };
        });

        Object.keys(dailyBacktest).forEach(date => {
            labels.push(formatDate(date));
            dataPoints.push(dailyBacktest[date].balance);
            investedPoints.push(dailyBacktest[date].invested);
        });

        let finalBalance = dataPoints[dataPoints.length - 1];
        let totalInvestedEnd = investedPoints[investedPoints.length - 1];
        let netProfit = finalBalance - totalInvestedEnd;
        let growth = totalInvestedEnd > 0 ? (netProfit / totalInvestedEnd) * 100 : 0;

        if (this.dom.btResBal) this.dom.btResBal.innerText = '$' + finalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        let resInvestedEl = document.getElementById('bt-res-invested');
        if (resInvestedEl) resInvestedEl.innerText = '$' + totalInvestedEnd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
                return { x: greenElement.element.x, y: greenElement.element.y };
            };
        }

        this.btChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Portfolio Balance', data: [], borderColor: '#34D399', backgroundColor: gradient,
                        borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointBackgroundColor: '#040914',
                        pointBorderColor: '#34D399', pointBorderWidth: 2, fill: true, tension: 0.15
                    },
                    {
                        label: 'Invested Capital', data: [], borderColor: 'transparent', backgroundColor: 'transparent',
                        borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, pointHitRadius: 0, fill: false, tension: 0, hidden: true
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                layout: { padding: { left: 0, right: 10, top: 10, bottom: 0 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        position: 'followGreenLine', backgroundColor: '#0A101C', titleColor: '#00E5FF',
                        titleFont: { size: 13, family: "'JetBrains Mono', monospace", weight: 'bold' },
                        bodyColor: '#E2E8F0', bodyFont: { size: 12, family: "'JetBrains Mono', monospace" },
                        bodySpacing: 6, borderColor: '#1A2436', borderWidth: 1, padding: 14, displayColors: false,
                        filter: function(tooltipItem) { return tooltipItem.datasetIndex === 0; },
                        callbacks: {
                            title: (items) => `Datum: ${items[0].label}`,
                            label: (ctx) => {
                                let balance = ctx.parsed.y;
                                let index = ctx.dataIndex;
                                let investedData = ctx.chart.data.datasets[1] ? ctx.chart.data.datasets[1].data : [];
                                let invested = (investedData && investedData[index] !== undefined) ? investedData[index] : 0;
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
                interaction: { mode: 'index', intersect: false, axis: 'x' },
                scales: {
                    x: { 
                        grid: { color: 'rgba(255, 255, 255, 0.02)', drawTicks: false }, 
                        border: { display: false },
                        ticks: { 
                            maxTicksLimit: 6, 
                            font: { size: 10 }, 
                            color: '#94A3B8',
                            align: 'inner',
                            padding: 5
                        } 
                    },
                    y: {
                        position: 'right', 
                        grid: { color: 'rgba(255, 255, 255, 0.04)', drawTicks: false }, 
                        border: { dash: [4, 4], display: false },
                        ticks: { 
                            maxTicksLimit: 6, font: { size: 10 }, color: '#94A3B8', 
                            mirror: true, z: 10, padding: 0, 
                            callback: (val) => val >= 1000 ? '$' + (val / 1000).toFixed(1) + 'k' : '$' + val 
                        }
                    }
                }
            }
        });
    }

    renderStatsAndTable() {
        if (!this.dom.tradesBody) return;

        const dataSource = (this.liveTableTrades && this.liveTableTrades.length > 0) ? this.liveTableTrades : this.rawTrades;

        let tradesOnly = dataSource.filter(t => t.Action && (t.Action.toUpperCase() === 'BUY' || t.Action.toUpperCase() === 'SELL'));
        let tableTrades = [...tradesOnly].sort((a, b) => new Date(b.dt) - new Date(a.dt));

        if (!tableTrades || tableTrades.length === 0) {
            this.dom.tradesBody.innerHTML = `<tr><td colspan="10" class="px-6 py-8 text-center text-zinc-500 font-sans">Warte auf Trade-Daten...</td></tr>`;
            return;
        }

        const statTotalEl = document.getElementById('stat-total');
        if(statTotalEl) statTotalEl.innerText = tableTrades.length;

        let html = '';
        tableTrades.forEach(t => {
            const rawAction = (t.Action || "").toUpperCase();
            const isLong = rawAction === 'BUY';
            const typeLabel = isLong ? 'Long' : 'Short';
            const typeColor = isLong ? 'text-emerald-400' : 'text-rose-400';
            
            // Format time correctly depending on API or JSON source
            let entryTime = "-";
            let exitTime = "-";
            if(t["Open Date"] && t["Open Date"].includes(" ")) entryTime = t["Open Date"].split(" ")[1];
            else if(t.d && t.d.includes(" ")) entryTime = t.d.split(" ")[1];
            
            if(t["Close Date"] && t["Close Date"].includes(" ")) exitTime = t["Close Date"].split(" ")[1];

            const symbol = t["Symbol"] || (this.isNeo ? 'EURUSD' : 'XAUUSD');
            const isForex = symbol.includes('EUR') || symbol.includes('USD') && !symbol.includes('XAU');
            const decimals = isForex ? 5 : 2;

            const openPrice = t["Open Price"] !== undefined && t["Open Price"] !== null ? Number(t["Open Price"]).toFixed(decimals) : '-';
            const closePrice = t["Close Price"] !== undefined && t["Close Price"] !== null ? Number(t["Close Price"]).toFixed(decimals) : '-';
            const lots = t["Units/Lots"] !== undefined && t["Units/Lots"] !== null ? `${Number(t["Units/Lots"]).toFixed(2)} Lots` : '-';

            const parsedG = t.parsedGain !== undefined ? t.parsedGain : (parseFloat(t.Gain) || 0);
            const isProfit = parsedG >= 0;
            const profitClass = isProfit ? 'text-emerald-400' : 'text-rose-400';
            const formattedGain = `${isProfit ? '+' : ''}${parsedG.toFixed(2)}%`;
            const stratName = this.isNeo ? 'NEO.FX' : 'SONIC';

            const logo = `<div class="flex items-center gap-2"><div class="w-5 h-5 rounded-full ${this.isNeo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'} flex items-center justify-center text-[10px]"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5v-2.1c2.1-.3 3.5-1.7 3.5-3.4 0-1.6-1.2-2.7-2.8-2.9v-2c1.9.3 2.9 1.4 3 2.8h1.8c-.2-2.4-1.9-4.2-4.8-4.5V3h-1.4v1.4c-2.3.3-4.1 1.9-4.1 4 0 2 1.6 3.3 3.7 3.7v2.3c-2-.3-3.2-1.5-3.3-3.1H6.9c.2 2.6 2.1 4.5 4.7 4.8v2.4h1.4z"/></svg></div><span class="font-extrabold text-white text-xs tracking-wide">${stratName}</span></div>`;

            html += `<tr class="hover:bg-cardBorder/25 transition-colors border-b border-cardBorder/30"><td class="px-6 py-4 font-sans">${logo}</td><td class="px-6 py-4 font-semibold text-zinc-300">${symbol}.f</td><td class="px-6 py-4 font-semibold ${typeColor}">${typeLabel}</td><td class="px-6 py-4 text-zinc-400">${lots}</td><td class="px-6 py-4 text-zinc-300 font-semibold">${t.dt || "-"}</td><td class="px-6 py-4 text-white font-bold">${openPrice}</td><td class="px-6 py-4 text-white font-bold">${closePrice}</td><td class="px-6 py-4 text-zinc-400">${entryTime}</td><td class="px-6 py-4 text-zinc-400">${exitTime}</td><td class="px-6 py-4 text-right font-extrabold ${profitClass} text-sm">${formattedGain}</td></tr>`;
        });
        this.dom.tradesBody.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DualEngineApp();
});