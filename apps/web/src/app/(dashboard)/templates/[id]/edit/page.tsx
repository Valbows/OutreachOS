"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import DOMPurify from "dompurify";
import { useTemplate, useUpdateTemplate, useRewriteEmail, useGenerateSubjects } from "@/lib/hooks/use-templates";

const BUILT_IN_TOKENS = [
  "FirstName", "LastName", "CompanyName", "BusinessWebsite", "City", "State", "Email",
];

export default function TemplateEditorPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const { data: template, isLoading, isError, error } = useTemplate(templateId);
  const updateMutation = useUpdateTemplate();
  const rewriteMutation = useRewriteEmail();
  const subjectsMutation = useGenerateSubjects();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [saved, setSaved] = useState(false);
  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);
  const initializedRef = useRef(false);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize form from template data (only once)
  useEffect(() => {
    if (template && !initializedRef.current) {
      initializedRef.current = true;
      setName(template.name);
      setSubject(template.subject ?? "");
      setBodyHtml(template.bodyHtml ?? "");
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
      });
      setSaved(true);
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
    } catch {
      // Error is handled via updateMutation.isError state
    }
  }, [templateId, name, subject, bodyHtml, updateMutation]);

  async function handleAiRewrite() {
    if (!aiInstruction.trim() || !bodyHtml) return;
    const result = await rewriteMutation.mutateAsync({
      currentBody: bodyHtml,
      instruction: aiInstruction,
    });
    setBodyHtml(result.text);
    setAiInstruction("");
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
    setBodyHtml((prev) => prev + `{${token}}`);
  }

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
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saved ? "Saved!" : updateMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
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
        <div className="border-b border-outline-variant px-4 py-2 flex items-center gap-1.5 overflow-x-auto">
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
        </div>

        {/* Editor area */}
        <div className="flex-1 overflow-auto p-4">
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            placeholder="Write your email body here... Use HTML for formatting. Insert tokens like {FirstName} for personalization."
            className="w-full h-full min-h-[400px] rounded-lg border border-outline-variant bg-surface p-4 text-sm text-on-surface font-mono placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        {/* Preview */}
        {bodyHtml && (
          <div className="border-t border-outline-variant">
            <details className="px-4 py-2" open>
              <summary className="text-xs font-medium text-on-surface-variant cursor-pointer flex items-center gap-2">
                <span>📧</span> Preview
              </summary>
              <div className="mt-3 rounded-xl border border-outline-variant bg-gradient-to-b from-slate-50 to-white shadow-lg overflow-hidden">
                {/* Email Header */}
                <div className="bg-slate-100 px-5 py-4 border-b border-slate-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                      {name?.charAt(0)?.toUpperCase() || "T"}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800">Your Company</div>
                      <div className="text-xs text-slate-500">to: {"{recipient}"}</div>
                    </div>
                    <div className="text-xs text-slate-400">Just now</div>
                  </div>
                  <div className="text-base font-semibold text-slate-900">
                    {subject || "No subject"}
                  </div>
                </div>
                {/* Email Body */}
                <div
                  className="px-5 py-5 text-sm text-slate-700 leading-relaxed max-h-64 overflow-auto prose prose-sm prose-slate max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bodyHtml) }}
                />
                {/* Email Footer */}
                <div className="bg-slate-50 px-5 py-3 border-t border-slate-200">
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <button className="hover:text-primary transition-colors">↩ Reply</button>
                    <button className="hover:text-primary transition-colors">↪ Forward</button>
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

          <div className="flex-1 p-4 space-y-3">
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
              {rewriteMutation.isPending ? "Rewriting..." : "Apply AI Rewrite"}
            </button>

            {rewriteMutation.isError && (
              <div className="rounded-lg bg-error/10 p-2 text-xs text-error">
                Failed to generate. Check your Gemini API key.
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
