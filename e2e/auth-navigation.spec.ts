import { test, expect } from "./fixtures";

// =============================================
// Phase 1: Auth & Navigation E2E Tests
// =============================================

test.describe("Authentication", () => {
  test("unauthenticated user is redirected to login with ?next param", async ({
    page,
  }) => {
    await page.goto("/hr/users");
    await expect(page).toHaveURL(/\/login\?next=%2Fhr%2Fusers/);
  });

  test("root path redirects authenticated user to /intranet", async ({
    staffPage,
  }) => {
    await staffPage.goto("/");
    await expect(staffPage).toHaveURL(/\/intranet/);
  });

  test("login page is accessible without auth", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    // Should see the login form
    await expect(
      page.getByText("Sign in to the MCR Pathways Intranet")
    ).toBeVisible();
  });
});

test.describe("Module access control", () => {
  // Staff user (user_type: staff) should access all modules
  test("staff can access /intranet", async ({ staffPage }) => {
    await staffPage.goto("/intranet");
    await expect(staffPage).toHaveURL(/\/intranet/);
  });

  test("staff can access /hr", async ({ staffPage }) => {
    await staffPage.goto("/hr");
    await expect(staffPage).toHaveURL(/\/hr/);
  });

  test("staff can access /learning", async ({ staffPage }) => {
    await staffPage.goto("/learning");
    await expect(staffPage).toHaveURL(/\/learning/);
  });

  test("staff can access /sign-in", async ({ staffPage }) => {
    await staffPage.goto("/sign-in");
    await expect(staffPage).toHaveURL(/\/sign-in/);
  });

  // Coordinator (user_type: pathways_coordinator) can access intranet + learning only
  test("coordinator can access /intranet", async ({ coordinatorPage }) => {
    await coordinatorPage.goto("/intranet");
    await expect(coordinatorPage).toHaveURL(/\/intranet/);
  });

  test("coordinator can access /learning", async ({ coordinatorPage }) => {
    await coordinatorPage.goto("/learning");
    await expect(coordinatorPage).toHaveURL(/\/learning/);
  });

  test("coordinator is redirected from /hr to /intranet", async ({
    coordinatorPage,
  }) => {
    await coordinatorPage.goto("/hr");
    await expect(coordinatorPage).toHaveURL(/\/intranet/);
  });

  test("coordinator is redirected from /sign-in to /intranet", async ({
    coordinatorPage,
  }) => {
    await coordinatorPage.goto("/sign-in");
    await expect(coordinatorPage).toHaveURL(/\/intranet/);
  });
});

test.describe("Sidebar navigation", () => {
  test("staff sees all navigation modules", async ({ staffPage }) => {
    await staffPage.goto("/intranet");
    const sidebar = staffPage.locator("aside");
    await expect(sidebar.getByText("Intranet")).toBeVisible();
    await expect(sidebar.getByText("HR")).toBeVisible();
    await expect(sidebar.getByText("Learning")).toBeVisible();
    await expect(sidebar.getByText("Working Location")).toBeVisible();
    await expect(sidebar.getByText("Settings")).toBeVisible();
  });

  test("coordinator only sees Intranet and Learning in sidebar", async ({
    coordinatorPage,
  }) => {
    await coordinatorPage.goto("/intranet");
    const sidebar = coordinatorPage.locator("aside");
    await expect(sidebar.getByText("Intranet")).toBeVisible();
    await expect(sidebar.getByText("Learning")).toBeVisible();
    // Should NOT see staff-only modules
    await expect(sidebar.getByText("HR")).not.toBeVisible();
    await expect(sidebar.getByText("Working Location")).not.toBeVisible();
  });

  test("HR admin sees admin sub-items in HR sidebar", async ({
    hrAdminPage,
  }) => {
    await hrAdminPage.goto("/hr");
    const sidebar = hrAdminPage.locator("aside");
    // Admin section should appear
    await expect(sidebar.getByText("Admin")).toBeVisible();
    await expect(sidebar.getByText("User Management")).toBeVisible();
    await expect(sidebar.getByText("Onboarding")).toBeVisible();
    await expect(sidebar.getByText("Absence & Sickness")).toBeVisible();
  });

  test("regular staff does not see HR admin sub-items", async ({
    staffPage,
  }) => {
    await staffPage.goto("/hr");
    const sidebar = staffPage.locator("aside");
    // Regular self-service items should be visible
    await expect(sidebar.getByText("My Profile")).toBeVisible();
    await expect(sidebar.getByText("Leave")).toBeVisible();
    // Admin section should NOT be visible
    await expect(sidebar.getByText("User Management")).not.toBeVisible();
    await expect(sidebar.getByText("Onboarding")).not.toBeVisible();
  });

  test("clicking sidebar nav link navigates to module", async ({
    staffPage,
  }) => {
    await staffPage.goto("/intranet");
    const sidebar = staffPage.locator("aside");
    await sidebar.getByText("HR").click();
    await expect(staffPage).toHaveURL(/\/hr/);
  });
});
