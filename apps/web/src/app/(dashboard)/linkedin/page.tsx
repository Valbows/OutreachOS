"use client";

import { useState, useRef, useEffect } from "react";
import {
  useLinkedInPlaybook,
  useGenerateLinkedInCopy,
  useRegenerateLinkedInCopy,
  useUpdatePlaybookStatus,
  useDeletePlaybookEntry,
  useBatchGenerateLinkedInCopy,
  type PlaybookEntry,
  type BatchGenerateResult,
} from "@/lib/hooks/use-linkedin";
import { useContactGroups, useContacts } from "@/lib/hooks/use-contacts";

const statusColors: Record<string, string> = {
  generated: "bg-[#41eec2]/20 text-[#41eec2]",
  sent: "bg-[#c4c0ff]/20 text-[#c4c0ff]",
  draft: "bg-[#464555]/40 text-[#c7c4d8]",
  pending: "bg-[#464555]/40 text-[#c7c4d8]",
};

export default function LinkedInPlaybookPage() {
  const { data, isLoading, error } = useLinkedInPlaybook();
  const generateMutation = useGenerateLinkedInCopy();
  const regenerateMutation = useRegenerateLinkedInCopy();
  const statusMutation = useUpdatePlaybookStatus();
  const deleteMutation = useDeletePlaybookEntry();
  const batchMutation = useBatchGenerateLinkedInCopy();
  const { data: groupsData } = useContactGroups();
  const { data: contactsData } = useContacts();

  const [selectedEntry, setSelectedEntry] = useState<PlaybookEntry | null>(null);
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [researchNotes, setResearchNotes] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [batchResult, setBatchResult] = useState<BatchGenerateResult | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const groups = groupsData ?? [];
  const contacts = contactsData?.data ?? [];

  const stats = {
    total: entries.length,
    generated: entries.filter((e) => e.status === "generated").length,
    sent: entries.filter((e) => e.status === "sent").length,
  };

  async function handleGenerate() {
    if (!prompt.trim()) return;
    try {
      const result = await generateMutation.mutateAsync({ prompt, researchNotes: researchNotes || undefined });
      setSelectedEntry(result);
      setShowGeneratePanel(false);
      setPrompt("");
      setResearchNotes("");
    } catch (err) {
      console.error("Generate failed:", err instanceof Error ? err.message : err);
    }
  }

  async function handleBatchGenerate() {
    if (!prompt.trim()) return;
    if (selectedContacts.length === 0 && !selectedGroup) return;
    
    try {
      const result = await batchMutation.mutateAsync({
        contactIds: selectedContacts.length > 0 ? selectedContacts : undefined,
        groupId: selectedGroup || undefined,
        prompt,
        researchNotes: researchNotes || undefined,
      });
      setBatchResult(result);
      setShowBatchPanel(false);
      setPrompt("");
      setResearchNotes("");
      setSelectedContacts([]);
      setSelectedGroup("");
    } catch (err) {
      console.error("Batch generate failed:", err instanceof Error ? err.message : err);
    }
  }

  async function handleCopyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      console.error("Clipboard write failed");
    }
  }

  // Cleanup timeout on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex gap-6 h-full">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[#e4e1e9]">LinkedIn Playbook</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBatchPanel(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2a292f] px-4 py-2 text-sm font-medium text-[#c7c4d8] hover:bg-[#35343a] transition-colors ring-1 ring-[#464555]/30"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Batch Generate
            </button>
            <button
              onClick={() => setShowGeneratePanel(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#c4c0ff] to-[#8781ff] px-4 py-2 text-sm font-medium text-[#100069] hover:opacity-90 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Generate Copy
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl bg-[#1f1f25] p-4">
            <p className="text-xs font-medium text-[#c7c4d8] mb-1">Total (Current page)</p>
            <p className="text-2xl font-bold text-[#41eec2]">{stats.total}</p>
          </div>
          <div className="rounded-xl bg-[#1f1f25] p-4">
            <p className="text-xs font-medium text-[#c7c4d8] mb-1">Copy Generated (Current page)</p>
            <p className="text-2xl font-bold text-[#c4c0ff]">{stats.generated}</p>
          </div>
          <div className="rounded-xl bg-[#1f1f25] p-4">
            <p className="text-xs font-medium text-[#c7c4d8] mb-1">Sent (Current page)</p>
            <p className="text-2xl font-bold text-[#ffb785]">{stats.sent}</p>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c4c0ff] border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-xl bg-[#93000a]/20 p-4 text-[#ffb4ab]">
            Failed to load playbook entries
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl bg-[#1f1f25] p-8 text-center text-[#c7c4d8]">
            <p className="text-lg mb-2">No LinkedIn copy generated yet</p>
            <p className="text-sm">Click &quot;Generate Copy&quot; to create your first outreach message</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className={`w-full text-left rounded-xl p-4 transition-colors ${
                  selectedEntry?.id === entry.id
                    ? "bg-[#2a292f] ring-1 ring-[#464555]/30"
                    : "bg-[#1f1f25] hover:bg-[#2a292f]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#e4e1e9] truncate font-mono">
                      {entry.generatedCopy?.slice(0, 80) ?? "No copy generated"}
                      {(entry.generatedCopy?.length ?? 0) > 80 ? "…" : ""}
                    </p>
                    <p className="text-xs text-[#918fa1] mt-1">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`ml-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[entry.status] ?? statusColors.draft}`}>
                    {entry.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Panel — Detail, Generate, or Batch */}
      <div className="w-[400px] shrink-0">
        {showBatchPanel ? (
          <div className="rounded-xl bg-[#1f1f25] p-5 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <h2 className="text-lg font-semibold text-[#e4e1e9] mb-4">Batch Generate LinkedIn Copy</h2>

            {/* Target Selection */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#c7c4d8] mb-1.5">
                Target Group (optional)
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => { setSelectedGroup(e.target.value); setSelectedContacts([]); }}
                className="w-full rounded-lg bg-[#2a292f] px-3 py-2 text-sm text-[#e4e1e9] focus:outline-none focus:ring-2 focus:ring-[#c4c0ff]"
              >
                <option value="">— Select a group —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Contact Selection */}
            {!selectedGroup && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#c7c4d8] mb-1.5">
                  Or Select Contacts ({selectedContacts.length} selected)
                  {contacts.length > 50 && (
                    <span className="ml-2 text-[#918fa1]">— Showing 50 of {contacts.length} contacts</span>
                  )}
                </label>
                <div className="max-h-[150px] overflow-y-auto rounded-lg bg-[#2a292f] p-2 space-y-1">
                  {contacts.slice(0, 50).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-2 py-1 hover:bg-[#35343a] rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedContacts([...selectedContacts, c.id]);
                          } else {
                            setSelectedContacts(selectedContacts.filter(id => id !== c.id));
                          }
                        }}
                        className="rounded border-[#464555] bg-[#1f1f25] text-[#c4c0ff]"
                      />
                      <span className="text-sm text-[#e4e1e9] truncate">{c.firstName} {c.lastName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <label className="block text-xs font-medium text-[#c7c4d8] mb-1.5" htmlFor="batch-prompt">
              Prompt Instructions
            </label>
            <textarea
              id="batch-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Generate personalized LinkedIn connection requests..."
              className="w-full rounded-lg bg-[#2a292f] px-3 py-2 text-sm text-[#e4e1e9] placeholder:text-[#918fa1] focus:outline-none focus:ring-2 focus:ring-[#c4c0ff] mb-3 min-h-[80px] resize-y"
            />

            <label className="block text-xs font-medium text-[#c7c4d8] mb-1.5" htmlFor="batch-notes">
              Research Notes (optional)
            </label>
            <textarea
              id="batch-notes"
              value={researchNotes}
              onChange={(e) => setResearchNotes(e.target.value)}
              placeholder="Applied to AI companies, mention their recent funding..."
              className="w-full rounded-lg bg-[#2a292f] px-3 py-2 text-sm text-[#e4e1e9] placeholder:text-[#918fa1] focus:outline-none focus:ring-2 focus:ring-[#c4c0ff] mb-4 min-h-[60px] resize-y"
            />

            <div className="flex gap-2">
              <button
                onClick={handleBatchGenerate}
                disabled={batchMutation.isPending || !prompt.trim() || (selectedContacts.length === 0 && !selectedGroup)}
                className="flex-1 rounded-lg bg-gradient-to-r from-[#c4c0ff] to-[#8781ff] px-4 py-2 text-sm font-medium text-[#100069] hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {batchMutation.isPending ? `Generating ${selectedContacts.length || 1}…` : `Generate ${selectedContacts.length || (selectedGroup ? "Group" : "0")}`}
              </button>
              <button
                onClick={() => setShowBatchPanel(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[#c7c4d8] hover:bg-[#2a292f] transition-colors"
              >
                Cancel
              </button>
            </div>

            {batchResult && (
              <div className="mt-4 p-3 rounded-lg bg-[#35343a] border border-[#464555]/30">
                <p className="text-sm font-medium text-[#41eec2] mb-1">
                  ✓ Batch Complete: {batchResult.successCount} of {batchResult.total} generated
                </p>
                {batchResult.errorCount > 0 && (
                  <p className="text-xs text-[#ffb4ab]">
                    {batchResult.errorCount} failed
                  </p>
                )}
                {batchResult.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-[#c7c4d8] cursor-pointer">
                      View failed contacts
                    </summary>
                    <ul className="mt-1 text-xs text-[#918fa1] max-h-[100px] overflow-y-auto">
                      {batchResult.errors.map((err: { contactId?: string; error: string }) => (
                        <li key={err.contactId || err.error}>
                          {err.contactId ? `${err.contactId}: ` : ""}{err.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {batchMutation.isError && (
              <p className="mt-3 text-sm text-[#ffb4ab]">
                {batchMutation.error.message}
              </p>
            )}
          </div>
        ) : showGeneratePanel ? (
          <div className="rounded-xl bg-[#1f1f25] p-5 sticky top-4">
            <h2 className="text-lg font-semibold text-[#e4e1e9] mb-4">Generate LinkedIn Copy</h2>

            <label className="block text-xs font-medium text-[#c7c4d8] mb-1.5" htmlFor="li-prompt">
              Prompt Instructions
            </label>
            <textarea
              id="li-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Keep it concise, mention their recent funding..."
              className="w-full rounded-lg bg-[#2a292f] px-3 py-2 text-sm text-[#e4e1e9] placeholder:text-[#918fa1] focus:outline-none focus:ring-2 focus:ring-[#c4c0ff] mb-3 min-h-[80px] resize-y"
              aria-label="Prompt instructions for LinkedIn copy generation"
            />

            <label className="block text-xs font-medium text-[#c7c4d8] mb-1.5" htmlFor="li-notes">
              Research Notes (optional)
            </label>
            <textarea
              id="li-notes"
              value={researchNotes}
              onChange={(e) => setResearchNotes(e.target.value)}
              placeholder="They just launched a new AI feature..."
              className="w-full rounded-lg bg-[#2a292f] px-3 py-2 text-sm text-[#e4e1e9] placeholder:text-[#918fa1] focus:outline-none focus:ring-2 focus:ring-[#c4c0ff] mb-4 min-h-[60px] resize-y"
              aria-label="Research notes about the contact"
            />

            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !prompt.trim()}
                className="flex-1 rounded-lg bg-gradient-to-r from-[#c4c0ff] to-[#8781ff] px-4 py-2 text-sm font-medium text-[#100069] hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {generateMutation.isPending ? "Generating…" : "Generate"}
              </button>
              <button
                onClick={() => setShowGeneratePanel(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[#c7c4d8] hover:bg-[#2a292f] transition-colors"
              >
                Cancel
              </button>
            </div>

            {generateMutation.isError && (
              <p className="mt-3 text-sm text-[#ffb4ab]">
                {generateMutation.error.message}
              </p>
            )}
          </div>
        ) : selectedEntry ? (
          <div className="rounded-xl bg-[#1f1f25] p-5 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#e4e1e9]">Copy Preview</h2>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[selectedEntry.status] ?? statusColors.draft}`}>
                {selectedEntry.status}
              </span>
            </div>

            {/* AI Preview Card — glassmorphism */}
            <div className="relative rounded-xl border-l-2 border-[#41eec2] bg-[#35343a]/40 backdrop-blur-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2 w-2 rounded-full bg-[#41eec2] animate-pulse" />
                <span className="text-xs font-mono text-[#41eec2]">AI Generated</span>
              </div>
              <p className="text-sm text-[#e4e1e9] font-mono leading-relaxed whitespace-pre-wrap">
                {selectedEntry.generatedCopy ?? "No copy generated"}
              </p>
            </div>

            {selectedEntry.prompt && (
              <div className="mb-4">
                <p className="text-xs font-medium text-[#c7c4d8] mb-1">Prompt Used</p>
                <p className="text-sm text-[#918fa1]">{selectedEntry.prompt}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleCopyToClipboard(selectedEntry.generatedCopy ?? "")}
                disabled={!selectedEntry.generatedCopy}
                className="rounded-lg bg-gradient-to-r from-[#c4c0ff] to-[#8781ff] px-3 py-1.5 text-xs font-medium text-[#100069] hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {copySuccess ? "Copied!" : "Copy to Clipboard"}
              </button>
              <button
                onClick={async () => {
                  try {
                    const result = await regenerateMutation.mutateAsync(selectedEntry.id);
                    setSelectedEntry(result);
                  } catch (err) {
                    console.error("Regenerate failed:", err instanceof Error ? err.message : err);
                  }
                }}
                disabled={regenerateMutation.isPending}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#c7c4d8] hover:bg-[#2a292f] transition-colors ring-1 ring-[#464555]/30"
              >
                {regenerateMutation.isPending ? "Regenerating…" : "Regenerate"}
              </button>
              {selectedEntry.status !== "sent" && (
                <button
                  onClick={async () => {
                    try {
                      const result = await statusMutation.mutateAsync({ id: selectedEntry.id, status: "sent" });
                      setSelectedEntry(result);
                    } catch (err) {
                      console.error("Status update failed:", err instanceof Error ? err.message : err);
                    }
                  }}
                  disabled={statusMutation.isPending}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#41eec2] hover:bg-[#41eec2]/10 transition-colors ring-1 ring-[#41eec2]/20"
                >
                  Mark as Sent
                </button>
              )}
              <button
                onClick={async () => {
                  try {
                    await deleteMutation.mutateAsync(selectedEntry.id);
                    setSelectedEntry(null);
                  } catch (err) {
                    console.error("Delete failed:", err instanceof Error ? err.message : err);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#ffb4ab] hover:bg-[#ffb4ab]/10 transition-colors"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-[#1f1f25] p-5 flex items-center justify-center min-h-[200px]">
            <p className="text-sm text-[#918fa1]">Select an entry to preview</p>
          </div>
        )}
      </div>
    </div>
  );
}
