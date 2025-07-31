// tradingbot/dashboard/static/main.js

const charts = {};
let positionsChart = null;

function updateProgressBar(id, value, min, max) {
    let el = document.getElementById(id);
    if (!el) return;
    let percent = Math.max(0, Math.min(1, (value - min) / (max - min)));
    el.style.width = (percent * 100) + "%";
}

function animateStat(element, newValue, oldValue) {
    if (!element) return;
    let classToAdd = '';
    if (oldValue == null) classToAdd = '';
    else if (newValue > oldValue) classToAdd = 'stat-animate-up';
    else if (newValue < oldValue) classToAdd = 'stat-animate-down';
    element.classList.remove('stat-animate-up', 'stat-animate-down');
    if (classToAdd) {
        element.classList.add(classToAdd);
        setTimeout(() => element.classList.remove(classToAdd), 900);
    }
}

function createChart(asset, chartData) {
    const ctx = document.getElementById(`${asset}-chart`).getContext('2d');
    if (charts[asset]) charts[asset].destroy();
    charts[asset] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.dates,
            datasets: [
                {
                    label: "Close",
                    data: chartData.close,
                    borderColor: "rgba(0,255,255,0.9)",
                    borderWidth: 2,
                    fill: false,
                },
            ]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: true } },
            animation: false,
            responsive: true,
        }
    });
}

function updateStats(asset, stats) {
    // --- PnL ---
    let pnlSpan = document.getElementById(`${asset}-pnl`);
    let oldPnl = parseFloat(pnlSpan.textContent.replace('$','')) || 0;
    let newPnl = stats.net_pnl ? Number(stats.net_pnl) : 0;
    pnlSpan.textContent = stats.net_pnl ? "$" + newPnl.toFixed(2) : '--';
    animateStat(pnlSpan, newPnl, oldPnl);
    updateProgressBar(`${asset}-pnl-bar`, newPnl, -1000, 2000);
    pnlSpan.classList.remove('text-green-400','text-red-400');
    if (stats.net_pnl > 0) pnlSpan.classList.add('text-green-400');
    else if (stats.net_pnl < 0) pnlSpan.classList.add('text-red-400');

    // --- Winrate ---
    let winrateSpan = document.getElementById(`${asset}-winrate`);
    let oldWinrate = parseFloat(winrateSpan.textContent) || 0;
    let newWinrate = stats.win_rate ? stats.win_rate : 0;
    winrateSpan.textContent = stats.win_rate ? (newWinrate*100).toFixed(1)+'%' : '--';
    animateStat(winrateSpan, newWinrate, oldWinrate);
    updateProgressBar(`${asset}-winrate-bar`, newWinrate, 0, 1);
    winrateSpan.classList.remove('text-green-400','text-red-400');
    if (stats.win_rate >= 0.5) winrateSpan.classList.add('text-green-400');
    else if (stats.win_rate < 0.5 && stats.win_rate > 0) winrateSpan.classList.add('text-red-400');

    // --- Sharpe ---
    let sharpeSpan = document.getElementById(`${asset}-sharpe`);
    let oldSharpe = parseFloat(sharpeSpan.textContent) || 0;
    let newSharpe = stats.sharpe ? Number(stats.sharpe) : 0;
    sharpeSpan.textContent = stats.sharpe ?? '--';
    animateStat(sharpeSpan, newSharpe, oldSharpe);
    updateProgressBar(`${asset}-sharpe-bar`, newSharpe, -2, 3);
    sharpeSpan.classList.remove('text-green-400','text-red-400');
    if (stats.sharpe > 0) sharpeSpan.classList.add('text-green-400');
    else if (stats.sharpe < 0) sharpeSpan.classList.add('text-red-400');

    // --- Drawdown ---
    let ddSpan = document.getElementById(`${asset}-drawdown`);
    let oldDD = parseFloat(ddSpan.textContent) || 0;
    let newDD = stats.drawdown ? Number(stats.drawdown) : 0;
    ddSpan.textContent = stats.drawdown ?? '--';
    animateStat(ddSpan, newDD, oldDD);
    updateProgressBar(`${asset}-drawdown-bar`, newDD, 0, 1);
    ddSpan.classList.remove('text-green-400','text-red-400');
    if (stats.drawdown !== undefined && stats.drawdown !== null && stats.drawdown < 0.15) ddSpan.classList.add('text-green-400');
    else if (stats.drawdown !== undefined && stats.drawdown !== null && stats.drawdown > 0.25) ddSpan.classList.add('text-red-400');

    // --- Additional summary stats ---
    document.getElementById(`${asset}-stats`).textContent =
        `Total Trades: ${stats.total_trades ?? 0}
Average Win: ${stats.average_win?.toFixed(2) ?? 0}
Average Loss: ${stats.average_loss?.toFixed(2) ?? 0}`;
}

