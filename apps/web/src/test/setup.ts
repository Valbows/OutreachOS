import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Manual cleanup required - automatic RTL cleanup not enabled in this Vitest config
afterEach(() => {
  cleanup();
});
