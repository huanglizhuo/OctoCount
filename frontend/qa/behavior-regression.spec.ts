import { expect, test } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:5173";

function reportFor(repoUrl: string, code: number, options = { ignoredDirs: [], ignoredLanguages: [], profile: "default", includeDocs: false, includeTests: false, includeGenerated: false }) {
  const [, owner = "owner", repo = "repo"] = new URL(repoUrl).pathname.split("/");
  return {
    id: `${owner}-${repo}-${code}`,
    repository: { owner, name: repo, htmlUrl: repoUrl, provider: "github" },
    refName: "main",
    commitSha: "abcdef1234567890abcdef1234567890abcdef12",
    generatedAt: "2026-09-08T01:02:03.000Z",
    durationMs: 12,
    cached: true,
    tokeiVersion: "tokei-12.1",
    analysisKey: `key-${code}`,
    analysisOptions: options,
    languages: [{ name: "TypeScript", stats: { files: 1, lines: code, code, comments: 0, blanks: 0 }, children: [] }],
    total: { files: 1, lines: code, code, comments: 0, blanks: 0 },
  };
}

test.describe("analysis behavior regressions", () => {
  test("a late analysis result cannot replace the newer request", async ({ page }) => {
    await page.addInitScript(() => {
      const nativeFetch = window.fetch.bind(window);
      window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => nativeFetch(input, init ? { ...init, signal: undefined } : init)) as typeof window.fetch;
    });
    await page.route("**/api/analyze", async (route) => {
      const request = route.request().postDataJSON() as { repoUrl: string };
      const isOld = request.repoUrl.includes("old-repo");
      if (isOld) await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ json: { kind: "cached", reportId: isOld ? "old" : "new", report: reportFor(request.repoUrl, isOld ? 111 : 222) } });
    });
    await page.goto(BASE_URL);
    const repo = page.locator("#repo-url");
    await repo.fill("https://github.com/example/old-repo");
    await page.getByRole("button", { name: "Analyze" }).click();
    await repo.fill("https://github.com/example/new-repo");
    // The regular button is correctly disabled while the first request is in
    // flight. Submit the same form programmatically to model a second caller
    // (sample/recent/retry) and exercise the operation-id guard.
    await page.locator(".input-row").evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.locator(".runner-repo")).toHaveText("example/new-repo");
    await page.waitForTimeout(350);
    await expect(page.locator(".runner-repo")).toHaveText("example/new-repo");
    await expect(page.locator(".summary .cell.accent .val")).toContainText("222");
  });

  test("homepage suggests main while explicit and blank ref choices survive URL edits", async ({ page }) => {
    const requests: Array<{ repoUrl: string; refName?: string }> = [];
    await page.route("**/api/analyze", async (route) => {
      const request = route.request().postDataJSON() as { repoUrl: string; refName?: string };
      requests.push(request);
      await route.fulfill({ json: { kind: "cached", reportId: "main", report: reportFor(request.repoUrl, 100) } });
    });
    await page.goto(BASE_URL);
    const repo = page.locator("#repo-url");
    const ref = page.locator("#repo-ref");
    await expect(ref).toHaveValue("main");
    await page.getByRole("button", { name: "Analyze" }).click();
    await expect.poll(() => requests.some((request) => request.repoUrl.includes("huanglizhuo/OctoCounts") && request.refName === "main")).toBe(true);
    await ref.fill("release");
    await page.getByRole("button", { name: "Analyze" }).click();
    await expect.poll(() => requests.some((request) => request.repoUrl.includes("huanglizhuo/OctoCounts") && request.refName === "release")).toBe(true);

    await repo.fill("https://github.com/example/plain-repo");
    await expect(ref).toHaveValue("release");
    await ref.fill("develop");
    await repo.fill("https://github.com/example/tree-repo/tree/release");
    await expect(ref).toHaveValue("develop");
    await repo.fill("https://github.com/example/tree-repo/tree/develop/src");
    await expect(ref).toHaveValue("develop");
    await ref.fill("");
    await repo.fill("https://github.com/example/default-branch-repo/tree/release");
    await expect(ref).toHaveValue("");
    await repo.fill("https://github.com/example/default-branch-repo/tree/develop/src");
    await expect(ref).toHaveValue("");

    await page.goto(BASE_URL);
    await page.locator("#repo-url").fill("https://github.com/example/tree-repo/tree/release");
    await expect(page.locator("#repo-ref")).toHaveValue("release");
  });

  test("CSV draft is preserved and the completed share URL pins custom options", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("denied")) } });
      document.execCommand = () => false;
    });
    let received: Record<string, unknown> | null = null;
    await page.route("**/api/analyze", async (route) => {
      received = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ json: { kind: "cached", reportId: "custom", report: reportFor("https://github.com/example/custom", 333, (received!.options as any)) } });
    });
    await page.goto(BASE_URL);
    await page.locator(".analysis-options summary").click();
    const ignored = page.locator('input[name="ignoredDirs"]');
    await ignored.fill("");
    await ignored.pressSequentially("examples, fixtures");
    await expect(ignored).toHaveValue("examples, fixtures");
    await page.locator("#repo-url").fill("https://github.com/example/custom");
    await page.getByRole("button", { name: "Analyze" }).click();
    await expect.poll(() => (received?.options as { ignoredDirs?: string[] } | undefined)?.ignoredDirs).toEqual(["examples", "fixtures"]);
    await page.locator("button").filter({ hasText: "report URL" }).click();
    await expect(page.locator(".manual-copy")).toHaveValue(/analysis=/);
  });

  test("a snapshot URL restores its analysis options before the first request", async ({ page }) => {
    let received: Record<string, unknown> | null = null;
    await page.route("**/api/analyze", async (route) => {
      received = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ json: { kind: "cached", reportId: "snapshot", report: reportFor("https://github.com/example/snapshot", 444, received!.options as any) } });
    });
    const options = encodeURIComponent(JSON.stringify({ ignoredDirs: ["generated"], ignoredLanguages: ["Markdown"], profile: "source-only", includeDocs: false, includeTests: true, includeGenerated: false }));
    await page.goto(`${BASE_URL}/github/example/snapshot/commit/abcdef1234567890abcdef1234567890abcdef12?analysis=${options}`);
    await expect(page.locator("#repo-ref")).toHaveValue("abcdef1234567890abcdef1234567890abcdef12");
    await expect.poll(() => received?.options).toMatchObject({ ignoredDirs: ["generated"], ignoredLanguages: ["Markdown"], profile: "source-only", includeTests: true });
  });

  test("clipboard denial leaves a real manually selectable URL", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("denied")) } });
      document.execCommand = () => false;
    });
    await page.goto(BASE_URL);
    await page.locator("button").filter({ hasText: "report URL" }).click();
    const manual = page.locator(".manual-copy");
    await expect(manual).toBeVisible();
    await expect(manual).toHaveValue(/\/github\/huanglizhuo\/OctoCounts\/commit\//);
  });

  test("a timed-out POST releases the UI and ignores its late response", async ({ page }) => {
    await page.addInitScript(() => {
      const nativeSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = ((callback: TimerHandler, timeout?: number, ...args: any[]) => nativeSetTimeout(callback, timeout === 120_000 ? 25 : timeout, ...args)) as typeof window.setTimeout;
      const nativeFetch = window.fetch.bind(window);
      window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => nativeFetch(input, init ? { ...init, signal: undefined } : init)) as typeof window.fetch;
    });
    await page.route("**/api/analyze", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({ json: { kind: "cached", reportId: "late", report: reportFor("https://github.com/example/late", 999) } });
    });
    await page.goto(BASE_URL);
    await page.locator("#repo-url").fill("https://github.com/example/late");
    await page.getByRole("button", { name: "Analyze" }).click();
    await expect(page.getByRole("heading", { name: "The analysis is taking too long." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Analyze" })).toBeEnabled();
    await page.waitForTimeout(130);
    await expect(page.locator(".runner-repo")).toHaveCount(0);
  });

  test("the final short public-report page does not expose a next link", async ({ page }) => {
    await page.route("**/api/seo/popular?limit=36&page=2", (route) => route.fulfill({ json: {
      page: 2, limit: 36, reports: [{ provider: "github", owner: "example", repo: "last", repoFullName: "example/last", htmlUrl: "https://github.com/example/last", publicPath: "/github/example/last", generatedAt: "2026-09-08", refName: "main", total: { code: 2 } }],
    } }));
    await page.goto(`${BASE_URL}/popular?page=2`);
    await expect(page.locator(".growth-repo-card")).toHaveCount(1);
    await expect(page.locator('.list-pagination a[href="?page=3"]')).toHaveCount(0);
  });

  test("topbar menus are mutually exclusive and restore focus after Escape", async ({ page }) => {
    await page.goto(BASE_URL);
    const explore = page.locator("details.topbar-menu").filter({ hasText: "Explore" });
    const tools = page.locator("details.topbar-menu").filter({ hasText: "Tools" });
    await explore.locator("summary").click();
    await expect(explore).toHaveAttribute("open", "");
    await tools.locator("summary").click();
    await expect(tools).toHaveAttribute("open", "");
    await expect(explore).not.toHaveAttribute("open", "");
    const pathnameBeforeOutsideClick = new URL(page.url()).pathname;
    await page.locator(".lang-btn").first().click();
    await expect(tools).not.toHaveAttribute("open", "");
    expect(new URL(page.url()).pathname).toBe(pathnameBeforeOutsideClick);
    await explore.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(explore).toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(explore).not.toHaveAttribute("open", "");
    await expect(explore.locator("summary")).toBeFocused();
  });

  test("landing anchors reveal the extension guide and its install action", async ({ page }) => {
    await page.goto(`${BASE_URL}/#extension`);
    const heading = page.locator("#extension .section-h");
    await expect.poll(() => heading.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
    })).toBe(true);
    const install = page.locator("#extension a.btn.install-btn");
    await expect(install).toBeVisible();
    await expect(install).toHaveAttribute("href", /chromewebstore\.google\.com/);
  });

  test("the compact extension guide immediately follows Runner without deferred blank space", async ({ page }) => {
    await page.goto(BASE_URL);
    const extension = page.locator("#extension");
    const runner = page.getByRole("heading", { name: "Runner" }).locator("..").locator("..");
    await expect(extension).toBeVisible();
    expect(await runner.evaluate((node) => node.nextElementSibling?.id)).toBe("extension");
    const intrinsicSize = await page.locator(".deferred-slot").first().evaluate((node) => getComputedStyle(node).containIntrinsicBlockSize);
    expect(intrinsicSize).not.toContain("640px");
  });

  test("history endpoint provides keyboard-readable chart data", async ({ page }) => {
    await page.route("**/api/seo/repo-history?*", (route) => route.fulfill({ json: {
      provider: "github", owner: "huanglizhuo", repo: "OctoCounts", currentStars: 0, starPoints: [], slocPoints: [{ date: "2026-01-01", totalLines: 100 }, { date: "2026-09-08", totalLines: 200 }], slocBackfillInProgress: false, starBackfillAvailable: false, starBackfillInProgress: false,
    } }));
    await page.goto(BASE_URL);
    await expect(page.locator(".repo-history")).toBeVisible();
    await page.locator(".repo-history-chart svg").focus();
    await page.keyboard.press("End");
    await expect(page.locator(".repo-history-tooltip")).toContainText("200");
    await page.locator(".repo-history-data summary").click();
    await expect(page.locator(".repo-history-data tbody tr")).toHaveCount(2);
  });
});
