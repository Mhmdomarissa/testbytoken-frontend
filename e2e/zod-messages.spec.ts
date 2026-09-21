import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * The locale-trim workaround (scripts/zod-locale-trim-loader.cjs) removes
 * zod's non-English locales from the bundle. This proves, in a real
 * browser on the real bundler output, that (a) the trim is actually in
 * effect and (b) English default validation messages still render.
 */
test("zod's English messages survive the locale trim", async ({ page }) => {
  await signIn(page);
  await page.goto("/dev/zod-messages");

  await expect(page.getByTestId("wrong-type")).toHaveText(
    "Invalid input: expected string, received number",
  );
  await expect(page.getByTestId("missing-field")).toHaveText(
    "Invalid input: expected string, received undefined",
  );
  await expect(page.getByTestId("too-small")).toHaveText(
    "Too small: expected array to have >=2 items",
  );
  // The workaround is in effect: `z.locales` is not in the bundle.
  await expect(page.getByTestId("locales")).toHaveText("undefined");
});
