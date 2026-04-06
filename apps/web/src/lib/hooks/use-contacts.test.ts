import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import {
  useContacts,
  useContact,
  useCreateContact,
  useUpdateContact,
  useDeleteContacts,
  useContactGroups,
  useCreateGroup,
} from "./use-contacts";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useContacts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("fetches contacts list", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "c1" }], total: 1 }),
    });

    const { result } = renderHook(() => useContacts(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(1);
  });

  it("fetches with params", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], total: 0 }),
    });

    const { result } = renderHook(
      () => useContacts({ search: "ada", groupId: "g1", limit: 10, offset: 5 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("search=ada"));
  });
});

describe("useContact", () => {
  it("fetches single contact", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "c1", firstName: "Ada" }),
    });

    const { result } = renderHook(() => useContact("c1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("c1");
  });

  it("returns null for 404", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 404 });

    const { result } = renderHook(() => useContact("c1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe("useCreateContact", () => {
  it("creates a contact", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "c1" }),
    });

    const { result } = renderHook(() => useCreateContact(), { wrapper: createWrapper() });

    result.current.mutate({ firstName: "Ada", lastName: "Lovelace" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("handles create error", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Failed" }),
    });

    const { result } = renderHook(() => useCreateContact(), { wrapper: createWrapper() });

    result.current.mutate({ firstName: "Ada", lastName: "Lovelace" });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdateContact", () => {
  it("updates a contact", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "c1", firstName: "Updated" }),
    });

    const { result } = renderHook(() => useUpdateContact(), { wrapper: createWrapper() });

    result.current.mutate({ id: "c1", firstName: "Updated" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("handles update error", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Failed" }),
    });

    const { result } = renderHook(() => useUpdateContact(), { wrapper: createWrapper() });

    result.current.mutate({ id: "c1", firstName: "Updated" });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useDeleteContacts", () => {
  it("deletes contacts", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deleted: 2 }),
    });

    const { result } = renderHook(() => useDeleteContacts(), { wrapper: createWrapper() });

    result.current.mutate(["c1", "c2"]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("handles delete error", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Failed" }),
    });

    const { result } = renderHook(() => useDeleteContacts(), { wrapper: createWrapper() });

    result.current.mutate(["c1"]);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useContactGroups", () => {
  it("fetches contact groups", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "g1", name: "VIPs" }],
    });

    const { result } = renderHook(() => useContactGroups(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe("useCreateGroup", () => {
  it("creates a group", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "g1", name: "New Group" }),
    });

    const { result } = renderHook(() => useCreateGroup(), { wrapper: createWrapper() });

    result.current.mutate({ name: "New Group" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("handles create error", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Failed" }),
    });

    const { result } = renderHook(() => useCreateGroup(), { wrapper: createWrapper() });

    result.current.mutate({ name: "New Group" });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
