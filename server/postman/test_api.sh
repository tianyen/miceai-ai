#!/bin/bash

# 活動報名系統 API v1 快速測試腳本
# 用於驗證 API 功能是否正常

BASE_URL="http://localhost:3000/api/v1"
TIMESTAMP=$(date +%s)
TEST_EMAIL="test_${TIMESTAMP}@example.com"

echo "🚀 開始測試活動報名系統 API v1..."
echo "📧 測試用電子郵件: $TEST_EMAIL"
echo ""

# 1. API 健康檢查
echo "1️⃣ 測試 API 健康檢查..."
curl -s -X GET "$BASE_URL/" -H "Content-Type: application/json" | jq '.'
echo ""

# 2. 獲取活動列表
echo "2️⃣ 測試獲取活動列表..."
EVENTS_RESPONSE=$(curl -s -X GET "$BASE_URL/events" -H "Content-Type: application/json")
echo "$EVENTS_RESPONSE" | jq '.'
echo ""

# 3. 獲取特定活動詳情
echo "3️⃣ 測試獲取活動詳情 (ID: 1)..."
curl -s -X GET "$BASE_URL/events/1" -H "Content-Type: application/json" | jq '.'
echo ""

# 4. 根據代碼獲取活動
echo "4️⃣ 測試根據代碼獲取活動 (TECH2024)..."
curl -s -X GET "$BASE_URL/events/code/TECH2024" -H "Content-Type: application/json" | jq '.'
echo ""

# 5. 提交活動報名
echo "5️⃣ 測試提交活動報名..."
REGISTRATION_DATA='{
  "name": "測試腳本用戶",
  "email": "'$TEST_EMAIL'",
  "phone": "0912345678",
  "company": "測試腳本公司",
  "position": "自動化測試工程師",
  "dietary_requirements": "無特殊需求",
  "special_needs": "",
  "data_consent": true,
  "marketing_consent": false
}'

REGISTRATION_RESPONSE=$(curl -s -X POST "$BASE_URL/events/1/registrations" \
  -H "Content-Type: application/json" \
  -d "$REGISTRATION_DATA")

echo "$REGISTRATION_RESPONSE" | jq '.'

# 提取 trace_id
TRACE_ID=$(echo "$REGISTRATION_RESPONSE" | jq -r '.data.trace_id')
echo "📋 獲得 Trace ID: $TRACE_ID"
echo ""

if [ "$TRACE_ID" != "null" ] && [ "$TRACE_ID" != "" ]; then
  # 6. 獲取 QR Code Base64
  echo "6️⃣ 測試獲取 QR Code Base64..."
  QR_RESPONSE=$(curl -s -X GET "$BASE_URL/qr-codes/$TRACE_ID/data" -H "Content-Type: application/json")
  echo "$QR_RESPONSE" | jq '. | del(.data.qr_base64)' # 隱藏 Base64 數據以節省空間
  echo "✅ QR Code Base64 長度: $(echo "$QR_RESPONSE" | jq -r '.data.qr_base64' | wc -c) 字符"
  echo ""

  # 7. 查詢報名狀態
  echo "7️⃣ 測試查詢報名狀態..."
  curl -s -X GET "$BASE_URL/registrations/$TRACE_ID" -H "Content-Type: application/json" | jq '.'
  echo ""

  # 8. QR Code 報到
  echo "8️⃣ 測試 QR Code 報到..."
  CHECKIN_DATA='{
    "trace_id": "'$TRACE_ID'",
    "scanner_location": "測試入口",
    "scanner_user_id": 1
  }'

  curl -s -X POST "$BASE_URL/check-in" \
    -H "Content-Type: application/json" \
    -d "$CHECKIN_DATA" | jq '.'
  echo ""

  # 9. 查詢報到記錄
  echo "9️⃣ 測試查詢報到記錄..."
  curl -s -X GET "$BASE_URL/check-in/$TRACE_ID" -H "Content-Type: application/json" | jq '.'
  echo ""

  # 10. 創建 QR Code 名片
  echo "🔟 測試創建 QR Code 名片..."
  CARD_DATA='{
    "project_id": 1,
    "name": "測試名片用戶",
    "title": "技術總監",
    "company": "測試腳本公司",
    "phone": "0912345678",
    "email": "'$TEST_EMAIL'",
    "website": "https://example.com",
    "linkedin": "https://linkedin.com/in/test"
  }'

  CARD_RESPONSE=$(curl -s -X POST "$BASE_URL/business-cards" \
    -H "Content-Type: application/json" \
    -d "$CARD_DATA")

  echo "$CARD_RESPONSE" | jq '. | del(.data.qr_code.base64)' # 隱藏 Base64 數據

  # 提取 card_id
  CARD_ID=$(echo "$CARD_RESPONSE" | jq -r '.data.card_id')
  echo "📇 獲得 Card ID: $CARD_ID"
  echo ""

  if [ "$CARD_ID" != "null" ] && [ "$CARD_ID" != "" ]; then
    # 11. 獲取名片詳情
    echo "1️⃣1️⃣ 測試獲取名片詳情..."
    CARD_DETAIL=$(curl -s -X GET "$BASE_URL/business-cards/$CARD_ID" -H "Content-Type: application/json")
    echo "$CARD_DETAIL" | jq '. | del(.data.qr_code.base64)' # 隱藏 Base64 數據
    echo "✅ 名片 QR Code Base64 長度: $(echo "$CARD_DETAIL" | jq -r '.data.qr_code.base64' | wc -c) 字符"
    echo ""

    # 12. 獲取專案名片列表
    echo "1️⃣2️⃣ 測試獲取專案名片列表..."
    curl -s -X GET "$BASE_URL/business-cards/project/1?page=1&limit=5" -H "Content-Type: application/json" | jq '.'
    echo ""
  fi

  echo "✅ 所有測試完成！"
  echo "📋 測試用 Trace ID: $TRACE_ID"
  echo "📇 測試用 Card ID: $CARD_ID"
  echo "📧 測試用電子郵件: $TEST_EMAIL"
else
  echo "❌ 報名失敗，無法繼續後續測試"
fi

echo ""
echo "🎯 Postman 檔案位置:"
echo "   - Collection: server/postman/API_v1_Frontend_Integration.postman_collection.json"
echo "   - Environment: server/postman/API_v1_Environment.postman_environment.json"
echo "   - 說明文檔: server/postman/README.md"
echo ""
echo "📚 API 文檔:"
echo "   - Swagger UI: http://localhost:3000/api-docs"
echo "   - API 規格: server/swagger.md"
echo "   - 前端串接規格: server/spec.md"
