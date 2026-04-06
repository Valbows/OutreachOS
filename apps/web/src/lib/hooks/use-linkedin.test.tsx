import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useDeletePlaybookEntry,
  useGenerateLinkedInCopy,
  useLinkedInEntry,
  useLinkedInPlaybook,
  useRegenerateLinkedInCopy,
  useUpdatePlaybookStatus,
} from "./use-linkedin";
import { createQueryWrapper, createTestQueryClient, mockJsonResponse } from "@/test/query-test-utils";

const fetchMock = vi.fn<typeof fetch>();

describe("use-linkedin hooks", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches the playbook with an optional status filter", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ entries: [], total: 0 }));

    const { result } = renderHook(() => useLinkedInPlaybook("draft"), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/linkedin?status=draft");
    expect(result.current.data).toEqual({ entries: [], total: 0 });
  });

  it("does not fetch an entry when id is empty", async () => {
    const { result } = renderHook(() => useLinkedInEntry(""), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses response error details when generation fails", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ error: "Prompt required" }, { status: 400 }));

    const { result } = renderHook(() => useGenerateLinkedInCopy(), {
      wrapper: createQueryWrapper(),
    });

    await expect(result.current.mutateAsync({ prompt: "" })).rejects.toThrow("Prompt required");
  });

  it("invalidates linkedin queries after regenerating copy", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ id: "p1" }));

    const { result } = renderHook(() => useRegenerateLinkedInCopy(), {
      wrapper: createQueryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("p1");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/linkedin/p1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["linkedin"] });
  });

  it("updates playbook status through the API", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ id: "p1", status: "approved" }));

    const { result } = renderHook(() => useUpdatePlaybookStatus(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: "p1", status: "approved" });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/linkedin/p1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("throws when deleting a playbook entry fails", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, { status: 500 }));

    const { result } = renderHook(() => useDeletePlaybookEntry(), {
      wrapper: createQueryWrapper(),
    });

    await expect(result.current.mutateAsync("p1")).rejects.toThrow("Failed to delete entry");
  });
});
