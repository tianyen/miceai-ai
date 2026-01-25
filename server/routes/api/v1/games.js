/**
 * API v1 - 遊戲日誌和會話管理路由
 * 路徑: /api/v1/games
 * 用於前端遊戲（p5.js）串接
 *
 * ⚠️ user_id 參數說明：
 * - 此 API 的 user_id 參數接受報名 API 返回的 user_id 或 registration_id
 * - 這是 form_submissions.id，不是後台管理員的 users.id
 * - 用於追蹤「哪個報名用戶」在玩遊戲
 *
 * 前端串接流程：
 * 1. 呼叫報名 API → 取得 { registration_id, user_id, trace_id }
 * 2. 呼叫遊戲 API 時帶入 user_id (或 registration_id) 和 trace_id
 */

const express = require('express');
const router = express.Router();
const { gameService } = require('../../../services');
const responses = require('../../../utils/responses');
const { validateTraceId } = require('../../../utils/traceId');

/**
 * 獲取客戶端 IP
 */
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           req.ip;
}

/**
 * 處理 Service 層錯誤
 */
function handleServiceError(res, error, defaultMessage) {
    console.error(`${defaultMessage}:`, error);

    if (error.statusCode) {
        // AppError
        const message = error.details?.message || error.message || defaultMessage;
        return responses.error(res, message, error.statusCode);
    }

    return responses.serverError(res, defaultMessage);
}

