/**
 * API v1 - 遊戲日誌和會話管理路由
 * 路徑: /api/v1/games
 * 用於前端遊戲（p5.js）串接
 */

const express = require('express');
const router = express.Router();
const database = require('../../../config/database');
const responses = require('../../../utils/responses');
const { validateTraceId } = require('../../../utils/traceId');
const { generateRedemptionCode } = require('../../../utils/redemption-code-generator');
const { checkVoucherRedemption } = require('../../../utils/voucher-checker');
const QRCode = require('qrcode');

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
 * @swagger
 * /api/v1/games/{gameId}/sessions/start:
 *   post:
 *     summary: 開始遊戲會話
 *     description: 創建新的遊戲會話，用於追蹤玩家遊戲進度
 *     tags: [遊戲室]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 遊戲 ID
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
 *                 example: "MICE-lm3k5g-abc123xyz"
 *               user_id:
 *                 type: string
 *                 description: 用戶 ID（選填）
 *                 example: "player_001"
 *               project_id:
 *                 type: integer
 *                 description: 專案 ID
 *                 example: 123
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
 *                       example: 1
 *                     game_info:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name_zh:
 *                           type: string
 *                           example: "記憶翻牌遊戲"
 *                         name_en:
 *                           type: string
 *                           example: "Memory Card Game"
 *                         game_url:
 *                           type: string
 *                           example: "https://example.com/games/memory-card"
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
        const { trace_id, user_id, project_id } = req.body;

        // 驗證必填欄位
        if (!trace_id || !project_id) {
            return responses.badRequest(res, '缺少必填欄位: trace_id, project_id');
        }

        // 驗證 trace_id 格式
        if (!validateTraceId(trace_id)) {
            return responses.badRequest(res, '無效的 trace_id 格式');
        }

        // 驗證專案和遊戲綁定關係
        const binding = await database.get(
            `SELECT pg.*, g.game_name_zh, g.game_name_en, g.game_url
             FROM project_games pg
             JOIN games g ON pg.game_id = g.id
             WHERE pg.project_id = ? AND pg.game_id = ? AND pg.is_active = 1`,
            [project_id, gameId]
        );

        if (!binding) {
            return responses.notFound(res, '專案未綁定此遊戲或遊戲未啟用');
        }

        // 創建遊戲會話
        const ip_address = getClientIP(req);
        const user_agent = req.get('User-Agent') || '';

        const result = await database.run(
            `INSERT INTO game_sessions (
                project_id, game_id, trace_id, user_id,
                ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [project_id, gameId, trace_id, user_id, ip_address, user_agent]
        );

        console.log(`✅ 遊戲會話已開始: session_id=${result.lastID}, trace_id=${trace_id}, game_id=${gameId}`);

        return responses.success(res, {
            session_id: result.lastID,
            game_info: {
                id: binding.game_id,
                name_zh: binding.game_name_zh,
                name_en: binding.game_name_en,
                game_url: binding.game_url
            }
        }, '會話已開始');

    } catch (error) {
        console.error('開始遊戲會話失敗:', error);
        return responses.serverError(res, '開始遊戲會話失敗', error);
    }
});

/**
 * @swagger
 * /api/v1/games/{gameId}/logs:
 *   post:
 *     summary: 接收遊戲日誌
 *     description: 記錄玩家遊戲過程中的操作和事件
 *     tags: [遊戲室]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 遊戲 ID
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
 *                 example: "MICE-lm3k5g-abc123xyz"
 *               user_id:
 *                 type: string
 *                 description: 用戶 ID（選填）
 *                 example: "player_001"
 *               project_id:
 *                 type: integer
 *                 description: 專案 ID
 *                 example: 123
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

        // 驗證 trace_id 格式
        if (!validateTraceId(trace_id)) {
            return responses.badRequest(res, '無效的 trace_id 格式');
        }

        // 插入日誌
        const ip_address = getClientIP(req);
        const user_agent = req.get('User-Agent') || '';

        const result = await database.run(
            `INSERT INTO game_logs (
                project_id, game_id, trace_id, user_id,
                log_level, message, user_action, score, play_time,
                ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                project_id, gameId, trace_id, user_id,
                log_level, message, user_action, score, play_time,
                ip_address, user_agent
            ]
        );

        return responses.success(res, {
            log_id: result.lastID
        }, '日誌已記錄');

    } catch (error) {
        console.error('記錄遊戲日誌失敗:', error);
        return responses.serverError(res, '記錄遊戲日誌失敗', error);
    }
});

