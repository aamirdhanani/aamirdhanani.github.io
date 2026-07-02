// Smoke-test the built site in a real headless browser (Edge via Playwright).
// Catches things a plain `eleventy` build can't: JS console errors, broken
// CSS/JS asset loads, and pages that render blank. Also saves a full-page
// screenshot per route to .gnhf/screenshots/ so an agent (or a human) can
// visually review the actual rendered result, not just the pass/fail text —
// this catches "it works but looks wrong" issues the checks below can't.
//
// Image 404s are EXPECTED and ignored: this local checkout uses a
// sparse-checkout that excludes image binaries to save disk space.
//
// Usage: node scripts/verify-site.js
// Exit code 0 = all routes passed, 1 = one or more routes failed.

const { chromium } = require("playwright");
const { spawn, execFile } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8099;
const BASE = `http://localhost:${PORT}`;
const ROUTES = [
  "/",
  "/contact/",
  "/fitness/",
  "/travel/",
  "/hobbies/",
  "/journal/",
  "/portfolio/",
  "/portfolio/projects/",
  "/portfolio/racing/",
  "/portfolio/photography/",
];

const SCREENSHOT_DIR = path.join(__dirname, "..", ".gnhf", "screenshots");

function killTree(pid) {
  // On Windows, child.kill() only signals the immediate shell process, not
  // the actual npx/node process it spawned underneath (shell: true creates
  // a cmd.exe wrapper). That leaves orphaned `eleventy --serve` processes
  // running indefinitely. taskkill /T kills the whole process tree.
  if (process.platform === "win32") {
    execFile("taskkill", ["/pid", String(pid), "/T", "/F"], () => {});
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {}
  }
}

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|tiff|heic|avif|ico)(\?.*)?$/i;

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) reject(new Error("server did not start in time"));
          else setTimeout(tryOnce, 300);
        });
    };
    tryOnce();
  });
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const server = spawn(
    "npx",
    ["@11ty/eleventy", "--serve", `--port=${PORT}`, "--quiet"],
    { shell: true, stdio: "ignore" }
  );

  const results = [];
  try {
    await waitForServer(BASE);

    const browser = await chromium.launch({
      channel: "msedge",
      headless: true,
    });
    const page = await browser.newPage();

    const isSameOrigin = (url) => url.startsWith(BASE);
    const isIgnorable = (url) => !isSameOrigin(url) || IMAGE_EXT.test(url);

    for (const route of ROUTES) {
      const issues = [];
      const jsErrors = [];
      const badResponses = [];
      const failedRequests = [];

      const onPageError = (err) => jsErrors.push(String(err.message || err));
      const onResponse = (res) => {
        if (res.status() >= 400 && !isIgnorable(res.url())) badResponses.push(`${res.status()} ${res.url()}`);
      };
      const onRequestFailed = (req) => {
        if (!isIgnorable(req.url())) failedRequests.push(req.url());
      };

      page.on("pageerror", onPageError);
      page.on("response", onResponse);
      page.on("requestfailed", onRequestFailed);

      try {
        const resp = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 15000 });
        if (!resp || resp.status() >= 400) {
          issues.push(`HTTP ${resp ? resp.status() : "no response"} loading the page itself`);
        }

        const title = await page.title();
        if (!title || !title.trim()) issues.push("empty <title>");

        const bodyText = await page.evaluate(() => document.body.innerText.trim());
        if (!bodyText) issues.push("page body rendered blank");

        if (jsErrors.length) issues.push(`uncaught JS errors: ${jsErrors.join(" | ")}`);
        if (badResponses.length) issues.push(`broken same-origin resources: ${badResponses.join(", ")}`);
        if (failedRequests.length) issues.push(`failed same-origin requests: ${failedRequests.join(", ")}`);

        const slug = route === "/" ? "home" : route.replace(/^\/|\/$/g, "").replace(/\//g, "_");
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${slug}.png`), fullPage: true });
      } catch (err) {
        issues.push(`navigation error: ${err.message}`);
      }

      page.off("pageerror", onPageError);
      page.off("response", onResponse);
      page.off("requestfailed", onRequestFailed);

      results.push({ route, issues });
    }

    await browser.close();
  } finally {
    killTree(server.pid);
  }

  let failed = false;
  for (const { route, issues } of results) {
    if (issues.length) {
      failed = true;
      console.log(`FAIL ${route}`);
      for (const issue of issues) console.log(`  - ${issue}`);
    } else {
      console.log(`PASS ${route}`);
    }
  }
  console.log(`\nScreenshots saved to ${SCREENSHOT_DIR} for visual review.`);

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("verify-site.js crashed:", err);
  process.exit(1);
});
