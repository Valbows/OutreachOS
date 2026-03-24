import { afterEach, describe, expect, it, vi } from "vitest";

describe("Modal null-ref branch", () => {
  afterEach(() => {
    vi.doUnmock("react");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("returns early when the dialog ref is unavailable", async () => {
    vi.resetModules();

    const showModalSpy = vi.fn();
    const closeSpy = vi.fn();
    HTMLDialogElement.prototype.showModal = showModalSpy;
    HTMLDialogElement.prototype.close = closeSpy;

    vi.doMock("react", async () => {
      const actual = await vi.importActual<typeof import("react")>("react");

      return {
        ...actual,
        useRef: () => ({ current: null }),
        // Cleanup not needed: null ref causes early return before side effects
        useEffect: (callback: () => void) => {
          callback();
        },
      };
    });

    const { Modal } = await import("./modal");

    // Direct call intentional: bypasses React rendering to test null-ref branch
    // with mocked useRef/useEffect stubs that wouldn't work inside render()
    const element = Modal({
      open: true,
      onClose: () => undefined,
      children: "Modal body",
    });

    expect(element.type).toBe("dialog");
    expect(showModalSpy).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
  });
});
