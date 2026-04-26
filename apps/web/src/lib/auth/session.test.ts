import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionMock,
  limitMock,
  whereMock,
  fromMock,
  selectMock,
  returningMock,
  onConflictDoNothingMock,
  valuesMock,
  insertMock,
  eqMock,
  updateMock,
  setMock,
} = vi.hoisted(() => {
  const getSessionMock = vi.fn();
  const limitMock = vi.fn();
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock = vi.fn(() => ({ where: whereMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));
  const returningMock = vi.fn();
  const onConflictDoNothingMock = vi.fn(() => ({ returning: returningMock }));
  const valuesMock = vi.fn(() => ({ onConflictDoNothing: onConflictDoNothingMock }));
  const insertMock = vi.fn(() => ({ values: valuesMock }));
  const eqMock = vi.fn((left, right) => ({ left, right }));
  const setMock = vi.fn(() => ({ where: vi.fn() }));
  const updateMock = vi.fn(() => ({ set: setMock }));

  return {
    getSessionMock,
    limitMock,
    whereMock,
    fromMock,
    selectMock,
    returningMock,
    onConflictDoNothingMock,
    valuesMock,
    insertMock,
    eqMock,
    updateMock,
    setMock,
  };
});

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: getSessionMock,
  },
}));

vi.mock("@outreachos/db", () => ({
  db: {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
  },
  accounts: {
    id: "id",
    neonAuthId: "neon_auth_id",
    name: "name",
    email: "email",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: eqMock,
}));

import { getAuthAccount } from "./session";

describe("getAuthAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the session has no email", async () => {
    getSessionMock.mockResolvedValue({ data: { user: {} } });

    await expect(getAuthAccount()).resolves.toBeNull();
    expect(selectMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns the existing account when one already matches the session email", async () => {
    const existing = { id: "acct_1", email: "test@example.com", name: "Test", neonAuthId: "user_123" };
    getSessionMock.mockResolvedValue({
      data: { user: { email: "test@example.com", name: "Test", id: "user_123" } },
    });
    // Lookup by email finds the account with matching neonAuthId — no update needed
    limitMock.mockResolvedValueOnce([existing]);

    await expect(getAuthAccount()).resolves.toEqual(existing);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("looks up by neonAuthId first and updates email if changed and no conflict", async () => {
    const existing = { id: "acct_1", email: "old@example.com", name: "Test", neonAuthId: "user_123" };
    getSessionMock.mockResolvedValue({
      data: { user: { email: "new@example.com", name: "Test", id: "user_123" } },
    });
    // First select: lookup by email (new@example.com) — not found
    limitMock.mockResolvedValueOnce([]);
    // Second select: lookup by neonAuthId — finds existing
    limitMock.mockResolvedValueOnce([existing]);
    // Third select: conflict check for new email — no conflict
    limitMock.mockResolvedValueOnce([]);

    await expect(getAuthAccount()).resolves.toEqual({ ...existing, email: "new@example.com" });
    expect(updateMock).toHaveBeenCalledOnce();
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@example.com" })
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns null when neonAuthId already belongs to a different account during sync", async () => {
    const existing = { id: "acct_1", email: "test@example.com", name: "Test", neonAuthId: "old_auth" };
    const conflictingAuth = { id: "acct_99" };
    getSessionMock.mockResolvedValue({
      data: { user: { email: "test@example.com", name: "Test", id: "new_auth" } },
    });
    // First select: lookup by email — finds existing (neonAuthId differs from session)
    limitMock.mockResolvedValueOnce([existing]);
    // Second select: neonAuthId conflict check — another account already owns "new_auth"
    limitMock.mockResolvedValueOnce([conflictingAuth]);

    await expect(getAuthAccount()).resolves.toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("skips email update when target email already belongs to a different account", async () => {
    const existing = { id: "acct_1", email: "old@example.com", name: "Test", neonAuthId: "user_123" };
    const conflicting = { id: "acct_99" };
    getSessionMock.mockResolvedValue({
      data: { user: { email: "taken@example.com", name: "Test", id: "user_123" } },
    });
    // First select: lookup by email (taken@example.com) — not found via email path (different neonAuthId)
    limitMock.mockResolvedValueOnce([]);
    // Second select: lookup by neonAuthId — finds existing
    limitMock.mockResolvedValueOnce([existing]);
    // Third select: conflict check — another account owns this email
    limitMock.mockResolvedValueOnce([conflicting]);

    await expect(getAuthAccount()).resolves.toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("auto-provisions an account row when the session is valid but no account exists", async () => {
    const created = { id: "acct_2", email: "alice@example.com", name: "alice" };
    getSessionMock.mockResolvedValue({
      data: { user: { email: "alice@example.com", id: "user_123" } },
    });
    // First lookup by neonAuthId returns nothing
    limitMock.mockResolvedValueOnce([]);
    // Second lookup by email returns nothing
    limitMock.mockResolvedValueOnce([]);
    returningMock.mockResolvedValueOnce([created]);

    await expect(getAuthAccount()).resolves.toEqual(created);
    expect(valuesMock).toHaveBeenCalledWith({
      name: "alice",
      email: "alice@example.com",
      neonAuthId: "user_123",
    });
    expect(onConflictDoNothingMock).toHaveBeenCalledWith({ target: "email" });
  });

  it("returns the raced account when another request inserts first", async () => {
    const raced = { id: "acct_3", email: "race@example.com", name: "race" };
    getSessionMock.mockResolvedValue({
      data: { user: { email: "race@example.com", id: "user_race" } },
    });
    // First lookup by neonAuthId returns nothing
    limitMock.mockResolvedValueOnce([]);
    // Second lookup by email returns nothing (pre-insert)
    limitMock.mockResolvedValueOnce([]);
    // Insert returns empty (race condition - already inserted)
    returningMock.mockResolvedValueOnce([]);
    // Third lookup finds the raced account
    limitMock.mockResolvedValueOnce([raced]);

    await expect(getAuthAccount()).resolves.toEqual(raced);
    expect(selectMock).toHaveBeenCalledTimes(3);
  });
});
