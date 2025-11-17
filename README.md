# MICE AI

一個完整的MICE-AI ，包含活動管理、報名系統、問卷功能、QR Code 名片等功能。

## 🚀 快速開始

> 💡 **新手用戶**: 請參考 [快速開始指南](./QUICK_START.md) 進行 5 分鐘快速部署

### 第一次使用

1. **安裝依賴套件**
   ```bash
   npm install
   ```

2. **環境變數配置**
   ```bash
   # 複製環境變數範例文件
   cp .env.example .env
   
   # 編輯環境變數（可選，預設值適用於開發環境）
   nano .env
   ```

3. **資料庫初始化**
   ```bash
   # 一鍵初始化（推薦）
   npm run setup  
   ```

4. **啟動服務**
   ```bash
   # 開發環境
   npm start
   
   # 或使用 nodemon 自動重啟
   npm run dev
   
   # 生產環境
   npm run production
   ```

5. **訪問系統**
   - 後台管理：http://localhost:3000/admin
   - API 文件：http://localhost:3000/api-docs

## 📋 可用腳本

### 基本運行
- `npm start` - 啟動服務器（開發環境）
- `npm run production` - 啟動服務器（生產環境）
- `npm run dev` - 使用 nodemon 啟動（自動重啟）

### 資料庫管理
- `npm run setup` - 一鍵初始化（包含架構、種子資料、遊戲室、攤位、問卷）
- `npm run db:init` - 初始化資料庫結構
- `npm run db:reset` - 重置資料庫（清空所有資料）
- `npm run db:seed` - 載入基礎種子資料
- `npm run db:info` - 查看資料庫資訊
- `npm run db:check` - 檢查資料庫狀態和數據統計
- `npm run db:verify` - 驗證資料庫 Schema 結構

### 資料庫遷移
- `npm run db:migrate` - API 日誌表遷移
- `npm run db:migrate:gameroom` - 遊戲室模組遷移
- `npm run db:migrate:booths` - 攤位資料表遷移

### 種子資料
- `npm run db:seed:gameroom` - 遊戲室模組種子資料
- `npm run db:seed:questionnaire` - 問卷種子資料

### 測試命令
- `npm test` - 運行模組測試
- `npm run test:api` - 測試完整 API 流程
- `npm run test:setup` - 測試完整設置流程
- `npm run test:business-cards` - 測試名片功能

### 生成工具
- `npm run generate:qrcodes` - 生成測試 QR Code
- `npm run generate:registration-qrcode` - 生成報名 QR Code 測試頁面

### 日誌管理
- `npm run logs` - 查看所有日誌
- `npm run logs:4xx` - 查看 4xx 錯誤日誌
- `npm run logs:5xx` - 查看 5xx 錯誤日誌

### 其他工具
- `npm run backup` - 備份資料庫
- `npm run status` - 查看系統狀態
- `npm run analyze:imports` - 分析未使用的 imports
- `npm run generate-certs` - 生成 HTTPS 證書

## 🔧 環境配置

### 環境變數

主要環境變數說明（詳細說明請參考 [ENV_CONFIG.md](./ENV_CONFIG.md)）：

| 變數名 | 預設值 | 說明 |
|--------|--------|------|
| `PORT` | `3000` | HTTP 服務器端口 |
| `BASE_URL` | `http://localhost:3000` | 應用程式基礎 URL |
| `NODE_ENV` | `development` | 運行環境 |
| `SESSION_SECRET` | 開發用密鑰 | Session 加密密鑰 |

### 不同環境配置

**開發環境**：
```bash
npm start
# 或
npm run dev
```

**生產環境**：
```bash
# 設定生產環境變數
export NODE_ENV=production
export BASE_URL=https://your-domain.com
export SESSION_SECRET=your-strong-secret

# 啟動服務
npm run production
```

## 📁 專案結構

```
server/
├── config/           # 配置文件
├── controllers/      # 控制器
├── middleware/       # 中間件
├── routes/          # 路由
│   ├── admin/       # 後台路由
│   ├── api/         # API 路由
│   └── frontend/    # 前端路由
├── views/           # 視圖模板
├── public/          # 靜態文件
├── scripts/         # 工具腳本
├── data/            # 資料庫文件
├── logs/            # 日誌文件
├── .env.example     # 環境變數範例
└── server.js        # 主程式入口
```

## 🎯 主要功能

### 1. 活動管理
- 活動專案建立與管理
- 活動模板系統
- 參加者管理

### 2. 報名系統
- 線上報名表單
- QR Code 報到功能
- 報名資料管理

### 3. 問卷系統
- 問卷設計與發布
- 問卷統計分析
- QR Code 問卷連結

### 4. QR Code 名片
- 數位名片建立
- QR Code 生成與分享
- 名片交換功能

### 5. 後台管理
- 用戶權限管理
- 系統設定
- 資料統計

## 🔗 API 文件

### Swagger UI
訪問 http://localhost:3000/api-docs 查看完整的 API 文件。

### Postman 集合
導入 `postman-collection.json` 到 Postman 進行 API 測試。

### API 端點概覽
- `/api/v1/` - 前端 API
- `/api/admin/` - 後台管理 API
- `/business-card/` - QR Code 名片展示

## 🛠️ 開發指南

### 資料庫操作
```bash
# 查看資料庫狀態
npm run db:info

# 重置開發資料庫
npm run db:reset
npm run db:seed
```

### 日誌查看
```bash
# 即時查看日誌
tail -f logs/access_$(date +%Y-%m-%d).log

# 查看錯誤日誌
npm run logs:5xx
```

### HTTPS 設定
```bash
# 生成開發用證書
npm run generate-certs

# 服務器會自動在 3443 端口啟動 HTTPS
```

## 🚨 故障排除

### 常見問題

1. **端口被佔用**
   ```bash
   # 查看端口使用情況
   lsof -i :3000
   
   # 修改 .env 中的 PORT 變數
   ```

2. **資料庫連接失敗**
   ```bash
   # 檢查資料庫文件權限
   ls -la data/
   
   # 重新初始化資料庫
   npm run db:init
   ```

3. **QR Code 掃描失敗**
   - 檢查 `.env` 中的 `BASE_URL` 設定
   - 確保 URL 可以從外部訪問

4. **Session 失效**
   - 檢查 `SESSION_SECRET` 是否設定
   - 確認 Session 配置正確