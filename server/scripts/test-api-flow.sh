#!/bin/bash

# 測試完整 API 流程
# 此腳本測試從活動查詢到報名、QR Code 生成的完整流程

echo "🧪 開始測試 API 完整流程..."
echo ""

BASE_URL="http://localhost:3000/api/v1"

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 測試 1: 獲取活動列表
echo -e "${BLUE}📝 測試 1: 獲取活動列表${NC}"
echo "GET $BASE_URL/events"
RESPONSE=$(curl -s "$BASE_URL/events")
echo "$RESPONSE" | jq '.'
if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo -e "${GREEN}✅ 測試通過${NC}\n"
    # 提取第一個活動的 ID
    EVENT_ID=$(echo "$RESPONSE" | jq -r '.data.events[0].id')
    EVENT_CODE=$(echo "$RESPONSE" | jq -r '.data.events[0].code')
    echo "   活動 ID: $EVENT_ID"
    echo "   活動代碼: $EVENT_CODE"
else
    echo -e "${RED}❌ 測試失敗${NC}\n"
    exit 1
fi
echo ""

# 測試 2: 獲取特定活動信息
echo -e "${BLUE}📝 測試 2: 獲取特定活動信息${NC}"
echo "GET $BASE_URL/events/$EVENT_ID"
RESPONSE=$(curl -s "$BASE_URL/events/$EVENT_ID")
echo "$RESPONSE" | jq '.'
if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo -e "${GREEN}✅ 測試通過${NC}\n"
else
    echo -e "${RED}❌ 測試失敗${NC}\n"
    exit 1
fi
echo ""

# 測試 3: 提交活動報名
echo -e "${BLUE}📝 測試 3: 提交活動報名${NC}"
echo "POST $BASE_URL/events/$EVENT_ID/registrations"
REGISTRATION_DATA='{
  "name": "測試用戶",
  "email": "test@example.com",
  "phone": "0912345678",
  "company": "測試公司",
  "position": "測試工程師",
  "dietary_requirements": "無",
  "special_needs": "無",
  "data_consent": true,
  "marketing_consent": true
}'
echo "請求數據:"
echo "$REGISTRATION_DATA" | jq '.'
RESPONSE=$(curl -s -X POST "$BASE_URL/events/$EVENT_ID/registrations" \
  -H "Content-Type: application/json" \
  -d "$REGISTRATION_DATA")
echo "回應:"
echo "$RESPONSE" | jq '.'
if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo -e "${GREEN}✅ 測試通過${NC}\n"
    # 提取 trace_id
    TRACE_ID=$(echo "$RESPONSE" | jq -r '.data.trace_id')
    echo "   Trace ID: $TRACE_ID"
else
    echo -e "${RED}❌ 測試失敗${NC}\n"
    exit 1
fi
echo ""

# 測試 4: 查詢報名狀態
echo -e "${BLUE}📝 測試 4: 查詢報名狀態${NC}"
echo "GET $BASE_URL/registrations/$TRACE_ID"
RESPONSE=$(curl -s "$BASE_URL/registrations/$TRACE_ID")
echo "$RESPONSE" | jq '.'
if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo -e "${GREEN}✅ 測試通過${NC}\n"
else
    echo -e "${RED}❌ 測試失敗${NC}\n"
    exit 1
fi
echo ""

# 測試 5: 獲取 QR Code 數據（包含 Base64）
echo -e "${BLUE}📝 測試 5: 獲取 QR Code 數據（Base64）${NC}"
echo "GET $BASE_URL/qr-codes/$TRACE_ID/data"
RESPONSE=$(curl -s "$BASE_URL/qr-codes/$TRACE_ID/data")
echo "$RESPONSE" | jq 'del(.data.qr_base64)' # 不顯示完整的 Base64 以節省空間
if echo "$RESPONSE" | jq -e '.success == true and .data.qr_base64 != null' > /dev/null; then
    echo -e "${GREEN}✅ 測試通過 - QR Code Base64 已生成${NC}\n"
    QR_BASE64_LENGTH=$(echo "$RESPONSE" | jq -r '.data.qr_base64 | length')
    echo "   QR Code Base64 長度: $QR_BASE64_LENGTH 字符"
else
    echo -e "${RED}❌ 測試失敗 - QR Code Base64 未生成${NC}\n"
    exit 1
fi
echo ""

# 測試 6: 獲取 QR Code 圖片
echo -e "${BLUE}📝 測試 6: 獲取 QR Code 圖片${NC}"
echo "GET $BASE_URL/qr-codes/$TRACE_ID"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/qr-codes/$TRACE_ID")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ 測試通過 - QR Code 圖片可訪問 (HTTP $HTTP_CODE)${NC}\n"
else
    echo -e "${RED}❌ 測試失敗 - HTTP $HTTP_CODE${NC}\n"
    exit 1
fi
echo ""

# 測試 7: 測試 API 版本信息
echo -e "${BLUE}📝 測試 7: API 版本信息${NC}"
echo "GET $BASE_URL/"
RESPONSE=$(curl -s "$BASE_URL/")
echo "$RESPONSE" | jq '.'
if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo -e "${GREEN}✅ 測試通過${NC}\n"
else
    echo -e "${RED}❌ 測試失敗${NC}\n"
    exit 1
fi
echo ""

# 測試 8: 測試健康檢查
echo -e "${BLUE}📝 測試 8: 健康檢查${NC}"
echo "GET $BASE_URL/health"
RESPONSE=$(curl -s "$BASE_URL/health")
echo "$RESPONSE" | jq '.'
if echo "$RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo -e "${GREEN}✅ 測試通過${NC}\n"
else
    echo -e "${RED}❌ 測試失敗${NC}\n"
    exit 1
fi
echo ""

echo "🎉 所有 API 測試通過！"
echo ""
echo "📊 測試摘要:"
echo "   ✅ 活動列表查詢"
echo "   ✅ 活動詳情查詢"
echo "   ✅ 活動報名提交"
echo "   ✅ 報名狀態查詢"
echo "   ✅ QR Code Base64 獲取"
echo "   ✅ QR Code 圖片獲取"
echo "   ✅ API 版本信息"
echo "   ✅ 健康檢查"
echo ""
echo "✅ 系統運行正常，所有功能可用！"

