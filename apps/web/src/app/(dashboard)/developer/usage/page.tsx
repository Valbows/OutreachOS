"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@/components/ui";

interface UsageStats {
  totalApiCalls: number;
  llmTokens: number;
  hunterCredits: number;
  resendEmails: number;
  periodStart: string;
  periodEnd: string;
}

interface EndpointUsage {
  endpoint: string;
  method: string;
  calls: number;
  avgLatency: number;
  errorRate: number;
}

interface DailyUsage {
  date: string;
  apiCalls: number;
  llmTokens: number;
}

type TimeRange = "7d" | "30d" | "90d";

export default function UsageAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointUsage[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);

  useEffect(() => {
    fetchUsageData();
  }, [timeRange]);

  async function fetchUsageData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/developer/usage?range=${timeRange}`);
      if (!res.ok) {
        const errorText = await res.text();
        setError(`Failed to load usage data: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ""}`);
        setStats(null);
        setEndpoints([]);
        setDailyUsage([]);
        return;
      }
      const data = await res.json();
      setStats(data.stats);
      setEndpoints(data.endpoints || []);
      setDailyUsage(data.daily || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to load usage data: ${message}`);
      setStats(null);
      setEndpoints([]);
      setDailyUsage([]);
      console.error("Failed to fetch usage data:", err);
    } finally {
      setLoading(false);
    }
  }

  const periodDays = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
  const monthlyMultiplier = 30 / periodDays;
  
  const estimatedMonthlyCost = stats
    ? ((stats.llmTokens * 0.00001 + stats.hunterCredits * 0.01 + stats.resendEmails * 0.001) * monthlyMultiplier).toFixed(2)
    : "0.00";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System Utilization</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Real-time resource allocation and API consumption metrics across your intelligence infrastructure.
          </p>
        </div>
        <div className="flex gap-1 bg-surface-container rounded-lg p-1">
          {(["7d", "30d", "90d"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                timeRange === range
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-error-container text-on-error-container p-4 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={fetchUsageData}>
            Retry
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-on-surface-variant">
              API Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {loading ? "—" : stats?.totalApiCalls.toLocaleString() || "0"}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">Total requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-on-surface-variant">
              LLM Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {loading ? "—" : stats?.llmTokens.toLocaleString() || "0"}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">Tokens consumed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-on-surface-variant">
              Hunter Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {loading ? "—" : stats?.hunterCredits.toLocaleString() || "0"}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">Enrichment lookups</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-on-surface-variant">
              Emails Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {loading ? "—" : stats?.resendEmails.toLocaleString() || "0"}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">Via Resend</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Projection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarIcon className="w-5 h-5" />
            Cost Projection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold">${estimatedMonthlyCost}</span>
            <span className="text-on-surface-variant">Estimated Monthly Burn</span>
          </div>
          <p className="text-xs text-on-surface-variant mt-2">
            Based on current usage patterns. Using BYOK keys reduces platform costs.
          </p>
        </CardContent>
      </Card>

      {/* Endpoint Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartIcon className="w-5 h-5" />
            Endpoint Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-on-surface-variant text-sm">Loading...</p>
          ) : endpoints.length === 0 ? (
            <p className="text-on-surface-variant text-sm">No API usage data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="text-left py-3 px-4 font-medium text-on-surface-variant">Endpoint</th>
                    <th className="text-left py-3 px-4 font-medium text-on-surface-variant">Method</th>
                    <th className="text-right py-3 px-4 font-medium text-on-surface-variant">Calls</th>
                    <th className="text-right py-3 px-4 font-medium text-on-surface-variant">Avg Latency</th>
                    <th className="text-right py-3 px-4 font-medium text-on-surface-variant">Error Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((ep, idx) => (
                    <tr key={idx} className="border-b border-outline-variant/50">
                      <td className="py-3 px-4 font-mono text-xs">{ep.endpoint}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {ep.method}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">{ep.calls.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">{ep.avgLatency}ms</td>
                      <td className="py-3 px-4 text-right">
                        <span className={ep.errorRate > 5 ? "text-error" : ""}>
                          {ep.errorRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Intelligence Trace */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainIcon className="w-5 h-5" />
            Intelligence Trace
          </CardTitle>
          <p className="text-sm text-on-surface-variant mt-1">
            Token-level granularity for generative inference.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-on-surface-variant text-sm">Loading...</p>
          ) : dailyUsage.length === 0 ? (
            <p className="text-on-surface-variant text-sm">No LLM usage data yet.</p>
          ) : (
            <div className="space-y-2">
              {dailyUsage.slice(0, 7).map((day) => (
                <div key={day.date} className="flex items-center gap-4">
                  <span className="text-sm text-on-surface-variant w-24">
                    {new Date(day.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <div className="flex-1 h-6 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${Math.min(100, (day.llmTokens / Math.max(...dailyUsage.map((d) => d.llmTokens || 1))) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-24 text-right">
                    {day.llmTokens.toLocaleString()} tokens
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <a
          href="/developer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-[var(--radius-button)] bg-transparent border border-outline text-on-surface hover:bg-surface-container transition-all duration-150"
        >
          ← Back to Developer
        </a>
      </div>
    </div>
  );
}

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}
