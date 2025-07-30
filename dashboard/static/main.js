// tradingbot/dashboard/static/main.js

const charts = {};

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
    document.getElementById(`${asset}-pnl`).textContent = stats.net_pnl ? "$" + stats.net_pnl.toFixed(2) : '--';
    document.getElementById(`${asset}-winrate`).textContent = stats.win_rate ? (stats.win_rate*100).toFixed(1)+'%' : '--';
    document.getElementById(`${asset}-sharpe`).textContent = stats.sharpe ?? '--';
    document.getElementById(`${asset}-drawdown`).textContent = stats.drawdown ?? '--';
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
        li.textContent = `[${trade.timestamp}] ${trade.action} ${trade.qty} @ $${trade.price} | ${trade.ai_reasoning ?? ''}`;
        ul.appendChild(li);
    });
}

function updateReflection(asset, reflection, improvements) {
    document.getElementById(`${asset}-reflection`).textContent = reflection ?? '';
    document.getElementById(`${asset}-improvements`).textContent = improvements ?? '';
}

window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("canvas[id$='-chart']").forEach((canvas) => {
        const asset = canvas.id.replace('-chart', '');
        const ws = new WebSocket(`ws://${window.location.host}/ws/${encodeURIComponent(asset)}`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.chart) createChart(asset, data.chart);
            if (data.stats) updateStats(asset, data.stats);
            if (data.feed) updateFeed(asset, data.feed);
            if (data.reflection) updateReflection(asset, data.reflection, data.improvements);
        };
        ws.onerror = (err) => {
            console.error(`WebSocket error for ${asset}:`, err);
        };
    });
});
