#!/bin/bash
echo "Branch: $VERCEL_GIT_COMMIT_REF"
if [[ "$VERCEL_GIT_COMMIT_REF" == "production" ]]; then
  echo "✅ Build can proceed"
  exit 1
else
  echo "🛑 Build cancelled"
  exit 0
fi
