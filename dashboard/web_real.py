# dashboard/web.py
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from fastapi import FastAPI, Request, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from tradingbot.trading.strategy import TradingStrategy
from tradingbot.config import Config
import asyncio

app = FastAPI()
app.mount("/static", StaticFiles(directory="dashboard/static"), name="static")
templates = Jinja2Templates(directory="dashboard/templates")

# Make strategies for all assets in Config.ASSETS
strategies = {asset: TradingStrategy(asset) for asset in Config.ASSETS}

@app.get("/")
async def root(request: Request):
    # Show dashboard for all assets
    summaries = []
    for asset, strat in strategies.items():
        feed = strat.get_trade_feed(10)
        summaries.append({"asset": asset, "feed": feed})
    return templates.TemplateResponse("index.html", {
        "request": request,
        "summaries": summaries,
        "assets": Config.ASSETS
    })

@app.websocket("/ws/{asset}")
async def asset_websocket(websocket: WebSocket, asset: str):
    await websocket.accept()
    strategy = TradingStrategy(asset)
    try:
        while True:
            df = strategy.data_client.get_historical_data(asset, days=30, timeframe=Config.TIMEFRAME)
            df = add_indicators(df)
            chart_data = {
                "dates": df.index.strftime("%Y-%m-%d %H:%M").tolist()[-100:],
                "close": df['close'].tolist()[-100:],
                "sma20": df['sma20'].tolist()[-100:],
                "sma50": df['sma50'].tolist()[-100:]
            }
            stats = {
                "pnl": strategy.history.pnl(),    # Implement this for cumulative P&L
                "win_rate": strategy.history.win_rate(), # Implement win rate
                "sharpe": strategy.history.sharpe(),     # Implement Sharpe
                "drawdown": strategy.history.drawdown()  # Implement drawdown
            }
            feed = strategy.get_trade_feed(10)
            await websocket.send_json({
                "chart": chart_data,
                "stats": stats,
                "feed": feed
            })
            await asyncio.sleep(30)
    except Exception as e:
        print("WebSocket closed:", e)


def run_trading_loops():
    import threading
    def run_for_asset(asset, strat):
        while True:
            strat.trading_cycle()
            time.sleep(900)  # Run every 15 minutes (adjust as needed)
    for asset, strat in strategies.items():
        t = threading.Thread(target=run_for_asset, args=(asset, strat), daemon=True)
        t.start()

# Only run trading loops if main process (not on reload)
if __name__ == "__main__":
    run_trading_loops()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
