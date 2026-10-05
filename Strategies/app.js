class StrategyCalculator {
    constructor() {
        this.appContainer = document.getElementById('strategy-app');
        this.config = {
            defaultCapital: 139836.51,
            defaultRate: 0.04, 
            defaultDays: 90
        };

        this.chartInstance = null;
        
        this.dom = {
            capInput: document.getElementById('calc-capital-input'),
            capSlider: document.getElementById('calc-capital-slider'),
            rateSlider: document.getElementById('calc-rate-slider'),
            daysSlider: document.getElementById('calc-days-slider'),
            modeSelect: document.getElementById('calc-mode-select'),
            dispRate: document.getElementById('display-rate'),
            dispDays: document.getElementById('display-days'),
            resBalance: document.getElementById('res-balance'),
            resProfit: document.getElementById('res-profit'),
            resGrowth: document.getElementById('res-growth'),
            presetBtns: document.querySelectorAll('.preset-btn'),
            tradesBody: document.getElementById('trades-table-body')
        };

        this.init();
    }

    init() {
        if (!this.dom.capInput) return;
        this.setupCalculator();
        this.initChart();
        this.calculate();
        this.loadTrades(); 
    }

    setupCalculator() {
        this.dom.capInput.value = this.config.defaultCapital;
        this.dom.capSlider.value = this.config.defaultCapital;
        this.dom.rateSlider.value = this.config.defaultRate;
        this.dom.daysSlider.value = this.config.defaultDays;

        this.dom.capSlider.addEventListener('input', (e) => {
            this.dom.capInput.value = e.target.value;
            this.calculate();
        });

        this.dom.capInput.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val)) {
                if (val > 1000000) val = 1000000;
                this.dom.capSlider.value = val;
                this.calculate();
            }
        });

        this.dom.rateSlider.addEventListener('input', () => this.calculate());
        this.dom.daysSlider.addEventListener('input', () => this.calculate());
        
        if (this.dom.modeSelect) {
            this.dom.modeSelect.addEventListener('change', () => this.calculate());
        }

        this.dom.presetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = parseFloat(e.target.dataset.preset);
                this.dom.capInput.value = val;
                this.dom.capSlider.value = val;
                this.calculate();
            });
        });
    }

    initChart() {
        const canvas = document.getElementById('projectionChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Etwas softerer Gradient für das Copy-X Feeling
        let gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(204, 255, 0, 0.15)'); 
        gradient.addColorStop(1, 'rgba(204, 255, 0, 0.0)');

        Chart.defaults.font.family = "'JetBrains Mono', monospace";
        Chart.defaults.color = '#64748B';

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ 
                data: [], 
                borderColor: '#CCFF00', 
                backgroundColor: gradient, 
                borderWidth: 2, 
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: '#05070A',
                pointBorderColor: '#CCFF00',
                pointBorderWidth: 2,
                fill: true, 
                tension: 0.4 // Smoothe Kurve
            }]},
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0F131C',
                        titleColor: '#94A3B8',
                        bodyColor: '#FFFFFF',
                        bodyFont: { size: 13, weight: 'bold' },
                        borderColor: '#1A2333',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            title: (ctx) => 'Tag ' + ctx[0].label,
                            label: (ctx) => '$' + ctx.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})
                        }
                    }
                },
                scales: {
                    x: { 
                        display: true,
                        grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
                        ticks: {
                            maxTicksLimit: 8,
                            callback: function(value) { return 'T ' + this.getLabelForValue(value); }
                        }
                    },
                    y: {
                        position: 'right',
                        grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
                        border: { dash: [4, 4] },
                        ticks: { 
                            maxTicksLimit: 6,
                            callback: (val) => val >= 1000 ? '$' + (val/1000).toFixed(0) + 'k' : '$' + val
                        }
                    }
                },
                interaction: { mode: 'index', intersect: false }
            }
        });
    }

    calculate() {
        let principal = parseFloat(this.dom.capInput.value) || 0;
        let rate = parseFloat(this.dom.rateSlider.value) || 0;
        let days = parseInt(this.dom.daysSlider.value) || 0;
        let mode = this.dom.modeSelect ? this.dom.modeSelect.value : 'reinvest';

        if (this.dom.dispRate) this.dom.dispRate.innerText = rate.toFixed(2) + '%';
        if (this.dom.dispDays) this.dom.dispDays.innerText = days + ' Tage';

        let currentBalance = principal;
        let labels = ['0'];
        let dataPoints = [principal];
        let totalPayouts = 0;

        for (let i = 1; i <= days; i++) {
            let dailyProfit = currentBalance * (rate / 100);
            
            if (mode === 'reinvest') {
                currentBalance += dailyProfit; 
            } else {
                totalPayouts += dailyProfit; 
            }

            labels.push(i.toString());
            dataPoints.push(mode === 'reinvest' ? currentBalance : principal);
        }

        let finalBalance = mode === 'reinvest' ? dataPoints[dataPoints.length - 1] : principal;
        let netProfit = mode === 'reinvest' ? (finalBalance - principal) : totalPayouts;
        let growth = (principal > 0) ? (netProfit / principal) * 100 : 0;

        // UI Updates
        const resTitle = document.getElementById('res-title');
        if (resTitle) {
            resTitle.innerText = mode === 'reinvest' ? "Projiziertes Endguthaben" : "Kapital (Konstant wg. Auszahlung)";
        }

        if (this.dom.resBalance) this.dom.resBalance.innerText = '$' + finalBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        if (this.dom.resProfit) this.dom.resProfit.innerText = '+$' + netProfit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        if (this.dom.resGrowth) this.dom.resGrowth.innerText = '+' + growth.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%';

        if (this.chartInstance) {
            this.chartInstance.data.labels = labels;
            this.chartInstance.data.datasets[0].data = dataPoints;
            this.chartInstance.update();
        }
    }

    async loadTrades() {
        try {
            // Lädt aus dem data Ordner (eine Ebene höher)
            const response = await fetch('../data/trades.json');
            if (!response.ok) throw new Error("trades.json nicht gefunden");
            const trades = await response.json();
            
            // Künstliche Ladezeit für einen "App-Look"
            setTimeout(() => {
                this.renderTradesTable(trades);
            }, 400);

        } catch (error) {
            console.error("Fehler beim Laden der trades.json:", error);
            if (this.dom.tradesBody) {
                this.dom.tradesBody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-rose-400">Verifizierte Daten konnten nicht geladen werden. Bitte später erneut versuchen.</td></tr>`;
            }
        }
    }

    renderTradesTable(trades) {
        if (!this.dom.tradesBody) return;
        
        if (!trades || trades.length === 0) {
            this.dom.tradesBody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-zinc-500">Keine Trades in der Historie.</td></tr>`;
            return;
        }

        let html = '';
        const validTrades = trades.filter(t => t.Action === 'Buy' || t.Action === 'Sell');

        validTrades.slice(0, 20).forEach(t => {
            const profitVal = parseFloat(t.Profit || 0);
            const isProfit = profitVal >= 0;
            const profitClass = isProfit ? 'text-emerald-400' : 'text-rose-400';
            const action = (t.Action || 'Buy').toUpperCase();
            
            // Farblich angepasste Badges für Buy/Sell wie bei Copy-X
            const actionBadge = action === 'BUY' 
                ? `<span class="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">${action}</span>` 
                : `<span class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">${action}</span>`;
            
            html += `
                <tr class="hover:bg-cardBorder/30 transition-colors cursor-default">
                    <td class="px-5 md:px-7 py-3 text-zinc-400">${t["Close Date"] || t["Open Date"] || 'Verifiziert'}</td>
                    <td class="px-5 md:px-7 py-3 font-bold text-white">${t.Symbol || 'XAUUSD'}</td>
                    <td class="px-5 md:px-7 py-3 font-semibold">${actionBadge}</td>
                    <td class="px-5 md:px-7 py-3 text-zinc-400">${parseFloat(t["Units/Lots"] || 1).toFixed(2)} Lots</td>
                    <td class="px-5 md:px-7 py-3 text-right font-bold ${profitClass}">${isProfit ? '+' : ''}$${profitVal.toFixed(2)}</td>
                </tr>
            `;
        });
        this.dom.tradesBody.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StrategyCalculator();
});