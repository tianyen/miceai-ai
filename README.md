# MICE AI Backend

> Version: **v1.0** · Documentation reset on 2025-12-07

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
- 後台管理: http://localhost:3000/admin (預設帳號: admin / Admin1qa)
- API 文檔: http://localhost:3000/api-docs

## 📋 可用腳本

### 基本運行
| 命令 | 說明 |
|------|------|
| `npm start` | 啟動服務器（開發環境） |
| `npm run dev` | 使用 nodemon 自動重啟 |
| `npm run production` | 啟動服務器（生產環境） |

### 資料庫管理
| 命令 | 說明 |
|------|------|
| `npm run setup` | 一鍵初始化（推薦） |
| `npm run db:reset` | 重置資料庫 |
| `npm run db:seed` | 載入基礎種子資料 |
| `npm run db:info` | 查看資料庫資訊 |
| `npm run db:check` | 檢查資料庫狀態 |
| `npm run db:verify` | 驗證資料庫 Schema |
| `npm run backup` | 備份資料庫 |

### 資料庫遷移
| 命令 | 說明 |
|------|------|
| `npm run db:migrate` | API 日誌表遷移 |
| `npm run db:migrate:gameroom` | 遊戲室模組遷移 |
| `npm run db:migrate:booths` | 攤位資料表遷移 |
| `npm run db:migrate:wishtree` | 許願樹遷移 |
| `npm run db:migrate:form-config` | 表單設定遷移 |

### 種子資料
| 命令 | 說明 |
|------|------|
| `npm run db:seed:gameroom` | 遊戲室模組種子資料 |
| `npm run db:seed:questionnaire` | 問卷種子資料 |
| `npm run db:seed:wishtree` | 許願樹種子資料 |
| `npm run db:seed:game-analytics` | 遊戲統計種子資料 |

### 驗證與測試
| 命令 | 說明 |
|------|------|
| `npm run verify` | 執行所有驗證測試 |
| `npm run verify:workflow` | 驗證完整業務流程 |
| `npm run verify:api` | 驗證 API 端點 |
| `npm run verify:data` | 驗證資料流程 |
| `npm run verify:batch-registration` | 驗證團體報名 API |
| `npm run verify:group-full-flow` | 驗證團體報名完整流程（報名→報到→遊戲→兌換） |
| `npm run test:api` | 測試完整 API 流程 |
| `npm run test:swagger` | 測試 Swagger 範例 |

### 生成工具
| 命令 | 說明 |
|------|------|
| `npm run generate:qrcodes` | 生成測試 QR Code |
| `npm run generate:registration-qrcode` | 生成報名 QR Code |
| `npm run generate-certs` | 生成 HTTPS 證書 |

### 日誌管理
| 命令 | 說明 |
|------|------|
| `npm run logs` | 查看所有日誌 |
| `npm run logs:4xx` | 查看 4xx 錯誤日誌 |
| `npm run logs:5xx` | 查看 5xx 錯誤日誌 |

### 其他工具
| 命令 | 說明 |
|------|------|
| `npm run status` | 查看系統狀態 |
| `npm run analyze:imports` | 分析未使用的 imports |

## ⚙️ 環境配置

主要環境變數（`.env` 文件）：

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PORT` | `3000` | 服務器端口 |
| `BASE_URL` | `http://localhost:3000` | 基礎 URL（QR Code 使用） |
| `DATABASE_PATH` | `./data/mice_ai.db` | 資料庫路徑 |
| `SESSION_SECRET` | 隨機密鑰 | Session 加密密鑰 |
| `NODE_ENV` | `development` | 運行環境 |

### Email 配置 (Google SMTP)

報名成功後系統會自動發送邀請信，需要配置 SMTP：

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `SMTP_ENABLED` | `false` | 是否啟用郵件功能 |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP 伺服器 |
| `SMTP_PORT` | `587` | SMTP 端口 |
| `SMTP_USER` | - | Gmail 帳號 |
| `SMTP_PASS` | - | Gmail 應用程式密碼 |
| `SMTP_FROM_NAME` | `MICE-AI 活動系統` | 寄件者名稱 |
| `SMTP_FROM_EMAIL` | - | 寄件者 Email |

