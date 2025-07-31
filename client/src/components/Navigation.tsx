import React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { TrendingUp, Database, Settings, FileEdit, BarChart3 } from "lucide-react";

export function Navigation() {
  const [location] = useLocation();

  return (
    <nav className="relative z-50 border-b border-white/20 bg-black/30 backdrop-blur-md supports-[backdrop-filter]:bg-black/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-white">AI Trading Bot</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <Link href="/">
              <Button 
                variant={location === "/" || location === "/dashboard" ? "default" : "ghost"} 
                size="sm"
                className={`flex items-center gap-2 ${location === "/" || location === "/dashboard" ? "bg-blue-600 text-white" : "text-white/90 hover:text-white hover:bg-white/10"}`}
              >
                <TrendingUp className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            
            <Link href="/ai-logs">
              <Button 
                variant={location === "/ai-logs" ? "default" : "ghost"} 
                size="sm"
                className={`flex items-center gap-2 ${location === "/ai-logs" ? "bg-blue-600 text-white" : "text-white/90 hover:text-white hover:bg-white/10"}`}
              >
                <Database className="h-4 w-4" />
                AI Logs
              </Button>
            </Link>
            
            <Link href="/strategy-editor">
              <Button 
                variant={location === "/strategy-editor" ? "default" : "ghost"} 
                size="sm"
                className={`flex items-center gap-2 ${location === "/strategy-editor" ? "bg-blue-600 text-white" : "text-white/90 hover:text-white hover:bg-white/10"}`}
              >
                <FileEdit className="h-4 w-4" />
                Strategy Editor
              </Button>
            </Link>
            
            <Link href="/backtesting">
              <Button 
                variant={location === "/backtesting" ? "default" : "ghost"} 
                size="sm"
                className={`flex items-center gap-2 ${location === "/backtesting" ? "bg-blue-600 text-white" : "text-white/90 hover:text-white hover:bg-white/10"}`}
              >
                <BarChart3 className="h-4 w-4" />
                Backtesting
              </Button>
            </Link>
            
            <Link href="/admin">
              <Button 
                variant={location === "/admin" ? "default" : "ghost"} 
                size="sm"
                className={`flex items-center gap-2 ${location === "/admin" ? "bg-blue-600 text-white" : "text-white/90 hover:text-white hover:bg-white/10"}`}
              >
                <Settings className="h-4 w-4" />
                Admin
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}