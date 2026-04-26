import { test as base, expect, type Page, type APIResponse } from "@playwright/test";

/**
 * Extended test fixture with authentication helpers
 */
export type TestFixtures = {
  authenticatedPage: Page;
  apiRequest: {
    post: (url: string, data: unknown) => Promise<APIResponse>;
    get: (url: string) => Promise<APIResponse>;
    delete: (url: string) => Promise<APIResponse>;
  };
};

export const test = base.extend<TestFixtures>({
  // Provide authenticated page context
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "./apps/web/e2e/.auth/user.json",
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // API request helper with authentication – inherits storage state from authenticatedPage
  apiRequest: async ({ authenticatedPage, playwright }, use) => {
    const storageState = await authenticatedPage.context().storageState();
    const requestContext = await playwright.request.newContext({
      storageState,
    });
    const api = {
      post: async (url: string, data: unknown) => {
        return requestContext.post(url, {
          data,
          headers: {
            "Content-Type": "application/json",
          },
        });
      },
      get: async (url: string) => {
        return requestContext.get(url);
      },
      delete: async (url: string) => {
        return requestContext.delete(url);
      },
    };
    await use(api);
    await requestContext.dispose();
  },
});

export { expect };
