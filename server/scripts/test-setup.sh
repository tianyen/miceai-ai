#!/bin/bash

# 測試完整設置流程
# 此腳本會執行完整的資料庫初始化並驗證所有功能

echo "🧪 開始測試完整設置流程..."
echo ""

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 步驟 1: 清理現有資料庫
echo "📝 步驟 1: 清理現有資料庫..."
if [ -f "data/database.sqlite" ]; then
    rm data/database.sqlite
    echo -e "${GREEN}✅ 已刪除現有資料庫${NC}"
else
    echo -e "${YELLOW}ℹ️  資料庫不存在，跳過刪除${NC}"
fi
echo ""

# 步驟 2: 執行資料庫重置
echo "📝 步驟 2: 執行資料庫架構初始化..."
node scripts/db-reset.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 資料庫架構初始化成功${NC}"
else
    echo -e "${RED}❌ 資料庫架構初始化失敗${NC}"
    exit 1
fi
echo ""

# 步驟 3: 執行種子數據初始化
echo "📝 步驟 3: 執行種子數據初始化..."
node scripts/db-seed.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 種子數據初始化成功${NC}"
else
    echo -e "${RED}❌ 種子數據初始化失敗${NC}"
    exit 1
fi
echo ""

# 步驟 4: 驗證資料庫結構
echo "📝 步驟 4: 驗證資料庫結構..."
node scripts/check-database.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 資料庫結構驗證成功${NC}"
else
    echo -e "${RED}❌ 資料庫結構驗證失敗${NC}"
    exit 1
fi
echo ""

# 步驟 5: 檢查 template_id 欄位
echo "📝 步驟 5: 檢查 template_id 欄位..."
sqlite3 data/database.sqlite "PRAGMA table_info(invitation_projects);" | grep template_id
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ template_id 欄位存在${NC}"
else
    echo -e "${RED}❌ template_id 欄位不存在${NC}"
    exit 1
fi
echo ""

# 步驟 6: 檢查模板數據
echo "📝 步驟 6: 檢查模板數據..."
TEMPLATE_COUNT=$(sqlite3 data/database.sqlite "SELECT COUNT(*) FROM invitation_templates;")
echo "   模板數量: $TEMPLATE_COUNT"
if [ "$TEMPLATE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ 模板數據存在${NC}"
else
    echo -e "${RED}❌ 模板數據不存在${NC}"
    exit 1
fi
echo ""

# 步驟 7: 檢查專案與模板關聯
echo "📝 步驟 7: 檢查專案與模板關聯..."
sqlite3 data/database.sqlite "SELECT project_name, template_id FROM invitation_projects WHERE template_id IS NOT NULL;"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 專案模板關聯正常${NC}"
else
    echo -e "${YELLOW}⚠️  部分專案未關聯模板${NC}"
fi
echo ""

# 步驟 8: 檢查 QR Code 相關表
echo "📝 步驟 8: 檢查 QR Code 相關表..."
sqlite3 data/database.sqlite "SELECT name FROM sqlite_master WHERE type='table' AND name='qr_codes';"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ qr_codes 表存在${NC}"
else
    echo -e "${RED}❌ qr_codes 表不存在${NC}"
    exit 1
fi
echo ""

echo "🎉 所有測試通過！"
echo ""
echo "📊 資料庫統計:"
echo "   用戶數量: $(sqlite3 data/database.sqlite 'SELECT COUNT(*) FROM users;')"
echo "   專案數量: $(sqlite3 data/database.sqlite 'SELECT COUNT(*) FROM invitation_projects;')"
echo "   模板數量: $(sqlite3 data/database.sqlite 'SELECT COUNT(*) FROM invitation_templates;')"
echo "   報名數量: $(sqlite3 data/database.sqlite 'SELECT COUNT(*) FROM form_submissions;')"
echo ""
echo "✅ 系統已準備就緒，可以啟動服務器進行測試！"
echo "   執行: npm run dev"

