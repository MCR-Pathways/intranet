import { test, expect } from "./fixtures";

test.describe("Smoke tests", () => {
  test("HR admin can access the intranet", async ({ hrAdminPage }) => {
    await hrAdminPage.goto("/intranet");
    await expect(hrAdminPage).toHaveURL(/\/intranet/);
    // Should see something on the page (not redirected to login)
    await expect(
      hrAdminPage.locator("body").first()
    ).not.toContainText("Sign in");
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/intranet");
    await expect(page).toHaveURL(/\/login/);
  });
});
