#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const lockfile = require("../package-lock.json");
const { ALLOWED_HIGH_ADVISORIES, POLICY_EXPIRES_AT, evaluateAudit } = require("./audit-policy.cjs");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const audit = spawnSync(npmCommand, ["audit", "--json"], {
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
  shell: false,
});

if (audit.error) {
  console.error(`Unable to execute npm audit: ${audit.error.message}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch (error) {
  console.error("npm audit did not return valid JSON.");
  if (audit.stderr) console.error(audit.stderr.trim());
  process.exit(1);
}

const verdict = evaluateAudit(report, lockfile);
if (!verdict.ok) {
  for (const failure of verdict.failures) console.error(`AUDIT BLOCKED: ${failure}`);
  process.exit(1);
}

const counts = report.metadata?.vulnerabilities || {};
console.log(
  `npm audit reviewed: ${counts.critical || 0} critical, ${counts.high || 0} high, ` +
    `${counts.moderate || 0} moderate, ${counts.low || 0} low.`,
);

if (verdict.waived.length > 0) {
  console.warn(
    `Temporary Expo/Metro build-tool waiver (${[...ALLOWED_HIGH_ADVISORIES].join(", ")}) ` +
      `applied to ${verdict.waived.join(", ")}; expires ${POLICY_EXPIRES_AT}.`,
  );
}
