"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import DOMPurify from "dompurify";
import { useTemplate, useUpdateTemplate, useRewriteEmail, useGenerateSubjects, useDuplicateTemplate } from "@/lib/hooks/use-templates";

const BUILT_IN_TOKENS = [
  "FirstName", "LastName", "CompanyName", "BusinessWebsite", "City", "State", "Email",
];

const SAMPLE_CONTACT = {
  FirstName: "Jane",
  LastName: "Smith",
  CompanyName: "Acme Corp",
  BusinessWebsite: "acme.com",
  City: "San Francisco",
  State: "CA",
  Email: "jane@acme.com",
};

interface VersionEntry {
  bodyHtml: string;
  instruction: string;
  timestamp: Date;
}

export default function TemplateEditorPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const { data: template, isLoading, isError, error } = useTemplate(templateId);
  const updateMutation = useUpdateTemplate();
  const rewriteMutation = useRewriteEmail();
  const subjectsMutation = useGenerateSubjects();
  const duplicateMutation = useDuplicateTemplate();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [saved, setSaved] = useState(false);
  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);
  const [tokenFallbacks, setTokenFallbacks] = useState<Record<string, string>>({});
  const [showFallbacks, setShowFallbacks] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteFilter, setAutocompleteFilter] = useState("");
  const [autocompletePos, setAutocompletePos] = useState({ top: 0, left: 0 });
  const [previewWithSample, setPreviewWithSample] = useState(false);
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([]);
  const [pendingRewrite, setPendingRewrite] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  // Initialize form from template data (only once)
  useEffect(() => {
    if (template && !initializedRef.current) {
      initializedRef.current = true;
      setName(template.name);
      setSubject(template.subject ?? "");
      setBodyHtml(template.bodyHtml ?? "");
      setTokenFallbacks((template.tokenFallbacks as Record<string, string>) ?? {});
    }
  }, [template]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await updateMutation.mutateAsync({
        id: templateId,
        name,
        subject,
        bodyHtml,
        tokenFallbacks,
      });
      setSaved(true);
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
    } catch {
      // Error is handled via updateMutation.isError state
    }
  }, [templateId, name, subject, bodyHtml, tokenFallbacks, updateMutation]);

  async function handleAiRewrite() {
    if (!aiInstruction.trim() || !bodyHtml) return;
    const result = await rewriteMutation.mutateAsync({
      currentBody: bodyHtml,
      instruction: aiInstruction,
    });
    // Show pending rewrite for accept/reject instead of applying directly
    setPendingRewrite(result.text);
  }

  function acceptRewrite() {
    if (!pendingRewrite) return;
    // Save current version to history before applying
    setVersionHistory((prev) => [
      { bodyHtml, instruction: aiInstruction, timestamp: new Date() },
      ...prev.slice(0, 19),
    ]);
    setBodyHtml(pendingRewrite);
    setPendingRewrite(null);
    setAiInstruction("");
  }

  function rejectRewrite() {
    setPendingRewrite(null);
  }

  function rollbackToVersion(entry: VersionEntry) {
    setVersionHistory((prev) => [
      { bodyHtml, instruction: "rollback", timestamp: new Date() },
      ...prev.slice(0, 19),
    ]);
    setBodyHtml(entry.bodyHtml);
  }

  async function handleGenerateSubjects() {
    if (!bodyHtml) return;
    try {
      const result = await subjectsMutation.mutateAsync({
        emailBody: bodyHtml,
        tone: "professional",
        count: 3,
      });
      try {
        const parsed = JSON.parse(result.text);
        if (Array.isArray(parsed)) setSubjectSuggestions(parsed);
      } catch {
        const lines = result.text.split("\n").filter((l: string) => l.trim());
        setSubjectSuggestions(lines.map((l: string) => l.replace(/^[\d.\-*"]+\s*/, "").replace(/"/g, "")));
      }
    } catch {
      setSubjectSuggestions([]);
    }
  }

  function insertToken(token: string) {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      // If autocomplete was triggered by typing `{`, replace from the `{` position
      const insertText = `{${token}}`;
      if (showAutocomplete) {
        // Find the last `{` before cursor to replace partial token
        const beforeCursor = bodyHtml.slice(0, start);
        const bracePos = beforeCursor.lastIndexOf("{");
        if (bracePos >= 0) {
          const newBody = bodyHtml.slice(0, bracePos) + insertText + bodyHtml.slice(end);
          setBodyHtml(newBody);
          setShowAutocomplete(false);
          setAutocompleteFilter("");
          // Restore focus and cursor position after React re-render
          requestAnimationFrame(() => {
            textarea.focus();
            const newPos = bracePos + insertText.length;
            textarea.setSelectionRange(newPos, newPos);
          });
          return;
        }
      }
      const newBody = bodyHtml.slice(0, start) + insertText + bodyHtml.slice(end);
      setBodyHtml(newBody);
      setShowAutocomplete(false);
      setAutocompleteFilter("");
      requestAnimationFrame(() => {
        textarea.focus();
        const newPos = start + insertText.length;
        textarea.setSelectionRange(newPos, newPos);
      });
    } else {
      setBodyHtml((prev) => prev + `{${token}}`);
    }
  }

  function handleTextareaKeyUp(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const textarea = e.currentTarget;
    const pos = textarea.selectionStart;
    const text = textarea.value.slice(0, pos);
    // Check if we're inside an open `{` without a closing `}`
    const lastBrace = text.lastIndexOf("{");
    const lastClose = text.lastIndexOf("}");
    if (lastBrace > lastClose) {
      const partial = text.slice(lastBrace + 1).toLowerCase();
      setAutocompleteFilter(partial);
      setShowAutocomplete(true);
      // Estimate position for dropdown
      const linesBefore = text.split("\n");
      const lineNum = linesBefore.length - 1;
      const colNum = linesBefore[linesBefore.length - 1].length;
      setAutocompletePos({ top: (lineNum + 1) * 20 + 8, left: Math.min(colNum * 7.2, 300) });
    } else {
      setShowAutocomplete(false);
      setAutocompleteFilter("");
    }
  }

  function renderPreviewHtml(html: string): string {
    if (!previewWithSample) return html;
    return html.replace(/\{(\w+)\}/g, (match, token) => {
      const value = SAMPLE_CONTACT[token as keyof typeof SAMPLE_CONTACT];
      if (value) return value;
      if (tokenFallbacks[token]) return tokenFallbacks[token];
      return match;
    });
  }

  const filteredTokens = BUILT_IN_TOKENS.filter((t) =>
    t.toLowerCase().startsWith(autocompleteFilter)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-error mb-2">Failed to load template</p>
        <p className="text-xs text-on-surface-variant mb-4">
          {error?.message || "Please try again later"}
        </p>
        <button
          onClick={() => router.back()}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-on-primary hover:bg-primary/90 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-80px)] gap-0">
      {/* Main Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
            >
              &larr;
            </button>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-semibold bg-transparent border-none outline-none text-on-surface"
            />
            <span className="text-xs text-on-surface-variant">v{template?.version ?? 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAiPanel(!showAiPanel)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                showAiPanel
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface hover:bg-surface-container-high"
              }`}
            >
              AI Workshop
            </button>
            <button
              onClick={async () => {
                setDuplicateError(null);
                try {
                  const variantName = `${name} (Variant B)`;
                  const result = await duplicateMutation.mutateAsync({ id: templateId, name: variantName });
                  if (result?.id) {
                    router.push(`/templates/${result.id}/edit`);
                  } else {
                    setDuplicateError("Failed to create variant. Please try again.");
                  }
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Failed to create variant";
                  setDuplicateError(message);
                }
              }}
              disabled={duplicateMutation.isPending}
              className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              {duplicateMutation.isPending ? "Creating..." : "Save as Variant"}
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saved ? "Saved!" : updateMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
          {duplicateError && (
            <div className="rounded-lg bg-error/10 p-2 text-xs text-error mt-2">
              {duplicateError}
            </div>
          )}
        </div>

        {/* Subject line */}
        <div className="border-b border-outline-variant px-4 py-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-on-surface-variant shrink-0">Subject:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject line..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-on-surface placeholder:text-on-surface-variant"
            />
            <button
              onClick={handleGenerateSubjects}
              disabled={subjectsMutation.isPending || !bodyHtml}
              className="text-[10px] text-primary hover:underline disabled:opacity-50"
            >
              {subjectsMutation.isPending ? "..." : "Suggest"}
            </button>
          </div>
          {subjectSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {subjectSuggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSubject(s);
                    setSubjectSuggestions([]);
                  }}
                  className="rounded bg-primary/10 px-2 py-1 text-[10px] text-primary hover:bg-primary/20 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {subjectsMutation.isError && (
            <div className="rounded-lg bg-error/10 p-2 text-xs text-error mt-2">
              Failed to suggest. Check your Gemini API key.
            </div>
          )}
        </div>

        {/* Token picker */}
        <div className="border-b border-outline-variant px-4 py-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[10px] text-on-surface-variant shrink-0 mr-1">Tokens:</span>
            {BUILT_IN_TOKENS.map((token) => (
              <button
                key={token}
                onClick={() => insertToken(token)}
                className="shrink-0 rounded bg-surface-container px-2 py-0.5 text-[10px] font-medium text-on-surface hover:bg-surface-container-high transition-colors"
              >
                {`{${token}}`}
              </button>
            ))}
            <span className="flex-1" />
            <button
              onClick={() => setShowFallbacks(!showFallbacks)}
              className="shrink-0 text-[10px] text-primary hover:underline"
            >
              {showFallbacks ? "Hide Fallbacks" : "Fallbacks"}
            </button>
          </div>
          {showFallbacks && (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {BUILT_IN_TOKENS.map((token) => (
                <div key={token} className="flex items-center gap-1">
                  <label className="text-[10px] text-on-surface-variant w-24 shrink-0">{`{${token}}`}</label>
                  <input
                    type="text"
                    value={tokenFallbacks[token] ?? ""}
                    onChange={(e) => setTokenFallbacks((prev) => ({ ...prev, [token]: e.target.value }))}
                    placeholder="fallback value"
                    className="flex-1 rounded border border-outline-variant bg-surface px-2 py-0.5 text-[10px] text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor area */}
        <div className="flex-1 overflow-auto p-4 relative">
          <textarea
            ref={textareaRef}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            onKeyUp={handleTextareaKeyUp}
            onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
            placeholder="Write your email body here... Use HTML for formatting. Type { to insert tokens like {FirstName}."
            className="w-full h-full min-h-[400px] rounded-lg border border-outline-variant bg-surface p-4 text-sm text-on-surface font-mono placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          {/* Token autocomplete dropdown */}
          {showAutocomplete && filteredTokens.length > 0 && (
            <div
              className="absolute z-10 rounded-lg border border-outline-variant bg-surface shadow-lg py-1 min-w-[160px]"
              style={{ top: autocompletePos.top + 32, left: autocompletePos.left + 16 }}
            >
              {filteredTokens.map((token) => (
                <button
                  key={token}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertToken(token);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-on-surface hover:bg-primary/10 transition-colors"
                >
                  <span className="font-mono text-primary">{`{${token}}`}</span>
                  <span className="ml-2 text-on-surface-variant">{SAMPLE_CONTACT[token as keyof typeof SAMPLE_CONTACT] ?? ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        {bodyHtml && (
          <div className="border-t border-outline-variant">
            <details className="px-4 py-2" open>
              <summary className="text-xs font-medium text-on-surface-variant cursor-pointer flex items-center gap-2">
                Preview
              </summary>
              <div className="flex items-center gap-2 mt-2 mb-2">
                <label className="flex items-center gap-1 text-[10px] text-on-surface-variant cursor-pointer">
                  <input
                    type="checkbox"
                    checked={previewWithSample}
                    onChange={(e) => setPreviewWithSample(e.target.checked)}
                    className="rounded border-outline-variant"
                  />
                  Show with sample data (Jane Smith, Acme Corp)
                </label>
              </div>
              <div className="rounded-xl border border-outline-variant bg-gradient-to-b from-slate-50 to-white shadow-lg overflow-hidden">
                {/* Email Header */}
                <div className="bg-slate-100 px-5 py-4 border-b border-slate-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                      {name?.charAt(0)?.toUpperCase() || "T"}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800">Your Company</div>
                      <div className="text-xs text-slate-500">to: {previewWithSample ? SAMPLE_CONTACT.Email : "{recipient}"}</div>
                    </div>
                    <div className="text-xs text-slate-400">Just now</div>
                  </div>
                  <div className="text-base font-semibold text-slate-900">
                    {renderPreviewHtml(subject || "No subject")}
                  </div>
                </div>
                {/* Email Body */}
                <div
                  className="px-5 py-5 text-sm text-slate-700 leading-relaxed max-h-64 overflow-auto prose prose-sm prose-slate max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderPreviewHtml(bodyHtml)) }}
                />
                {/* Email Footer */}
                <div className="bg-slate-50 px-5 py-3 border-t border-slate-200">
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <button className="hover:text-primary transition-colors">Reply</button>
                    <button className="hover:text-primary transition-colors">Forward</button>
                    <span className="flex-1" />
                    <span>Sent via OutreachOS</span>
                  </div>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>

      {/* AI Workshop Panel */}
      {showAiPanel && (
        <div className="w-80 border-l border-outline-variant bg-surface-container-low flex flex-col">
          <div className="px-4 py-3 border-b border-outline-variant">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-on-surface">AI Workshop</h3>
              <button
                onClick={() => setShowAiPanel(false)}
                aria-label="Close"
                className="text-on-surface-variant hover:text-on-surface text-lg"
              >
                &times;
              </button>
            </div>
            <p className="text-[10px] text-on-surface-variant mt-0.5">
              Describe changes and AI will rewrite your email
            </p>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3">
            <textarea
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              placeholder="e.g., Make it more conversational and add a PS line..."
              rows={4}
              className="w-full rounded-lg border border-outline-variant bg-surface p-3 text-xs text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <button
              onClick={handleAiRewrite}
              disabled={!aiInstruction.trim() || !bodyHtml || rewriteMutation.isPending}
              className="w-full rounded-lg bg-primary px-4 py-2 text-xs font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {rewriteMutation.isPending ? "Rewriting..." : "Generate Rewrite"}
            </button>

            {rewriteMutation.isError && (
              <div className="rounded-lg bg-error/10 p-2 text-xs text-error">
                Failed to generate. Check your Gemini API key.
              </div>
            )}

            {/* Pending rewrite: accept / reject */}
            {pendingRewrite && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="text-[10px] font-medium text-primary">AI Suggestion</div>
                <div
                  className="text-xs text-on-surface leading-relaxed max-h-40 overflow-auto prose prose-xs max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(pendingRewrite) }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={acceptRewrite}
                    className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary/90 transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={rejectRewrite}
                    className="flex-1 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Version history */}
            {versionHistory.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-on-surface-variant">Version History</div>
                {versionHistory.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-outline-variant p-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-on-surface truncate">
                        {entry.instruction || "Manual edit"}
                      </div>
                      <div className="text-[9px] text-on-surface-variant">
                        {entry.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    <button
                      onClick={() => rollbackToVersion(entry)}
                      className="shrink-0 text-[10px] text-primary hover:underline"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-outline-variant">
            <div className="text-[10px] text-on-surface-variant">
              Powered by Gemini 2.5 Flash
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
