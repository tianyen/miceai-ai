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
- `/api/v1/*` - 前端 API（14 個端點，完整 Swagger 文檔）
  - Check-in: 報到管理（2 個端點）
  - Events: 活動管理（4 個端點）
  - Registrations: 報名管理（3 個端點）
  - Games: 遊戲管理（4 個端點）
  - Business Cards: 名片管理（2 個端點）
  - Wish Tree: 許願樹（2 個端點）
- `/api/admin/*` - 後台管理 API（16 個端點）
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

**詳細文檔**:
- [API v1 端點清單](./claude/docs/API_V1_ENDPOINTS.md)
- [Swagger 整合指南](./claude/docs/SWAGGER_INTEGRATION_GUIDE.md)

## 🗄️ 資料庫

### 資料庫位置
- **實際文件**: `server/data/mice_ai.db` ⭐
- **Schema 定義**: `server/database/schema.sql`（僅定義，不存放 .db 文件）
- **配置**: `.env` 中的 `DATABASE_PATH` 環境變數

### 核心資料表
- `event_projects` - 活動專案表
- `booths` - 攤位表
- `booth_games` - 攤位遊戲綁定表（P1-2: 從 project_games 重構）
- `form_submissions` - 報名記錄表
- `qr_codes` - QR Code 表
- `game_sessions` - 遊戲會話表
- `business_cards` - 名片表

**詳細文檔**: [資料庫 Schema 快速參考](./claude/docs/DATABASE_SCHEMA_REFERENCE.md)

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

### 欄位命名規範（v2.6）

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

> 📖 詳細規範請參閱 [spec.md v2.6 - 資料庫欄位命名規範](./claude/docs/spec.md#資料庫欄位命名規範-v26)

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

預設管理員帳號：`admin` / `admin123`

## 📚 文檔

### 核心文檔
- [技術規格文檔](./claude/docs/spec.md) - 完整的系統架構和技術規格
- [系統改進計劃](./claude/docs/plan.md) - 優化計劃和 TODO 追蹤
- [用戶旅程文檔](./claude/docs/user-journey.md) - 四種角色的完整用戶旅程

### API 文檔
- [API v1 端點清單](./claude/docs/API_V1_ENDPOINTS.md) - 前端 API 完整清單
- [API 路由重構](./claude/docs/API_ROUTING_REFACTOR.md) - API 路由設計規範
- [Swagger 整合指南](./claude/docs/SWAGGER_INTEGRATION_GUIDE.md) - Swagger 使用指南

### 資料庫文檔
- [資料庫 Schema 參考](./claude/docs/DATABASE_SCHEMA_REFERENCE.md) - 資料表快速參考
- [命名規範](./claude/docs/NAMING_CONVENTIONS.md) - 欄位命名規範

### 開發規範
- [錯誤處理指南](./claude/docs/ERROR_HANDLING_GUIDE.md) - 統一錯誤處理
- [日誌系統指南](./claude/docs/LOGGING_GUIDE.md) - 集中式日誌
- [API 回應標準](./claude/docs/API_RESPONSE_STANDARD.md) - 統一回應格式

### 完成報告
- [P1-2: 攤位遊戲重構](./claude/docs/P1-2_BOOTH_GAMES_REFACTOR.md)
- [P1-7: API 路由重構](./claude/docs/P1-7_COMPLETION_REPORT.md)

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

**版本**: 2.7
**最後更新**: 2025-12-02
**維護者**: MICE-AI Team