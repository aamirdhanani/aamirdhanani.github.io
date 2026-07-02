// Smoke-test the built site in a real headless browser (Edge via Playwright).
// Catches things a plain `eleventy` build can't: JS console errors, broken
// CSS/JS asset loads, and pages that render blank.
//
// Image 404s are EXPECTED and ignored: this local checkout uses a
// sparse-checkout that excludes image binaries to save disk space.
//
// Usage: node scripts/verify-site.js
// Exit code 0 = all routes passed, 1 = one or more routes failed.

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const http = require("http");

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
    server.kill();
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

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("verify-site.js crashed:", err);
  process.exit(1);
});
