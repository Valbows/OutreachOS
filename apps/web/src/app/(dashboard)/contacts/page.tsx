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
import {
  useContacts,
  useContactGroups,
  useDeleteContacts,
  useAddToGroup,
  useRemoveFromGroup,
  useCreateGroup,
  useDeleteGroup,
  useUpdateGroup,
} from "@/lib/hooks/use-contacts";

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
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showRenameGroupModal, setShowRenameGroupModal] = useState(false);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [groupActionError, setGroupActionError] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [groupToRename, setGroupToRename] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [renameGroupName, setRenameGroupName] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);

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
  const addToGroup = useAddToGroup();
  const removeFromGroup = useRemoveFromGroup();
  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();
  const updateGroup = useUpdateGroup();

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

  // Group management handlers
  const handleOpenAssignModal = useCallback(() => {
    if (selectedIds.size === 0) return;
    setGroupActionError(null);
    setShowAssignModal(true);
  }, [selectedIds.size]);

  const handleAssignToGroup = useCallback((groupId: string) => {
    setPendingGroupId(groupId);
    addToGroup.mutate(
      { groupId, contactIds: [...selectedIds] },
      {
        onSuccess: () => {
          setShowAssignModal(false);
          setSelectedIds(new Set());
          setGroupActionError(null);
          setPendingGroupId(null);
        },
        onError: (error) => {
          setGroupActionError(error.message || "Failed to assign contacts to group");
          setPendingGroupId(null);
        },
      }
    );
  }, [selectedIds, addToGroup]);

  const handleRemoveFromGroup = useCallback(() => {
    if (selectedGroup === "all" || selectedIds.size === 0) return;
    removeFromGroup.mutate(
      { groupId: selectedGroup, contactIds: [...selectedIds] },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
        },
        onError: (error) => {
          console.error("Failed to remove from group:", error.message);
        },
      }
    );
  }, [selectedGroup, selectedIds, removeFromGroup]);

  const handleCreateGroup = useCallback(() => {
    if (!newGroupName.trim()) return;
    createGroup.mutate(
      { name: newGroupName.trim(), description: newGroupDescription.trim() || undefined },
      {
        onSuccess: (newGroup) => {
          setShowCreateGroupModal(false);
          setNewGroupName("");
          setNewGroupDescription("");
          setGroupActionError(null);
          // If contacts are selected, immediately assign them
          if (selectedIds.size > 0) {
            addToGroup.mutate(
              {
                groupId: newGroup.id,
                contactIds: [...selectedIds],
              },
              {
                onSuccess: () => {
                  setSelectedIds(new Set());
                },
                onError: (error) => {
                  setGroupActionError(error.message || "Failed to assign contacts to new group");
                },
              }
            );
          }
        },
        onError: (error) => {
          setGroupActionError(error.message || "Failed to create group");
        },
      }
    );
  }, [newGroupName, newGroupDescription, createGroup, selectedIds, addToGroup]);

  const handleOpenRenameModal = useCallback((groupId: string, currentName: string) => {
    setRenameGroupName(currentName);
    setGroupToRename(groupId);
    setGroupActionError(null);
    setShowRenameGroupModal(true);
  }, []);

  const handleRenameGroup = useCallback(() => {
    if (!renameGroupName.trim() || !groupToRename) return;
    updateGroup.mutate(
      { id: groupToRename, name: renameGroupName.trim() },
      {
        onSuccess: () => {
          setShowRenameGroupModal(false);
          setGroupToRename(null);
          setGroupActionError(null);
        },
        onError: (error) => {
          setGroupActionError(error.message || "Failed to rename group");
        },
      }
    );
  }, [renameGroupName, groupToRename, updateGroup]);

  const handleOpenDeleteGroupModal = useCallback((groupId: string) => {
    setGroupToDelete(groupId);
    setGroupActionError(null);
    setShowDeleteGroupModal(true);
  }, []);

  const handleConfirmDeleteGroup = useCallback(() => {
    if (!groupToDelete) return;
    deleteGroup.mutate(groupToDelete, {
      onSuccess: () => {
        setShowDeleteGroupModal(false);
        setGroupToDelete(null);
        setGroupActionError(null);
      },
      onError: (error) => {
        setGroupActionError(error.message || "Failed to delete group");
      },
    });
  }, [groupToDelete, deleteGroup]);

  function SortIndicator({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      {/* Sidebar — Groups */}
      <div className="w-64 shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-mono uppercase tracking-wider text-on-surface-variant">
            Groups
          </h2>
          <button
            onClick={() => {
              setNewGroupName("");
              setNewGroupDescription("");
              setGroupActionError(null);
              setShowCreateGroupModal(true);
            }}
            className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors"
            aria-label="Create new group"
          >
            <PlusIcon />
          </button>
        </div>
        
        <div className="space-y-1 overflow-y-auto flex-1 pr-2">
          {/* All Contacts */}
          <button
            onClick={() => setSelectedGroup("all")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
              selectedGroup === "all"
                ? "bg-gradient-to-r from-[#c4c0ff]/20 to-transparent border-l-2 border-[#c4c0ff]"
                : "hover:bg-surface-container-low"
            }`}
          >
            <div className="flex items-center gap-2">
              <UsersIcon className={selectedGroup === "all" ? "text-[#c4c0ff]" : "text-on-surface-variant"} />
              <span className={`text-sm ${selectedGroup === "all" ? "text-on-surface font-medium" : "text-on-surface-variant"}`}>
                All Contacts
              </span>
            </div>
            <span className="text-xs text-on-surface-variant font-mono">
              {totalCount.toLocaleString()}
            </span>
          </button>

          {/* Group List */}
          {groups.map((group) => (
            <div
              key={group.id}
              className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                selectedGroup === group.id
                  ? "bg-gradient-to-r from-[#41eec2]/10 to-transparent border-l-2 border-[#41eec2]"
                  : "hover:bg-surface-container-low"
              }`}
            >
              <button
                onClick={() => setSelectedGroup(group.id)}
                className="flex-1 flex items-center gap-2 text-left"
              >
                <FolderIcon className={selectedGroup === group.id ? "text-[#41eec2]" : "text-on-surface-variant"} />
                <span className={`text-sm truncate ${selectedGroup === group.id ? "text-on-surface font-medium" : "text-on-surface-variant"}`}>
                  {group.name}
                </span>
              </button>
              
              {/* Group Actions Menu */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenRenameModal(group.id, group.name);
                  }}
                  className="p-1 rounded hover:bg-surface-container-high"
                  aria-label="Rename group"
                >
                  <EditIcon />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDeleteGroupModal(group.id);
                  }}
                  className="p-1 rounded hover:bg-surface-container-high text-[#ffb4ab]"
                  aria-label="Delete group"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {selectedGroup === "all" ? "Contacts" : groups.find(g => g.id === selectedGroup)?.name || "Contacts"}
              <span className="text-on-surface-variant font-normal text-lg ml-2">
                ({totalCount.toLocaleString()} total)
              </span>
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Intelligence Database Management
            </p>
          </div>
          <Button variant="secondary" onClick={() => router.push("/contacts/upload")}>
            <UploadIcon />
            Upload
          </Button>
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
              
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-on-surface-variant font-mono">
                    {selectedIds.size} selected
                  </span>
                  
                  {/* Assign to Group */}
                  <Button size="sm" variant="secondary" onClick={handleOpenAssignModal}>
                    <FolderIcon />
                    Assign to Group
                  </Button>
                  
                  {/* Remove from Group (only when filtered) */}
                  {selectedGroup !== "all" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRemoveFromGroup}
                      disabled={removeFromGroup.isPending}
                    >
                      {removeFromGroup.isPending ? "Removing..." : "Remove from Group"}
                    </Button>
                  )}
                  
                  <Button size="sm" variant="ghost" onClick={handleExport}>
                    Export
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={handleDeleteClick}
                    disabled={deleteContacts.isPending}
                  >
                    {deleteContacts.isPending ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <div className="flex-1 overflow-auto">
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
                    <UsersIcon />
                  </div>
                  <h2 className="text-lg font-semibold text-on-surface mb-1">
                    {selectedGroup === "all" ? "No contacts yet" : "No contacts in this group"}
                  </h2>
                  <p className="text-sm text-on-surface-variant mb-6 max-w-sm">
                    {selectedGroup === "all"
                      ? "Upload a CSV or Excel file to get started. Your contacts will appear here once imported."
                      : "Select contacts from other groups and assign them here."}
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
        </div>
      </div>

      {/* Assign to Group Modal */}
      <Modal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign to Group"
      >
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            Select a group to assign {selectedIds.size} contact{selectedIds.size === 1 ? "" : "s"} to:
          </p>
          
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => handleAssignToGroup(group.id)}
                disabled={addToGroup.isPending}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors text-left"
              >
                <FolderIcon className="text-[#41eec2]" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-on-surface">{group.name}</p>
                  {group.description && (
                    <p className="text-xs text-on-surface-variant">{group.description}</p>
                  )}
                </div>
                {addToGroup.isPending && pendingGroupId === group.id && (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
              </button>
            ))}
          </div>
          
          <div className="pt-2 border-t border-outline-variant/20">
            <button
              onClick={() => {
                setShowAssignModal(false);
                setShowCreateGroupModal(true);
                setNewGroupName("");
                setNewGroupDescription("");
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-outline-variant/50 hover:bg-surface-container-low transition-colors text-left"
            >
              <PlusIcon className="text-on-surface-variant" />
              <span className="text-sm text-on-surface-variant">Create New Group</span>
            </button>
          </div>
          
          {groupActionError && (
            <div className="p-3 rounded bg-error-container text-on-error-container text-sm" role="alert">
              {groupActionError}
            </div>
          )}
        </div>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        open={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        title="Create Group"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="group-name" className="block text-sm font-medium text-on-surface mb-1">
              Group Name
            </label>
            <Input
              id="group-name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g., VPs of Sales, SaaS Companies"
              autoFocus
            />
          </div>
          
          <div>
            <label htmlFor="group-desc" className="block text-sm font-medium text-on-surface mb-1">
              Description <span className="text-on-surface-variant font-normal">(optional)</span>
            </label>
            <Input
              id="group-desc"
              value={newGroupDescription}
              onChange={(e) => setNewGroupDescription(e.target.value)}
              placeholder="Brief description of this group"
            />
          </div>
          
          {selectedIds.size > 0 && (
            <p className="text-xs text-on-surface-variant">
              {selectedIds.size} contact{selectedIds.size === 1 ? "" : "s"} will be added to this group.
            </p>
          )}
          
          {groupActionError && (
            <div className="p-3 rounded bg-error-container text-on-error-container text-sm" role="alert">
              {groupActionError}
            </div>
          )}
          
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowCreateGroupModal(false)} disabled={createGroup.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={createGroup.isPending || !newGroupName.trim()}
            >
              {createGroup.isPending ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rename Group Modal */}
      <Modal
        open={showRenameGroupModal}
        onClose={() => {
          setShowRenameGroupModal(false);
          setGroupToRename(null);
        }}
        title="Rename Group"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="rename-group" className="block text-sm font-medium text-on-surface mb-1">
              Group Name
            </label>
            <Input
              id="rename-group"
              value={renameGroupName}
              onChange={(e) => setRenameGroupName(e.target.value)}
              autoFocus
            />
          </div>
          
          {groupActionError && (
            <div className="p-3 rounded bg-error-container text-on-error-container text-sm" role="alert">
              {groupActionError}
            </div>
          )}
          
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowRenameGroupModal(false)} disabled={updateGroup.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleRenameGroup}
              disabled={updateGroup.isPending || !renameGroupName.trim()}
            >
              {updateGroup.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Group Modal */}
      <Modal
        open={showDeleteGroupModal}
        onClose={() => {
          setShowDeleteGroupModal(false);
          setGroupToDelete(null);
        }}
        title="Delete Group"
      >
        <div className="space-y-4">
          <p className="text-on-surface-variant">
            Are you sure you want to delete &quot;{groups.find(g => g.id === groupToDelete)?.name}&quot;?
            This will remove the group, but contacts will remain in your database.
          </p>
          
          {groupActionError && (
            <div className="p-3 rounded bg-error-container text-on-error-container text-sm" role="alert">
              {groupActionError}
            </div>
          )}
          
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteGroupModal(false)} disabled={deleteGroup.isPending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDeleteGroup} disabled={deleteGroup.isPending}>
              {deleteGroup.isPending ? "Deleting..." : "Delete Group"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Contacts Modal */}
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

// Icons
function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-on-surface-variant">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" fill="currentColor" />
    </svg>
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

/** Get badge for hunter score value */
function getScoreBadge(score: number | null) {
  if (score === null) return <Badge variant="secondary">—</Badge>;
  if (score >= 80) return <Badge variant="success">{score}</Badge>;
  if (score >= 50) return <Badge variant="warning">{score}</Badge>;
  return <Badge variant="error">{score}</Badge>;
}
