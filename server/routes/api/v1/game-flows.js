/**
 * API v1 - tolerant mobile game telemetry ingestion
 * Path: /api/v1/game-flows
 */

const express = require('express');
const router = express.Router();
const responses = require('../../../utils/responses');
const { gameFlowService } = require('../../../services');

function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.ip;
}

function handleServiceError(res, error, defaultMessage) {
    if (error?.statusCode) {
        return responses.error(
            res,
            error.message || defaultMessage,
            error.statusCode,
            error.details || null,
            error.code || null
        );
    }

    console.error(defaultMessage, error);
    return responses.serverError(res, defaultMessage, error);
}

/**
 * @swagger
 * /api/v1/game-flows/start:
 *   get:
 *     summary: 解析手機遊戲 QR bootstrap 資訊
 *     description: 根據 QR data 解析 project/booth/game/schema 上下文，供手機端流程初始化使用。
 *     tags: [Game Flows]
 *     parameters:
 *       - in: query
 *         name: data
 *         required: true
 *         schema:
 *           type: string
 *         description: 編碼後的 JSON bootstrap payload
 *     responses:
 *       200:
 *         description: 成功解析遊戲 bootstrap 資訊
 *       400:
 *         description: QR data 無效
 *       404:
 *         description: 專案、攤位或遊戲不存在
 */
router.get('/start', async (req, res) => {
    try {
        const result = await gameFlowService.getStartContext({ data: req.query.data });
        return responses.success(res, result, '遊戲 bootstrap 資訊已解析');
    } catch (error) {
        return handleServiceError(res, error, '解析遊戲 bootstrap 資訊失敗');
    }
});

/**
 * @swagger
 * /api/v1/game-flows/track:
 *   post:
 *     summary: 記錄手機遊戲流程事件
 *     description: 寬鬆型 mobile telemetry ingestion，支援 flow session 自動補建與 client_event_id 去重。
 *     tags: [Game Flows]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trace_id
 *               - flow_session_id
 *               - stage_id
 *               - event_type
 *             properties:
 *               trace_id:
 *                 type: string
 *               flow_session_id:
 *                 type: string
 *               project_id:
 *                 type: integer
 *               project_code:
 *                 type: string
 *               game_id:
 *                 type: integer
 *               game_code:
 *                 type: string
 *               booth_id:
 *                 type: integer
 *               booth_code:
 *                 type: string
 *               stage_id:
 *                 type: string
 *               event_type:
 *                 type: string
 *               session_status:
 *                 type: string
 *               client_event_id:
 *                 type: string
 *               duration_ms:
 *                 type: integer
 *               payload:
 *                 type: object
 *     responses:
 *       202:
 *         description: 遊戲流程事件已受理
 *       400:
 *         description: 請求參數錯誤
 *       404:
 *         description: 專案、攤位或遊戲不存在
 */
router.post('/track', async (req, res) => {
    try {
        const result = await gameFlowService.trackEvent(req.body || {}, {
            ipAddress: getClientIP(req),
            userAgent: req.get('User-Agent') || ''
        });

        return responses.success(res, result, '遊戲流程事件已記錄', 202);
    } catch (error) {
        return handleServiceError(res, error, '記錄遊戲流程事件失敗');
    }
});

module.exports = router;
