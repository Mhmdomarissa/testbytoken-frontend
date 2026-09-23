import { expect, type Page } from "@playwright/test";

/** The dev sign-in flow (magic link against the mock, "Continue (dev)" stands in for the email). */
export async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("dev@example.com");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.getByText("Continue (dev - no backend yet)").click();
  await page.waitForURL(/\/overview$/);
  await expect
    .poll(async () => (await page.context().cookies()).length)
    .toBeGreaterThan(0);
}
