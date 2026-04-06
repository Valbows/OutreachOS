import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCampaign,
  useCampaignAnalytics,
  useCampaigns,
  useCreateCampaign,
  useDeleteCampaign,
  useUpdateCampaign,
} from "./use-campaigns";
import { createQueryWrapper, createTestQueryClient, mockJsonResponse } from "@/test/query-test-utils";

const fetchMock = vi.fn<typeof fetch>();

describe("use-campaigns hooks", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches campaigns with optional status filter", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ data: [{ id: "cmp_1" }] }));

    const { result } = renderHook(() => useCampaigns("draft"), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/campaigns?status=draft");
    expect(result.current.data).toEqual([{ id: "cmp_1" }]);
  });

  it("does not fetch a campaign when the id is empty", async () => {
    const { result } = renderHook(() => useCampaign(""), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("invalidates campaigns after creation", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ data: { id: "cmp_1" } }));

    const { result } = renderHook(() => useCreateCampaign(), {
      wrapper: createQueryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ name: "Launch", type: "email" });
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/campaigns", expect.objectContaining({ method: "POST" }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["campaigns"] });
  });

  it("throws on update failure", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, { status: 500 }));

    const { result } = renderHook(() => useUpdateCampaign(), {
      wrapper: createQueryWrapper(),
    });

    await expect(result.current.mutateAsync({ id: "cmp_1", name: "Updated" })).rejects.toThrow(
      "Failed to update campaign",
    );
  });

  it("deletes campaigns through the API", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ success: true }));

    const { result } = renderHook(() => useDeleteCampaign(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync("cmp_1");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/campaigns/cmp_1", { method: "DELETE" });
  });

  it("fetches campaign analytics when enabled", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ data: { metrics: { totalSent: 1 }, hourly: [], daily: [] } }),
    );

    const { result } = renderHook(() => useCampaignAnalytics("cmp_1"), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/campaigns/cmp_1/analytics");
    expect(result.current.data).toEqual({ metrics: { totalSent: 1 }, hourly: [], daily: [] });
  });
});
