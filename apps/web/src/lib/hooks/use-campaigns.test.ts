import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import {
  useCampaigns,
  useCampaign,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useCampaignAnalytics,
} from "./use-campaigns";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useCampaigns", () => {

  it("fetches campaigns list", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "cmp1", name: "Launch" }] }),
    });

    const { result } = renderHook(() => useCampaigns(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("fetches with status filter", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const { result } = renderHook(() => useCampaigns("active"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith("/api/campaigns?status=active");
  });
});

describe("useCampaign", () => {
  it("fetches single campaign", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "cmp1", name: "Launch" } }),
    });

    const { result } = renderHook(() => useCampaign("cmp1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("cmp1");
  });
});

describe("useCreateCampaign", () => {
  it("creates a campaign", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "cmp1" } }),
    });

    const { result } = renderHook(() => useCreateCampaign(), { wrapper: createWrapper() });

    result.current.mutate({ name: "New Campaign", type: "one_time" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useUpdateCampaign", () => {
  it("updates a campaign", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "cmp1" } }),
    });

    const { result } = renderHook(() => useUpdateCampaign(), { wrapper: createWrapper() });

    result.current.mutate({ id: "cmp1", name: "Updated" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useDeleteCampaign", () => {
  it("deletes a campaign", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useDeleteCampaign(), { wrapper: createWrapper() });

    result.current.mutate("cmp1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useCampaignAnalytics", () => {
  it("fetches campaign analytics", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          metrics: { totalSent: 100, openRate: 0.25 },
          hourly: [],
          daily: [],
        },
      }),
    });

    const { result } = renderHook(() => useCampaignAnalytics("cmp1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.metrics.totalSent).toBe(100);
  });
});
