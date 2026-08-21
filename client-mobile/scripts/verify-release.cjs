"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repository = path.resolve(__dirname, "..", "..");
function git(args) {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
}

const branch = git(["branch", "--show-current"]);
const localHead = git(["rev-parse", "HEAD"]);
const exactGithubAndroidPush =
  process.env.GITHUB_ACTIONS === "true" &&
  process.env.GITHUB_REF_NAME === "android" &&
  process.env.GITHUB_SHA === localHead;
if (branch !== "android" && !exactGithubAndroidPush) {
  throw new Error(`Release builds must run from android; current branch is ${branch || "detached"}.`);
}

const workingTreeChanges = git(["status", "--porcelain", "--untracked-files=all"]);
if (workingTreeChanges) throw new Error("Release build blocked: commit, restore, or remove every local change first.");

for (const nativeDirectory of ["client-mobile/android", "client-mobile/ios"]) {
  if (fs.existsSync(path.join(repository, nativeDirectory))) {
    throw new Error(`Release build blocked: remove generated ${nativeDirectory} so EAS Prebuild uses the audited Expo configuration.`);
  }
  const trackedNativeFiles = git(["ls-files", nativeDirectory]);
  if (trackedNativeFiles) {
    throw new Error(`Release build blocked: ${nativeDirectory} is tracked. PlusPuls releases must use Expo CNG/Prebuild from audited config.`);
  }
}

git(["fetch", "--quiet", "origin", "android:refs/remotes/origin/android"]);
const remoteHead = git(["rev-parse", "refs/remotes/origin/android"]);
if (localHead !== remoteHead) throw new Error(`Release build blocked: local ${localHead.slice(0, 8)} is not origin/android ${remoteHead.slice(0, 8)}.`);

console.log(`Release provenance OK: android@${localHead}`);
