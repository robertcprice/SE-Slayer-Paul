import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import AiLogsPage from "@/pages/ai-logs";
import Admin from "@/pages/admin";
import StrategyEditor from "@/pages/strategy-editor";
import Backtesting from "@/pages/backtesting";
import NotFound from "@/pages/not-found";
import { Navigation } from "@/components/Navigation";

function Router() {
  return (
    <>
      <Navigation />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/ai-logs" component={AiLogsPage} />
        <Route path="/admin" component={Admin} />
        <Route path="/strategy-editor" component={StrategyEditor} />
        <Route path="/backtesting" component={Backtesting} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
