import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateTemplate,
  useDeleteTemplate,
  useGenerateEmail,
  useGenerateSubjects,
  useRewriteEmail,
  useTemplate,
  useTemplates,
  useUpdateTemplate,
} from "./use-templates";
import { createQueryWrapper, createTestQueryClient, mockJsonResponse } from "@/test/query-test-utils";

const fetchMock = vi.fn<typeof fetch>();

describe("use-templates hooks", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches templates", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ data: [{ id: "t1", name: "Cold Email" }] }));

    const { result } = renderHook(() => useTemplates(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/templates");
    expect(result.current.data).toEqual([{ id: "t1", name: "Cold Email" }]);
  });

  it("keeps a single-template query disabled without an id", async () => {
    const { result } = renderHook(() => useTemplate(""), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("invalidates templates after creation", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ data: { id: "t1" } }));

    const { result } = renderHook(() => useCreateTemplate(), {
      wrapper: createQueryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ name: "Cold Email" });
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/templates", expect.objectContaining({ method: "POST" }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["templates"] });
  });

  it("throws when template update fails", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, { status: 500 }));

    const { result } = renderHook(() => useUpdateTemplate(), {
      wrapper: createQueryWrapper(),
    });

    await expect(result.current.mutateAsync({ id: "t1", name: "Updated" })).rejects.toThrow(
      "Failed to update template",
    );
  });

  it("returns null when delete succeeds with 204 no-content", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, text: async () => "" } as Response);

    const { result } = renderHook(() => useDeleteTemplate(), {
      wrapper: createQueryWrapper(),
    });

    await expect(result.current.mutateAsync("t1")).resolves.toBeNull();
  });

  it("sends the generate_email action to the generator endpoint", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ data: { subject: "Hi" } }));

    const { result } = renderHook(() => useGenerateEmail(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ goal: "Book demo", audience: "CTOs", tone: "friendly" });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/templates/generate",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns generated subjects", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ data: ["Subject A", "Subject B"] }));

    const { result } = renderHook(() => useGenerateSubjects(), {
      wrapper: createQueryWrapper(),
    });

    await expect(
      result.current.mutateAsync({ emailBody: "Hello", tone: "warm", count: 2 }),
    ).resolves.toEqual(["Subject A", "Subject B"]);
  });

  it("throws when rewrite fails", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, { status: 500 }));

    const { result } = renderHook(() => useRewriteEmail(), {
      wrapper: createQueryWrapper(),
    });

    await expect(
      result.current.mutateAsync({ currentBody: "Hello", instruction: "Shorter" }),
    ).rejects.toThrow("Failed to rewrite email");
  });
});
