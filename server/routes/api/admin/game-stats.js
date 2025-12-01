/**
 * 遊戲統計 API（後端管理專用）
 * 路徑: /api/admin/games/:gameId/stats
 *
 * @refactor 2025-12-01: 使用 gameService，遵循 3-Tier Architecture
 */
const express = require('express');
const router = express.Router();
const { authenticateSession } = require('../../../middleware/auth');
const { gameService } = require('../../../services');
const responses = require('../../../utils/responses');

/**
 * 處理 Service 層錯誤
 */
function handleServiceError(res, error, defaultMessage) {
    if (error.statusCode) {
        const message = error.details?.message || error.message || defaultMessage;
        return responses.error(res, message, error.statusCode);
    }
    return responses.serverError(res, defaultMessage, error);
}

/**
 * @swagger
 * /api/admin/games/{gameId}/stats:
 *   get:
 *     tags: [Admin - Game Stats]
 *     summary: 獲取遊戲統計資料
 *     description: 支援多種統計類型：summary, hourly, fastest, top_scores
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
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [summary, hourly, fastest, top_scores]
 *           default: summary
 *         description: 統計類型
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: 日期篩選 (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: 成功獲取統計資料
 *       400:
 *         description: 缺少必要參數或無效的統計類型
 */
router.get('/:gameId/stats', authenticateSession, async (req, res) => {
    try {
        const result = await gameService.getAdminGameStats(req.params.gameId, {
            project_id: req.query.project_id,
            date: req.query.date,
            type: req.query.type || 'summary'
        });

        return responses.success(res, result, '統計資料查詢成功');
    } catch (error) {
        return handleServiceError(res, error, '查詢遊戲統計失敗');
    }
});

module.exports = router;
