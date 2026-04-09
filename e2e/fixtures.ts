import { test as base, type Page } from "@playwright/test";
import { authFile } from "./global-setup";

/**
 * Custom Playwright fixtures with pre-authenticated pages.
 *
 * Usage:
 *   import { test, expect } from "./fixtures";
 *   test("admin can view users", async ({ hrAdminPage }) => { ... });
 *   test("staff can view feed", async ({ staffPage }) => { ... });
 */

export const test = base.extend<{
  hrAdminPage: Page;
  lineManagerPage: Page;
  staffPage: Page;
  coordinatorPage: Page;
}>({
  hrAdminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: authFile("hrAdmin") });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
  lineManagerPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: authFile("lineManager"),
    });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
  staffPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: authFile("staff") });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
  coordinatorPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: authFile("coordinator"),
    });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
});

export { expect } from "@playwright/test";
