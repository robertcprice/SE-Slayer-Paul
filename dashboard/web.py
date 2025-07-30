# tradingbot/dashboard/web.py
import os
import asyncio
import datetime
from fastapi import FastAPI, WebSocket, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import random

app = FastAPI()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

ASSETS = ["BTC/USD", "SOL/USD"]

@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("index.html", {
        "request": request,
        "assets": ASSETS,
        "best_asset": "BTC/USD",
        "best_pnl": 4200.67,
    })

@app.websocket("/ws/{asset:path}")
async def asset_websocket(websocket: WebSocket, asset: str):
    await websocket.accept()
    fake_trade_actions = ["BUY", "SELL", "HOLD"]
    fake_reasonings = [
        "Liquidity sweep, bullish FVG, NY session.",
        "Order block rejection, SMC confluence.",
        "Chop/no clear bias.",
        "Asian low taken, premium to discount.",
    ]
    while True:
        now = datetime.datetime.utcnow()
        # Chart data (last 100 mins)
        chart_data = {
            "dates": [(now - datetime.timedelta(minutes=i)).strftime("%Y-%m-%d %H:%M") for i in reversed(range(100))],
            "close": [random.uniform(30, 70) + i*0.05 for i in range(100)],
            "sma20": [random.uniform(35, 65) for _ in range(100)],
            "sma50": [random.uniform(40, 60) for _ in range(100)],
        }
        stats = {
            "total_trades": 17,
            "net_pnl": round(random.uniform(200, 5000), 2),
            "average_win": round(random.uniform(10, 120), 2),
            "average_loss": round(random.uniform(-100, -10), 2),
            "win_rate": 0.58,
            "sharpe": round(random.uniform(1.0, 2.2), 2),
            "drawdown": round(random.uniform(4, 18), 2),
        }
        # Demo feed: last 5 trades
        feed = []
        for i in range(5):
            ts = (now - datetime.timedelta(minutes=i*5)).isoformat()
            action = random.choice(fake_trade_actions)
            feed.append({
                "timestamp": ts,
                "action": action,
                "qty": round(random.uniform(0.005, 0.013), 4),
                "price": round(random.uniform(35_000, 67_000), 2),
                "ai_reasoning": random.choice(fake_reasonings),
            })
        reflection = (
            "Most profitable trades occurred after liquidity sweeps and FVG fills. Avoided chop. "
            "Risk management improved. Consider waiting for London session setups."
        )
        improvements = "Refine OB entry criteria; avoid overtrading in low volatility periods."
        await websocket.send_json({
            "chart": chart_data,
            "stats": stats,
            "feed": feed,
            "reflection": reflection,
            "improvements": improvements,
        })
        await asyncio.sleep(3)
