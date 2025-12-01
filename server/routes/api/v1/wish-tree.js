/**
 * API v1 - 許願樹互動路由
 * 路徑: /api/v1/wish-tree
 * 用於前端許願樹（p5.js）串接
 *
 * @refactor 2025-12-01: 使用 wishTreeService
 */

const express = require('express');
const router = express.Router();
const { wishTreeService } = require('../../../services');
const responses = require('../../../utils/responses');

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
        const message = error.details?.message || error.message || defaultMessage;
        return responses.error(res, message, error.statusCode);
    }

    return responses.serverError(res, defaultMessage, error);
}

/**
 * @swagger
 * /api/v1/wish-tree/submit:
 *   post:
 *     summary: 提交許願樹互動數據
 *     description: 記錄用戶在許願樹活動中提交的願望文字和圖片
 *     tags: [許願樹]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - project_id
 *               - wish_text
 *             properties:
 *               project_id:
 *                 type: integer
 *                 description: 專案 ID
 *                 example: 5
 *               booth_id:
 *                 type: integer
 *                 description: 攤位 ID（選填）
 *                 example: 4
 *               wish_text:
 *                 type: string
 *                 description: 許願文字內容
 *                 example: "希望2025年事業順利，平安健康"
 *               image_base64:
 *                 type: string
 *                 description: 許願卡圖片 Base64 編碼（選填）
 *     responses:
 *       200:
 *         description: 許願提交成功
 *       400:
 *         description: 請求參數錯誤
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/submit', async (req, res) => {
    try {
        const result = await wishTreeService.submitWish(req.body, {
            ipAddress: getClientIP(req),
            userAgent: req.get('User-Agent') || ''
        });

        console.log(`許願已記錄: id=${result.id}, project_id=${req.body.project_id}`);

        return responses.success(res, result, '許願提交成功');

    } catch (error) {
        return handleServiceError(res, error, '提交許願失敗');
    }
});

/**
 * @swagger
 * /api/v1/wish-tree/stats:
 *   get:
 *     summary: 獲取許願樹統計數據
 *     description: 獲取許願樹的統計資訊，包括互動高峰頻率分析
 *     tags: [許願樹]
 *     parameters:
 *       - in: query
 *         name: project_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: booth_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功獲取統計數據
 *       400:
 *         description: 請求參數錯誤
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/stats', async (req, res) => {
    try {
        const result = await wishTreeService.getStats({
            project_id: req.query.project_id,
            booth_id: req.query.booth_id,
            start_date: req.query.start_date,
            end_date: req.query.end_date
        });

        return responses.success(res, result);

    } catch (error) {
        return handleServiceError(res, error, '獲取統計數據失敗');
    }
});

/**
 * @swagger
 * /api/v1/wish-tree/recent:
 *   get:
 *     summary: 獲取最近的許願記錄
 *     description: 獲取最近提交的許願記錄（不含圖片，減少數據量）
 *     tags: [許願樹]
 *     parameters:
 *       - in: query
 *         name: project_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: 成功獲取記錄
 *       400:
 *         description: 請求參數錯誤
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/recent', async (req, res) => {
    try {
        const result = await wishTreeService.getRecentWishes(
            req.query.project_id,
            req.query.limit
        );

        return responses.success(res, result);

    } catch (error) {
        return handleServiceError(res, error, '獲取最近記錄失敗');
    }
});

/**
 * @swagger
 * /api/v1/wish-tree/wish/{wishId}:
 *   get:
 *     summary: 獲取單一許願記錄（含圖片）
 *     description: 根據許願 ID 獲取完整記錄，包括 Base64 圖片
 *     tags: [許願樹]
 *     parameters:
 *       - in: path
 *         name: wishId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功獲取記錄
 *       404:
 *         description: 找不到記錄
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/wish/:wishId', async (req, res) => {
    try {
        const result = await wishTreeService.getWishById(req.params.wishId);
        return responses.success(res, result);

    } catch (error) {
        return handleServiceError(res, error, '獲取許願記錄失敗');
    }
});

module.exports = router;
