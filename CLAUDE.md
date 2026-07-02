# aamirdhanani.github.io — agent notes

This is a personal Eleventy (11ty) site deployed to GitHub Pages. Read this before building, verifying, or deploying — the deploy model has non-obvious failure modes that have silently broken production more than once.

## Deployment model (important — two-step, not one)

GitHub Pages serves the **root of the `main` branch directly** (no build step, no GitHub Actions build). The actual publish sequence is:

```
npx @11ty/eleventy      # builds src/ -> dist/
cp -r dist/* .          # copies compiled output into the repo ROOT
git add -A && git commit && git push origin main
```

Editing files in `src/` and pushing is **not enough** — nothing changes live until the build output is copied to root and pushed. `dist/` itself is also committed to the repo but is not what Pages serves; it's just an intermediate copy that happens to be tracked.

`npm run deploy` does all of this in one command, but it also runs `scripts/fetch-strava.js` first, which requires Strava API secrets (`.env`) that are **not present on most dev machines**. If `.env` is missing, use the manual sequence above instead of `npm run deploy` / `npm run build` / `npm start`.

There is also a stale `gh-pages` branch in this repo (last touched Feb 2026). It is **not** the deploy target — ignore it.

## Critical: the photography category page cannot be built correctly on a sparse checkout

`src/portfolio/photography/photography.11tydata.js` generates the category list (Automotive, City, Food, Formula 1, Nature, Still life) by `fs.readdirSync()`-scanning subdirectories that contain **only image files**. If your checkout excludes image binaries (see below), those directories aren't materialized on disk at all, so this data function silently returns an **empty category list** — and a local build will happily overwrite the live `portfolio/photography/index.html` with an empty page.

**Before deploying anything that runs a local build, verify this page wasn't clobbered:**
```
grep -c "photo-category-card" portfolio/photography/index.html   # must be 6, not 0
```
If it's 0, restore it rather than trying to rebuild it:
```
git checkout 910c61e -- portfolio/photography/index.html dist/portfolio/photography/index.html
```
(`910c61e` is a known-good commit as of 2026-07; find a more recent one if this file has legitimately changed since.)

The real fix is to move this specific build step to an environment with full image access (e.g., a GitHub Actions workflow checking out the full repo), so it's never generated from an image-less local checkout. Until that happens, treat this file as fragile on any machine using the sparse-checkout below.

## Sparse-checkout

This repo may be checked out with `git sparse-checkout` (non-cone mode) excluding image binaries (`*.jpg/.jpeg/.png/.gif/.webp/.bmp/.tiff/.heic` etc.) to save disk space:
```
git config core.sparseCheckoutCone false
git sparse-checkout set --no-cone '/*' '!*.jpg' '!*.jpeg' ... (see .git/info/sparse-checkout)
```
Effects:
- Images will 404 in any local dev server / headless browser check. **This is expected, not a bug** — don't "fix" it by deleting or rewriting image references.
- See the photography page issue above — this is the main real consequence.

## Verifying changes before committing

`npm run verify` (builds + `node scripts/verify-site.js`) loads every main route in a real headless browser (Playwright, using the system's installed Edge via `channel: "msedge"` to avoid downloading a separate Chromium) and checks for JS errors, broken same-origin resources, HTTP errors, and blank-rendered pages. It ignores image 404s and external/third-party request failures (e.g. GoatCounter analytics).

**This catches functional breakage but NOT visual breakage.** It also saves a full-page screenshot per route to `.gnhf/screenshots/*.png` — actually look at these (via the Read tool) before deciding a change is good, especially for anything touching layout, styling, or animation. A page can pass every automated check while being visually empty — this happened for real (see next section).

## Known bug pattern: don't apply `.timeline-animate` to large wrapper elements

`.timeline-animate` (in `src/assets/style.css`) is a scroll-triggered fade-in: `opacity: 0` by default, revealed via an `IntersectionObserver` with `threshold: 0.15` (see `src/assets/js/main.js`). That threshold is relative to the **target element's own size**. Applied to a small, individual item (a single timeline entry, a single card), it works correctly. Applied to a **large wrapper** containing many stacked children (e.g. a whole `.projects-list` or `.photo-grid`), the wrapper is often too tall for 15% of its own bounding box to ever be within the viewport at once — so `.visible` never gets added, and the entire section stays invisible forever. This has already caused a real, hours-long production outage across the hobbies, portfolio grid, photography, contact, fitness, and home pages. It looked like "the page is empty" with no console errors and no failed requests, so `npm run verify` reported PASS.

If you see a page that looks empty/blank despite the build succeeding and `npm run verify` passing, check for this pattern first: `grep -rn "timeline-animate" src/`. It should only ever be on small, individual, per-item elements — never on a `*-list`, `*-grid`, or other multi-item container.

## Windows-specific notes (if running agents/tooling on Windows)

- Node's `child_process.spawn("claude", ...)` fails with `ENOENT` on Windows — npm's global install creates an extensionless POSIX shim, a `.cmd`, and a `.ps1`, and `where claude` often returns the extensionless one first, so naive `.cmd`/`.bat` detection can pick the wrong one. Point tooling directly at the real `claude.exe` binary if it supports a path override (e.g. GNHF's `~/.gnhf/config.yml` → `agentPathOverride.claude`).
- `spawn(cmd, args, { shell: true })` on Windows does **not** safely quote/escape `args` — they're concatenated with plain spaces before being handed to `cmd.exe`. Multi-word prompts/JSON args get shredded. Avoid `shell: true` with complex args on Windows; spawn the real executable directly instead.
- Killing a spawned dev-server process on Windows: `child.kill()` only signals the immediate process, not the full tree if it was spawned via `shell: true` (which wraps it in `cmd.exe`). Use `taskkill /pid <pid> /T /F` to actually kill descendants — otherwise orphaned `eleventy --serve` processes accumulate indefinitely (this happened: ~24 orphaned processes piled up in one session before this was caught).

## GNHF (autonomous agent loop) notes

- GNHF auto-creates its own `gnhf/<slug>` branch from the prompt text on first run. Don't pre-create a branch with a matching name yourself — it'll try to treat it as a resume and fail with "Run directory not found."
- Resuming a run with a bare `gnhf` (no args) does **not** persist `--max-tokens`, `--max-iterations`, or `--push` from the original invocation — re-pass them explicitly every time, or the run continues with those caps effectively disabled.
- GNHF's own `npm run verify`-based self-checks are not a substitute for a human/agent actually looking at the screenshots — see the visual-verification section above.
