"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { UploadIcon, CheckCircleIcon, FileIcon, ZapIcon, AiIcon, ArrowRightIcon, ArrowLeftIcon } from "@/components/icons";

const REQUIRED_COLUMNS = ["First Name", "Last Name", "Business Website", "Company Name"];
const ACCEPTED_TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];
const ACCEPTED_EXTENSIONS = ".csv,.xlsx,.xls";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// Valid field mappings for the dropdown
const FIELD_OPTIONS = [
  { value: "", label: "— Skip Column —" },
  { value: "firstName", label: "First Name *" },
  { value: "lastName", label: "Last Name *" },
  { value: "businessWebsite", label: "Business Website *" },
  { value: "companyName", label: "Company Name *" },
  { value: "email", label: "Email" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "linkedinUrl", label: "LinkedIn URL" },
];

interface PreviewData {
  headers: string[];
  autoMapping: Record<string, string>;
  unmapped: string[];
  suggestions: Record<string, { field: string; confidence: number }[]>;
  sampleRows: Record<string, string>[];
  totalRows: number;
  requiredFields: string[];
  missingRequired: string[];
}

function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / 1024).toFixed(1)} KB`;
}

export default function UploadContactsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [userMapping, setUserMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ count: number; errors: string[] } | null>(null);

  const validateFile = useCallback((f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.match(/\.(csv|xlsx|xls)$/i)) {
      return "Invalid file type. Please upload a .csv, .xlsx, or .xls file.";
    }
    if (f.size > MAX_FILE_SIZE) {
      return "File exceeds 25MB limit.";
    }
    return null;
  }, []);

  const handleFile = useCallback(
    async (f: File) => {
      const err = validateFile(f);
      if (err) {
        setError(err);
        setFile(null);
        return;
      }
      setError(null);
      setFile(f);
      setResult(null);
      
      // Auto-generate preview
      setPreviewLoading(true);
      try {
        const formData = new FormData();
        formData.append("file", f);
        const res = await fetch("/api/contacts/upload/preview", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to preview file.");
          return;
        }
        setPreview(data.preview);
        setUserMapping(data.preview.autoMapping);
        setStep(2);
      } catch {
        setError("Failed to preview file. Please check your connection and try again.");
      } finally {
        setPreviewLoading(false);
      }
    },
    [validateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setDragActive(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setDragActive(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setDragActive(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) handleFile(selected);
    },
    [handleFile]
  );

  const handleMappingChange = useCallback((header: string, field: string) => {
    setUserMapping((prev) => ({ ...prev, [header]: field }));
  }, []);

  const getMissingRequiredFields = useCallback(() => {
    if (!preview) return [];
    const mappedFields = new Set(Object.values(userMapping).filter(Boolean));
    return preview.requiredFields.filter((f) => !mappedFields.has(f));
  }, [preview, userMapping]);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(userMapping));
      const res = await fetch("/api/contacts/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed. Please try again.");
        return;
      }
      setResult({ count: data.count, errors: data.errors || [] });
      setStep(3);
    } catch {
      setError("Upload failed. Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  const missingRequired = getMissingRequiredFields();
  const canProceed = missingRequired.length === 0;

  // Step 1: Upload
  if (step === 1) {
    return (
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-primary mb-2">
            Step 1 of 3 — Upload
          </p>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">
            Upload Contacts
          </h1>
          <p className="text-sm text-on-surface-variant">
            Feed the intelligence engine with fresh lead data
          </p>
        </div>

      {/* Upload result banner */}
      {result && (
        <Card className="mb-6 border border-secondary/20">
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary/15 flex items-center justify-center">
                <CheckCircleIcon width={20} height={20} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-on-surface">
                  {result.count} contacts uploaded successfully!
                </p>
                {result.errors.length > 0 && (
                  <p className="text-xs text-on-surface-variant mt-1">
                    {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} had errors and were skipped.
                  </p>
                )}
              </div>
              <Button size="sm" onClick={() => router.push("/contacts/enrich")}>
                Enrich Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drag & Drop Zone */}
      <Card className="mb-6">
        <CardContent>
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload file drop zone. Click or drag a file here."
            onDrop={previewLoading ? undefined : handleDrop}
            onDragEnter={previewLoading ? undefined : handleDragEnter}
            onDragLeave={previewLoading ? undefined : handleDragLeave}
            onDragOver={(e) => !previewLoading && e.preventDefault()}
            onClick={() => !previewLoading && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (!previewLoading && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`relative flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-[var(--radius-card)] cursor-pointer transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container-low"
            } ${previewLoading ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={previewLoading ? undefined : handleInputChange}
              disabled={previewLoading}
              className="sr-only"
              aria-hidden="true"
            />
            {previewLoading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-on-surface font-medium">Processing file...</p>
                <p className="text-xs text-on-surface-variant">Analyzing columns and generating preview</p>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-surface-container-highest flex items-center justify-center">
                  <UploadIcon width={24} height={24} />
                </div>
                {file ? (
                  <div className="text-center">
                    <p className="text-on-surface font-medium">{file.name}</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {formatFileSize(file.size)} — Click to change
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-on-surface font-medium">
                      Drag &amp; drop your file here
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Supports .csv, .xlsx, .xls — max 25MB
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {error && (
            <div role="alert" className="mt-4 px-4 py-3 bg-error-container/20 border border-error/20 rounded-[var(--radius-input)] text-sm text-error">
              {error}
            </div>
          )}

          {file && !result && (
            <div className="mt-4 flex justify-end">
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? "Uploading..." : "Upload & Parse"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Required Columns */}
      <Card className="mb-6">
        <CardContent>
          <h2 className="text-sm font-mono uppercase tracking-wider text-on-surface-variant mb-4">
            Required Columns
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {REQUIRED_COLUMNS.map((col) => (
              <div
                key={col}
                className="flex items-center gap-2 px-3 py-2 bg-surface-container-low rounded-[var(--radius-input)]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-secondary shrink-0">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
                </svg>
                <span className="text-sm text-on-surface">{col}</span>
                <Badge variant="success" className="ml-auto text-[10px]">Required</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Optional Features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <CardContent>
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <FileIcon width={20} height={20} />
            </div>
            <h3 className="text-sm font-semibold text-on-surface mb-1">CSV Template</h3>
            <p className="text-xs text-on-surface-variant">
              Optimized for rapid ingestion with all necessary mapping.
            </p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent>
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-tertiary/10 flex items-center justify-center">
              <ZapIcon width={20} height={20} />
            </div>
            <h3 className="text-sm font-semibold text-on-surface mb-1">Zapier Connection</h3>
            <p className="text-xs text-on-surface-variant">
              Automate lead flow directly from your forms or CRM.
            </p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent>
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-secondary/10 flex items-center justify-center">
              <AiIcon width={20} height={20} />
            </div>
            <h3 className="text-sm font-semibold text-on-surface mb-1">AI Auto-Mapping</h3>
            <p className="text-xs text-on-surface-variant">
              Engine will automatically detect your column headers.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

  // Step 2: Map Columns
  if (step === 2 && preview) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-mono uppercase tracking-widest text-primary mb-2">Step 2 of 3 — Map Columns</p>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Map Your Columns</h1>
          <p className="text-sm text-on-surface-variant">Review AI-detected mappings and adjust as needed</p>
        </div>

        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
                  <FileIcon width={20} height={20} />
                </div>
                <div>
                  <p className="font-medium text-on-surface">{file?.name}</p>
                  <p className="text-xs text-on-surface-variant">{preview.totalRows.toLocaleString()} rows • {preview.headers.length} columns</p>
                </div>
              </div>
              {missingRequired.length > 0 ? (
                <Badge variant="error">{missingRequired.length} required missing</Badge>
              ) : (
                <Badge variant="success">All fields mapped</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {missingRequired.length > 0 && (
          <div className="mb-4 p-4 rounded-xl bg-error-container/20 border border-error/20">
            <p className="text-sm text-error font-medium">Missing: {missingRequired.map(f => FIELD_OPTIONS.find(o => o.value === f)?.label || f).join(", ")}</p>
          </div>
        )}

        <Card className="mb-6">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-outline-variant/20">
                    <th className="text-left px-4 py-3 text-xs font-mono uppercase text-on-surface-variant">CSV Column</th>
                    <th className="text-left px-4 py-3 text-xs font-mono uppercase text-on-surface-variant">Maps To</th>
                    <th className="text-left px-4 py-3 text-xs font-mono uppercase text-on-surface-variant">Sample</th>
                    <th className="text-center px-4 py-3 text-xs font-mono uppercase text-on-surface-variant">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.headers.map((header) => {
                    const currentMapping = userMapping[header] || "";
                    const isAutoMapped = preview.autoMapping[header] && preview.autoMapping[header] === currentMapping;
                    const hasSuggestion = preview.suggestions[header]?.length > 0 && !currentMapping;
                    const sampleValue = preview.sampleRows[0]?.[header] || "—";
                    return (
                      <tr key={header} className="border-b border-outline-variant/10 last:border-b-0">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-on-surface">{header}</span>
                          {hasSuggestion && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {preview.suggestions[header].slice(0, 2).map((sugg) => (
                                <button key={sugg.field} onClick={() => handleMappingChange(header, sugg.field)} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20">
                                  {FIELD_OPTIONS.find(o => o.value === sugg.field)?.label || sugg.field} ({sugg.confidence}%)
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select 
                            value={currentMapping} 
                            onChange={(e) => handleMappingChange(header, e.target.value)} 
                            aria-label={`Map column "${header}" to field`}
                            className="w-full px-3 py-2 bg-surface-container-highest text-on-surface text-sm rounded-[var(--radius-input)] border-none focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {FIELD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3"><span className="text-sm text-on-surface-variant truncate max-w-[150px] block">{sampleValue}</span></td>
                        <td className="px-4 py-3 text-center">
                          {isAutoMapped && <Badge variant="success" className="text-[10px]">AI</Badge>}
                          {currentMapping && !isAutoMapped && <Badge variant="default" className="text-[10px]">Manual</Badge>}
                          {!currentMapping && hasSuggestion && <Badge variant="warning" className="text-[10px]">Suggest</Badge>}
                          {!currentMapping && !hasSuggestion && <span className="text-xs text-on-surface-variant">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {error && <div role="alert" className="mb-4 px-4 py-3 bg-error-container/20 border border-error/20 rounded-[var(--radius-input)] text-sm text-error">{error}</div>}

        <div className="flex justify-between">
          <Button variant="secondary" onClick={() => setStep(1)} disabled={uploading}>
            <ArrowLeftIcon width={16} height={16} /> Back
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !canProceed}>
            {uploading ? "Importing..." : "Confirm & Import"} {!uploading && <ArrowRightIcon width={16} height={16} />}
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: Success
  if (step === 3 && result) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="text-center py-12">
          <CardContent>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-secondary/15 flex items-center justify-center">
              <CheckCircleIcon width={32} height={32} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">Import Complete!</h1>
            <p className="text-on-surface-variant mb-6">Successfully imported <span className="font-semibold text-on-surface">{result.count}</span> contact{result.count === 1 ? "" : "s"}</p>
            {result.errors.length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-warning-container/20 border border-warning/20 text-left">
                <p className="text-sm text-warning font-medium">{result.errors.length} row{result.errors.length !== 1 ? "s" : ""} skipped</p>
              </div>
            )}
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={() => router.push("/contacts")}>View Contacts</Button>
              <Button onClick={() => router.push("/contacts/enrich")}>Enrich Contacts</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