> 💡 **Gmail 設定**: 需要啟用兩步驟驗證後，在 Google 帳戶 → 安全性 → 應用程式密碼 產生專用密碼。

### 生產環境建議

- `BASE_URL`: 設定為實際域名（含 https://）
- `SESSION_SECRET`: 使用強密鑰
- `NODE_ENV`: 設為 `production`
- `SMTP_ENABLED`: 設為 `true` 以啟用邀請信

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
| **報名系統** | 線上報名、**團體報名 (最多 5 人)**、**Email 邀請信**、QR Code 報到、trace_id 追蹤 |
| **邀請信管理** | 後台郵件管理、批量重寄邀請信、發送記錄追蹤、SMTP 測試 |
| **遊戲室** | 遊戲管理、會話追蹤、兌換券系統、統計報告 |
| **問卷系統** | 問卷設計、統計分析、QR Code 連結 |
| **許願樹** | 許願留言、統計分析、CSV 匯出 |
| **攤位系統** | 攤位管理、遊戲綁定、統計 |
| **QR Code 名片** | 數位名片、QR Code 生成 |
| **後台管理** | 三級權限、操作日誌、資料統計 |

## 📡 API 文檔

**Swagger UI**: http://localhost:3000/api-docs

主要 API 端點：
- `/api/v1/*` - 前端 API（25 個端點，完整 Swagger 文檔）
  - Check-in: 報到管理（2 個端點）
  - Events: 活動管理（3 個端點）
    - `GET /events` - 活動列表
    - `GET /events/:id` - 活動詳情
    - `GET /events/code/:code` - 根據代碼查詢活動
  - Registrations: 報名管理（7 個端點，含團體報名）
    - `POST /events/{eventId}/registrations` - 單人報名
    - `POST /events/{eventId}/registrations/batch` - **團體報名 (最多 5 人)**
    - `GET /registrations/{traceId}` - 查詢報名狀態
    - `POST /registrations/{traceId}/resend-email` - **重寄邀請信**
    - `GET /qr-codes/{traceId}` - QR Code 圖片
    - `GET /qr-codes/{traceId}/data` - QR Code Base64 數據
    - `POST /verify-pass-code` - 驗證通行碼
  - Games: 遊戲管理（4 個端點）
  - Business Cards: 名片管理（3 個端點）
    - `POST /business-cards` - 創建名片
    - `GET /business-cards/:cardId` - 名片詳情
    - `GET /business-cards/project/:projectId` - 專案名片列表
  - Wish Tree: 許願樹（4 個端點）
    - `POST /wish-tree/submit` - 提交許願
    - `GET /wish-tree/stats` - 統計數據
    - `GET /wish-tree/recent` - 最近許願記錄
    - `GET /wish-tree/wish/:wishId` - 單一許願詳情（含圖片）
- `/api/admin/*` - 後台管理 API（18+ 個端點）
  - Dashboard: 儀表板統計（4 個端點）
  - Email Management: 郵件管理（4 個端點）
  - Games: 遊戲管理（6 個端點）
  - Vouchers: 兌換券管理（6 個端點）
  - Booth Games: 攤位遊戲綁定（4 個端點）
- `/business-card/:traceId` - QR Code 名片展示

測試數據（與 Swagger 範例一致）：
- 測試報名用戶：王大明 (registration_id: 3, trace_id: `MICE-05207cf7-199967c04`)
- 測試專案：TECH2024 (project_id: 1)
- 測試攤位：BOOTH-A1 (booth_id: 4)
- 測試遊戲：幸運飛鏢 (game_id: 2)

> ⚠️ **注意**：API 報名用戶的 `registration_id` (form_submissions.id) 與後台管理員的 `users.id` 是完全不同的概念！

