import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "./store";

describe("useUIStore", () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarOpen: true,
      activeAccountId: null,
    });
  });

  it("resets to the expected default state", () => {
    const state = useUIStore.getState();

    expect(state.sidebarOpen).toBe(true);
    expect(state.activeAccountId).toBeNull();
  });

  it("toggles the sidebar state", () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it("sets sidebar visibility and active account explicitly", () => {
    useUIStore.getState().setSidebarOpen(false);
    useUIStore.getState().setActiveAccountId("acct_123");

    const state = useUIStore.getState();
    expect(state.sidebarOpen).toBe(false);
    expect(state.activeAccountId).toBe("acct_123");
  });
});
