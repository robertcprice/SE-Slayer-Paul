# tradingbot/dashboard/web.py
import os
import time
from fastapi import WebSocket, WebSocketDisconnect, Request, FastAPI
import asyncio
import json
from dotenv import load_dotenv

from tradingbot.trading.strategy import TradingStrategy
from tradingbot.utils.intervals import get_interval, set_interval
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

# Load .env file
load_dotenv()

app = FastAPI()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

ASSETS = ["SOL/USD"]

@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("index.html", {
        "request": request,
        "assets": ASSETS,
        "best_asset": "SOL/USD",
        "best_pnl": 4200.67,
    })

def compute_stats(trades):
    # Dummy implementation, fill in with real stats if needed
    return {
        "net_pnl": 0,
        "win_rate": 0,
        "sharpe": 0,
        "drawdown": 0,
        "total_trades": len(trades),
        "average_win": 0,
        "average_loss": 0,
    }

@app.websocket("/ws/{asset:path}")
async def ws_asset(websocket: WebSocket, asset: str):
    await websocket.accept()
    asset = asset.upper()
    strategy = TradingStrategy(asset)
    paused = False  # Start paused
    interval = 300  # 5 minutes
    allowed_intervals = {60, 300, 900, 1800, 3600}


    async def send_dashboard_update():
        trades = strategy.history.all()
        stats = compute_stats(trades)
        feed = trades[-10:] if len(trades) > 0 else []
        chart_data = {
            "dates": [t['timestamp'][:10] for t in trades[-30:]],
            "close": [t.get("executed", {}).get("price", 0) or 0 for t in trades[-30:]],
        }
        positions = strategy.get_open_positions() if hasattr(strategy, "get_open_positions") else []
        reflection = ""
        improvements = ""
        if trades:
            last = trades[-1]
            reflection = last.get("reflection", "")
            improvements = last.get("improvements", "")
        await websocket.send_json({
            "stats": stats,
            "feed": feed,
            "reflection": reflection,
            "improvements": improvements,
            "chart": chart_data,
            "positions": positions,
            "paused": paused,
            "interval": interval
    })


    async def trading_loop():
        nonlocal paused, interval
        next_run = time.time()
        while True:
            print(f"Trading loop running. Paused={paused} Interval={interval}")
            if not paused:
                now = time.time()
                if now >= next_run:
                    print("Calling trading_cycle() for", asset)
                    strategy.trading_cycle()
                    print("Trading cycle finished.")
                    next_run = now + interval  # Schedule next run
            await send_dashboard_update()
            await asyncio.sleep(1)

    task = asyncio.create_task(trading_loop())
    try:
        while True:
            msg = await websocket.receive_text()
            try:
                data = json.loads(msg)
                if data.get("action") == "pause":
                    paused = True
                    await send_dashboard_update()
                elif data.get("action") == "resume":
                    paused = False
                    await send_dashboard_update()
                elif data.get("action") == "set_interval":
                    try:
                        val = int(data["interval"])
                        if val in allowed_intervals:
                            interval = val
                            set_interval(asset, interval)
                            await send_dashboard_update()
                    except Exception:
                        pass
            except Exception:
                pass
    except WebSocketDisconnect:
        task.cancel()