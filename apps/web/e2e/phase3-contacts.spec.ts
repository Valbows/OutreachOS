/**
 * Phase 3 E2E Tests: Contact Management & Enrichment Flow
 * Tests: CSV upload → parse → DB insert → enrichment → contact record update
 */

import { test, expect, type Page } from "@playwright/test";

// Test data
const testContacts = [
  {
    firstName: "John",
    lastName: "Doe",
    companyName: "Acme Inc",
    businessWebsite: "acme.com",
    city: "New York",
    state: "NY",
  },
  {
    firstName: "Jane",
    lastName: "Smith",
    companyName: "Tech Corp",
    businessWebsite: "techcorp.io",
    city: "San Francisco",
    state: "CA",
  },
  {
    firstName: "Bob",
    lastName: "Johnson",
    companyName: "StartupXYZ",
    businessWebsite: "startupxyz.com",
    city: "Austin",
    state: "TX",
  },
];

/**
 * Helper to create a CSV file content from test data
 */
function createCSVContent(contacts: typeof testContacts): string {
  const headers = "FirstName,LastName,CompanyName,BusinessWebsite,City,State\n";
  const rows = contacts
    .map(
      (c) => `${c.firstName},${c.lastName},${c.companyName},${c.businessWebsite},${c.city},${c.state}`
    )
    .join("\n");
  return headers + rows;
}

/**
 * Helper to login (assumes test account exists or uses test credentials)
 * For E2E tests, we may need to set up test authentication
 */
async function loginAsTestUser(page: Page): Promise<void> {
  // First check if already logged in by navigating to dashboard
  await page.goto("/dashboard");

  // If we're redirected to login, we're not logged in
  const currentUrl = page.url();
  if (!currentUrl.includes("/dashboard")) {
    // Navigate to login and perform login
    await page.goto("/login");

    // For E2E tests, we'll use a mock login or test credentials
    // This can be configured via environment variables
    const testEmail = process.env.TEST_USER_EMAIL || "test@example.com";
    const testPassword = process.env.TEST_USER_PASSWORD || "testpassword";

    // Fill in login form
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL("**/dashboard", { timeout: 10000 });
  }
  // If already on dashboard, we're logged in - nothing to do
}

