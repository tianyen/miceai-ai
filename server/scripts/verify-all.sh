#!/bin/bash
# 一鍵驗證所有系統功能
# 執行方式: npm run verify

# 確保在 server 目錄下執行
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.." || exit 1

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

# Server 管理變數
SERVER_PID=""
SERVER_STARTED_BY_US=false

# 測試用端口
TEST_PORT=9999

# 備份並修改 .env PORT
configure_env_for_test() {
    echo "🔧 配置測試環境..."

    # 備份 .env
    if [ ! -f ".env.bak" ]; then
        cp .env .env.bak
        echo "   ✅ 已備份 .env"
    fi

    # 修改 PORT
    if grep -q "^PORT=" .env; then
        CURRENT_PORT=$(grep "^PORT=" .env | cut -d= -f2)
        if [ "$CURRENT_PORT" != "$TEST_PORT" ]; then
            sed -i '' "s/^PORT=.*/PORT=$TEST_PORT/" .env
            echo "   ✅ PORT: $CURRENT_PORT → $TEST_PORT"
        else
            echo "   ✅ PORT 已正確 ($TEST_PORT)"
        fi
    else
        echo "PORT=$TEST_PORT" >> .env
        echo "   ✅ 新增 PORT=$TEST_PORT"
    fi
}

# 恢復 .env
restore_env() {
    if [ -f ".env.bak" ]; then
        mv .env.bak .env
        echo "   ✅ 已恢復 .env"
    fi
}

# 檢查並啟動 server
check_and_start_server() {
    echo "🔍 檢查 API 伺服器狀態..."

    # 檢查 port 9999 是否有服務
    if curl -s --max-time 2 http://localhost:9999/api/v1/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API 伺服器已在運行${NC}"
        return 0
    fi

    echo -e "${YELLOW}⚠️  API 伺服器未運行，正在啟動...${NC}"

    # 背景啟動 server
    node server.js > /dev/null 2>&1 &
    SERVER_PID=$!
    SERVER_STARTED_BY_US=true

    # 等待 server 啟動
    for i in {1..10}; do
        sleep 1
        if curl -s --max-time 2 http://localhost:9999/api/v1/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ API 伺服器啟動成功 (PID: $SERVER_PID)${NC}"
            echo ""
            return 0
        fi
        echo "   等待啟動... ($i/10)"
    done

    echo -e "${RED}❌ API 伺服器啟動失敗${NC}"
    return 1
}

# 停止 server（如果是我們啟動的）
stop_server_if_needed() {
    if [ "$SERVER_STARTED_BY_US" = true ] && [ -n "$SERVER_PID" ]; then
        echo ""
        echo "🛑 停止測試用 API 伺服器 (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null
        wait $SERVER_PID 2>/dev/null
        echo -e "${GREEN}✅ 伺服器已停止${NC}"
    fi

    # 恢復 .env
    restore_env
}

# 註冊清理函數
trap stop_server_if_needed EXIT

# 配置測試環境（修改 .env PORT）
configure_env_for_test

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

# 啟動 server（如果需要）
if ! check_and_start_server; then
    echo -e "${RED}❌ 無法啟動 API 伺服器，測試中止${NC}"
    exit 1
fi

# 0. 資料庫路徑配置驗證
run_test "資料庫路徑配置驗證" "node scripts/verify-db-paths.js"

# 0.5. 資料庫 Schema 驗證
run_test "資料庫 Schema 驗證" "node scripts/verify-schema.js"

# 1. API v1 端點測試
run_test "API v1 端點測試" "node scripts/test-api-v1-endpoints.js"

# 2. 資料流程檢查
run_test "資料流程檢查" "node scripts/check-data-flow.js"

# 3. 完整業務流程測試
run_test "完整業務流程測試" "node scripts/test-full-workflow.js"

# 4. 後台資料顯示檢查
run_test "後台資料顯示檢查" "node scripts/check-admin-data.js"

# 5. 團體報名流程測試 (使用 EVENT_ID=3: 資訊月互動許願樹 2026-01-08 ~ 2026-01-11)
run_test "團體報名流程測試" "EVENT_ID=3 node scripts/verify-batch-registration.js"

# 6. 小孩統計功能測試
run_test "小孩統計功能測試" "EVENT_ID=3 node scripts/verify-children-stats.js"

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

