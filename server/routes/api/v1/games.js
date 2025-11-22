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
 *         description: 遊戲 ID
 *         schema:
 *           type: integer
 *         example: 1
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
 *                 description: 用戶 ID（選填）
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

        // 驗證必填欄位（支持 booth_id 或 project_id）
        if (!trace_id || (!booth_id && !project_id)) {
            return responses.badRequest(res, '缺少必填欄位: trace_id, booth_id 或 project_id');
        }

        // 驗證 trace_id 格式
        if (!validateTraceId(trace_id)) {
            return responses.badRequest(res, '無效的 trace_id 格式');
        }

        let binding;
        let actualBoothId = booth_id;

        // 如果提供 booth_id，直接查詢攤位遊戲綁定
        if (booth_id) {
            binding = await database.get(
                `SELECT bg.*, g.game_name_zh, g.game_name_en, g.game_url, b.project_id
                 FROM booth_games bg
                 JOIN games g ON bg.game_id = g.id
                 JOIN booths b ON bg.booth_id = b.id
                 WHERE bg.booth_id = ? AND bg.game_id = ? AND bg.is_active = 1`,
                [booth_id, gameId]
            );
        }
        // 向後兼容：如果只提供 project_id，查找該專案的第一個攤位
        else if (project_id) {
            binding = await database.get(
                `SELECT bg.*, g.game_name_zh, g.game_name_en, g.game_url, b.project_id, b.id as booth_id
                 FROM booth_games bg
                 JOIN games g ON bg.game_id = g.id
                 JOIN booths b ON bg.booth_id = b.id
                 WHERE b.project_id = ? AND bg.game_id = ? AND bg.is_active = 1
                 ORDER BY b.id ASC
                 LIMIT 1`,
                [project_id, gameId]
            );
            if (binding) {
                actualBoothId = binding.booth_id;
            }
        }

        if (!binding) {
            return responses.notFound(res, '攤位未綁定此遊戲或遊戲未啟用');
        }

        // 創建遊戲會話
        const ip_address = getClientIP(req);
        const user_agent = req.get('User-Agent') || '';

        const result = await database.run(
            `INSERT INTO game_sessions (
                project_id, game_id, booth_id, trace_id, user_id,
                ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [binding.project_id, gameId, actualBoothId, trace_id, user_id, ip_address, user_agent]
        );

        console.log(`✅ 遊戲會話已開始: session_id=${result.lastID}, trace_id=${trace_id}, game_id=${gameId}, booth_id=${actualBoothId}`);

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
 *         description: 遊戲 ID
 *         schema:
 *           type: integer
 *         example: 1
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
 *                 description: 用戶 ID（選填）
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
 *         description: 遊戲 ID
 *         schema:
 *           type: integer
 *         example: 1
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
 *                 description: 用戶 ID（選填）
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
 *                     final_score:
 *                       type: integer
 *                       example: 850
 *                     total_play_time:
 *                       type: integer
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

        // 查詢攤位綁定的兌換券（使用會話中的 booth_id）
        const binding = await database.get(
            `SELECT * FROM booth_games
             WHERE booth_id = ? AND game_id = ? AND is_active = 1`,
            [session.booth_id, gameId]
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

                            // 插入兌換記錄（包含 QR Code Base64）
                            const redemptionResult = await database.run(
                                `INSERT INTO voucher_redemptions (
                                    voucher_id, session_id, trace_id,
                                    redemption_code, qr_code_base64
                                ) VALUES (?, ?, ?, ?, ?)`,
                                [voucher.id, session.id, trace_id, redemption_code, qrCodeBase64]
                            );

                            // 更新兌換券庫存
                            await database.run(
                                `UPDATE vouchers
                                 SET remaining_quantity = remaining_quantity - 1
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
 *     description: 獲取遊戲基本資訊。如果提供 project_id，會額外返回專案綁定狀態和兌換券資訊
 *     tags: [遊戲室]
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

        // 查詢遊戲資訊
        const game = await database.get(
            `SELECT * FROM games WHERE id = ? AND is_active = 1`,
            [gameId]
        );

        if (!game) {
            return responses.notFound(res, '遊戲不存在或未啟用');
        }

        const responseData = {
            id: game.id,
            name_zh: game.game_name_zh,
            name_en: game.game_name_en,
            game_url: game.game_url,
            game_version: game.game_version,
            is_active: game.is_active
        };

        // 如果提供了 booth_id 或 project_id，查詢綁定資訊和兌換券
        let binding;
        if (booth_id) {
            binding = await database.get(
                `SELECT * FROM booth_games
                 WHERE booth_id = ? AND game_id = ? AND is_active = 1`,
                [booth_id, gameId]
            );
        } else if (project_id) {
            // 向後兼容：查找該專案的第一個攤位
            binding = await database.get(
                `SELECT bg.* FROM booth_games bg
                 JOIN booths b ON bg.booth_id = b.id
                 WHERE b.project_id = ? AND bg.game_id = ? AND bg.is_active = 1
                 ORDER BY b.id ASC
                 LIMIT 1`,
                [project_id, gameId]
            );
        }

        if (binding) {
            responseData.is_bound = true;

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
        } else if (booth_id || project_id) {
            responseData.is_bound = false;
        }

        return responses.success(res, responseData);

    } catch (error) {
        console.error('獲取遊戲資訊失敗:', error);
        return responses.serverError(res, '獲取遊戲資訊失敗', error);
    }
});

module.exports = router;

