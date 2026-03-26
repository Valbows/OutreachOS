"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Badge,
  Card,
  CardContent,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Modal,
} from "@/components/ui";
import { useContacts, useContactGroups, useDeleteContacts } from "@/lib/hooks/use-contacts";

type SortField = "name" | "company" | "email" | "score" | "createdAt";
type SortDir = "asc" | "desc";

export default function ContactsPage() {
  const router = useRouter();
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: contactsData, isLoading } = useContacts({
    search: debouncedSearch || undefined,
    groupId: selectedGroup !== "all" ? selectedGroup : undefined,
    sortBy: sortField,
    sortDir,
  });
  const { data: groups = [] } = useContactGroups();
  const deleteContacts = useDeleteContacts();

  const contacts = contactsData?.data ?? [];
  const totalCount = contactsData?.total ?? 0;

  // Sorting is handled server-side via the hook, but we still need local sort toggle
  const sorted = contacts;

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((c) => c.id)));
    }
  }, [selectedIds.size, sorted]);

  const handleDeleteClick = useCallback(() => {
    if (selectedIds.size === 0) return;
    setDeleteError(null);
    setShowDeleteModal(true);
  }, [selectedIds.size]);

  const handleConfirmDelete = useCallback(() => {
    deleteContacts.mutate([...selectedIds], {
      onSuccess: () => {
        setSelectedIds(new Set());
        setShowDeleteModal(false);
        setDeleteError(null);
      },
      onError: (error) => {
        setDeleteError(error.message || "Failed to delete contacts. Please try again.");
      },
      onSettled: () => {
        // Query invalidation happens in the hook, but we could add additional cleanup here
      },
    });
  }, [selectedIds, deleteContacts]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setDeleteError(null);
  }, []);

  const handleExport = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedGroup !== "all") params.set("group_id", selectedGroup);
    if (selectedIds.size > 0) params.set("ids", [...selectedIds].join(","));
    window.open(`/api/contacts/export?${params.toString()}`, "_blank");
  }, [selectedGroup, selectedIds]);

  function SortIndicator({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Contacts
            {totalCount > 0 && (
              <span className="text-on-surface-variant font-normal text-lg ml-2">
                ({totalCount.toLocaleString()} total)
              </span>
            )}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Intelligence Database Management
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => router.push("/contacts/upload")}>
            <UploadIcon />
            Upload
          </Button>
        </div>
      </div>

      {/* Filters bar */}
      <Card className="mb-4">
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-sm">
              <Input
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search contacts"
              />
            </div>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-3 py-2.5 bg-surface-container-highest text-on-surface text-sm rounded-[var(--radius-input)] border-none focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Filter by group"
            >
              <option value="all">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-on-surface-variant">
                  {selectedIds.size} selected
                </span>
                <Button size="sm" variant="ghost" onClick={handleExport}>
                  Export
                </Button>
                <Button size="sm" variant="danger" onClick={handleDeleteClick} disabled={deleteContacts.isPending}>
                  {deleteContacts.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent>
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          </CardContent>
        </Card>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-surface-container-highest flex items-center justify-center">
                <ContactsIcon />
              </div>
              <h2 className="text-lg font-semibold text-on-surface mb-1">
                No contacts yet
              </h2>
              <p className="text-sm text-on-surface-variant mb-6 max-w-sm">
                Upload a CSV or Excel file to get started. Your contacts will appear here once imported.
              </p>
              <Button onClick={() => router.push("/contacts/upload")}>
                Upload Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === sorted.length && sorted.length > 0}
                    onChange={toggleAll}
                    aria-label="Select all contacts"
                    className="accent-primary"
                  />
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => toggleSort("name")} className="cursor-pointer hover:text-on-surface transition-colors">
                    Name <SortIndicator field="name" />
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => toggleSort("email")} className="cursor-pointer hover:text-on-surface transition-colors">
                    Email <SortIndicator field="email" />
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => toggleSort("company")} className="cursor-pointer hover:text-on-surface transition-colors">
                    Company <SortIndicator field="company" />
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => toggleSort("score")} className="cursor-pointer hover:text-on-surface transition-colors">
                    Score <SortIndicator field="score" />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(contact.id)}
                      onChange={() => toggleSelect(contact.id)}
                      aria-label={`Select ${contact.firstName} ${contact.lastName}`}
                      className="accent-primary"
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-medium text-on-surface hover:text-primary transition-colors"
                    >
                      {contact.firstName} {contact.lastName}
                    </Link>
                    {contact.city && (
                      <p className="text-xs text-on-surface-variant">
                        {contact.city}{contact.state ? `, ${contact.state}` : ""}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-on-surface-variant">
                      {contact.email || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-on-surface-variant">
                      {contact.companyName || "—"}
                    </span>
                  </TableCell>
                  <TableCell>{getScoreBadge(contact.hunterScore)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      {contact.enrichedAt && (
                        <Badge variant="success">Enriched</Badge>
                      )}
                      {contact.unsubscribed && (
                        <Badge variant="error">Unsubscribed</Badge>
                      )}
                      {contact.replied && (
                        <Badge variant="default">Replied</Badge>
                      )}
                      {!contact.enrichedAt && !contact.unsubscribed && !contact.replied && (
                        <Badge variant="secondary">New</Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={handleCancelDelete}
        title="Delete Contacts"
      >
        <div className="space-y-4">
          <p className="text-on-surface-variant">
            Are you sure you want to delete {selectedIds.size} contact{selectedIds.size === 1 ? "" : "s"}?
            This action cannot be undone.
          </p>
          {deleteError && (
            <div className="p-3 rounded bg-error-container text-on-error-container text-sm" role="alert">
              {deleteError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleCancelDelete} disabled={deleteContacts.isPending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete} disabled={deleteContacts.isPending}>
              {deleteContacts.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" fill="currentColor" />
    </svg>
  );
}

function ContactsIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-on-surface-variant">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor" />
    </svg>
  );
}

/** Get badge for hunter score value */
function getScoreBadge(score: number | null) {
  if (score === null) return <Badge variant="secondary">—</Badge>;
  if (score >= 80) return <Badge variant="success">{score}</Badge>;
  if (score >= 50) return <Badge variant="warning">{score}</Badge>;
  return <Badge variant="error">{score}</Badge>;
}
