// Icons initialisieren
lucide.createIcons();

// --- 1. Chart.js & Rechner Logik ---
let chartInstance = null;

function initChart() {
    const ctx = document.getElementById('projectionChart').getContext('2d');
    
    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(208, 246, 92, 0.25)'); 
    gradient.addColorStop(1, 'rgba(208, 246, 92, 0.0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ 
            data: [], 
            borderColor: '#D0F65C', 
            backgroundColor: gradient, 
            borderWidth: 2, 
            pointRadius: 0, 
            pointHoverRadius: 6,
            pointBackgroundColor: '#16171B',
            pointBorderColor: '#D0F65C',
            fill: true, 
            tension: 0.4 
        }]},
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0F1014',
                    titleColor: '#94959A',
                    bodyColor: '#fff',
                    borderColor: '#27282D',
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
                    display: true, /* X-Achse aktiviert (Zeitraum) */
                    grid: { display: false },
                    ticks: {
                        color: '#94959A',
                        maxTicksLimit: 8, /* Begrenzt die Anzahl der angezeigten Tage unten */
                        callback: function(value, index, values) {
                            return 'Tag ' + this.getLabelForValue(value);
                        }
                    }
                },
                y: {
                    position: 'right',
                    grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
                    ticks: { 
                        color: '#94959A', 
                        font: { size: 11 },
                        callback: (val) => val >= 1000 ? '$' + (val/1000).toFixed(0) + 'k' : '$' + val
                    }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });
}

const sliderStart = document.getElementById('input-start');
const numStart = document.getElementById('input-start-num');
const sliderRate = document.getElementById('input-rate');
const sliderDays = document.getElementById('input-days');

function setPrincipal(amount) {
    sliderStart.value = amount;
    numStart.value = amount;
    calculateProjection();
}

function calculateProjection() {
    let principal = parseFloat(sliderStart.value);
    if (isNaN(principal) || principal < 100) principal = 100;
    if (principal > 100000) principal = 100000;

    const dailyRate = parseFloat(sliderRate.value);
    const days = parseInt(sliderDays.value);

    document.getElementById('display-rate').innerText = dailyRate.toFixed(2) + '%';
    document.getElementById('display-days').innerText = days + ' Tage';

    let currentBalance = principal;
    let labels = ['0'];
    let dataPoints = [principal];

    for (let i = 1; i <= days; i++) {
        currentBalance *= (1 + (dailyRate / 100));
        labels.push(i.toString());
        dataPoints.push(currentBalance);
    }

    const finalBalance = dataPoints[dataPoints.length - 1];
    const netProfit = finalBalance - principal;
    const growthPercentage = (netProfit / principal) * 100;

    document.getElementById('calc-final').innerText = '$' + finalBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('calc-profit').innerText = '+$' + netProfit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('calc-percent').innerText = '+' + growthPercentage.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%';

    if (chartInstance) {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = dataPoints;
        chartInstance.update();
    }
}


// --- 2. Live Trades API Logik ---
async function loadLiveTradesFromAPI() {
    const tbody = document.getElementById('trades-body');
    
    try {
        // HIER DEINE ECHTE API URL EINTRAGEN:
        const API_URL = 'https://api.deinedomain.com/v1/live-trades/sonic-ai'; 
        
        // Versuche Daten abzurufen
        const response = await fetch(API_URL);
        
        // Wenn die API nicht antwortet oder 404 zurückgibt (was ohne echte URL passiert)
        if (!response.ok) {
            throw new Error('API Endpunkt nicht erreichbar');
        }

        const trades = await response.json();
        
        // Wenn keine Trades vorhanden sind
        if (!trades || trades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-tm-textMuted">Aktuell keine offenen Trades.</td></tr>';
            return;
        }

        // HTML Tabelle aufbauen
        let html = '';
        trades.forEach(t => {
            const isProfit = t.profit >= 0;
            const profitClass = isProfit ? 'text-green-400' : 'text-red-400';
            const typeClass = t.type === 'BUY' ? 'text-blue-400' : 'text-purple-400';
            
            html += `
                <tr class="border-b border-tm-border/50 hover:bg-tm-bg transition-colors">
                    <td class="py-3 text-tm-textMuted">${t.time}</td>
                    <td class="py-3 font-semibold text-white">${t.pair}</td>
                    <td class="py-3 ${typeClass} font-bold">${t.type}</td>
                    <td class="py-3 text-right text-tm-textMuted">${t.volume.toFixed(2)} Lots</td>
                    <td class="py-3 text-right font-bold ${profitClass}">${isProfit ? '+' : ''}$${t.profit.toFixed(2)}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

    } catch (error) {
        // Fallback, wenn die API (noch) nicht existiert oder fehlschlägt
        console.warn("Live-Trades konnten nicht geladen werden:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-6 text-center text-tm-textMuted">
                    <span class="block mb-1">Verbindung zur Live-Trading API fehlgeschlagen.</span>
                    <span class="text-xs opacity-50">(Bitte überprüfe die API-URL in der app.js)</span>
                </td>
            </tr>
        `;
    }
}

// Initialisieren beim Start
window.onload = () => {
    initChart();
    calculateProjection();
    loadLiveTradesFromAPI(); // Ruft die Trades ab

    sliderStart.addEventListener('input', () => { numStart.value = sliderStart.value; calculateProjection(); });
    numStart.addEventListener('input', () => { 
        let v = parseFloat(numStart.value); 
        if(!isNaN(v)){ 
            if(v > 100000) v = 100000; 
            sliderStart.value = v; 
            calculateProjection(); 
        }
    });
    sliderRate.addEventListener('input', calculateProjection);
    sliderDays.addEventListener('input', calculateProjection);
};