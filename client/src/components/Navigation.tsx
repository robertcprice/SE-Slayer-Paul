import React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { TrendingUp, Database, Settings, FileEdit, BarChart3 } from "lucide-react";

export function Navigation() {
  const [location] = useLocation();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">AI Trading Bot</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <Link href="/">
              <Button 
                variant={location === "/" ? "default" : "ghost"} 
                size="sm"
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            
            <Link href="/ai-logs">
              <Button 
                variant={location === "/ai-logs" ? "default" : "ghost"} 
                size="sm"
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                AI Logs
              </Button>
            </Link>
            
            <Link href="/strategy-editor">
              <Button 
                variant={location === "/strategy-editor" ? "default" : "ghost"} 
                size="sm"
                className="flex items-center gap-2"
              >
                <FileEdit className="h-4 w-4" />
                Strategy Editor
              </Button>
            </Link>
            
            <Link href="/backtesting">
              <Button 
                variant={location === "/backtesting" ? "default" : "ghost"} 
                size="sm"
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Backtesting
              </Button>
            </Link>
            
            <Link href="/admin">
              <Button 
                variant={location === "/admin" ? "default" : "ghost"} 
                size="sm"
                className="flex items-center gap-2"
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