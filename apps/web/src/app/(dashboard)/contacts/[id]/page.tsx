"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Badge, Card, CardContent, CardHeader, CardTitle, Input, Modal } from "@/components/ui";
import { 
  useContact, 
  useContactAnalytics, 
  useReEnrichContact,
  useUpdateCustomField,
  useDeleteCustomField,
} from "@/lib/hooks/use-contacts";

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id;
  const contactId = Array.isArray(rawId) ? rawId[0] : rawId;

  // Custom field editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editFieldValue, setEditFieldValue] = useState<string>("");
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Re-enrichment mutation
  const reEnrich = useReEnrichContact();
  const updateField = useUpdateCustomField();
  const deleteField = useDeleteCustomField();

  // All hooks must be called before any early return. When contactId is missing
  // we pass an empty string; the hooks treat that as a disabled query.
  const safeContactId = contactId ?? "";
  const { data: contact, isLoading: loading } = useContact(safeContactId);
  const { data: analytics } = useContactAnalytics(safeContactId);
  
  // Use real analytics data or fallback to empty
  const stats = {
    emailsSent: analytics?.emailsSent ?? 0,
    totalOpens: analytics?.totalOpens ?? 0,
    replies: analytics?.replies ?? 0,
    unsubscribes: analytics?.unsubscribes ?? 0,
    softBounces: analytics?.softBounces ?? 0,
    hardBounces: analytics?.hardBounces ?? 0,
  };
  const hourlyOpens = analytics?.hourlyOpens ?? Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
  const dailyOpens = analytics?.dailyOpens ?? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => ({ day: d, count: 0 }));

  // Handlers for custom fields
  const handleStartEdit = useCallback((key: string, value: unknown) => {
    setEditingField(key);
    setEditFieldValue(String(value));
    setFieldError(null);
  }, []);

  const handleSaveField = useCallback((key: string) => {
    updateField.mutate(
      { contactId: safeContactId, fieldName: key, fieldValue: editFieldValue },
      {
        onSuccess: () => {
          setEditingField(null);
          setFieldError(null);
        },
        onError: (err) => setFieldError(err.message),
      }
    );
  }, [safeContactId, editFieldValue, updateField]);

  const handleDeleteField = useCallback((key: string) => {
    deleteField.mutate(
      { contactId: safeContactId, fieldName: key },
      {
        onError: (err) => setFieldError(err.message),
      }
    );
  }, [safeContactId, deleteField]);

  const handleAddField = useCallback(() => {
    if (!newFieldName.trim()) return;
    updateField.mutate(
      { contactId: safeContactId, fieldName: newFieldName.trim(), fieldValue: newFieldValue },
      {
        onSuccess: () => {
          setShowAddFieldModal(false);
          setNewFieldName("");
          setNewFieldValue("");
          setFieldError(null);
        },
        onError: (err) => setFieldError(err.message),
      }
    );
  }, [safeContactId, newFieldName, newFieldValue, updateField]);

  const handleReEnrich = useCallback(() => {
    reEnrich.mutate(safeContactId);
  }, [safeContactId, reEnrich]);

  if (!contactId) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/contacts"
            className="text-sm text-on-surface-variant hover:text-primary transition-colors"
          >
            ← Back to Contacts
          </Link>
        </div>
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-surface-container-highest flex items-center justify-center">
                <ContactIcon />
              </div>
              <h2 className="text-lg font-semibold text-on-surface mb-1">
                Invalid contact ID
              </h2>
              <p className="text-sm text-on-surface-variant mb-6">
                No contact ID provided.
              </p>
              <Button onClick={() => router.push("/contacts")}>
                Back to Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/contacts"
            className="text-sm text-on-surface-variant hover:text-primary transition-colors"
          >
            ← Back to Contacts
          </Link>
        </div>
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-surface-container-highest flex items-center justify-center">
                <ContactIcon />
              </div>
              <h2 className="text-lg font-semibold text-on-surface mb-1">
                Contact not found
              </h2>
              <p className="text-sm text-on-surface-variant mb-6">
                Contact <code className="font-mono text-xs bg-surface-container-highest px-1.5 py-0.5 rounded">{contactId}</code> does not exist or has been deleted.
              </p>
              <Button onClick={() => router.push("/contacts")}>
                Back to Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fullName = `${contact.firstName} ${contact.lastName}`;
  const initials = `${contact.firstName?.[0] ?? ""}${contact.lastName?.[0] ?? ""}`.toUpperCase();
  const maxHourly = Math.max(...hourlyOpens.map((h) => h.count), 1);
  const maxDaily = Math.max(...dailyOpens.map((d) => d.count), 1);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/contacts"
          className="text-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          ← Back to Contacts
        </Link>
      </div>

      {/* Contact Header */}
      <div className="flex items-start gap-6 mb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-on-primary-fixed text-xl font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
          {contact.companyName && (
            <p className="text-on-surface-variant mt-0.5">
              {contact.companyName}
            </p>
          )}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-fixed-dim transition-colors"
                aria-label={`Email ${fullName}`}
              >
                <MailIcon />
                {contact.email}
              </a>
            )}
            {contact.linkedinUrl && (
              <a
                href={contact.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-fixed-dim transition-colors"
                aria-label={`LinkedIn profile for ${fullName}`}
              >
                <LinkIcon />
                LinkedIn
              </a>
            )}
            {contact.businessWebsite && (
              <a
                href={contact.businessWebsite.startsWith("http") ? contact.businessWebsite : `https://${contact.businessWebsite}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-fixed-dim transition-colors"
                aria-label={`Website for ${fullName}`}
              >
                <LinkIcon />
                Website
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={() => router.push(`/contacts/${contactId}/edit`)}>
            Edit
          </Button>
          <Button size="sm" disabled={true} title="Email compose coming soon">Send Email</Button>
        </div>
      </div>

      {/* Hunter Intelligence */}
      {contact.enrichedAt && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-on-surface-variant">
              Hunter Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-on-surface-variant">Score:</span>
                {contact.hunterScore != null ? (
                  <Badge variant={contact.hunterScore >= 80 ? "success" : contact.hunterScore >= 50 ? "warning" : "error"}>
                    {contact.hunterScore}%
                  </Badge>
                ) : (
                  <Badge variant="secondary">—</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-on-surface-variant">Status:</span>
                <Badge variant={contact.hunterStatus === "valid" ? "success" : contact.hunterStatus === "accept_all" ? "warning" : "secondary"}>
                  {contact.hunterStatus || "Unknown"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-on-surface-variant">Enriched:</span>
                <span className="text-sm text-on-surface">
                  {new Date(contact.enrichedAt).toLocaleDateString()}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                disabled={reEnrich.isPending}
                onClick={handleReEnrich}
                title="Re-enrich this contact via Hunter.io"
              >
                {reEnrich.isPending ? "Enriching..." : "Re-enrich"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Emails Sent" value={stats.emailsSent} />
        <StatCard label="Total Opens" value={stats.totalOpens} />
        <StatCard label="Replies" value={stats.replies} accent />
        <StatCard label="Unsubscribes" value={stats.unsubscribes} error={stats.unsubscribes > 0} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Time of Day Histogram */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-on-surface-variant">
              Open Density: Time of Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-0.5 h-24">
              {hourlyOpens.map((slot) => (
                <div
                  key={slot.hour}
                  className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-colors"
                  style={{ height: `${(slot.count / maxHourly) * 100}%`, minHeight: "2px" }}
                  title={`${slot.hour}:00 — ${slot.count} opens`}
                  aria-label={`${slot.hour}:00 — ${slot.count} opens`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-on-surface-variant font-mono">
              <span>0h</span>
              <span>6h</span>
              <span>12h</span>
              <span>18h</span>
              <span>24h</span>
            </div>
          </CardContent>
        </Card>

        {/* Day of Week Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-on-surface-variant">
              Engagement Peaks: Weekly
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-24">
              {dailyOpens.map((slot) => (
                <div key={slot.day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-secondary/20 hover:bg-secondary/40 rounded-t transition-colors"
                    style={{ height: `${(slot.count / maxDaily) * 100}%`, minHeight: "2px" }}
                    title={`${slot.day} — ${slot.count} opens`}
                    aria-label={`${slot.day} — ${slot.count} opens`}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              {dailyOpens.map((slot) => (
                <span key={slot.day} className="flex-1 text-center text-[10px] text-on-surface-variant font-mono">
                  {slot.day}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card className="mb-6 glass border border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-primary">
            <AiIcon />
            Synthetic Intelligence Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-surface-container-low rounded-[var(--radius-card)]">
              <h4 className="text-xs font-mono uppercase tracking-wider text-on-surface-variant mb-2">
                Psychographic Profile
              </h4>
              <p className="text-sm text-on-surface leading-relaxed">
                No engagement data available yet. Insights will appear once emails are sent and opened.
              </p>
            </div>
            <div className="p-4 bg-surface-container-low rounded-[var(--radius-card)]">
              <h4 className="text-xs font-mono uppercase tracking-wider text-on-surface-variant mb-2">
                Optimal Outreach Window
              </h4>
              <p className="text-sm text-on-surface leading-relaxed">
                Insufficient data to determine optimal outreach window. Send at least 3 emails to enable analysis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Fields */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-mono uppercase tracking-wider text-on-surface-variant">
            Custom Fields
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowAddFieldModal(true);
              setNewFieldName("");
              setNewFieldValue("");
              setFieldError(null);
            }}
          >
            + Add Field
          </Button>
        </CardHeader>
        <CardContent>
          {fieldError && (
            <div className="mb-3 p-2 rounded bg-error-container text-on-error-container text-sm">
              {fieldError}
            </div>
          )}
          {contact.customFields && Object.keys(contact.customFields).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(contact.customFields).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 px-3 py-2 bg-surface-container-low rounded-[var(--radius-input)] group">
                  <span className="text-xs font-mono text-on-surface-variant shrink-0">{key}:</span>
                  {editingField === key ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editFieldValue}
                        onChange={(e) => setEditFieldValue(e.target.value)}
                        className="flex-1 h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveField(key);
                          if (e.key === "Escape") setEditingField(null);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSaveField(key)}
                        disabled={updateField.isPending}
                      >
                        {updateField.isPending ? "..." : "Save"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingField(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-on-surface truncate">{String(value)}</span>
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        <button
                          onClick={() => handleStartEdit(key, value)}
                          className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                          title="Edit field"
                        >
                          <EditIcon />
                        </button>
                        <button
                          onClick={() => handleDeleteField(key)}
                          className="p-1 rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                          title="Delete field"
                          disabled={deleteField.isPending}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">No custom fields yet. Click &quot;Add Field&quot; to create one.</p>
          )}
        </CardContent>
      </Card>

      {/* Add Custom Field Modal */}
      <Modal
        open={showAddFieldModal}
        onClose={() => setShowAddFieldModal(false)}
        title="Add Custom Field"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Field Name</label>
            <Input
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              placeholder="e.g., industry, notes, priority"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Value</label>
            <Input
              value={newFieldValue}
              onChange={(e) => setNewFieldValue(e.target.value)}
              placeholder="Enter value"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddField();
              }}
            />
          </div>
          {fieldError && (
            <div className="p-2 rounded bg-error-container text-on-error-container text-sm">
              {fieldError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowAddFieldModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddField} disabled={!newFieldName.trim() || updateField.isPending}>
              {updateField.isPending ? "Adding..." : "Add Field"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  accent,
  error,
}: {
  label: string;
  value: number;
  accent?: boolean;
  error?: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs font-mono uppercase tracking-wider text-on-surface-variant mb-1">
          {label}
        </p>
        <p
          className={`text-2xl font-semibold ${
            error ? "text-error" : accent ? "text-secondary" : "text-on-surface"
          }`}
        >
          {value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="currentColor" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" fill="currentColor" />
    </svg>
  );
}

function ContactIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-on-surface-variant">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-primary">
      <path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79s7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.5-9.11 0-12.58 3.51-3.47 9.14-3.49 12.65 0L21 3v7.12z" fill="currentColor" />
    </svg>
  );
}
