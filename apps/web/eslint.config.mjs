import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),

  // ─────────────────────────────────────────────────────────────────────
  // Project-wide rule tuning
  // ─────────────────────────────────────────────────────────────────────
  // `react-hooks/set-state-in-effect` is a React Compiler-style guideline
  // with too many legitimate exceptions in this codebase (syncing state to
  // props on prop change is a valid pattern when paired with refs/keys).
  // We defer adoption until the full React Compiler migration.
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // Test-file overrides — applies to vitest unit tests and Playwright e2e
  // ─────────────────────────────────────────────────────────────────────
  // Tests use `any` for mock typings (industry-standard — strict typing of
  // mocks is anti-pattern), CommonJS `require()` for dynamic imports,
  // and inline wrapper components without `displayName`.
  {
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "e2e/**/*.ts",
      "e2e/**/*.tsx",
      "src/test/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react/display-name": "off",
      // Playwright's fixture API uses `use(value)` as a callback, which the
      // React Hook lint rule mistakes for React's `use` hook.
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);

export default eslintConfig;
