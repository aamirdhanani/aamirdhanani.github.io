// A per-build identifier appended to CSS/JS URLs (?v={{ buildId }}) so browsers
// fetch the current assets after a deploy instead of serving a stale cached
// copy. Changes every build, which is exactly what we want for correctness.
module.exports = Date.now().toString(36);