**詳細文檔**: 查看 Swagger UI (http://localhost:3000/api-docs)

## 🗄️ 資料庫

### 資料庫位置
- **實際文件**: `server/data/mice_ai.db` ⭐
- **Schema 定義**: `server/database/schema.sql`（僅定義，不存放 .db 文件）
- **配置**: `.env` 中的 `DATABASE_PATH` 環境變數

### 核心資料表
- `event_projects` - 活動專案表
- `booths` - 攤位表
- `booth_games` - 攤位遊戲綁定表（P1-2: 從 project_games 重構）
- `form_submissions` - 報名記錄表（含團體報名欄位：`group_id`, `is_primary`, `parent_submission_id`）
- `qr_codes` - QR Code 表
- `game_sessions` - 遊戲會話表
- `business_cards` - 名片表

> ✅ **Schema 完整性**: `npm run setup` 會使用完整的 `schema.sql` 建立資料庫，包含所有功能所需欄位（團體報名、尊稱/性別/備註等），無需額外執行 migration。

### 報名 API 欄位對照表

| API 欄位 | DB 欄位 | DB Schema | 單人報名 | 團體主報名人 | 團體同行者 |
|----------|---------|-----------|:--------:|:-----------:|:---------:|
| `name` | `submitter_name` | `NOT NULL` | ✅ 必填 | ✅ 必填 | ✅ 必填 |
| `email` | `submitter_email` | `NOT NULL` | ✅ 必填 | ✅ 必填 | ⭕ 選填* |
| `phone` | `submitter_phone` | `NULL OK` | ✅ 必填 | ✅ 必填 | ⭕ 選填 |
| `company` | `company_name` | `NULL OK` | ⭕ 選填 | ⭕ 選填 | ⭕ 選填 |
| `position` | `position` | `NULL OK` | ⭕ 選填 | ⭕ 選填 | ⭕ 選填 |
| `gender` | `gender` | `NULL OK` | ⭕ 選填 | ⭕ 選填 | ⭕ 選填 |
| `title` | `title` | `NULL OK` | ⭕ 選填 | ⭕ 選填 | ⭕ 選填 |
| `notes` | `notes` | `NULL OK` | ⭕ 選填 | ⭕ 選填 | ⭕ 選填 |
| `data_consent` | `data_consent` | `NOT NULL` | ✅ 必填 | ✅ 必填 | - |
| `marketing_consent` | `marketing_consent` | `DEFAULT 0` | ⭕ 選填 | ⭕ 選填 | - |
| `adult_age` | `adult_age` | `NULL OK` | ⭕ 選填 | ⭕ 選填 | ⭕ 選填 |
| `children_count` | `children_count` | `DEFAULT 0` | ⭕ 選填 | ⭕ 選填 | ⭕ 選填 |
| `children_ages` | `children_ages` | `NULL OK` | ⭕ 選填 | ⭕ 選填 | ⭕ 選填 |

> *同行者若未填 email，系統自動使用主報名人的 email

**年齡欄位說明**:
| API 欄位 | 類型 | 範圍 | 說明 |
|----------|------|------|------|
| `adult_age` | Integer | 18-120 | 成年人年齡 |
| `children_count` | Integer | 0-10 | 小朋友數量 |
| `children_ages` | Array[Integer] | 每個 0-17 | 小朋友年齡陣列，例如 `[5, 8, 12]` |

**團體報名專用欄位**:
| DB 欄位 | 說明 |
|---------|------|
| `group_id` | 團體識別碼 (GRP-{timestamp}-{random}) |
| `is_primary` | 是否為主報名人 (1=主, 0=同行者) |
| `parent_submission_id` | 同行者指向主報名人的 form_submissions.id |

**資料表欄位**: 查看 `server/database/schema.sql` 獲取完整定義

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

### 欄位命名規範（v1.0）

**時間欄位**: 使用 `_at` 後綴（如 `created_at`, `updated_at`）
- ⚠️ **例外**: `qr_codes.last_scanned` 不使用 `_at` 後綴
- ✅ `business_cards.last_scanned_at` 使用 `_at` 後綴

**庫存欄位**: 使用 `_quantity` 後綴（如 `remaining_quantity`, `total_quantity`）
- ❌ 不要使用 ~~`current_stock`~~ 或 ~~`total_stock`~~（已廢棄）

**布林欄位**: 使用 `is_` 前綴（如 `is_active`, `is_required`）

**外鍵欄位**: 使用 `_id` 後綴（如 `user_id`, `project_id`, `booth_id`）

### user_id 與 registration_id 區分

| 概念 | 表格 | 欄位 | 說明 |
|------|------|------|------|
| 後台管理員 ID | `users` | `id` | 後台登入用戶 (admin, manager, vendor) |
| 報名用戶 ID | `form_submissions` | `id` | API 報名參加者 (= registration_id) |
| 遊戲 API user_id | 參數 | `user_id` | 可傳入 registration_id，用於追蹤玩家 |

```
後台管理員 users.id:           API 報名用戶 registration_id:
├── 1: admin (super_admin)     ├── 1: 張志明 (MICE-d074dd3e-e3e27b6b0)
├── 2: manager (project_mgr)   ├── 2: 李美玲 (MICE-d74b09c8-6cfa4a823)
├── 3: user (project_user)     └── 3: 王大明 (MICE-05207cf7-199967c04)
└── 4: vendor
```

> 📖 詳細規範請參閱 `server/database/schema.sql` 中的註解

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
- **資料庫**: better-sqlite3 (同步 API)
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

預設管理員帳號：`admin` / `Admin1qa`

### CSRF 防護（Admin）

- 所有 `/admin/*` 表單與 `/api/admin/*` 請求都會驗證 Session 綁定的 CSRF Token。
- Handlebars 版面會自動在 `<head>` 載入 `<meta name="csrf-token">`，並在送出表單或 `fetch`/`$.ajax` 時附加 `_csrf` 欄位與 `X-CSRF-Token` header。
- 若自行撰寫前端程式碼，請從 `<meta name="csrf-token">` 讀取 token 並附加到請求；否則會收到 `403 CSRF_TOKEN_INVALID`。

## 📚 文檔資源

| 資源 | 位置 | 說明 |
|------|------|------|
| **API 文檔** | http://localhost:3000/api-docs | Swagger UI 互動式文檔 |
| **資料庫 Schema** | `server/database/schema.sql` | 完整資料表定義與註解 |
| **遷移腳本** | `server/database/migrations/` | 資料庫版本遷移 |
| **種子資料** | `server/scripts/seeds/` | 測試資料腳本 |
| **驗證腳本** | `server/scripts/verify/` | 功能驗證測試 |

## 🚀 生產環境部署

### 推薦配置
```bash
# 使用 PM2 啟動
pm2 start server/server.js --name mice-ai
pm2 save
pm2 startup
```

### 環境變數檢查清單
- [ ] `BASE_URL` 設定為實際域名
- [ ] `SESSION_SECRET` 使用強密鑰
- [ ] `NODE_ENV` 設為 `production`
- [ ] `DATABASE_PATH` 確認正確
- [ ] 資料庫已備份

---

**維護者**: MICE-AI Team

### 更新日誌

#### 2025-12-07 (v1.0)
- 文檔重整：以專案根目錄 README 為主，其他規格逐步移轉至 /claude 目錄
- 版本號回歸 v1.0，作為長期維護基準

#### 2025-12-06
- 修正: pass_code
- 修正: 驗證後台 Email 發送信件 + 暫時移除 pass_code 號碼在 Email template 中顯示

#### 2025-12-05
- 新增：個人報名 API 支援年齡相關欄位 (`adult_age`, `children_count`, `children_ages`)
- 更新：Swagger 文檔同步更新
- 驗證：所有測試 5/5 通過

#### 2025-12-04
- 新增：邀請信管理功能（後台郵件管理頁面）
- 新增：批量重寄邀請信 API
- 新增：儀表板郵件發送統計卡片
- 新增：郵件操作日誌記錄
- 優化：權限控制（super_admin / project_manager）
- 清理：移除失效的文檔連結
