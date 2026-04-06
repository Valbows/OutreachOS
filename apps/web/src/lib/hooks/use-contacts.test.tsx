import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  contactKeys,
  useContact,
  useContactGroups,
  useContacts,
  useCreateContact,
  useDeleteContacts,
  useUpdateContact,
} from "./use-contacts";
import { createQueryWrapper, createTestQueryClient, mockJsonResponse } from "@/test/query-test-utils";

const fetchMock = vi.fn<typeof fetch>();

describe("use-contacts hooks", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("builds the contact list query key helpers", () => {
    expect(contactKeys.all).toEqual(["contacts"]);
    expect(contactKeys.detail("c1")).toEqual(["contacts", "detail", "c1"]);
  });

  it("fetches contacts with serialized search params", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ data: [], total: 0 }));

    const { result } = renderHook(
      () => useContacts({ search: "alice", groupId: "g1", sortBy: "firstName", sortDir: "asc", limit: 10, offset: 20 }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/contacts?search=alice&group_id=g1&sort_by=firstName&sort_dir=asc&limit=10&offset=20",
    );
    expect(result.current.data).toEqual({ data: [], total: 0 });
  });

  it("returns null when a single-contact request gets a 404", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, { status: 404 }));

    const { result } = renderHook(() => useContact("missing"), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("surfaces API error details when contact creation fails", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ error: "Duplicate email" }, { status: 400 }),
    );

    const { result } = renderHook(() => useCreateContact(), {
      wrapper: createQueryWrapper(),
    });

    await expect(
      result.current.mutateAsync({ firstName: "A", lastName: "B", email: "a@example.com" }),
    ).rejects.toThrow("Duplicate email");
  });

  it("invalidates list queries and updates detail cache after contact update", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const setQueryDataSpy = vi.spyOn(queryClient, "setQueryData");
    const updated = { id: "c1", firstName: "Alice" };
    fetchMock.mockResolvedValueOnce(mockJsonResponse(updated));

    const { result } = renderHook(() => useUpdateContact(), {
      wrapper: createQueryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: "c1", firstName: "Alice" });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: contactKeys.lists() });
    expect(setQueryDataSpy).toHaveBeenCalledWith(contactKeys.detail("c1"), updated);
  });

  it("removes detail caches after deleting contacts", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const removeQueriesSpy = vi.spyOn(queryClient, "removeQueries");
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ deleted: 2 }));

    const { result } = renderHook(() => useDeleteContacts(), {
      wrapper: createQueryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(["c1", "c2"]);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: contactKeys.lists() });
    expect(removeQueriesSpy).toHaveBeenCalledWith({ queryKey: contactKeys.detail("c1") });
    expect(removeQueriesSpy).toHaveBeenCalledWith({ queryKey: contactKeys.detail("c2") });
  });

  it("fetches contact groups", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse([{ id: "g1", name: "Customers" }]));

    const { result } = renderHook(() => useContactGroups(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/contacts/groups");
    expect(result.current.data).toEqual([{ id: "g1", name: "Customers" }]);
  });
});
