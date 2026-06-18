#!/bin/zsh
# Lambda deployment script — builds the shared layer and deploys
# all 10 Magnivonic functions (6 agents + 4 API handlers).
set -e  # Exit on any error

REGION="us-east-1"
ACCOUNT_ID="082228066878"
ROLE_ARN="arn:aws:iam::082228066878:role/magnivonic-lambda-role"
LAYER_NAME="magnivonic-common-layer"
LOG_GROUP="/magnivonic/agents"
SCRIPT_DIR="${0:A:h}"
BACKEND_DIR="${SCRIPT_DIR}/.."

# ─── Step 1 — EventBridge bus (idempotent) ───────────────────────────
aws events create-event-bus \
  --name magnivonic-events \
  --region $REGION 2>/dev/null || \
  echo "EventBridge bus already exists — skipping"

# ─── Step 2 — CloudWatch log group (idempotent) ──────────────────────
aws logs create-log-group \
  --log-group-name $LOG_GROUP \
  --region $REGION 2>/dev/null || \
  echo "Log group already exists — skipping"

# ─── Step 3 — Build Lambda layer ─────────────────────────────────────
TMPDIR=$(mktemp -d)
mkdir -p "${TMPDIR}/python"

pip3 install psycopg2-binary boto3 requests \
  --platform manylinux2014_x86_64 \
  --python-version 3.12 \
  --only-binary=:all: \
  --target "${TMPDIR}/python" \
  --quiet

cp "${BACKEND_DIR}/layer/python/"*.py "${TMPDIR}/python/"

cd $TMPDIR && zip -r layer.zip python/ -q
echo "✓ Layer built"

LAYER_RESPONSE=$(aws lambda publish-layer-version \
  --layer-name $LAYER_NAME \
  --zip-file "fileb://${TMPDIR}/layer.zip" \
  --compatible-runtimes python3.12 \
  --region $REGION)

LAYER_ARN=$(echo $LAYER_RESPONSE | \
  python3 -c "import sys,json; \
  print(json.load(sys.stdin)['LayerVersionArn'])")
echo "✓ Layer published: $LAYER_ARN"
cd -

# ─── Step 4 — Deploy agent functions ─────────────────────────────────
AGENT_NAMES=(orchestrator coordinator revenue
             operations customer security)
AGENT_DIRS=(orchestrator coordinator revenue
            operations customer security)
AGENT_TIMEOUTS=(60 30 30 30 30 30)
AGENT_MEMORIES=(512 256 256 256 256 256)

for i in {1..${#AGENT_NAMES[@]}}; do
  FUNC_NAME="magnivonic-${AGENT_NAMES[$i]}-agent"
  HANDLER_FILE="${BACKEND_DIR}/agents/${AGENT_DIRS[$i]}/handler.py"
  FUNC_TMPDIR=$(mktemp -d)
  cp $HANDLER_FILE "${FUNC_TMPDIR}/handler.py"
  cd $FUNC_TMPDIR && zip -r func.zip handler.py -q && cd -

  if aws lambda get-function --function-name $FUNC_NAME \
       --region $REGION > /dev/null 2>&1; then
    aws lambda update-function-code \
      --function-name $FUNC_NAME \
      --zip-file "fileb://${FUNC_TMPDIR}/func.zip" \
      --region $REGION > /dev/null
  else
    aws lambda create-function \
      --function-name $FUNC_NAME \
      --runtime python3.12 \
      --role $ROLE_ARN \
      --handler handler.handler \
      --zip-file "fileb://${FUNC_TMPDIR}/func.zip" \
      --timeout ${AGENT_TIMEOUTS[$i]} \
      --memory-size ${AGENT_MEMORIES[$i]} \
      --region $REGION > /dev/null
    # Wait for the new function to become active before configuring
    aws lambda wait function-active \
      --function-name $FUNC_NAME --region $REGION
  fi

  aws lambda update-function-configuration \
    --function-name $FUNC_NAME \
    --timeout ${AGENT_TIMEOUTS[$i]} \
    --memory-size ${AGENT_MEMORIES[$i]} \
    --layers $LAYER_ARN \
    --environment "Variables={LOG_LEVEL=INFO,\
AWS_REGION_NAME=us-east-1,\
EVENTBRIDGE_BUS_NAME=magnivonic-events}" \
    --region $REGION > /dev/null
  echo "✓ Deployed: $FUNC_NAME"
  rm -rf $FUNC_TMPDIR
done

# ─── Step 5 — Deploy API functions ───────────────────────────────────
API_NAMES=(analyze risks customers health)
API_TIMEOUTS=(70 15 15 5)
API_MEMORIES=(512 256 256 128)

for i in {1..${#API_NAMES[@]}}; do
  FUNC_NAME="magnivonic-api-${API_NAMES[$i]}"
  HANDLER_FILE="${BACKEND_DIR}/api/${API_NAMES[$i]}.py"
  FUNC_TMPDIR=$(mktemp -d)
  cp $HANDLER_FILE "${FUNC_TMPDIR}/handler.py"
  cd $FUNC_TMPDIR && zip -r func.zip handler.py -q && cd -

  if aws lambda get-function --function-name $FUNC_NAME \
       --region $REGION > /dev/null 2>&1; then
    aws lambda update-function-code \
      --function-name $FUNC_NAME \
      --zip-file "fileb://${FUNC_TMPDIR}/func.zip" \
      --region $REGION > /dev/null
  else
    aws lambda create-function \
      --function-name $FUNC_NAME \
      --runtime python3.12 \
      --role $ROLE_ARN \
      --handler handler.handler \
      --zip-file "fileb://${FUNC_TMPDIR}/func.zip" \
      --timeout ${API_TIMEOUTS[$i]} \
      --memory-size ${API_MEMORIES[$i]} \
      --region $REGION > /dev/null
    aws lambda wait function-active \
      --function-name $FUNC_NAME --region $REGION
  fi

  aws lambda update-function-configuration \
    --function-name $FUNC_NAME \
    --timeout ${API_TIMEOUTS[$i]} \
    --memory-size ${API_MEMORIES[$i]} \
    --layers $LAYER_ARN \
    --environment "Variables={LOG_LEVEL=INFO,\
AWS_REGION_NAME=us-east-1,\
EVENTBRIDGE_BUS_NAME=magnivonic-events}" \
    --region $REGION > /dev/null
  echo "✓ Deployed: $FUNC_NAME"
  rm -rf $FUNC_TMPDIR
done

# ─── Step 6 — Summary ────────────────────────────────────────────────
rm -rf $TMPDIR

echo ""
echo "═══════════════════════════════════════"
echo "✓ Magnivonic deployment complete"
echo "Total functions: 10 (6 agents + 4 API)"
echo "Layer ARN: $LAYER_ARN"
echo ""
echo "Next — set Aurora connection on each Lambda:"
echo "Run: ./set_aurora_env.sh (created below)"
echo ""
echo "Test health endpoint:"
echo "aws lambda invoke --function-name \
magnivonic-api-health --payload '{}' \
--cli-binary-format raw-in-base64-out \
/tmp/health.json && cat /tmp/health.json"
echo "═══════════════════════════════════════"
