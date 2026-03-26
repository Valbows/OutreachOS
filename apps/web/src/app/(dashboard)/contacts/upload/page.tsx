"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { UploadIcon, CheckCircleIcon, FileIcon, ZapIcon, AiIcon } from "@/components/icons";

const REQUIRED_COLUMNS = ["First Name", "Last Name", "Business Website", "Company Name"];
const ACCEPTED_TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];
const ACCEPTED_EXTENSIONS = ".csv,.xlsx,.xls";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

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
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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
    (f: File) => {
      const err = validateFile(f);
      if (err) {
        setError(err);
        setFile(null);
        return;
      }
      setError(null);
      setFile(f);
      setResult(null);
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

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
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
    } catch {
      setError("Upload failed. Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-mono uppercase tracking-widest text-primary mb-2">
          Initialize Contact Ingestion
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
            onDrop={handleDrop}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`relative flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-[var(--radius-card)] cursor-pointer transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container-low"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleInputChange}
              className="sr-only"
              aria-hidden="true"
            />
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
