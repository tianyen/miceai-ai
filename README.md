# MICE-AI Backend

Node.js + Express + SQLite 的活動互動後端，支援：
- 活動報名 / 報到 / QR Code
- 攤位遊戲與兌換券
- Admin 後台管理
- V1 前端 API（Swagger）

## 快速開始

```bash
cd server
npm install
npm run setup
npm run dev
```

啟動後：
- API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api-docs`
- API JSON: `http://localhost:3000/api-docs.json`

## 資料庫策略（重要）

本專案目前採 **schema-only**：
- DB 結構唯一來源：`server/database/schema.sql`
- `npm run setup` 不再執行 migration
- `db:migrate*` 僅保留為 deprecated 提示，不會變更資料庫

建議流程：
```bash
cd server
npm run db:reset
npm run db:seed
```

## 常用命令

在 `server/` 目錄執行。

### 啟動
- `npm run dev`：開發模式
- `npm start`：一般啟動
- `npm run production`：`NODE_ENV=production` 啟動

### 初始化與資料庫
- `npm run setup`：完整初始化（推薦）
- `npm run db:reset`：重建資料庫（依 `schema.sql`）
- `npm run db:seed`：核心種子資料
- `npm run db:seed:gameroom`：遊戲室種子
- `npm run db:seed:questionnaire`：問卷種子
- `npm run db:seed:wishtree`：許願樹種子
- `npm run db:seed:game-analytics`：分析種子
- `npm run db:seed:demo`：Demo 2026 流程資料
- `npm run db:clean:p0-indexes`：P0 索引前置清洗（check mode）
- `npm run db:clean:test-users`：清理驗證腳本建立的測試用戶
- `npm run db:verify`：Schema 驗證
- `npm run db:verify-paths`：資料庫路徑驗證

### 驗證與測試
- `npm run verify`：完整驗證（verify-all）
- `npm run verify:api`：V1 API 端點驗證
- `npm run verify:data`：資料鏈檢查
- `npm run verify:workflow`：完整業務流程
- `npm run verify:admin`：後台資料顯示檢查
- `npm run verify:batch-registration`：團體報名流程
- `npm run verify:children-stats`：小孩統計流程
- `npm run test:swagger`：Swagger 範例測試

`test:swagger` 可透過 `BASE_URL` 覆寫測試目標：
```bash
cd server
BASE_URL=http://localhost:9999 npm run test:swagger
```

## API 文件治理

- 單一真相（Single Source of Truth）：`server/docs/v1-api.md`
- `registration_config` JSON Schema：`server/contracts/registration-config.v2.json`
- README 不重複維護 API 回傳欄位明細，避免文件漂移

## Admin 動態欄位與素材

- 報名欄位配置：`/api/admin/projects/:projectId/registration-config`
- 第二頁特效開關：`/api/admin/projects/:projectId/interstitial-effect`
- 第二頁素材上傳：`/api/admin/projects/:projectId/interstitial-asset`

素材安全策略：
- 只允許 GIF / MP4
- 副檔名 + MIME + 檔頭驗證
- URL 僅允許本地 `/uploads/...`

## 目錄結構（精簡）

```text
server/
  server.js
  config/
  controllers/
  services/
  repositories/
  routes/
    api/
  middleware/
  utils/
  database/
    schema.sql
  data/
  public/
  views/
  scripts/
  docs/
```

## 安全與設定

1. 複製 `.env.example` 為 `.env`，設定至少：
- `SESSION_SECRET`
- `DATABASE_PATH`
- `BASE_URL`

## 排錯

### setup 卡住或 DB 壞檔
先重跑：
```bash
cd server
npm run setup
```
`pre-setup` 會嘗試清理壞掉的 `db/wal/shm` 後再重建。

### Swagger 測試 HTTP 000
代表 API 未成功啟動或測試 URL 不對。
- 確認服務是否在目標 port 監聽
- 或用 `BASE_URL` 指向正確位址

---

若需要舊版長篇架構說明或歷史更新記錄，請以 Git 歷史與 PR/MR 為準。
