class StrategyApp {
    constructor() {
        this.appContainer = document.getElementById('strategy-app');
        if (!this.appContainer) return;

        // Config aus den Data-Attributen des Containers auslesen (Wichtig für Wiederverwendbarkeit)
        this.config = {
            apiUrl: this.appContainer.dataset.apiUrl,
            defaultCapital: parseFloat(this.appContainer.dataset.defaultCapital) || 10000,
            defaultRate: parseFloat(this.appContainer.dataset.defaultRate) || 1.35,
            defaultDays: parseInt(this.appContainer.dataset.defaultDays) || 90
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
            
            tradesBody: document.getElementById('trades-table-body'),
            apiDot: document.getElementById('api-status-dot'),
            apiText: document.getElementById('api-status-text')
        };

        this.init();
    }

    async init() {
        if (typeof lucide !== 'undefined') lucide.createIcons();

        this.setupCalculator();
        this.initChart();
        this.calculate();
        
        // Echten API Call ausführen
        await this.loadLiveTrades();
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
                if (val > 100000) val = 100000;
                this.dom.capSlider.value = val;
                this.calculate();
            }
        });

        this.dom.rateSlider.addEventListener('input', () => this.calculate());
        this.dom.daysSlider.addEventListener('input', () => this.calculate());

        this.dom.presetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = e.target.dataset.preset;
                this.dom.capInput.value = val;
                this.dom.capSlider.value = val;
                this.calculate();
            });
        });
    }

    initChart() {
        const ctx = document.getElementById('projectionChart').getContext('2d');
        
        let gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(208, 246, 92, 0.25)'); 
        gradient.addColorStop(1, 'rgba(208, 246, 92, 0.0)');

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ 
                data: [], 
                borderColor: '#D0F65C', 
                backgroundColor: gradient, 
                borderWidth: 2, 
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: '#121214',
                pointBorderColor: '#D0F65C',
                pointBorderWidth: 2,
                fill: true, 
                tension: 0.4 
            }]},
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#18181B',
                        titleColor: '#94959A',
                        bodyColor: '#FAFAFA',
                        bodyFont: { family: "'JetBrains Mono', monospace", size: 14, weight: 'bold' },
                        borderColor: '#27272A',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            title: (ctx) => 'Tag ' + ctx[0].label,
                            label: (ctx) => '$' + ctx.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})
                        }
                    }
                },
                scales: {
                    x: { 
                        display: true, // X-Achse mit Zeitraum aktiv
                        grid: { color: 'rgba(255, 255, 255, 0.02)', drawBorder: false },
                        ticks: {
                            color: '#94959A',
                            font: { family: "'JetBrains Mono', monospace", size: 10 },
                            maxTicksLimit: 8,
                            callback: function(value) { return 'T ' + this.getLabelForValue(value); }
                        }
                    },
                    y: {
                        position: 'right',
                        grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
                        ticks: { 
                            color: '#94959A', 
                            font: { family: "'JetBrains Mono', monospace", size: 11 },
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
            // Echter API Call an die im HTML angegebene URL
            const response = await fetch(this.config.apiUrl, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            const trades = await response.json();
            this.renderTradesTable(trades);
            this.setApiStatus('connected');

        } catch (error) {
            console.warn("Live API Call fehlgeschlagen:", error.message);
            this.setApiStatus('error');
            
            this.dom.tradesBody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-10 text-center">
                        <p class="text-sm text-zinc-300 font-medium mb-1">Verbindung zur Live-Trading API fehlgeschlagen.</p>
                        <p class="text-xs text-zinc-600">(Bitte hinterlege eine gültige API im data-api-url Attribut)</p>
                    </td>
                </tr>
            `;
        }
    }

    renderTradesTable(trades) {
        if (!trades || trades.length === 0) {
            this.dom.tradesBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-zinc-500">Aktuell keine Trades verfügbar.</td></tr>`;
            return;
        }

        let html = '';
        trades.forEach(t => {
            const isProfit = t.profit >= 0;
            const profitClass = isProfit ? 'text-emerald-400' : 'text-rose-500';
            const actionClass = t.action.toUpperCase() === 'BUY' ? 'text-blue-500' : 'text-purple-400';
            
            html += `
                <tr class="border-b border-surface-600 hover:bg-surface-700/50 transition-colors">
                    <td class="p-4 text-zinc-400">${t.date}</td>
                    <td class="p-4 font-bold text-white">${t.asset}</td>
                    <td class="p-4 ${actionClass} font-semibold">${t.action.toUpperCase()}</td>
                    <td class="p-4 text-zinc-400">${parseFloat(t.volume).toFixed(2)} Lots</td>
                    <td class="p-4 text-right font-bold ${profitClass}">${isProfit ? '+' : ''}$${parseFloat(t.profit).toFixed(2)}</td>
                </tr>
            `;
        });
        this.dom.tradesBody.innerHTML = html;
    }

    setApiStatus(status) {
        if (status === 'connected') {
            this.dom.apiDot.className = "w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]";
            this.dom.apiText.innerText = "Live API";
            this.dom.apiText.className = "text-[10px] text-emerald-500 uppercase tracking-widest";
        } else {
            this.dom.apiDot.className = "w-2 h-2 rounded-full bg-zinc-600";
            this.dom.apiText.innerText = "Offline";
            this.dom.apiText.className = "text-[10px] text-zinc-500 uppercase tracking-widest";
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StrategyApp();
});