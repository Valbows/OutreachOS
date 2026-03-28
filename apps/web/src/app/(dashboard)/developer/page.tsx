"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Modal, Badge } from "@/components/ui";

type DeveloperTab = "keys" | "docs" | "webhooks" | "usage";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

interface BYOKProvider {
  id: string;
  name: string;
  description: string;
  configured: boolean;
}

const tabs: { id: DeveloperTab; label: string }[] = [
  { id: "keys", label: "API Keys" },
  { id: "docs", label: "API Docs" },
  { id: "webhooks", label: "Webhooks" },
  { id: "usage", label: "Usage" },
];

const byokProviders: BYOKProvider[] = [
  { id: "hunter", name: "Hunter.io", description: "Email Verification", configured: false },
  { id: "resend", name: "Resend", description: "Transactional Delivery", configured: false },
  { id: "gemini", name: "Gemini API", description: "Multimodal AI Intelligence", configured: false },
  { id: "openrouter", name: "OpenRouter", description: "Unified Model Routing", configured: false },
];

export default function DeveloperPage() {
  const [activeTab, setActiveTab] = useState<DeveloperTab>("keys");
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["read"]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [byokStatus, setByokStatus] = useState<Record<string, boolean>>({});
  const [apiKeysError, setApiKeysError] = useState<string | null>(null);
  const [byokError, setByokError] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const copyToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchApiKeys();
    fetchByokStatus();

    return () => {
      // Cleanup timeout on unmount
      if (copyToastTimeoutRef.current) {
        clearTimeout(copyToastTimeoutRef.current);
      }
    };
  }, []);

  async function fetchApiKeys() {
    setLoading(true);
    setApiKeysError(null);
    try {
      const res = await fetch("/api/developer/keys");
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.keys || []);
      } else {
        const errorData = await res.json().catch(() => ({}));
        const message = errorData.error || errorData.message || `Failed to load API keys (${res.status})`;
        setApiKeysError(message);
        console.error("Failed to fetch API keys:", message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      setApiKeysError(message);
      console.error("Failed to fetch API keys:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchByokStatus() {
    setByokError(null);
    try {
      const res = await fetch("/api/settings/byok");
      if (res.ok) {
        const data = await res.json();
        setByokStatus(data.providers || {});
      } else {
        const errorData = await res.json().catch(() => ({}));
        const message = errorData.error || errorData.message || `Failed to load BYOK status (${res.status})`;
        setByokError(message);
        console.error("Failed to fetch BYOK status:", message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      setByokError(message);
      console.error("Failed to fetch BYOK status:", err);
    }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/developer/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName, scopes: newKeyScopes }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.key);
        setApiKeys((prev) => [data.apiKey, ...prev]);
        setNewKeyName("");
        setNewKeyScopes(["read"]);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setCreateError(errorData.error || errorData.message || `Failed to create key (${res.status})`);
      }
    } catch (err) {
      console.error("Failed to create API key:", err);
      setCreateError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeKey(keyId: string) {
    if (revoking) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/developer/keys/${keyId}`, { method: "DELETE" });
      if (res.ok) {
        setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
        setShowRevokeModal(null);
      }
    } catch (err) {
      console.error("Failed to revoke API key:", err);
    } finally {
      setRevoking(false);
    }
  }

  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      return false;
    }
  }

  const staleKeys = apiKeys.filter((k) => {
    if (!k.createdAt) return false;
    const created = new Date(k.createdAt);
    const daysSinceCreated = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreated > 90;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API Keys Management</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Authenticated interface control for your communication clusters.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-outline-variant">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "keys" && (
        <div className="space-y-6">
          {/* Status cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-tertiary" />
                  Active Credentials
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{apiKeys.length}</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  {apiKeys.length === 1 ? "1 key" : `${apiKeys.length} keys`} configured
                </p>
              </CardContent>
            </Card>

            {staleKeys.length > 0 && (
              <Card className="border-error/30 bg-error/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-error">
                    <WarningIcon className="w-4 h-4" />
                    Security Audit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-error">
                    {staleKeys.length} {staleKeys.length === 1 ? "key was" : "keys were"} created over 90 days ago.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* API Keys list */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>API Keys</CardTitle>
              <Button onClick={() => setShowCreateModal(true)}>
                <PlusIcon className="w-4 h-4 mr-2" />
                Create Key
              </Button>
            </CardHeader>
            <CardContent>
              {apiKeysError ? (
                <div className="p-4 rounded-lg bg-error/10 text-error text-sm">
                  <p className="font-medium mb-1">Failed to load API keys</p>
                  <p>{apiKeysError}</p>
                  <button
                    onClick={fetchApiKeys}
                    className="mt-2 text-sm underline hover:no-underline"
                  >
                    Retry
                  </button>
                </div>
              ) : loading ? (
                <p className="text-on-surface-variant text-sm">Loading...</p>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8">
                  <KeyIcon className="w-12 h-12 mx-auto text-on-surface-variant/50 mb-3" />
                  <p className="text-on-surface-variant">No API keys yet</p>
                  <p className="text-sm text-on-surface-variant/70 mt-1">
                    Create your first API key to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-surface-container"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{key.name}</span>
                          {staleKeys.some((k) => k.id === key.id) && (
                            <Badge variant="destructive" className="text-xs">Stale</Badge>
                          )}
                        </div>
                        <p className="text-sm text-on-surface-variant font-mono mt-1">
                          {key.prefix}...
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-on-surface-variant">
                          <span>Scopes: {key.scopes.join(", ")}</span>
                          <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                          {key.lastUsedAt && (
                            <span>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-error hover:text-error hover:bg-error/10"
                        onClick={() => setShowRevokeModal(key.id)}
                      >
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* BYOK Section */}
          <Card>
            <CardHeader>
              <CardTitle>Bring Your Own Keys (BYOK)</CardTitle>
              <p className="text-sm text-on-surface-variant mt-1">
                Integrate your existing provider infrastructure seamlessly.
              </p>
            </CardHeader>
            <CardContent>
              {byokError ? (
                <div className="p-4 rounded-lg bg-error/10 text-error text-sm mb-4">
                  <p className="font-medium mb-1">Failed to load provider status</p>
                  <p>{byokError}</p>
                </div>
              ) : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {byokProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className="p-4 rounded-lg border border-outline-variant bg-surface-container-low"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{provider.name}</span>
                      {byokStatus[provider.id] ? (
                        <Badge variant="secondary" className="text-xs bg-tertiary/10 text-tertiary">
                          Configured
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Not Set
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant">{provider.description}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-on-surface-variant mt-4">
                Configure BYOK keys in{" "}
                <a href="/settings" className="text-primary hover:underline">
                  Settings → Inbox Connection
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "docs" && (
        <Card>
          <CardHeader>
            <CardTitle>API Documentation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-on-surface-variant mb-4">
              Complete API reference with interactive examples.
            </p>
            <a
              href="/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-[var(--radius-button)] bg-gradient-primary text-on-primary-fixed hover:opacity-90 transition-all duration-150"
            >
              View OpenAPI Docs
            </a>
          </CardContent>
        </Card>
      )}

      {activeTab === "webhooks" && (
        <Card>
          <CardHeader>
            <CardTitle>Webhooks</CardTitle>
            <p className="text-sm text-on-surface-variant mt-1">
              Receive real-time notifications for email events.
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-on-surface-variant text-sm">
              Webhook configuration coming soon.
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === "usage" && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-on-surface-variant text-sm">
              View detailed usage analytics on the{" "}
              <a href="/developer/usage" className="text-primary hover:underline">
                Usage Dashboard
              </a>
              .
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Key Modal */}
      <Modal
        open={showCreateModal}
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open || createdKey) {
            setCreatedKey(null);
            setCreateError(null);
          }
        }}
      >
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Create API Key</h2>
          {createdKey ? (
            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                Your API key has been created. Copy it now — you won&apos;t be able to see it again.
              </p>
              <div className="p-3 bg-surface-container rounded-lg font-mono text-sm break-all">
                {createdKey}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    const success = await copyToClipboard(createdKey);
                    setCopyToast({
                      message: success ? "API key copied to clipboard" : "Failed to copy. Please copy manually.",
                      type: success ? "success" : "error",
                    });
                    // Clear any existing timeout before creating new one
                    if (copyToastTimeoutRef.current) {
                      clearTimeout(copyToastTimeoutRef.current);
                    }
                    copyToastTimeoutRef.current = setTimeout(() => setCopyToast(null), 3000);
                  }}
                  className="flex-1"
                >
                  Copy Key
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreatedKey(null);
                    setShowCreateModal(false);
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Key Name</label>
                <Input
                  placeholder="e.g., Production API Key"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
              {createError && (
                <div className="p-3 rounded-lg bg-error/10 text-error text-sm">
                  {createError}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Scopes</label>
                <div className="flex flex-wrap gap-2">
                  {["read", "write", "admin"].map((scope) => (
                    <button
                      key={scope}
                      onClick={() =>
                        setNewKeyScopes((prev) =>
                          prev.includes(scope)
                            ? prev.length === 1
                              ? prev
                              : prev.filter((s) => s !== scope)
                            : [...prev, scope]
                        )
                      }
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        newKeyScopes.includes(scope)
                          ? "bg-primary text-on-primary border-primary"
                          : "border-outline-variant text-on-surface-variant hover:border-primary"
                      }`}
                    >
                      {scope}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleCreateKey} disabled={!newKeyName.trim() || creating || newKeyScopes.length === 0}>
                  {creating ? "Creating..." : "Create Key"}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Revoke Key Modal */}
      <Modal open={!!showRevokeModal} onOpenChange={() => setShowRevokeModal(null)}>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-error">Revoke API Key</h2>
          <p className="text-sm text-on-surface-variant">
            Are you sure you want to revoke this API key? This action cannot be undone and will
            immediately invalidate the key.
          </p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => showRevokeModal && handleRevokeKey(showRevokeModal)}
              disabled={revoking}
            >
              {revoking ? "Revoking..." : "Revoke Key"}
            </Button>
            <Button variant="outline" onClick={() => setShowRevokeModal(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
      {/* Toast Notification */}
      {copyToast && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 transition-all ${
            copyToast.type === "success"
              ? "bg-secondary text-on-secondary"
              : "bg-error text-on-error"
          }`}
        >
          {copyToast.message}
        </div>
      )}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}
