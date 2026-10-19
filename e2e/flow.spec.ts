import { expect, test, type Browser, type Page } from "@playwright/test";

// Full scheduling flow with two real users against the configured Supabase project.
// Requires "Confirm email" to be disabled in Supabase Auth while testing.

const stamp = Date.now();
const password = "Test-pass-123";

async function signUp(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `meetly.test.${name}.${stamp}@gmail.com`;
  await page.goto("/login");
  await page.getByRole("button", { name: "Create your account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/home");
  return { page, email, context };
}

async function shareAvailability(page: Page) {
  await page.getByRole("button", { name: /Share availability|Update availability/ }).click();
  await expect(page.getByRole("status")).toContainText("Availability saved");
}

test("host and guest schedule a meeting end to end", async ({ browser }) => {
  const host = await signUp(browser, "host");
  const bob = await signUp(browser, "bob");
  const title = `E2E sync ${stamp}`;

  // Host creates an event
  await host.page.getByRole("link", { name: "New event" }).click();
  await host.page.getByPlaceholder("Weekly team sync").fill(title);
  await host.page.getByRole("button", { name: "Every week" }).click();
  await host.page.getByRole("button", { name: "Create & invite people" }).click();
  await host.page.waitForURL(/\/events\/[0-9a-f-]{36}/);
  const eventUrl = host.page.url();
  await shareAvailability(host.page);

  // Host invites Bob by email
  await host.page.getByRole("tab", { name: /People/ }).click();
  await host.page.getByPlaceholder("Invite by email").fill(bob.email);
  await host.page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(host.page.getByRole("status")).toContainText("Invited");

  // Bob is notified (badge + list) and shares availability
  await bob.page.goto("/notifications");
  await expect(bob.page.getByText(title)).toBeVisible();
  await bob.page.getByText(title).click();
  await bob.page.waitForURL(eventUrl);
  await shareAvailability(bob.page);

  // Host sees both people on the live heatmap and proposes a time
  await host.page.getByRole("tab", { name: "Group schedule" }).click();
  await expect(host.page.getByText("2 of 2 people have shared")).toBeVisible();
  await host.page.getByRole("button", { name: /· 2\/2/ }).first().click();
  await host.page.getByRole("button", { name: "Propose this time" }).click();
  await expect(host.page.getByText("Proposed time")).toBeVisible();

  // Bob approves; the event becomes confirmed for both
  await bob.page.goto("/home");
  await expect(bob.page.getByText("Approve the time")).toBeVisible();
  await bob.page.getByText(title).click();
  await bob.page.getByRole("button", { name: "Accept" }).click();
  await expect(bob.page.getByText("Confirmed time")).toBeVisible();
  await expect(host.page.getByText("Confirmed time")).toBeVisible(); // arrives live, no reload

  // It shows up on Bob's calendar
  await bob.page.goto("/calendar");
  await bob.page.locator(".fc-next-button").click(); // events default to next week
  await expect(bob.page.locator(".fc-event", { hasText: title }).first()).toBeVisible();

  // Chat works across users
  await bob.page.goto(eventUrl.replace("/events/", "/chat/"));
  await bob.page.getByPlaceholder("Write a message…").fill("see you there");
  await bob.page.getByRole("button", { name: "Send" }).click();
  await host.page.goto(eventUrl.replace("/events/", "/chat/"));
  await expect(host.page.getByText("see you there")).toBeVisible();

  await host.context.close();
  await bob.context.close();
});
