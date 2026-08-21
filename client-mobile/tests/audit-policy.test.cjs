"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  PINNED_WAIVER_PACKAGES,
  evaluateAudit,
} = require("../scripts/audit-policy.cjs");

function lockfile() {
  return {
    packages: Object.fromEntries(
      [...PINNED_WAIVER_PACKAGES].map(([name, version]) => [
        `node_modules/${name}`,
        { version },
      ]),
    ),
  };
}

function allowedReport() {
  return {
    vulnerabilities: {
      "image-size": {
        severity: "high",
        fixAvailable: { name: "expo", version: "53.0.27", isSemVerMajor: true },
        nodes: ["node_modules/image-size"],
        via: [
          { severity: "high", url: "https://github.com/advisories/GHSA-w3rx-r6r6-pgpr" },
          { severity: "high", url: "https://github.com/advisories/GHSA-5p2g-fcmc-qvqq" },
        ],
      },
      metro: { severity: "high", via: ["image-size"] },
    },
  };
}

test("accepts only the pinned Expo/Metro advisory closure before expiry", () => {
  const verdict = evaluateAudit(allowedReport(), lockfile(), new Date("2026-08-21T00:00:00Z"));
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.failures, []);
});

test("also accepts no remediation for the unpatched parser", () => {
  const report = allowedReport();
  report.vulnerabilities["image-size"].fixAvailable = false;
  const verdict = evaluateAudit(report, lockfile(), new Date("2026-08-21T00:00:00Z"));
  assert.equal(verdict.ok, true);
});

test("rejects an unrelated high-severity advisory", () => {
  const report = allowedReport();
  report.vulnerabilities.other = {
    severity: "high",
    via: [{ severity: "high", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc" }],
  };
  const verdict = evaluateAudit(report, lockfile(), new Date("2026-08-21T00:00:00Z"));
  assert.equal(verdict.ok, false);
  assert.match(verdict.failures.join("\n"), /not in the approved/);
});

test("rejects critical findings even inside the approved package closure", () => {
  const report = allowedReport();
  report.vulnerabilities.metro = { severity: "critical", via: ["image-size"] };
  const verdict = evaluateAudit(report, lockfile(), new Date("2026-08-21T00:00:00Z"));
  assert.equal(verdict.ok, false);
  assert.match(verdict.failures.join("\n"), /never waived/);
});

test("rejects lockfile drift", () => {
  const changedLock = lockfile();
  changedLock.packages["node_modules/image-size"].version = "2.0.2";
  const verdict = evaluateAudit(allowedReport(), changedLock, new Date("2026-08-21T00:00:00Z"));
  assert.equal(verdict.ok, false);
  assert.match(verdict.failures.join("\n"), /waiver pins/);
});

test("rejects the waiver when npm reports a remediation", () => {
  const report = allowedReport();
  report.vulnerabilities["image-size"].fixAvailable = {
    name: "image-size",
    version: "2.0.3",
    isSemVerMajor: true,
  };
  const verdict = evaluateAudit(report, lockfile(), new Date("2026-08-21T00:00:00Z"));
  assert.equal(verdict.ok, false);
  assert.match(verdict.failures.join("\n"), /remediation is now available/);
});

test("rejects a boolean npm remediation signal", () => {
  const report = allowedReport();
  report.vulnerabilities["image-size"].fixAvailable = true;
  const verdict = evaluateAudit(report, lockfile(), new Date("2026-08-21T00:00:00Z"));
  assert.equal(verdict.ok, false);
  assert.match(verdict.failures.join("\n"), /remediation is now available/);
});

test("rejects image-size path drift", () => {
  const report = allowedReport();
  report.vulnerabilities["image-size"].nodes.push("node_modules/other/image-size");
  const verdict = evaluateAudit(report, lockfile(), new Date("2026-08-21T00:00:00Z"));
  assert.equal(verdict.ok, false);
  assert.match(verdict.failures.join("\n"), /unexpected installed path/);
});

test("rejects the waiver after its expiry date", () => {
  const verdict = evaluateAudit(allowedReport(), lockfile(), new Date("2026-10-01T00:00:00Z"));
  assert.equal(verdict.ok, false);
  assert.match(verdict.failures.join("\n"), /exception expired/);
});

test("passes without a waiver when npm reports no high or critical finding", () => {
  const verdict = evaluateAudit(
    { vulnerabilities: { uuid: { severity: "moderate", via: [] } } },
    {},
    new Date("2027-01-01T00:00:00Z"),
  );
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.waived, []);
});