function updateFeed(asset, feed) {
    const ul = document.getElementById(`${asset}-feed`);
    ul.innerHTML = '';
    if (!feed || !feed.length) {
        ul.innerHTML = "<li>No trades yet.</li>";
        return;
    }
    feed.slice().reverse().forEach(trade => {
        const li = document.createElement('li');
        // Support for possible missing fields:
        let action = trade.action ?? (trade.ai_decision?.recommendation ?? '');
        let qty = trade.qty ?? (trade.executed?.qty ?? '');
        let price = trade.price ?? (trade.executed?.price ?? '');
        let ai_reasoning = trade.ai_reasoning ?? (trade.ai_decision?.reasoning ?? '');
        li.textContent = `[${trade.timestamp}] ${action} ${qty} @ $${price} | ${ai_reasoning}`;
        ul.appendChild(li);
    });
}

function updateReflection(asset, reflection, improvements) {
    document.getElementById(`${asset}-reflection`).textContent = reflection ?? '';
    document.getElementById(`${asset}-improvements`).textContent = improvements ?? '';
}

function updatePauseBtn(asset, paused) {
    const btn = document.getElementById(`${asset}-pause-btn`);
    if (!btn) return;
    btn.textContent = paused ? "Resume" : "Pause";
    btn.dataset.paused = paused ? "true" : "false";
    btn.classList.toggle("bg-green-400", paused);
    btn.classList.toggle("bg-yellow-400", !paused);
}

// Set interval display
function updateIntervalDisplay(asset, val) {
    let text = "";
    switch (parseInt(val)) {
        case 60: text = "1 minute"; break;
        case 300: text = "5 minutes"; break;
        case 900: text = "15 minutes"; break;
        case 1800: text = "30 minutes"; break;
        case 3600: text = "1 hour"; break;
        default: text = val + "s";
    }
    document.getElementById(`${asset}-interval-display`).textContent = text;
}

// Send pause/resume/interval commands
function togglePause(asset) {
    const ws = window[`ws_${asset}`];
    if (!ws) return;
    const btn = document.getElementById(`${asset}-pause-btn`);
    const isPaused = btn.dataset.paused === "true";
    ws.send(JSON.stringify({ action: isPaused ? "resume" : "pause" }));
    // UI will update when server responds
}

function setIntervalWS(asset, val) {
    const ws = window[`ws_${asset}`];
    if (ws) {
        ws.send(JSON.stringify({ action: "set_interval", interval: parseInt(val) }));
        updateIntervalDisplay(asset, val);
    }
}

// ----------- ACTIVE POSITIONS PANEL -----------

function updatePositionsPanel(positions) {
    const panel = document.getElementById("positions-panel");
    const content = document.getElementById("positions-content");
    if (!panel || !content) return;
    if (!positions || !positions.length) {
        content.innerHTML = `<p class="text-center opacity-80">No open positions.</p>`;
        if (positionsChart) positionsChart.destroy();
        return;
    }
    let html = `<table class="w-full text-sm text-white opacity-90"><thead>
        <tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Unrealized PnL</th></tr>
        </thead><tbody>`;
    let pnlSeries = [];
    positions.forEach(pos => {
        html += `<tr>
            <td>${pos.symbol}</td>
            <td>${pos.side}</td>
            <td>${pos.qty}</td>
            <td>${pos.avg_entry_price}</td>
            <td>${pos.unrealized_pnl}</td>
        </tr>`;
        // We'll use the first available pnl_history series for the chart
        if (pos.pnl_history && Array.isArray(pos.pnl_history) && !pnlSeries.length) {
            pnlSeries = pos.pnl_history;
        }
    });
    html += "</tbody></table>";
    content.innerHTML = html;

    // Update PnL chart (if pnl_history available)
    const ctx = document.getElementById("positions-pnl-chart").getContext('2d');
    if (positionsChart) positionsChart.destroy();
    if (pnlSeries.length) {
        positionsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({length: pnlSeries.length}, (_, i) => i+1),
                datasets: [{
                    label: "PnL",
                    data: pnlSeries,
                    borderColor: "rgba(100,255,180,0.85)",
                    borderWidth: 2,
                    fill: false
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { x: { display: false }, y: { display: true } },
                animation: false,
                responsive: true,
            }
        });
    }
}

// -------------- WEBSOCKET HANDLING ----------------

window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("canvas[id$='-chart']").forEach((canvas) => {
        const asset = canvas.id.replace('-chart', '');
        const ws = new WebSocket(`ws://${window.location.host}/ws/${encodeURIComponent(asset)}`);
        window[`ws_${asset}`] = ws;

        ws.onopen = () => {
            // Wait for first server message to set UI state correctly
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            // Update all panels
            if (data.interval) {
                document.getElementById(`${asset}-interval-select`).value = data.interval;
                updateIntervalDisplay(asset, data.interval);
            }
            if (data.chart) createChart(asset, data.chart);
            if (data.stats) updateStats(asset, data.stats);
            if (data.feed) updateFeed(asset, data.feed);
            if (data.reflection) updateReflection(asset, data.reflection, data.improvements);
            if (typeof data.paused === "boolean") updatePauseBtn(asset, data.paused);
            if (data.positions) updatePositionsPanel(data.positions);
        };

        ws.onerror = (err) => {
            console.error(`WebSocket error for ${asset}:`, err);
        };
    });
});