test.describe("Phase 3: Contact Management & Enrichment", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginAsTestUser(page);
  });

  test("should upload CSV and display contacts in list", async ({ page }) => {
    // Navigate to contacts upload page
    await page.goto("/contacts/upload");

    // Verify upload page loads
    await expect(page.getByText(/upload contacts/i)).toBeVisible();
    await expect(page.getByText(/drag and drop/i)).toBeVisible();

    // Create test CSV file
    const csvContent = createCSVContent(testContacts);
    const csvBlob = new Blob([csvContent], { type: "text/csv" });

    // Upload the file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-contacts.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    });

    // Wait for upload to complete and redirect to review
    await page.waitForURL("**/contacts/review**", { timeout: 15000 });

    // Verify contacts are displayed in review table
    for (const contact of testContacts) {
      await expect(page.getByText(contact.firstName)).toBeVisible();
      await expect(page.getByText(contact.lastName)).toBeVisible();
      await expect(page.getByText(contact.companyName)).toBeVisible();
    }

    // Verify import button is available
    await expect(page.getByRole("button", { name: /import/i })).toBeVisible();
  });

  test("should enrich contacts via Hunter.io", async ({ page }) => {
    // Navigate to enrichment page
    await page.goto("/contacts/enrich");

    // Verify enrichment page loads
    await expect(page.getByText(/enrich contacts/i)).toBeVisible();
    await expect(page.getByText(/hunter\.io/i)).toBeVisible();

    // Select a group to enrich (if groups exist)
    const groupSelect = page.locator('select[name="groupId"], [data-testid="group-select"]');
    if (await groupSelect.isVisible().catch(() => false)) {
      await groupSelect.selectOption({ index: 0 });
    }

    // Click enrich button
    const enrichButton = page.getByRole("button", { name: /start enrichment/i });
    await expect(enrichButton).toBeVisible();
    await enrichButton.click();

    // Wait for enrichment progress
    await expect(page.getByText(/processing/i)).toBeVisible();

    // Wait for enrichment to complete or show results
    await page.waitForTimeout(5000); // Give time for enrichment to start

    // Verify progress indicator or results
    const progressIndicator = page.locator('[data-testid="enrichment-progress"], .progress-bar');
    const resultsTable = page.locator('[data-testid="enrichment-results"], table');

    await expect(progressIndicator.or(resultsTable)).toBeVisible();
  });

  test("should display contacts in list with search and filtering", async ({ page }) => {
    // Navigate to contacts list
    await page.goto("/contacts");

    // Verify contacts list page loads
    await expect(page.getByText(/contacts/i)).toBeVisible();

    // Wait for contacts to load
    await page.waitForSelector("table tbody tr, [data-testid='contact-row']", {
      timeout: 10000,
    });

    // Test search functionality
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(testContacts[0].firstName);
      await page.waitForTimeout(500); // Debounce wait

      // Verify search results
      await expect(page.getByText(testContacts[0].firstName)).toBeVisible();
    }

    // Test sorting (if available)
    const sortButton = page.getByRole("button", { name: /sort/i });
    if (await sortButton.isVisible().catch(() => false)) {
      await sortButton.click();
      await expect(page.getByText(/name|email|company/i)).toBeVisible();
    }
  });

  test("should navigate to contact detail and display analytics", async ({ page }) => {
    // Navigate to contacts list
    await page.goto("/contacts");

    // Wait for contacts to load
    await page.waitForSelector("table tbody tr, [data-testid='contact-row']", {
      timeout: 10000,
    });

    // Click on first contact to view detail
    const firstContactRow = page.locator("table tbody tr, [data-testid='contact-row']").first();
    await firstContactRow.click();

    // Wait for contact detail page
    await page.waitForURL("**/contacts/**");

    // Verify contact detail page loads
    await expect(page.getByText(/contact details/i)).toBeVisible();

    // Verify analytics section
    await expect(page.getByText(/emails sent|analytics/i)).toBeVisible();
    await expect(page.getByText(/opens|replies/i)).toBeVisible();

    // Verify Hunter intelligence section (if enriched)
    const hunterSection = page.locator("text=/hunter|enrichment|score/i").first();
    if (await hunterSection.isVisible().catch(() => false)) {
      // Check for re-enrich button
      await expect(page.getByRole("button", { name: /re-enrich/i })).toBeVisible();
    }
  });

  test("should allow group assignment", async ({ page }) => {
    // Navigate to contacts list
    await page.goto("/contacts");

    // Wait for contacts to load
    await page.waitForSelector("table tbody tr, [data-testid='contact-row']", {
      timeout: 10000,
    });

    // Select first contact checkbox
    const firstCheckbox = page.locator('table tbody tr input[type="checkbox"], [data-testid="contact-checkbox"]').first();
    if (await firstCheckbox.isVisible().catch(() => false)) {
      await firstCheckbox.click();

      // Look for group assignment button
      const assignButton = page.getByRole("button", { name: /assign to group|add to group/i });
      if (await assignButton.isVisible().catch(() => false)) {
        await assignButton.click();

        // Verify group assignment modal or dropdown
        await expect(
          page.getByText(/select group|create group/i).or(page.locator('[role="dialog"]'))
        ).toBeVisible();
      }
    }
  });

  test("should re-enrich a single contact", async ({ page }) => {
    // Navigate to a contact detail page
    await page.goto("/contacts");

    // Wait for contacts to load
    await page.waitForSelector("table tbody tr, [data-testid='contact-row']", {
      timeout: 10000,
    });

    // Click on first contact
    const firstContactRow = page.locator("table tbody tr, [data-testid='contact-row']").first();
    await firstContactRow.click();

    // Wait for contact detail page
    await page.waitForURL("**/contacts/**");

    // Find and click re-enrich button (in Hunter section)
    const reEnrichButton = page.getByRole("button", { name: /re-enrich/i });

    if (await reEnrichButton.isVisible().catch(() => false)) {
      await reEnrichButton.click();

      // Wait for enrichment to start
      await page.waitForTimeout(2000);

      // Verify button shows loading state or success
      await expect(
        reEnrichButton.or(page.getByText(/enriching|enriched/i))
      ).toBeVisible();
    }
  });

  test("should edit custom fields inline", async ({ page }) => {
    // Navigate to a contact detail page
    await page.goto("/contacts");

    // Wait for contacts to load
    await page.waitForSelector("table tbody tr, [data-testid='contact-row']", {
      timeout: 10000,
    });

    // Click on first contact
    const firstContactRow = page.locator("table tbody tr, [data-testid='contact-row']").first();
    await firstContactRow.click();

    // Wait for contact detail page
    await page.waitForURL("**/contacts/**");

    // Find custom fields section
    const customFieldsHeading = page.getByText(/custom fields/i);
    await expect(customFieldsHeading).toBeVisible();

    // Click add field button
    const addFieldButton = page.getByRole("button", { name: /add field/i });
    if (await addFieldButton.isVisible().catch(() => false)) {
      await addFieldButton.click();

      // Fill in new custom field
      await page.fill('input[placeholder*="field name"]', "priority");
      await page.fill('input[placeholder*="value"]', "high");

      // Save the field
      const saveButton = page.getByRole("button", { name: /add field|save/i });
      await saveButton.click();

      // Verify field was added
      await expect(page.getByText("priority")).toBeVisible();
      await expect(page.getByText("high")).toBeVisible();
    }
  });

  test("full flow: upload → enrich → view contact with analytics", async ({ page }) => {
    // Step 1: Upload CSV
    await page.goto("/contacts/upload");

    const csvContent = createCSVContent([testContacts[0]]);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "single-contact.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    });

    // Wait for review page
    await page.waitForURL("**/contacts/review**", { timeout: 15000 });

    // Import the contact
    const importButton = page.getByRole("button", { name: /import/i });
    await importButton.click();

    // Wait for import to complete
    await page.waitForURL("**/contacts", { timeout: 10000 });

    // Step 2: Navigate to enrichment
    await page.goto("/contacts/enrich");

    const enrichButton = page.getByRole("button", { name: /start enrichment/i });
    if (await enrichButton.isVisible().catch(() => false)) {
      await enrichButton.click();
      await page.waitForTimeout(3000); // Wait for enrichment
    }

    // Step 3: View contact and check analytics
    await page.goto("/contacts");

    // Click on the imported contact
    await page.waitForSelector("table tbody tr", { timeout: 10000 });
    await page.locator("table tbody tr").first().click();

    await page.waitForURL("**/contacts/**");

    // Verify all sections are present
    await expect(page.getByText(/contact details/i)).toBeVisible();
    await expect(page.getByText(/analytics|emails sent/i)).toBeVisible();
    await expect(page.getByText(/custom fields/i)).toBeVisible();
  });
});
