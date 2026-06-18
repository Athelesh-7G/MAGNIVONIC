#!/bin/zsh
# Sets the Aurora secret JSON as MAGNIVONIC_AURORA_SECRET on all 10
# Magnivonic Lambda functions. Fetches the full magnivonic/aurora secret
# string from Secrets Manager and applies it as an environment variable
# alongside the standard runtime vars.
#
# The secret value is JSON (contains commas + quotes), so we build the
# --environment payload as a JSON file via python3 rather than the
# Variables={..} shorthand, which cannot represent JSON values safely.
set -e

REGION="us-east-1"

echo "Fetching magnivonic/aurora secret..."
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id magnivonic/aurora \
  --region $REGION \
  --query SecretString \
  --output text)

if [[ -z "$SECRET_JSON" ]]; then
  echo "ERROR: could not retrieve magnivonic/aurora secret value."
  exit 1
fi

FUNCTIONS=(
  magnivonic-orchestrator-agent
  magnivonic-coordinator-agent
  magnivonic-revenue-agent
  magnivonic-operations-agent
  magnivonic-customer-agent
  magnivonic-security-agent
  magnivonic-api-analyze
  magnivonic-api-risks
  magnivonic-api-customers
  magnivonic-api-health
)

ENVFILE=$(mktemp)
python3 - "$SECRET_JSON" > "$ENVFILE" <<'PY'
import json, sys
secret = sys.argv[1]
print(json.dumps({
    "Variables": {
        "LOG_LEVEL": "INFO",
        "AWS_REGION_NAME": "us-east-1",
        "EVENTBRIDGE_BUS_NAME": "magnivonic-events",
        "MAGNIVONIC_AURORA_SECRET": secret
    }
}))
PY

for FUNC_NAME in $FUNCTIONS; do
  aws lambda update-function-configuration \
    --function-name $FUNC_NAME \
    --environment "file://${ENVFILE}" \
    --region $REGION > /dev/null
  # Wait until the update settles before touching the next function
  aws lambda wait function-updated \
    --function-name $FUNC_NAME --region $REGION
  echo "✓ Aurora env set: $FUNC_NAME"
done

rm -f "$ENVFILE"

echo ""
echo "═══════════════════════════════════════"
echo "✓ MAGNIVONIC_AURORA_SECRET set on all 10 functions"
echo "═══════════════════════════════════════"
