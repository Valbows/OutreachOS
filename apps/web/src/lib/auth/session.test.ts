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
  },
  accounts: {
    id: "id",
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
    const existing = { id: "acct_1", email: "test@example.com", name: "Test" };
    getSessionMock.mockResolvedValue({
      data: { user: { email: "test@example.com", name: "Test" } },
    });
    limitMock.mockResolvedValueOnce([existing]);

    await expect(getAuthAccount()).resolves.toEqual(existing);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("auto-provisions an account row when the session is valid but no account exists", async () => {
    const created = { id: "acct_2", email: "alice@example.com", name: "alice" };
    getSessionMock.mockResolvedValue({
      data: { user: { email: "alice@example.com" } },
    });
    limitMock.mockResolvedValueOnce([]);
    returningMock.mockResolvedValueOnce([created]);

    await expect(getAuthAccount()).resolves.toEqual(created);
    expect(valuesMock).toHaveBeenCalledWith({
      name: "alice",
      email: "alice@example.com",
    });
    expect(onConflictDoNothingMock).toHaveBeenCalledWith({ target: "email" });
  });

  it("returns the raced account when another request inserts first", async () => {
    const raced = { id: "acct_3", email: "race@example.com", name: "race" };
    getSessionMock.mockResolvedValue({
      data: { user: { email: "race@example.com" } },
    });
    limitMock.mockResolvedValueOnce([]).mockResolvedValueOnce([raced]);
    returningMock.mockResolvedValueOnce([]);

    await expect(getAuthAccount()).resolves.toEqual(raced);
    expect(selectMock).toHaveBeenCalledTimes(2);
  });
});
