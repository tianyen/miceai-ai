#!/bin/bash

# 測試完整遊戲流程：開始 → 記錄日誌 → 結束

echo "🧪 測試完整遊戲流程"
echo ""

BASE_URL="${BASE_URL:-http://localhost:${PORT:-3000}}"
API_URL="${API_URL:-${BASE_URL%/}/api/v1}"

TRACE_ID="MICE-test-$(date +%s)"
echo "📝 使用 Trace ID: $TRACE_ID"
echo ""

# 步驟 1: 開始遊戲
echo "📊 步驟 1: 開始遊戲會話"
START_RESPONSE=$(curl -s -X POST "$API_URL/games/1/sessions/start" \
  -H "Content-Type: application/json" \
  -d "{
    \"trace_id\": \"$TRACE_ID\",
    \"user_id\": \"3\",
    \"project_id\": 1
  }")

echo "$START_RESPONSE" | jq .

SESSION_ID=$(echo "$START_RESPONSE" | jq -r '.data.session_id')
echo "✅ 會話 ID: $SESSION_ID"
echo ""
echo "---"
echo ""

# 等待 2 秒
sleep 2

# 步驟 2: 記錄遊戲日誌
echo "📊 步驟 2: 記錄遊戲日誌"
curl -s -X POST "$API_URL/games/1/logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"trace_id\": \"$TRACE_ID\",
    \"project_id\": 1,
    \"log_level\": \"info\",
    \"message\": \"玩家得分 500\",
    \"score\": 500,
    \"action\": \"score_update\"
  }" | jq .

echo ""
echo "---"
echo ""

# 等待 2 秒
sleep 2

# 步驟 3: 結束遊戲
echo "📊 步驟 3: 結束遊戲會話"
curl -s -X POST "$API_URL/games/1/sessions/end" \
  -H "Content-Type: application/json" \
  -d "{
    \"trace_id\": \"$TRACE_ID\",
    \"user_id\": \"3\",
    \"project_id\": 1,
    \"final_score\": 850,
    \"total_play_time\": 45
  }" | jq .

echo ""
echo "---"
echo ""
echo "✅ 測試完成！"
