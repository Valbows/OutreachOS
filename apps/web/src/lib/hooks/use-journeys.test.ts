import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import {
  useJourneys,
  useJourney,
  useCreateJourney,
  useDeleteJourney,
  useEnrollContacts,
} from "./use-journeys";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useJourneys", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("fetches journeys list", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "j1", name: "Onboarding" }] }),
    });

    const { result } = renderHook(() => useJourneys(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe("useJourney", () => {
  it("fetches single journey", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "j1", name: "Onboarding" } }),
    });

    const { result } = renderHook(() => useJourney("j1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("j1");
  });
});

describe("useCreateJourney", () => {
  it("creates a journey", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "j1" } }),
    });

    const { result } = renderHook(() => useCreateJourney(), { wrapper: createWrapper() });

    result.current.mutate({ name: "New Journey" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("handles create error", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Failed" }),
    });

    const { result } = renderHook(() => useCreateJourney(), { wrapper: createWrapper() });

    result.current.mutate({ name: "New Journey" });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useDeleteJourney", () => {
  it("deletes a journey", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 204 });

    const { result } = renderHook(() => useDeleteJourney(), { wrapper: createWrapper() });

    result.current.mutate("j1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useEnrollContacts", () => {
  it("enrolls contacts in journey", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { enrolled: 5 } }),
    });

    const { result } = renderHook(() => useEnrollContacts(), { wrapper: createWrapper() });

    result.current.mutate({ journeyId: "j1", contactIds: ["c1", "c2"] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("handles enroll error", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Failed to enroll" }),
    });

    const { result } = renderHook(() => useEnrollContacts(), { wrapper: createWrapper() });

    result.current.mutate({ journeyId: "j1", contactIds: ["c1"] });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
