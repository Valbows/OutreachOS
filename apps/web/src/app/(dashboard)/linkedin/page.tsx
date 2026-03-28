"use client";

import { useState, useRef } from "react";
import {
  useLinkedInPlaybook,
  useGenerateLinkedInCopy,
  useRegenerateLinkedInCopy,
  useUpdatePlaybookStatus,
  useDeletePlaybookEntry,
  type PlaybookEntry,
} from "@/lib/hooks/use-linkedin";

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

  const [selectedEntry, setSelectedEntry] = useState<PlaybookEntry | null>(null);
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [researchNotes, setResearchNotes] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;

  const stats = {
    total: total,
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

  return (
    <div className="flex gap-6 h-full">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[#e4e1e9]">LinkedIn Playbook</h1>
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl bg-[#1f1f25] p-4">
            <p className="text-xs font-medium text-[#c7c4d8] mb-1">Total Entries</p>
            <p className="text-2xl font-bold text-[#41eec2]">{stats.total}</p>
          </div>
          <div className="rounded-xl bg-[#1f1f25] p-4">
            <p className="text-xs font-medium text-[#c7c4d8] mb-1">Copy Generated</p>
            <p className="text-2xl font-bold text-[#c4c0ff]">{stats.generated}</p>
          </div>
          <div className="rounded-xl bg-[#1f1f25] p-4">
            <p className="text-xs font-medium text-[#c7c4d8] mb-1">Sent</p>
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

      {/* Right Panel — Detail or Generate */}
      <div className="w-[400px] shrink-0">
        {showGeneratePanel ? (
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
