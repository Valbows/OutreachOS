import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateForm,
  useDeleteForm,
  useForm,
  useFormEmbedCodes,
  useForms,
  useFormSubmissions,
  useUpdateForm,
} from "./use-forms";
import { createQueryWrapper, createTestQueryClient, mockJsonResponse } from "@/test/query-test-utils";

const fetchMock = vi.fn<typeof fetch>();

describe("use-forms hooks", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches the forms list", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ data: [{ id: "f1", name: "Form" }] }));

    const { result } = renderHook(() => useForms(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/forms");
    expect(result.current.data).toEqual([{ id: "f1", name: "Form" }]);
  });

  it("does not fetch a form when the id is empty", async () => {
    const { result } = renderHook(() => useForm(""), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces API error details when form creation fails", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ error: "Name already exists" }, { status: 400 }),
    );

    const { result } = renderHook(() => useCreateForm(), {
      wrapper: createQueryWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        name: "Signup",
        type: "minimal",
        fields: [{ name: "email", type: "email", required: true, label: "Email" }],
      }),
    ).rejects.toThrow("Name already exists");
  });

  it("invalidates list and detail caches when a form is updated", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ data: { id: "f1", name: "Updated" } }));

    const { result } = renderHook(() => useUpdateForm(), {
      wrapper: createQueryWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: "f1", name: "Updated" });
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/forms/f1", expect.objectContaining({ method: "PATCH" }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["forms"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["forms", "f1"] });
  });

  it("throws when delete fails", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, { status: 500 }));

    const { result } = renderHook(() => useDeleteForm(), {
      wrapper: createQueryWrapper(),
    });

    await expect(result.current.mutateAsync("f1")).rejects.toThrow("Failed to delete form");
  });

  it("fetches submissions with pagination parameters", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ data: [], total: 0 }));

    const { result } = renderHook(() => useFormSubmissions("f1", 25, 50), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/forms/f1/submissions?limit=25&offset=50");
    expect(result.current.data).toEqual({ data: [], total: 0 });
  });

  it("fetches embed codes for a form", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        data: {
          hosted: "https://example.com/form",
          iframe: "<iframe></iframe>",
          widget: "<script></script>",
        },
      }),
    );

    const { result } = renderHook(() => useFormEmbedCodes("f1"), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/forms/f1/embed");
    expect(result.current.data?.hosted).toBe("https://example.com/form");
  });
});
