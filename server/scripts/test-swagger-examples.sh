#!/bin/bash
# Swagger API 範例測試腳本
# 驗證所有 Swagger 文檔中的範例數據能正常運作

BASE_URL="http://localhost:3000"

echo "🧪 Swagger API 範例測試"
echo "======================================"
echo ""

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 測試計數器
TOTAL=0
PASSED=0
FAILED=0

# 測試函數
test_api() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    TOTAL=$((TOTAL + 1))
    echo -n "測試 $TOTAL: $name ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "   Response: $body"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "📊 1. 活動資訊 API"
echo "--------------------------------------"
test_api "查詢活動列表" "GET" "/api/v1/events"
test_api "查詢 TECH2024 活動" "GET" "/api/v1/events/code/TECH2024"
test_api "查詢活動詳情" "GET" "/api/v1/events/1"
echo ""

echo "🎮 2. 遊戲 API"
echo "--------------------------------------"
test_api "開始遊戲會話" "POST" "/api/v1/games/1/sessions/start" \
    '{"trace_id":"MICE-05207cf7-199967c04","user_id":"3","project_id":1}'

test_api "記錄遊戲日誌" "POST" "/api/v1/games/1/logs" \
    '{"trace_id":"MICE-05207cf7-199967c04","user_id":"3","project_id":1,"message":"測試日誌","log_level":"info"}'

test_api "查詢遊戲資訊" "GET" "/api/v1/games/1/info"
test_api "查詢遊戲資訊(含專案)" "GET" "/api/v1/games/1/info?project_id=1"
echo ""

echo "📋 3. 報名 API"
echo "--------------------------------------"
test_api "查詢報名狀態(王大明)" "GET" "/api/v1/registrations/MICE-05207cf7-199967c04"
test_api "查詢報名狀態(張志明)" "GET" "/api/v1/registrations/MICE-d074dd3e-e3e27b6b0"
test_api "查詢報名狀態(李美玲)" "GET" "/api/v1/registrations/MICE-d74b09c8-6cfa4a823"
echo ""

echo "🔲 4. QR Code API"
echo "--------------------------------------"
test_api "獲取 QR Code Base64(王大明)" "GET" "/api/v1/qr-codes/MICE-05207cf7-199967c04/data"
test_api "獲取 QR Code Base64(張志明)" "GET" "/api/v1/qr-codes/MICE-d074dd3e-e3e27b6b0/data"
echo ""

echo "======================================"
echo "📊 測試結果統計"
echo "======================================"
echo -e "總測試數: $TOTAL"
echo -e "${GREEN}通過: $PASSED${NC}"
echo -e "${RED}失敗: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有測試通過！${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED 個測試失敗${NC}"
    exit 1
fi

