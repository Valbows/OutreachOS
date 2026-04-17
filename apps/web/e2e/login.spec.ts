import { test, expect } from "@playwright/test";

test.describe("Login Flow", () => {
  test("should login with valid credentials", async ({ page }) => {
    // Navigate to login page
    await page.goto("http://localhost:3000/login");
    
    // Wait for the login form to be visible
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    
    // Fill in credentials
    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByLabel(/password/i).fill("password123");
    
    // Click sign in button
    await page.getByRole("button", { name: /sign in/i }).click();
    
    // Wait for navigation away from /login (successful login → dashboard).
    // App redirects "/" → "/contacts" so accept either the root or any dashboard route.
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // Verify we're logged in by checking for dashboard content
    await expect(page.getByText(/welcome|dashboard|contacts|campaigns/i).first()).toBeVisible();
  });

  test("should show error with invalid credentials", async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    
    await page.getByLabel(/email/i).fill("wrong@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();
    
    // Should show error message
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    
    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });
});
