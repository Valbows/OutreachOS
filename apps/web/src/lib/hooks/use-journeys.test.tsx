import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateJourney,
  useDeleteJourney,
  useEnrollContacts,
  useJourney,
  useJourneys,
} from "./use-journeys";
import { createQueryWrapper, createTestQueryClient, mockJsonResponse } from "@/test/query-test-utils";

const fetchMock = vi.fn<typeof fetch>();

describe("use-journeys hooks", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches journeys", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ data: [{ id: "j1", name: "Journey" }] }));

    const { result } = renderHook(() => useJourneys(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/journeys");
    expect(result.current.data).toEqual([{ id: "j1", name: "Journey" }]);
  });

  it("keeps a single-journey query disabled without an id", async () => {
    const { result } = renderHook(() => useJourney(""), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses API-provided errors when journey creation fails", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ error: "Too many steps" }, { status: 400 }));

    const { result } = renderHook(() => useCreateJourney(), {
      wrapper: createQueryWrapper(),
    });

    await expect(result.current.mutateAsync({ name: "Onboarding" })).rejects.toThrow("Too many steps");
  });

  it("allows delete on 204 responses and invalidates the list", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    fetchMock.mockResolvedValueOnce({ ok: false, status: 204 } as Response);

    const { result } = renderHook(() => useDeleteJourney(), {
      wrapper: createQueryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("j1");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/journeys/j1", { method: "DELETE" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["journeys"] });
  });

  it("invalidates the specific journey after enrolling contacts", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ success: true }));

    const { result } = renderHook(() => useEnrollContacts(), {
      wrapper: createQueryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        journeyId: "j1",
        contactIds: ["c1", "c2"],
        removeOnReply: true,
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/journeys/j1/enroll",
      expect.objectContaining({ method: "POST" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["journeys", "j1"] });
  });
});
