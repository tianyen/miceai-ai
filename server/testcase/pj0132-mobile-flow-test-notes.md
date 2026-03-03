# PJ0132 Mobile Flow Test Notes

## Scope

這份 testcase note 用來追蹤 `PJ0132` 手機端虎爺 / 天燈流程，對 `miceai_backend` 的測試分層、覆蓋範圍、執行指令與人工整合驗證項目。

公開 backend 目標：

- `https://backend-pj0132.miceai.ai/api/v1`

前端 origin：

- `https://tianyen-service.com:4049`

遊戲綁定：

- Tiger: `project_code=PJ0131`, `booth_code=TIGER`, `game_code=tiger-mobile`
- Lantern: `project_code=PJ0131`, `booth_code=LANTERN`, `game_code=lantern-mobile`

## Unit Test

目的：只測單一函式或單一 service 的規則，不依賴完整前端流程。

backend：

- Script: `server/scripts/test-game-flow-service-unit.js`
- Command:
```bash
cd server
npm run verify:pj0132:unit
```

覆蓋：

- `game-flow.service.js` event alias normalize
- `game-flow.service.js` stage alias normalize
- `completed / failed / abandoned` status 推導
- schema stage / allowed event validation
- accepted alias contract 輸出

frontend unit-style：

- 參考 `pj0132/testcase/pj0132-mice-flow-test-notes.md`
- 主要驗證 `mice-flow.js` 的 `detectStage / getApiBaseUrl / trackEvent / queueEvent / endFlowAndNavigate`

## Regression Test

目的：把已知可工作的手機流程事件序列固定下來，之後改版時快速回歸。

主腳本：

- Script: `server/scripts/verify-pj0132-mobile-flows-public.js`

指令：

```bash
cd server
npm run verify:pj0132:public
```

分模式執行：

```bash
cd server
npm run verify:pj0132:regression:happy
npm run verify:pj0132:regression:failure
npm run verify:pj0132:regression:upload-fail
npm run verify:pj0132:regression:alias
```

覆蓋分類：

- `happy path`
  - 虎爺：`session_start -> stage_enter -> stage_submit -> select_case -> pray_attempt -> pray_result -> reveal_start -> color_select -> sign_submit -> session_end -> upload_attempt -> upload_success -> complete`
  - 天燈：`session_start -> template_browse -> choose_lantern submit -> capture_photo -> camera_switch -> preview_photo -> throw_start -> throw_success -> session_end -> upload_attempt -> upload_success -> complete`
- `failure path`
  - 虎爺：失敗結束 `session_end=failed`
  - 天燈：預覽重來 `session_end=abandoned`
- `upload fail path`
  - 虎爺：`upload_fail`
  - 天燈：`upload_fail`
- `alias compatibility path`
  - `flow_start`
  - `preview_restart`
  - `complete_restart`
  - stage alias `intro / complete`

## Black-Box Testing

目的：從外部 API / 對外入口驗證系統，不依賴內部實作細節。

目前自動化已覆蓋：

- 公開 domain `backend-pj0132.miceai.ai`
- HTTP status
- JSON response `success`
- CORS header `Access-Control-Allow-Origin`
- 虎爺 / 天燈對外 event ingestion
- admin session login
- admin stats / funnel response shape 與 booth / stage presence

指令：

```bash
cd server
npm run verify:pj0132:public
npm run verify:pj0132:admin
npm run verify:pj0132:all
npm run verify:pj0132:all:remote
npm run verify:pj0132:all:vps-local
```

admin 黑箱腳本：

- Script: `server/scripts/verify-pj0132-admin-analytics.js`
- login: `POST /admin/login` with seeded admin `admin / Admin1qa`
- verify endpoints:
  - `/api/admin/tracking/game-flows/stats?project_code=PJ0131&window=today`
  - `/api/admin/tracking/game-flows/funnel?project_code=PJ0131&game_code=tiger-mobile&booth_code=TIGER&window=today`
  - `/api/admin/tracking/game-flows/funnel?project_code=PJ0131&game_code=lantern-mobile&booth_code=LANTERN&window=today`
- remote VPS 補充：
  - 若 `backend-pj0132.miceai.ai` 在 VPS 上呈現 self-signed chain，使用 `npm run verify:pj0132:all:remote`
  - 這只對驗證腳本關閉 Node TLS 檢查，預設 `verify:pj0132:*` 仍維持嚴格憑證驗證
  - 若 VPS 自己打公開域名仍拿到非 app 標準回應，改用 `npm run verify:pj0132:all:vps-local`
  - `vps-local` 直打 `http://127.0.0.1:9994`，用來驗證 pm2 / app / DB / admin analytics 鏈路

建議補充：

- 用實際手機或模擬器跑 `moneycontroller` / `openingpic`
- 驗證瀏覽器端 network request 與 response shape
- 驗證 admin 畫面中的數字與 API 回傳一致

## System Integration

目的：驗證整條正式鏈路，不只 API，可包含真實裝置與外部基礎設施。

整合對象：

- HTML 手機頁
- Cloudflare DNS
- Caddy reverse proxy
- `pm2` backend process
- SQLite
- admin analytics
- 真實手機操作

人工 checklist：

1. 確認 `pm2 status miceai-backend-pj0132` 為 `online`
2. 確認 `https://backend-pj0132.miceai.ai/api/v1/game-flows/track` 可回 `202`
3. 用手機開虎爺正式網址跑完整流程
4. 用手機開天燈正式網址跑完整流程
5. 在瀏覽器 DevTools 或代理工具確認 request origin 為 `https://tianyen-service.com:4049`
6. 確認 response header 含 `Access-Control-Allow-Origin: https://tianyen-service.com:4049`
7. 登入 admin 後確認：
   - `/api/admin/tracking/game-flows/stats?project_code=PJ0131&window=today`
   - `/api/admin/tracking/game-flows/funnel?project_code=PJ0131&game_code=tiger-mobile&booth_code=TIGER&window=today`
   - `/api/admin/tracking/game-flows/funnel?project_code=PJ0131&game_code=lantern-mobile&booth_code=LANTERN&window=today`
8. 確認 stats / funnel 有對應 booth、session status、completion stage
9. 若從 VPS 自己打 `https://backend-pj0132.miceai.ai` 出現 `{}` 或 `501`，記錄為 proxy / DNS self-call 問題，改用 `verify:pj0132:all:vps-local` 驗證 app 本體

## Notes

- `smoke test` 已升級成可重跑的 regression / public black-box 腳本
- backend repo 是多專案共用，`pj0132` 的 domain 對齊以部署 `.env` 與這組 testcase 為準
- 若未來要補 Playwright，建議放在獨立 e2e 套件，不直接混入目前 script-based test 架構
- 2026-03-03 實測：外部機器跑 `verify:pj0132:public` / `verify:pj0132:admin` 可通；VPS 自己打 `backend-pj0132.miceai.ai` 看到 `{}` / `501`，因此補了 `verify:pj0132:all:vps-local`
