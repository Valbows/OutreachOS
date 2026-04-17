"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import {
  useMcpServers,
  useCreateMcpServer,
  useUpdateMcpServer,
  useDeleteMcpServer,
  useTestMcpServer,
  type McpServer,
} from "@/lib/hooks/use-mcp-servers";

/* ------------------------------------------------------------------ */
/* Main section                                                         */
/* ------------------------------------------------------------------ */

export function IntegrationsSection() {
  const { data: servers, isLoading, error } = useMcpServers();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-8">
      {/* OutreachOS MCP info card */}
      <OutreachMcpInfoCard />

      {/* External MCP Servers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-on-surface">External MCP Servers</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Register external MCP servers that your AI tools can discover and call.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ Add Server"}
          </Button>
        </div>

        {showForm && (
          <AddServerForm onSuccess={() => setShowForm(false)} />
        )}

        {isLoading ? (
          <div className="py-8 text-center text-sm text-on-surface-variant">Loading...</div>
        ) : error ? (
          <div role="alert" className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
            Failed to load MCP servers
          </div>
        ) : (servers ?? []).length === 0 && !showForm ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-8 text-center">
            <p className="text-sm font-medium text-on-surface">No external MCP servers yet</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Add your first MCP server to enable external tool integrations.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(servers ?? []).map((server) => (
              <ServerCard key={server.id} server={server} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OutreachOS MCP info card                                             */
/* ------------------------------------------------------------------ */

function OutreachMcpInfoCard() {
  const [copied, setCopied] = useState<"url" | "config" | null>(null);

  const mcpUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/v1/mcp`
      : "/api/v1/mcp";

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        outreachos: {
          url: mcpUrl,
          headers: { Authorization: "Bearer YOUR_API_KEY" },
        },
      },
    },
    null,
    2,
  );

  const cursorConfig = `[mcp]\nname = "OutreachOS"\nurl = "${mcpUrl}"\napi_key = "YOUR_API_KEY"`;

  async function copy(text: string, key: "url" | "config") {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-on-surface">OutreachOS MCP Server</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Connect Claude Desktop, Cursor, or any MCP-compatible client to OutreachOS.
        </p>
      </div>

      {/* MCP URL */}
      <div>
        <label className="block text-xs font-medium text-on-surface-variant mb-1">
          MCP Server URL
        </label>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-surface-container-highest px-3 py-2 text-xs font-mono text-on-surface break-all">
            {mcpUrl}
          </code>
          <button
            onClick={() => copy(mcpUrl, "url")}
            className="shrink-0 rounded-lg border border-outline-variant px-3 py-2 text-xs hover:bg-surface-container-high transition-colors"
          >
            {copied === "url" ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="mt-1 text-xs text-on-surface-variant">
          Use an API key from{" "}
          <a href="/developer" className="text-primary hover:underline">
            Developer &rarr; API Keys
          </a>{" "}
          as your Bearer token.
        </p>
      </div>

      {/* Config snippets */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-on-surface-variant">Claude Desktop config</label>
            <button
              onClick={() => copy(claudeConfig, "config")}
              className="text-xs text-primary hover:underline"
            >
              {copied === "config" ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="rounded-lg bg-surface-container-highest p-3 text-xs font-mono text-on-surface overflow-x-auto whitespace-pre-wrap break-all">
            {claudeConfig}
          </pre>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-on-surface-variant">Cursor config</label>
          </div>
          <pre className="rounded-lg bg-surface-container-highest p-3 text-xs font-mono text-on-surface overflow-x-auto whitespace-pre-wrap break-all">
            {cursorConfig}
          </pre>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add server form                                                       */
/* ------------------------------------------------------------------ */

function AddServerForm({ onSuccess }: { onSuccess: () => void }) {
  const createServer = useCreateMcpServer();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Name is required");
    if (!url.trim()) return setError("URL is required");
    try {
      await createServer.mutateAsync({
        name: name.trim(),
        url: url.trim(),
        apiKey: apiKey.trim() || undefined,
        description: description.trim() || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add server");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-5 space-y-3"
    >
      <h3 className="text-sm font-semibold text-on-surface">Add MCP Server</h3>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="mcp-name" className="block text-xs font-medium text-on-surface-variant mb-1">
            Name <span className="text-error">*</span>
          </label>
          <input
            id="mcp-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My MCP Server"
            required
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="mcp-url" className="block text-xs font-medium text-on-surface-variant mb-1">
            URL <span className="text-error">*</span>
          </label>
          <input
            id="mcp-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://my-mcp-server.example.com"
            required
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="mcp-apikey" className="block text-xs font-medium text-on-surface-variant mb-1">
            API Key (optional)
          </label>
          <input
            id="mcp-apikey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="mcp-desc" className="block text-xs font-medium text-on-surface-variant mb-1">
            Description (optional)
          </label>
          <input
            id="mcp-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this server do?"
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={createServer.isPending}>
          {createServer.isPending ? "Adding..." : "Add Server"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Server card                                                           */
/* ------------------------------------------------------------------ */

function ServerCard({ server }: { server: McpServer }) {
  const updateServer = useUpdateMcpServer();
  const deleteServer = useDeleteMcpServer();
  const testServer = useTestMcpServer();
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; latencyMs?: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setErrorMsg("");
    try {
      const result = await testServer.mutateAsync(server.id);
      setTestResult(result);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleToggleEnabled() {
    try {
      await updateServer.mutateAsync({ id: server.id, enabled: server.enabled === 0 });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to update");
    }
  }

  async function handleDelete() {
    if (!confirm(`Remove "${server.name}"?`)) return;
    try {
      await deleteServer.mutateAsync(server.id);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  const isEnabled = server.enabled !== 0;
  const statusColor =
    server.lastTestStatus === "ok"
      ? "text-secondary"
      : server.lastTestStatus === "error"
        ? "text-error"
        : "text-on-surface-variant";

  return (
    <div
      className={`rounded-xl border bg-surface-container-low p-4 transition-colors ${
        isEnabled ? "border-outline-variant/30" : "border-outline-variant/10 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-on-surface">{server.name}</span>
            <span
              className={`text-xs font-mono ${statusColor}`}
              aria-label={`Last test: ${server.lastTestStatus ?? "not tested"}`}
            >
              {server.lastTestStatus === "ok"
                ? "● ok"
                : server.lastTestStatus === "error"
                  ? "● error"
                  : "● not tested"}
            </span>
            {!isEnabled && (
              <span className="text-xs bg-outline-variant/20 text-on-surface-variant rounded-full px-2 py-0.5">
                disabled
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-on-surface-variant mt-0.5 truncate">{server.url}</p>
          {server.description && (
            <p className="text-xs text-on-surface-variant mt-0.5">{server.description}</p>
          )}
          {server.lastTestedAt && (
            <p className="text-xs text-on-surface-variant mt-0.5">
              Last tested:{" "}
              {new Date(server.lastTestedAt).toLocaleString(undefined, {
                dateStyle: "short",
                timeStyle: "short",
              })}
              {server.lastTestError && (
                <span className="text-error ml-1">— {server.lastTestError}</span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTest}
            disabled={testing}
            aria-label={`Test ${server.name}`}
          >
            {testing ? "Testing..." : "Test"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleEnabled}
            disabled={updateServer.isPending}
          >
            {isEnabled ? "Disable" : "Enable"}
          </Button>
          <button
            onClick={handleDelete}
            disabled={deleteServer.isPending}
            className="text-xs text-error hover:underline disabled:opacity-50"
            aria-label={`Remove ${server.name}`}
          >
            Remove
          </button>
        </div>
      </div>

      {testResult && (
        <div
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            testResult.ok
              ? "bg-secondary/10 text-secondary"
              : "bg-error/10 text-error"
          }`}
        >
          {testResult.ok
            ? `Connected successfully${testResult.latencyMs != null ? ` (${testResult.latencyMs}ms)` : ""}`
            : `Connection failed: ${testResult.error ?? "unknown error"}`}
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="mt-2 text-xs text-error">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
