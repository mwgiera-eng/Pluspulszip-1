# Temporary dependency advisory waiver

CI normally rejects every high or critical npm advisory. Expo SDK 57 currently
pulls `image-size` through Metro, and npm reports these two high-severity denial
of service advisories:

- `GHSA-w3rx-r6r6-pgpr`
- `GHSA-5p2g-fcmc-qvqq`

GitHub lists no patched `image-size` version. npm's automated remediation is an
exact forced downgrade to `expo@53.0.27`, taking this project from Expo SDK 57
to SDK 53, so it is not a safe fix. The policy accepts only that exact unsafe
downgrade proposal (or no remediation); any other proposed fix stops the build
and requires review.

The affected parser is part of Metro's Node-based build tooling. It is not an
Android runtime endpoint and the mobile application does not pass network or
user-uploaded images to it. CI also has a 15-minute timeout, limiting the impact
of a crafted repository asset to the build job.

`scripts/audit-ci.cjs` therefore accepts only the exact two advisories through
the exact, version-pinned Expo/Metro dependency closure. It still blocks:

- every critical advisory;
- any other high-severity advisory;
- a changed package or version in the waived closure;
- a newly available remediation or an unexpected install path;
- malformed or unresolved audit paths.

The exception expires on **2026-10-01**. Remove it earlier when Expo/Metro ships
a dependency graph that no longer includes an affected `image-size` release.