/**
 * @swagger
 * /api/v1/games/{gameId}/sessions/end:
 *   post:
 *     summary: 結束遊戲會話並檢查兌換券條件
 *     description: 結束遊戲會話，檢查玩家是否符合兌換券條件，自動發放兌換券
 *     tags: [遊戲室]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 遊戲 ID
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
 *                 example: "MICE-lm3k5g-abc123xyz"
 *               user_id:
 *                 type: string
 *                 description: 用戶 ID（選填）
 *                 example: "player_001"
 *               project_id:
 *                 type: integer
 *                 description: 專案 ID
 *                 example: 123
 *               final_score:
 *                 type: integer
 *                 description: 最終分數
 *                 example: 1200
 *               total_play_time:
 *                 type: integer
 *                 description: 總遊戲時間（秒）
 *                 example: 180
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
 *                       example: 1
 *                     final_score:
 *                       type: integer
 *                       example: 1200
 *                     total_play_time:
 *                       type: integer
 *                       example: 180
 *                     voucher_earned:
 *                       type: boolean
 *                       example: true
 *                     voucher:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 2
 *                         name:
 *                           type: string
 *                           example: "誠品書店禮券"
 *                         value:
 *                           type: integer
 *                           example: 200
 *                         vendor:
 *                           type: string
 *                           example: "誠品書店"
 *                         category:
 *                           type: string
 *                           example: "購物"
 *                         redemption_code:
 *                           type: string
 *                           example: "GAME-2025-A3B7C9"
 *                         qr_code_base64:
 *                           type: string
 *                           description: QR Code Base64 編碼，包含兌換碼和 trace_id，可直接用於前端顯示
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
            user_id,
            project_id,
            final_score = 0,
            total_play_time = 0
        } = req.body;

        // 驗證必填欄位
        if (!trace_id || !project_id) {
            return responses.badRequest(res, '缺少必填欄位: trace_id, project_id');
        }

        // 驗證 trace_id 格式
        if (!validateTraceId(trace_id)) {
            return responses.badRequest(res, '無效的 trace_id 格式');
        }

        // 查找最近的會話
        const session = await database.get(
            `SELECT * FROM game_sessions
             WHERE trace_id = ? AND game_id = ? AND project_id = ?
             AND session_end IS NULL
             ORDER BY session_start DESC
             LIMIT 1`,
            [trace_id, gameId, project_id]
        );

        if (!session) {
            return responses.notFound(res, '找不到進行中的遊戲會話');
        }

        // 更新會話結束資訊
        await database.run(
            `UPDATE game_sessions
             SET session_end = CURRENT_TIMESTAMP,
                 final_score = ?,
                 total_play_time = ?
             WHERE id = ?`,
            [final_score, total_play_time, session.id]
        );

        // 查詢專案綁定的兌換券
        const binding = await database.get(
            `SELECT * FROM project_games
             WHERE project_id = ? AND game_id = ? AND is_active = 1`,
            [project_id, gameId]
        );

        let voucherEarned = false;
        let voucherData = null;
        let reason = '';

        // 如果有綁定兌換券，檢查條件
        if (binding && binding.voucher_id) {
            // 查詢兌換券資訊
            const voucher = await database.get(
                `SELECT * FROM vouchers WHERE id = ? AND is_active = 1`,
                [binding.voucher_id]
            );

            if (voucher) {
                // 查詢兌換條件
                const conditions = await database.get(
                    `SELECT * FROM voucher_conditions WHERE voucher_id = ?`,
                    [voucher.id]
                );

                if (conditions) {
                    // 檢查兌換條件和庫存
                    const checkResult = checkVoucherRedemption(
                        { final_score, total_play_time },
                        voucher,
                        conditions
                    );

                    if (checkResult.canRedeem) {
                        // 生成兌換碼
                        const redemption_code = generateRedemptionCode();

                        // 開始資料庫交易
                        await database.run('BEGIN TRANSACTION');

                        try {
                            // 插入兌換記錄
                            const redemptionResult = await database.run(
                                `INSERT INTO voucher_redemptions (
                                    voucher_id, session_id, trace_id,
                                    redemption_code
                                ) VALUES (?, ?, ?, ?)`,
                                [voucher.id, session.id, trace_id, redemption_code]
                            );

                            // 更新兌換券庫存
                            await database.run(
                                `UPDATE vouchers
                                 SET current_stock = current_stock - 1
                                 WHERE id = ?`,
                                [voucher.id]
                            );

                            // 更新會話記錄
                            await database.run(
                                `UPDATE game_sessions
                                 SET voucher_earned = 1, voucher_id = ?
                                 WHERE id = ?`,
                                [voucher.id, session.id]
                            );

                            await database.run('COMMIT');

                            // 生成 QR Code Base64（包含兌換碼）
                            const qrCodeData = JSON.stringify({
                                redemption_code: redemption_code,
                                trace_id: trace_id,
                                voucher_id: voucher.id,
                                voucher_name: voucher.voucher_name
                            });
                            const qrCodeBase64 = await QRCode.toDataURL(qrCodeData, {
                                errorCorrectionLevel: 'M',
                                type: 'image/png',
                                width: 300,
                                margin: 2
                            });

                            voucherEarned = true;
                            voucherData = {
                                id: voucher.id,
                                name: voucher.voucher_name,
                                value: voucher.voucher_value,
                                vendor: voucher.vendor_name,
                                category: voucher.category,
                                redemption_code: redemption_code,
                                qr_code_base64: qrCodeBase64
                            };

                            console.log(`🎁 兌換券已發放: ${redemption_code}, trace_id=${trace_id}`);

                        } catch (error) {
                            await database.run('ROLLBACK');
                            throw error;
                        }
                    } else {
                        reason = checkResult.reason;
                    }
                }
            }
        }

        const responseData = {
            session_id: session.id,
            final_score,
            play_time: total_play_time,
            voucher_earned: voucherEarned
        };

        if (voucherEarned) {
            responseData.voucher = voucherData;
        } else if (reason) {
            responseData.reason = reason;
        }

        console.log(`✅ 遊戲會話已結束: session_id=${session.id}, score=${final_score}, voucher=${voucherEarned}`);

        return responses.success(res, responseData, '遊戲結束');

    } catch (error) {
        console.error('結束遊戲會話失敗:', error);
        return responses.serverError(res, '結束遊戲會話失敗', error);
    }
});

/**
 * @swagger
 * /api/v1/games/{gameId}/info:
 *   get:
 *     summary: 獲取遊戲資訊
 *     description: 獲取遊戲基本資訊和兌換券條件（可選）
 *     tags: [遊戲室]
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 遊戲 ID
 *       - in: query
 *         name: project_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 專案 ID
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
 *                       example: "記憶翻牌遊戲"
 *                     name_en:
 *                       type: string
 *                       example: "Memory Card Game"
 *                     game_url:
 *                       type: string
 *                       example: "https://example.com/games/memory-card"
 *                     game_version:
 *                       type: string
 *                       example: "1.0.0"
 *                     is_active:
 *                       type: integer
 *                       example: 1
 *                     voucher:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 2
 *                         name:
 *                           type: string
 *                           example: "誠品書店禮券"
 *                         value:
 *                           type: integer
 *                           example: 200
 *                         current_stock:
 *                           type: integer
 *                           example: 50
 *                         conditions:
 *                           type: object
 *                           properties:
 *                             min_score:
 *                               type: integer
 *                               example: 1000
 *                             min_play_time:
 *                               type: integer
 *                               example: 120
 *       400:
 *         description: 缺少 project_id 參數
 *       404:
 *         description: 遊戲不存在或專案未綁定此遊戲
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/:gameId/info', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { project_id } = req.query;

        if (!project_id) {
            return responses.badRequest(res, '缺少 project_id 參數');
        }

        // 查詢遊戲資訊
        const game = await database.get(
            `SELECT * FROM games WHERE id = ? AND is_active = 1`,
            [gameId]
        );

        if (!game) {
            return responses.notFound(res, '遊戲不存在或未啟用');
        }

        // 查詢專案綁定資訊
        const binding = await database.get(
            `SELECT * FROM project_games
             WHERE project_id = ? AND game_id = ? AND is_active = 1`,
            [project_id, gameId]
        );

        if (!binding) {
            return responses.notFound(res, '專案未綁定此遊戲');
        }

        const responseData = {
            id: game.id,
            name_zh: game.game_name_zh,
            name_en: game.game_name_en,
            game_url: game.game_url,
            game_version: game.game_version,
            is_active: game.is_active
        };

        // 如果有綁定兌換券，返回兌換券資訊
        if (binding.voucher_id) {
            const voucher = await database.get(
                `SELECT v.*, vc.min_score, vc.min_play_time
                 FROM vouchers v
                 LEFT JOIN voucher_conditions vc ON v.id = vc.voucher_id
                 WHERE v.id = ? AND v.is_active = 1`,
                [binding.voucher_id]
            );

            if (voucher) {
                responseData.voucher = {
                    id: voucher.id,
                    name: voucher.voucher_name,
                    value: voucher.voucher_value,
                    current_stock: voucher.remaining_quantity,
                    conditions: {
                        min_score: voucher.min_score,
                        min_play_time: voucher.min_play_time
                    }
                };
            }
        }

        return responses.success(res, responseData);

    } catch (error) {
        console.error('獲取遊戲資訊失敗:', error);
        return responses.serverError(res, '獲取遊戲資訊失敗', error);
    }
});

module.exports = router;

