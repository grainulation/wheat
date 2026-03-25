/**
 * Smart defaults and environment detection for wheat CLI.
 * Zero dependencies — Node built-ins only.
 */

export const DEFAULTS = {
  audience: ["engineers"],
  constraints: [],
  doneCriteria: "Decision-ready brief with evidence",
};

export function isTTY() {
  return Boolean(process.stdout.isTTY) && !isCI();
}

export function isCI() {
  return Boolean(
    process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI ||
      process.env.JENKINS_URL ||
      process.env.BUILDKITE,
  );
}

export function outputMode() {
  if (process.argv.includes("--quiet")) return "quiet";
  if (process.argv.includes("--json")) return "json";
  if (!isTTY()) return "json";
  return "tty";
}
