"use strict";

const POLICY_EXPIRES_AT = "2026-10-01T00:00:00.000Z";

// Expo SDK 57 currently pulls image-size through Metro. The two advisories below
// have no patched image-size release, and npm's proposed remediation downgrades
// Expo to SDK 53. Keep this exception deliberately narrow and fail on any drift.
const ALLOWED_HIGH_ADVISORIES = new Set([
  "GHSA-5p2g-fcmc-qvqq",
  "GHSA-w3rx-r6r6-pgpr",
]);

const PINNED_WAIVER_PACKAGES = new Map([
  ["@expo/cli", "57.0.17"],
  ["@expo/metro", "56.0.0"],
  ["@expo/metro-config", "57.0.9"],
  ["expo", "57.0.15"],
  ["image-size", "1.2.1"],
  ["metro", "0.84.4"],
  ["metro-config", "0.84.4"],
  ["metro-transform-worker", "0.84.4"],
]);

function advisoryId(via) {
  const match = String(via?.url || "").match(/GHSA-[a-z0-9-]+/i);
  return match ? match[0] : null;
}

function collectHighAdvisories(name, vulnerabilities, seen = new Set()) {
  if (seen.has(name)) return { advisories: new Set(), unresolved: new Set() };
  seen.add(name);

  const entry = vulnerabilities[name];
  if (!entry) {
    return { advisories: new Set(), unresolved: new Set([name]) };
  }

  const advisories = new Set();
  const unresolved = new Set();
  for (const via of entry.via || []) {
    if (typeof via === "string") {
      const nested = collectHighAdvisories(via, vulnerabilities, seen);
      for (const item of nested.advisories) advisories.add(item);
      for (const item of nested.unresolved) unresolved.add(item);
      continue;
    }

    if (via && ["high", "critical"].includes(via.severity)) {
      const id = advisoryId(via);
      if (id) advisories.add(id);
      else unresolved.add(`${name}:missing-advisory-id`);
    }
  }

  return { advisories, unresolved };
}

function evaluateAudit(report, lockfile, now = new Date()) {
  const failures = [];
  const waived = [];
  const vulnerabilities = report?.vulnerabilities;

  if (!vulnerabilities || typeof vulnerabilities !== "object") {
    return { ok: false, failures: ["npm audit returned no vulnerability map"], waived };
  }

  const highEntries = Object.entries(vulnerabilities).filter(([, entry]) =>
    ["high", "critical"].includes(entry?.severity),
  );

  if (highEntries.length === 0) return { ok: true, failures, waived };

  if (now >= new Date(POLICY_EXPIRES_AT)) {
    failures.push(`security exception expired at ${POLICY_EXPIRES_AT}`);
  }

  const imageSize = vulnerabilities["image-size"];
  if (imageSize?.severity === "high") {
    if (imageSize.fixAvailable !== false) {
      failures.push("image-size: a remediation is now available; remove or re-review the waiver");
    }
    const nodes = Array.isArray(imageSize.nodes) ? [...imageSize.nodes].sort() : [];
    if (nodes.length !== 1 || nodes[0] !== "node_modules/image-size") {
      failures.push(`image-size: unexpected installed path (${nodes.join(", ") || "none"})`);
    }
  }

  for (const [name, entry] of highEntries) {
    if (entry.severity === "critical") {
      failures.push(`${name}: critical vulnerabilities are never waived`);
      continue;
    }

    const expectedVersion = PINNED_WAIVER_PACKAGES.get(name);
    if (!expectedVersion) {
      failures.push(`${name}: high-severity package is not in the approved Expo/Metro closure`);
      continue;
    }

    const installedVersion = lockfile?.packages?.[`node_modules/${name}`]?.version;
    if (installedVersion !== expectedVersion) {
      failures.push(
        `${name}: waiver pins ${expectedVersion}, lockfile contains ${installedVersion || "no version"}`,
      );
    }

    const { advisories, unresolved } = collectHighAdvisories(name, vulnerabilities);
    if (unresolved.size > 0) {
      failures.push(`${name}: unresolved audit dependency path (${[...unresolved].sort().join(", ")})`);
    }
    if (advisories.size === 0) {
      failures.push(`${name}: no high-severity advisory could be traced`);
    }
    for (const id of advisories) {
      if (!ALLOWED_HIGH_ADVISORIES.has(id)) {
        failures.push(`${name}: unexpected high-severity advisory ${id}`);
      }
    }

    if (
      advisories.size > 0 &&
      unresolved.size === 0 &&
      [...advisories].every((id) => ALLOWED_HIGH_ADVISORIES.has(id))
    ) {
      waived.push(`${name}@${installedVersion}`);
    }
  }

  return { ok: failures.length === 0, failures, waived: [...new Set(waived)].sort() };
}

module.exports = {
  ALLOWED_HIGH_ADVISORIES,
  PINNED_WAIVER_PACKAGES,
  POLICY_EXPIRES_AT,
  collectHighAdvisories,
  evaluateAudit,
};
