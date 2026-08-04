#!/usr/bin/env bash
set -euo pipefail

echo "Running pre-deploy security checks..."

# Fail if .replit still contains obvious secrets
if grep -i -n "TWILIO_ACCOUNT_SID\|WILIO_AUTH_TOKEN\|ADMIN_USER_ID\|replit-objstore" .replit >/dev/null 2>&1; then
  echo ".replit contains Replit-specific secrets or object storage IDs. Please remove or move to secret manager."
  exit 1
fi

# Warn if ENABLE_EXTERNAL_SIGNALS is enabled in env (CI won't have it set by default)
if [ "${ENABLE_EXTERNAL_SIGNALS:-false}" = "true" ]; then
  echo "WARNING: ENABLE_EXTERNAL_SIGNALS is true. Ensure you have legal permission to fetch external sites."
  # Do not fail by default; just warn.
fi

# Check for remaining replit.md admin email
if grep -i -n "obeydefiance@icloud.com" replit.md >/dev/null 2>&1; then
  echo "Found hard-coded admin email in replit.md — consider redacting before public deploy."
fi

echo "Pre-deploy checks completed."