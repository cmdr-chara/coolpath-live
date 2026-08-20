import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.request.post("http://127.0.0.1:8787/api/demo/reset");
  await page.goto("/");
});

test("protects the public list during layout drift and recovers after review", async ({ page }) => {
  await expect(page.getByText("Verified public source").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harbour Library" })).toBeVisible();

  await page.getByRole("link", { name: "Technical view" }).click();
  await page.getByRole("button", { name: /Simulate drift/ }).click();
  await expect(page.getByText("Temporarily unverifiable")).toBeVisible();
  await expect(
    page.getByLabel("Quarantine branch").getByText("Candidate quarantined")
  ).toBeVisible();

  await page.getByRole("link", { name: "Public directory" }).click();
  await expect(page.getByRole("heading", { name: "Harbour Library" })).toBeVisible();
  await expect(page.getByText("Last trusted report").first()).toBeVisible();

  await page.getByRole("link", { name: "Technical view" }).click();
  await page.getByRole("button", { name: /Prepare repair/ }).click();
  await expect(page.getByText("Repair needs manual approval")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Repair only the failed fields." })).toBeVisible();

  await page.getByRole("button", { name: /Approve and re-run/ }).click();
  await expect(page.getByText("Source recovered and re-verified")).toBeVisible();
  await expect(page.getByLabel("Quarantine branch")).toHaveCount(0);
});

test("guided demo controls explain unavailable steps instead of appearing broken", async ({
  page
}) => {
  await page.getByRole("link", { name: "Technical view" }).click();
  await page.getByRole("button", { name: /Approve and re-run/ }).click();
  await expect(page.getByText(/Run Prepare repair first/)).toBeVisible();
});

test("rejecting a repair keeps the trusted snapshot and does not rerun", async ({ page }) => {
  await page.getByRole("link", { name: "Technical view" }).click();
  await page.getByRole("button", { name: /Simulate drift/ }).click();
  await page.getByRole("button", { name: /Prepare repair/ }).click();
  await expect(page.getByText("Repair needs manual approval")).toBeVisible();

  await page.getByRole("button", { name: /Reject repair/ }).click();
  await expect(page.getByText("Temporarily unverifiable")).toBeVisible();
  await expect(page.getByText(/Repair rejected\. No selector change was applied/)).toBeVisible();

  await page.getByRole("link", { name: "Public directory" }).click();
  await expect(page.getByRole("heading", { name: "Harbour Library" })).toBeVisible();
  await expect(page.getByText("Last trusted report").first()).toBeVisible();
});

test("evidence drawer traps focus, escapes safely and restores the trigger", async ({ page }) => {
  const evidenceButton = page.getByRole("button", {
    name: "View evidence for Harbour Library"
  });
  await evidenceButton.focus();
  await evidenceButton.click();

  const dialog = page.getByRole("dialog", { name: "Harbour Library" });
  await expect(dialog).toBeVisible();
  await expect(page.getByText("Wheelchair accessible entrance").first()).toBeVisible();

  await page.keyboard.press("Shift+Tab");
  await expect(dialog).toContainText("Evidence ledger");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(evidenceButton).toBeFocused();
});

test("main views are URL-backed and browser history restores the public view", async ({ page }) => {
  await page.getByRole("link", { name: "Technical view" }).click();
  await expect(page).toHaveURL(/\?view=technical$/);
  await expect(page.getByRole("link", { name: "Technical view" })).toHaveAttribute(
    "aria-current",
    "page"
  );

  await page.goBack();
  await expect(page).not.toHaveURL(/view=technical/);
  await expect(page.getByRole("link", { name: "Public directory" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByRole("heading", { name: "Location records" })).toBeVisible();
});

test("search filters only the already-published trusted snapshot", async ({ page }) => {
  const search = page.getByRole("searchbox", { name: "Search published locations" });

  await search.fill("Harbour");
  await expect(page.getByText("1 of 3 verified records match your search")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harbour Library" })).toBeVisible();

  await search.fill("no such verified location");
  await expect(page.getByText("0 of 3 verified records match your search")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No matching verified locations" })).toBeVisible();

  await search.fill("");
  await expect(page.getByText("3 verified records")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harbour Library" })).toBeVisible();
});

test("the first verified location appears within the initial mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();

  const firstLocation = page.getByRole("heading", { name: "Harbour Library" });
  await expect(firstLocation).toBeVisible();
  const bounds = await firstLocation.boundingBox();
  expect(bounds).not.toBeNull();
  expect((bounds?.y ?? 9999) + (bounds?.height ?? 0)).toBeLessThan(812);
});
