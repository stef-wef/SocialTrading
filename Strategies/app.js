class StrategyCalculator {
    constructor() {
        // Raten aus dem Copy-X Design:
        // Average: 1.14% * 24 * 0.7 = 19.152% pro Monat
        this.rates = {
            cons: 0.0588, // 5.88%
            avg: 0.19152, // 19.152%
            opt: 0.3528   // 35.28%
        };
        
        this.dom = {
            depInput: document.getElementById('calc-deposit'),
            depSlider: document.getElementById('calc-deposit-slider'),
            topInput: document.getElementById('calc-topup'),
            topSlider: document.getElementById('calc-topup-slider'),
            moInput: document.getElementById('calc-months'),
            moSlider: document.getElementById('calc-months-slider'),
            
            resMoTitle: document.getElementById('res-month-title'),
            resAvgBal: document.getElementById('res-avg-balance'),
            resInvested: document.getElementById('res-invested'),
            resMult: document.getElementById('res-multiplier'),
            
            resConsBal: document.getElementById('res-cons-balance'),
            resOptBal: document.getElementById('res-opt-balance'),
            
            tradesBody: document.getElementById('trades-table-body')
        };

        this.init();
    }

    init() {
        if (!this.dom.depInput) return; // Nur ausführen, wenn auf der Sonic Seite
        this.setupCalculator();
        this.calculate();
        this.loadTrades(); 
    }

    setupCalculator() {
        const updateFromSlider = (slider, input) => {
            input.value = slider.value;
            this.calculate();
        };
        const updateFromInput = (input, slider, max) => {
            let val = parseInt(input.value) || 0;
            if (val > max) val = max;
            slider.value = val;
            this.calculate();
        };

        // Event Listeners Startkapital
        this.dom.depSlider.addEventListener('input', () => updateFromSlider(this.dom.depSlider, this.dom.depInput));
        this.dom.depInput.addEventListener('input', () => updateFromInput(this.dom.depInput, this.dom.depSlider, 100000));

        // Event Listeners Top-Up
        this.dom.topSlider.addEventListener('input', () => updateFromSlider(this.dom.topSlider, this.dom.topInput));
        this.dom.topInput.addEventListener('input', () => updateFromInput(this.dom.topInput, this.dom.topSlider, 10000));

        // Event Listeners Monate
        this.dom.moSlider.addEventListener('input', () => updateFromSlider(this.dom.moSlider, this.dom.moInput));
        this.dom.moInput.addEventListener('input', () => updateFromInput(this.dom.moInput, this.dom.moSlider, 12));
    }

    formatMoney(amount) {
        // Formatiert wie bei Copy-X: $81'887
        return '$' + Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    }

    simulate(deposit, topup, months, rate) {
        let balance = deposit;
        let invested = deposit;
        for (let m = 1; m <= months; m++) {
            balance = balance * (1 + rate);
            if (m < months) { // Topup am Ende des Monats für den nächsten
                balance += topup;
                invested += topup;
            }
        }
        return { balance, invested };
    }

    calculate() {
        let deposit = parseFloat(this.dom.depInput.value) || 0;
        let topup = parseFloat(this.dom.topInput.value) || 0;
        let months = parseInt(this.dom.moInput.value) || 0;

        // UI Header Update
        this.dom.resMoTitle.innerText = months;

        // Calculation Average
        let resAvg = this.simulate(deposit, topup, months, this.rates.avg);
        let resCons = this.simulate(deposit, topup, months, this.rates.cons);
        let resOpt = this.simulate(deposit, topup, months, this.rates.opt);

        let multiplier = resAvg.invested > 0 ? (resAvg.balance / resAvg.invested).toFixed(1) : 0;

        // Update Main Results
        this.dom.resAvgBal.innerText = this.formatMoney(resAvg.balance);
        this.dom.resInvested.innerText = this.formatMoney(resAvg.invested);
        this.dom.resMult.innerText = multiplier + 'x';
        this.dom.resMult.className = multiplier >= 1 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold";

        // Update Bounds
        this.dom.resConsBal.innerText = this.formatMoney(resCons.balance);
        this.dom.resOptBal.innerText = this.formatMoney(resOpt.balance);

        // Update Milestones (1, 3, 6, 12 months)
        [1, 3, 6, 12].forEach(m => {
            let avgM = this.simulate(deposit, topup, m, this.rates.avg).balance;
            let consM = this.simulate(deposit, topup, m, this.rates.cons).balance;
            let optM = this.simulate(deposit, topup, m, this.rates.opt).balance;
            
            const elAvg = document.getElementById(`ms${m}-avg`);
            const elCons = document.getElementById(`ms${m}-cons`);
            const elOpt = document.getElementById(`ms${m}-opt`);
            
            if(elAvg) elAvg.innerText = this.formatMoney(avgM);
            if(elCons) elCons.innerText = this.formatMoney(consM);
            if(elOpt) elOpt.innerText = this.formatMoney(optM);
        });
    }

    async loadTrades() {
        try {
            // Aus dem /data Ordner laden
            const response = await fetch('../data/trades.json');
            if (!response.ok) throw new Error("trades.json nicht gefunden");
            const trades = await response.json();
            
            setTimeout(() => {
                this.renderTradesTable(trades);
            }, 300); // Künstlicher App-Delay

        } catch (error) {
            console.error("Fehler beim Laden der trades.json:", error);
            if (this.dom.tradesBody) {
                this.dom.tradesBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-rose-400 font-mono">Ledger data unavailable. Check connection.</td></tr>`;
            }
        }
    }

    renderTradesTable(trades) {
        if (!this.dom.tradesBody) return;
        
        if (!trades || trades.length === 0) {
            this.dom.tradesBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-zinc-500 font-mono">No trades in ledger.</td></tr>`;
            return;
        }

        let html = '';
        const validTrades = trades.filter(t => t.Action === 'Buy' || t.Action === 'Sell');

        validTrades.slice(0, 20).forEach(t => {
            const profitVal = parseFloat(t.Profit || 0);
            const isProfit = profitVal >= 0;
            const profitClass = isProfit ? 'text-emerald-400' : 'text-rose-400';
            const action = (t.Action || 'Buy').toUpperCase();
            
            const actionClass = action === 'BUY' ? 'text-sky-400' : 'text-purple-400';
            
            html += `
                <tr class="hover:bg-cardBorder/30 transition-colors">
                    <td class="px-6 py-4 text-zinc-400">${t["Close Date"] || t["Open Date"] || 'Verifiziert'}</td>
                    <td class="px-6 py-4 font-bold text-white">${t.Symbol || 'XAUUSD'}</td>
                    <td class="px-6 py-4 ${actionClass} font-semibold">${action}</td>
                    <td class="px-6 py-4 text-zinc-400">${parseFloat(t["Units/Lots"] || 1).toFixed(2)} Lots</td>
                    <td class="px-6 py-4 text-right font-bold ${profitClass}">${isProfit ? '+' : ''}$${profitVal.toFixed(2)}</td>
                </tr>
            `;
        });
        this.dom.tradesBody.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StrategyCalculator();
});