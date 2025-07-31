import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PortfolioDataPoint {
  timestamp: string;
  pnl: number;
  equity: number;
}

export default function PortfolioChart() {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  const { data: portfolioHistory } = useQuery<PortfolioDataPoint[]>({
    queryKey: ["/api/portfolio/history"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  useEffect(() => {
    if (chartRef.current && window.Chart && portfolioHistory && portfolioHistory.length > 0) {
      // Destroy existing chart
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (!ctx) return;

      // Prepare chart data
      const labels = portfolioHistory.map(point => {
        const date = new Date(point.timestamp);
        return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
      });

      const pnlData = portfolioHistory.map(point => point.pnl);
      const equityData = portfolioHistory.map(point => point.equity);

      chartInstance.current = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Total P&L',
              data: pnlData,
              borderColor: pnlData[pnlData.length - 1] >= 0 ? '#22c55e' : '#ef4444',
              backgroundColor: pnlData[pnlData.length - 1] >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.1,
              pointRadius: 2,
              pointHoverRadius: 4,
            },
            {
              label: 'Portfolio Value',
              data: equityData,
              borderColor: '#06b6d4',
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              borderWidth: 2,
              fill: false,
              tension: 0.1,
              pointRadius: 2,
              pointHoverRadius: 4,
              yAxisID: 'y1',
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index',
          },
          scales: {
            x: {
              display: true,
              grid: {
                color: 'rgba(255, 255, 255, 0.1)',
              },
              ticks: {
                color: 'rgba(255, 255, 255, 0.7)',
                maxTicksLimit: 8,
              }
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              grid: {
                color: 'rgba(255, 255, 255, 0.1)',
              },
              ticks: {
                color: 'rgba(255, 255, 255, 0.7)',
                callback: function(value: any) {
                  return '$' + value.toFixed(2);
                }
              },
              title: {
                display: true,
                text: 'P&L ($)',
                color: 'rgba(255, 255, 255, 0.7)',
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              grid: {
                drawOnChartArea: false,
              },
              ticks: {
                color: 'rgba(255, 255, 255, 0.7)',
                callback: function(value: any) {
                  return '$' + value.toLocaleString();
                }
              },
              title: {
                display: true,
                text: 'Portfolio Value ($)',
                color: 'rgba(255, 255, 255, 0.7)',
              }
            }
          },
          plugins: {
            legend: {
              display: true,
              labels: {
                color: 'rgba(255, 255, 255, 0.7)',
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: 'white',
              bodyColor: 'white',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              callbacks: {
                label: function(context: any) {
                  const label = context.dataset.label || '';
                  const value = context.parsed.y;
                  if (label === 'Total P&L') {
                    return `P&L: $${value.toFixed(2)}`;
                  } else {
                    return `Portfolio: $${value.toLocaleString()}`;
                  }
                }
              }
            }
          }
        }
      });
    }

    // Cleanup function
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [portfolioHistory]);

  return (
    <Card className="glass-panel-dark border-white/20">
      <CardHeader>
        <CardTitle className="text-white">Portfolio Performance</CardTitle>
        <p className="text-white/60 text-sm">
          {portfolioHistory?.length > 0 
            ? `${portfolioHistory.length} data points (5-minute intervals)`
            : "Portfolio tracking started - data will appear after first logging cycle"
          }
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64 relative">
          {portfolioHistory && portfolioHistory.length > 0 ? (
            <canvas ref={chartRef} className="w-full h-full"></canvas>
          ) : (
            <div className="h-full flex items-center justify-center text-white/60">
              <p>Portfolio data will be logged every 5 minutes...</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}