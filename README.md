# MICE AI Backend

專業的 MICE (會議、獎勵旅遊、大型會議、展覽) 活動管理系統後端，提供完整的活動管理、報名系統、遊戲室、問卷、許願樹等功能。

## 🚀 快速開始

```bash
# 1. 安裝依賴
cd server && npm install

# 2. 環境配置（可選）
cp .env.example .env

# 3. 初始化資料庫
npm run setup

# 4. 啟動服務
npm start
```

**訪問系統**:
- 後台管理: http://localhost:3000/admin (預設帳號: admin / admin123)
- API 文檔: http://localhost:3000/api-docs

## 📋 常用命令

```bash
# 開發
npm start              # 啟動開發服務器
npm run dev            # 使用 nodemon 自動重啟

# 資料庫
npm run setup          # 一鍵初始化（推薦）
npm run db:reset       # 重置資料庫
npm run db:seed        # 載入測試資料
npm run db:check       # 檢查資料庫狀態
npm run backup         # 備份資料庫

# 測試
npm run test:swagger   # 測試 Swagger 範例
npm run test:api       # 測試 API 流程

# 生產環境
npm run production     # 啟動生產服務器
```

## ⚙️ 環境配置

主要環境變數（`.env` 文件）：

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PORT` | `3000` | 服務器端口 |
| `BASE_URL` | `http://localhost:3000` | 基礎 URL（QR Code 使用） |
| `DATABASE_PATH` | `./data/mice_ai.db` | 資料庫路徑 |
| `SESSION_SECRET` | 隨機密鑰 | Session 加密密鑰 |
| `NODE_ENV` | `development` | 運行環境 |

生產環境建議修改：
- `BASE_URL`: 設定為實際域名
- `SESSION_SECRET`: 使用強密鑰
- `NODE_ENV`: 設為 `production`

## 📁 專案結構

```
server/
├── config/              # 配置文件
├── controllers/         # 控制器
├── middleware/          # 中間件
├── routes/             # 路由
│   ├── admin/          # 後台管理路由
│   ├── api/v1/         # 前端 API (Swagger 文檔)
│   └── api/admin/      # 後台 API
├── views/admin/        # 後台 Handlebars 模板
├── public/             # 靜態文件
├── scripts/            # 工具腳本
│   └── db-path.js      # 統一資料庫路徑模組
├── database/           # 資料庫 Schema 定義
│   └── schema.sql      # 資料庫結構（僅定義，不存放 .db 文件）
├── data/               # 資料庫實際存放位置 ⭐
│   └── mice_ai.db      # SQLite 資料庫文件
├── logs/               # 日誌文件
└── .env                # 環境變數配置
```

## 🎯 核心功能

| 模組 | 功能 |
|------|------|
| **活動管理** | 專案建立、活動模板、參加者管理 |
| **報名系統** | 線上報名、QR Code 報到、trace_id 追蹤 |
| **遊戲室** | 遊戲管理、會話追蹤、兌換券系統、統計報告 |
| **問卷系統** | 問卷設計、統計分析、QR Code 連結 |
| **許願樹** | 許願留言、統計分析、CSV 匯出 |
| **攤位系統** | 攤位管理、遊戲綁定、統計 |
| **QR Code 名片** | 數位名片、QR Code 生成 |
| **後台管理** | 三級權限、操作日誌、資料統計 |

## 📡 API 文檔

**Swagger UI**: http://localhost:3000/api-docs

主要 API 端點：
- `/api/v1/*` - 前端 API（完整 Swagger 文檔）
- `/api/admin/*` - 後台管理 API
- `/business-card/:traceId` - QR Code 名片展示

測試數據（與 Swagger 範例一致）：
- 測試用戶：王大明 (user_id: 3, trace_id: `MICE-05207cf7-199967c04`)
- 測試專案：TECH2024 (project_id: 1)
- 測試遊戲：幸運飛鏢 (game_id: 1)

## 🗄️ 資料庫

### 資料庫位置
- **實際文件**: `server/data/mice_ai.db` ⭐
- **Schema 定義**: `server/database/schema.sql`（僅定義，不存放 .db 文件）
- **配置**: `.env` 中的 `DATABASE_PATH` 環境變數

### 在腳本中使用資料庫

✅ **推薦方式**（統一路徑模組）:
```javascript
const { getDbPath } = require('./scripts/db-path');
const dbPath = getDbPath();
```

❌ **不推薦**（硬編碼路徑）:
```javascript
const dbPath = './data/mice_ai.db';  // 不要這樣做！
```

### Trace ID 格式

**新格式**（推薦）:
```
MICE-{timestamp}-{random}
範例: MICE-05207cf7-199967c04
```

**舊格式**（向後相容）:
```
TRACE{timestamp}{random}
範例: TRACED074DD3EE3E27B6B
```

兩種格式都支援，新建資料自動使用新格式。

## 🔧 常見問題

| 問題 | 解決方案 |
|------|---------|
| 端口被佔用 | 修改 `.env` 中的 `PORT` 或執行 `lsof -i :3000` 查看佔用 |
| 資料庫連接失敗 | 執行 `npm run setup` 重新初始化 |
| QR Code 掃描失敗 | 檢查 `.env` 中的 `BASE_URL` 設定 |
| Session 失效 | 檢查 `SESSION_SECRET` 是否設定 |
| 找不到資料庫 | 確認 `server/data/mice_ai.db` 存在 |


## 🎯 技術棧

- **後端**: Node.js 22+ / Express.js 4.x
- **資料庫**: SQLite3 5.x
- **模板引擎**: Handlebars 4.x
- **認證**: express-session + bcrypt
- **API 文檔**: Swagger/OpenAPI 3.0
- **QR Code**: qrcode 套件
- **CSV 匯出**: json2csv 套件

## 🔐 權限系統

三級角色權限：
- `super_admin` - 超級管理員（完整權限）
- `project_manager` - 專案管理員（專案管理）
- `project_user` - 一般用戶（基本權限）

預設管理員帳號：`admin` / `admin123`

### 推薦配置
```bash
# 使用 PM2 啟動
pm2 start server/server.js --name mice-ai
pm2 save
pm2 startup
```