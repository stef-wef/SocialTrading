class StrategyCalculator {
    constructor() {
        this.appContainer = document.getElementById('strategy-app');
        this.config = {
            defaultCapital: 139836.51,
            defaultRate: 0.04, // Historischer Tagesdurchschnitt
            defaultDays: 90
        };

        this.chartInstance = null;
        
        this.dom = {
            capInput: document.getElementById('calc-capital-input'),
            capSlider: document.getElementById('calc-capital-slider'),
            rateSlider: document.getElementById('calc-rate-slider'),
            daysSlider: document.getElementById('calc-days-slider'),
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
        this.loadLiveTrades(); // Lädt die echten Live-Daten vom Backend
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
        
        let gradient = ctx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, 'rgba(204, 255, 0, 0.25)'); 
        gradient.addColorStop(1, 'rgba(204, 255, 0, 0.0)');

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ 
                data: [], 
                borderColor: '#CCFF00', 
                backgroundColor: gradient, 
                borderWidth: 2.5, 
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: '#07090E',
                pointBorderColor: '#CCFF00',
                pointBorderWidth: 2,
                fill: true, 
                tension: 0.35 
            }]},
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#101522',
                        titleColor: '#94A3B8',
                        bodyColor: '#FFFFFF',
                        bodyFont: { family: "'JetBrains Mono', monospace", size: 12, weight: 'bold' },
                        borderColor: '#1E293B',
                        borderWidth: 1,
                        padding: 10,
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
                        grid: { color: 'rgba(255, 255, 255, 0.02)', drawBorder: false },
                        ticks: {
                            color: '#64748B',
                            font: { family: "'JetBrains Mono', monospace", size: 10 },
                            maxTicksLimit: 8,
                            callback: function(value) { return 'T ' + this.getLabelForValue(value); }
                        }
                    },
                    y: {
                        position: 'right',
                        grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
                        ticks: { 
                            color: '#64748B', 
                            font: { family: "'JetBrains Mono', monospace", size: 10 },
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

        this.dom.dispRate.innerText = rate.toFixed(2) + '%';
        this.dom.dispDays.innerText = days + ' Tage';

        let currentBalance = principal;
        let labels = ['0'];
        let dataPoints = [principal];

        for (let i = 1; i <= days; i++) {
            currentBalance *= (1 + (rate / 100));
            labels.push(i.toString());
            dataPoints.push(currentBalance);
        }

        let finalBalance = dataPoints[dataPoints.length - 1];
        let netProfit = finalBalance - principal;
        let growth = (principal > 0) ? (netProfit / principal) * 100 : 0;

        this.dom.resBalance.innerText = '$' + finalBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        this.dom.resProfit.innerText = '+$' + netProfit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        this.dom.resGrowth.innerText = '+' + growth.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%';

        if (this.chartInstance) {
            this.chartInstance.data.labels = labels;
            this.chartInstance.data.datasets[0].data = dataPoints;
            this.chartInstance.update();
        }
    }

    async loadLiveTrades() {
        try {
            const response = await fetch('https://tagmarkets-backend.onrender.com/api/live-trades');
            const trades = await response.json();
            this.renderTradesTable(trades);
        } catch (error) {
            console.warn("Live-Trades konnten nicht geladen werden:", error);
            if (this.dom.tradesBody) {
                this.dom.tradesBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-rose-400 font-mono">Verbindung zum Live-Server fehlgeschlagen.</td></tr>`;
            }
        }
    }

    renderTradesTable(trades) {
        if (!this.dom.tradesBody) return;
        
        if (!trades || trades.length === 0) {
            this.dom.tradesBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-zinc-500 font-mono">Keine Trades verfügbar.</td></tr>`;
            return;
        }

        let html = '';
        // Zeige die letzten Trades an
        trades.slice(0, 15).forEach(t => {
            const profitVal = parseFloat(t.profit || 0);
            const isProfit = profitVal >= 0;
            const profitClass = isProfit ? 'text-emerald-400' : 'text-rose-400';
            const action = (t.action || 'BUY').toUpperCase();
            const actionClass = action === 'BUY' ? 'text-sky-400' : 'text-purple-400';
            
            html += `
                <tr class="hover:bg-cardBg/40 transition-colors">
                    <td class="p-4 text-zinc-400">${t.date || t.closeDate || 'Live'}</td>
                    <td class="p-4 font-bold text-white">${t.symbol || t.asset || 'XAUUSD'}</td>
                    <td class="p-4 ${actionClass} font-semibold">${action}</td>
                    <td class="p-4 text-zinc-400">${parseFloat(t.lots || t.volume || 1).toFixed(2)} Lots</td>
                    <td class="p-4 text-right font-bold ${profitClass}">${isProfit ? '+' : ''}$${profitVal.toFixed(2)}</td>
                </tr>
            `;
        });
        this.dom.tradesBody.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StrategyCalculator();
});