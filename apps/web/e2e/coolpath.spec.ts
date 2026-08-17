import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.request.post("http://127.0.0.1:8787/api/demo/reset");
  await page.goto("/");
});

test("protects the public list during layout drift and recovers after review", async ({ page }) => {
  await expect(page.getByText("Reported by the official source").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harbour Library" })).toBeVisible();

  await page.getByRole("button", { name: "Source health" }).click();
  await page.getByRole("button", { name: /Simulate drift/ }).click();
  await expect(page.getByText("Temporarily unverifiable")).toBeVisible();
  await page.getByRole("button", { name: "Public directory" }).click();
  await expect(page.getByRole("heading", { name: "Harbour Library" })).toBeVisible();

  await page.getByRole("button", { name: "Source health" }).click();
  await page.getByRole("button", { name: /Prepare repair/ }).click();
  await expect(page.getByText("Repair needs manual approval")).toBeVisible();
  await page.getByRole("button", { name: /Approve and re-run/ }).click();
  await expect(page.getByText("Source recovered and re-verified")).toBeVisible();
});

test("opens evidence without rendering hostile HTML", async ({ page }) => {
  await page.getByRole("button", { name: "Evidence" }).first().click();
  await expect(page.getByRole("dialog", { name: "Harbour Library" })).toBeVisible();
  await expect(page.getByText("Wheelchair accessible entrance").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
