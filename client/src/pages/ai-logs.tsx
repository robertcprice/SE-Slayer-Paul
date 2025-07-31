import React from "react";
import { AiLogsPanel } from "@/components/AiLogsPanel";

export default function AiLogsPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">AI Decision Logs</h1>
        <p className="text-muted-foreground mt-2">
          View and export all OpenAI trading decisions with detailed analytics and token usage
        </p>
      </div>
      
      <AiLogsPanel />
    </div>
  );
}