/**
 * @swagger
 * /api/v1/games/{gameId}/sessions/start:
 *   post:
 *     summary: 開始遊戲會話
 *     description: 創建新的遊戲會話，用於追蹤玩家遊戲進度
 *     tags: [Games (遊戲室)]
 *     parameters:
 *       - in: path
 *         name: game_id
 *         required: true
 *         description: 遊戲 ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trace_id
 *               - project_id
 *             properties:
 *               trace_id:
 *                 type: string
 *                 description: 玩家追蹤 ID（格式 MICE-xxx-xxx 或 TRACExxx）
 *                 example: "MICE-05207cf7-199967c04"
 *               user_id:
 *                 type: string
 *                 description: |
 *                   用戶識別 ID（選填），可傳入報名 API 返回的 user_id 或 registration_id
 *                   用於追蹤玩家身份和統計分析
 *                 example: "3"
 *               project_id:
 *                 type: integer
 *                 description: 專案 ID（資料庫中的專案，例如：1 = TECH2024）
 *                 example: 1
 *     responses:
 *       200:
 *         description: 會話已開始
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "會話已開始"
 *                 data:
 *                   type: object
 *                   properties:
 *                     session_id:
 *                       type: integer
 *                       example: 32
 *                     trace_id:
 *                       type: string
 *                       description: 追蹤 ID（與請求中的 trace_id 相同）
 *                       example: "MICE-05207cf7-199967c04"
 *                     game_info:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name_zh:
 *                           type: string
 *                           example: "幸運飛鏢"
 *                         name_en:
 *                           type: string
 *                           example: "Lucky Darts"
 *                         game_url:
 *                           type: string
 *                           example: "https://example.com/games/lucky-darts"
 *       400:
 *         description: 請求參數錯誤
 *       404:
 *         description: 專案未綁定此遊戲或遊戲未啟用
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/:gameId/sessions/start', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { trace_id, user_id, project_id, booth_id } = req.body;

        // 驗證必填欄位
        if (!trace_id || (!booth_id && !project_id)) {
            return responses.badRequest(res, '缺少必填欄位: trace_id, booth_id 或 project_id');
        }

        if (!validateTraceId(trace_id)) {
            return responses.badRequest(res, '無效的 trace_id 格式');
        }

        const result = await gameService.startSession({
            gameId,
            traceId: trace_id,
            userId: user_id,
            projectId: project_id,
            boothId: booth_id,
            ipAddress: getClientIP(req),
            userAgent: req.get('User-Agent') || ''
        });

        console.log(`✅ 遊戲會話已開始: session_id=${result.sessionId}, trace_id=${trace_id}, game_id=${gameId}`);

        return responses.success(res, {
            session_id: result.sessionId,
            trace_id: result.traceId,
            game_info: result.gameInfo
        }, '會話已開始');

    } catch (error) {
        return handleServiceError(res, error, '開始遊戲會話失敗');
    }
});

/**
 * @swagger
 * /api/v1/games/{gameId}/logs:
 *   post:
 *     summary: 接收遊戲日誌
 *     description: 記錄玩家遊戲過程中的操作和事件
 *     tags: [Games (遊戲室)]
 *     parameters:
 *       - in: path
 *         name: game_id
 *         required: true
 *         description: 遊戲 ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trace_id
 *               - project_id
 *               - message
 *             properties:
 *               trace_id:
 *                 type: string
 *                 description: 玩家追蹤 ID
 *                 example: "MICE-05207cf7-199967c04"
 *               user_id:
 *                 type: string
 *                 description: |
 *                   用戶識別 ID（選填），可傳入報名 API 返回的 user_id 或 registration_id
 *                 example: "3"
 *               project_id:
 *                 type: integer
 *                 description: 專案 ID（資料庫中的專案，例如：1 = TECH2024）
 *                 example: 1
 *               log_level:
 *                 type: string
 *                 enum: [debug, info, warn, error]
 *                 description: 日誌級別
 *                 example: "info"
 *               message:
 *                 type: string
 *                 description: 日誌訊息
 *                 example: "玩家點擊了卡片 A"
 *               score:
 *                 type: integer
 *                 description: 當前分數（選填）
 *                 example: 1200
 *               action:
 *                 type: string
 *                 description: 玩家操作（選填）
 *                 example: "click_card"
 *               metadata:
 *                 type: object
 *                 description: 額外資料（選填）
 *                 example: { "card_id": "A", "position": { "x": 100, "y": 200 } }
 *     responses:
 *       200:
 *         description: 日誌已記錄
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "日誌已記錄"
 *                 data:
 *                   type: object
 *                   properties:
 *                     log_id:
 *                       type: integer
 *                       example: 1
 *                     trace_id:
 *                       type: string
 *                       description: 追蹤 ID（與請求中的 trace_id 相同）
 *                       example: "MICE-05207cf7-199967c04"
 *       400:
 *         description: 請求參數錯誤
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/:gameId/logs', async (req, res) => {
    try {
        const { gameId } = req.params;
        const {
            trace_id,
            user_id,
            project_id,
            log_level = 'info',
            message,
            user_action,
            score = 0,
            play_time = 0
        } = req.body;

        // 驗證必填欄位
        if (!trace_id || !project_id) {
            return responses.badRequest(res, '缺少必填欄位: trace_id, project_id');
        }

        if (!validateTraceId(trace_id)) {
            return responses.badRequest(res, '無效的 trace_id 格式');
        }

        const result = await gameService.logEvent({
            gameId,
            traceId: trace_id,
            userId: user_id,
            projectId: project_id,
            logLevel: log_level,
            message,
            userAction: user_action,
            score,
            playTime: play_time,
            ipAddress: getClientIP(req),
            userAgent: req.get('User-Agent') || ''
        });

        return responses.success(res, {
            log_id: result.logId,
            trace_id: result.traceId
        }, '日誌已記錄');

    } catch (error) {
        return handleServiceError(res, error, '記錄遊戲日誌失敗');
    }
});

/**
 * @swagger
 * /api/v1/games/{gameId}/sessions/end:
 *   post:
 *     summary: 結束遊戲會話並檢查兌換券條件
 *     description: 結束遊戲會話，檢查玩家是否符合兌換券條件，自動發放兌換券
 *     tags: [Games (遊戲室)]
 *     parameters:
 *       - in: path
 *         name: game_id
 *         required: true
 *         description: 遊戲 ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trace_id
 *               - project_id
 *             properties:
 *               trace_id:
 *                 type: string
 *                 description: 玩家追蹤 ID
 *                 example: "MICE-05207cf7-199967c04"
 *               user_id:
 *                 type: string
 *                 description: |
 *                   用戶識別 ID（選填），可傳入報名 API 返回的 user_id 或 registration_id
 *                 example: "3"
 *               project_id:
 *                 type: integer
 *                 description: 專案 ID（資料庫中的專案，例如：1 = TECH2024）
 *                 example: 1
 *               final_score:
 *                 type: integer
 *                 description: 最終分數
 *                 example: 850
 *               total_play_time:
 *                 type: integer
 *                 description: 總遊戲時間（秒）
 *                 example: 45
 *     responses:
 *       200:
 *         description: 會話已結束
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "會話已結束，恭喜獲得兌換券！"
 *                 data:
 *                   type: object
 *                   properties:
 *                     session_id:
 *                       type: integer
 *                       example: 32
 *                     trace_id:
 *                       type: string
 *                       description: 追蹤 ID（與請求中的 trace_id 相同）
 *                       example: "MICE-05207cf7-199967c04"
 *                     final_score:
 *                       type: integer
 *                       example: 850
 *                     play_time:
 *                       type: integer
 *                       description: 遊戲時間（秒）
 *                       example: 45
 *                     voucher_earned:
 *                       type: boolean
 *                       example: true
 *                     voucher:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: "星巴克咖啡券"
 *                         value:
 *                           type: integer
 *                           example: 100
 *                         vendor:
 *                           type: string
 *                           example: "星巴克"
 *                         category:
 *                           type: string
 *                           example: "餐飲"
 *                         redemption_code:
 *                           type: string
 *                           example: "GAME-2025-D8E9F1"
 *                         qr_code_base64:
 *                           type: string
 *                           description: |
 *                             QR Code Base64 編碼，包含兌換碼和 trace_id，可直接用於前端顯示。
 *                             QR Code 內容為 JSON 格式：
 *                             {
 *                               "redemption_code": "GAME-2025-XXXXXX",
 *                               "trace_id": "MICE-xxx-xxx",
 *                               "voucher_id": 1,
 *                               "voucher_name": "星巴克咖啡券"
 *                             }
 *                           example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *       400:
 *         description: 請求參數錯誤
 *       404:
 *         description: 找不到會話
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/:gameId/sessions/end', async (req, res) => {
    try {
        const { gameId } = req.params;
        const {
            trace_id,
            project_id,
            final_score = 0,
            total_play_time = 0
        } = req.body;

        // 驗證必填欄位
        if (!trace_id || !project_id) {
            return responses.badRequest(res, '缺少必填欄位: trace_id, project_id');
        }

        if (!validateTraceId(trace_id)) {
            return responses.badRequest(res, '無效的 trace_id 格式');
        }

        const result = await gameService.endSession({
            gameId,
            traceId: trace_id,
            projectId: project_id,
            finalScore: final_score,
            totalPlayTime: total_play_time
        });

        const responseData = {
            session_id: result.sessionId,
            trace_id: result.traceId,
            final_score: result.finalScore,
            play_time: result.playTime,
            voucher_earned: result.voucherEarned
        };

        if (result.voucherEarned && result.voucher) {
            responseData.voucher = result.voucher;
            console.log(`🎁 兌換券已發放: ${result.voucher.redemption_code}, trace_id=${trace_id}`);
        } else if (result.reason) {
            responseData.reason = result.reason;
        }

        console.log(`✅ 遊戲會話已結束: session_id=${result.sessionId}, score=${final_score}, voucher=${result.voucherEarned}`);

        return responses.success(res, responseData, '遊戲結束');

    } catch (error) {
        return handleServiceError(res, error, '結束遊戲會話失敗');
    }
});

/**
 * @swagger
 * /api/v1/games/{gameId}/info:
 *   get:
 *     summary: 獲取遊戲資訊
 *     description: 獲取遊戲基本資訊。如果提供 project_id，會額外返回專案綁定狀態和兌換券資訊
 *     tags: [Games (遊戲室)]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         description: 遊戲 ID
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: project_id
 *         required: false
 *         description: 專案 ID（可選）。提供時會返回專案綁定狀態和兌換券資訊
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: 成功獲取遊戲資訊
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name_zh:
 *                       type: string
 *                       example: "幸運飛鏢"
 *                     name_en:
 *                       type: string
 *                       example: "Lucky Darts"
 *                     game_url:
 *                       type: string
 *                       example: "https://example.com/games/lucky-darts"
 *                     game_version:
 *                       type: string
 *                       example: "1.0.0"
 *                     is_active:
 *                       type: integer
 *                       example: 1
 *                     is_bound:
 *                       type: boolean
 *                       example: true
 *                       description: 專案是否綁定此遊戲（僅在提供 project_id 時返回）
 *                     voucher:
 *                       type: object
 *                       description: 兌換券資訊（僅在提供 project_id 且有綁定兌換券時返回）
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: "星巴克咖啡券"
 *                         value:
 *                           type: integer
 *                           example: 100
 *                         current_stock:
 *                           type: integer
 *                           example: 100
 *                         conditions:
 *                           type: object
 *                           properties:
 *                             min_score:
 *                               type: integer
 *                               example: 500
 *                             min_play_time:
 *                               type: integer
 *                               example: 300
 *       404:
 *         description: 遊戲不存在或未啟用
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/:gameId/info', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { project_id, booth_id } = req.query;

        const result = await gameService.getGameInfo({
            gameId,
            projectId: project_id,
            boothId: booth_id
        });

        return responses.success(res, result);

    } catch (error) {
        return handleServiceError(res, error, '獲取遊戲資訊失敗');
    }
});

module.exports = router;

