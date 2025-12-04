#!/bin/bash
# 一鍵驗證所有系統功能
# 執行方式: npm run verify

echo "🧪 開始系統完整性驗證..."
echo "================================"
echo ""

# 設定顏色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 計數器
TOTAL=0
PASSED=0
FAILED=0

# 測試函數
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo "📋 執行: $test_name"
    echo "---"
    
    TOTAL=$((TOTAL + 1))
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ $test_name - 通過${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ $test_name - 失敗${NC}"
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
}

# 1. API v1 端點測試
run_test "API v1 端點測試" "node scripts/test-api-v1-endpoints.js"

# 2. 資料流程檢查
run_test "資料流程檢查" "node scripts/check-data-flow.js"

# 3. 完整業務流程測試
run_test "完整業務流程測試" "node scripts/test-full-workflow.js"

# 4. 後台資料顯示檢查
run_test "後台資料顯示檢查" "node scripts/check-admin-data.js"

# 5. 團體報名流程測試
run_test "團體報名流程測試" "EVENT_ID=2 node scripts/verify-batch-registration.js"

# 顯示總結
echo "================================"
echo "📊 驗證結果總結"
echo "================================"
echo -e "總測試數: $TOTAL"
echo -e "${GREEN}通過: $PASSED${NC}"
echo -e "${RED}失敗: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 所有測試通過！系統運作正常。${NC}"
    echo ""
    echo "📄 詳細報告請參考: claude/docs/DATA_FLOW_VERIFICATION.md"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  有 $FAILED 個測試失敗，請檢查錯誤訊息。${NC}"
    exit 1
fi

