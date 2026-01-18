/**
 * 後台 QR Code 名片管理 API
 * 路徑: /api/admin/business-cards
 *
 * @refactor 2025-12-01: 使用 businessCardService，遵循 3-Tier Architecture
 */

const express = require('express');
const router = express.Router();
const { businessCardService } = require('../../../services');
const { authenticateSession } = require('../../../middleware/auth');
const responses = require('../../../utils/responses');
const { param, query, validationResult } = require('express-validator');

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
 * /api/admin/business-cards/project/{projectId}:
 *   get:
 *     tags: [Admin - Business Cards]
 *     summary: 獲取專案下的所有名片列表
 *     description: 支援分頁和搜尋功能
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 專案 ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每頁筆數 (1-100)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜尋關鍵字 (姓名、公司、Email)
 *     responses:
 *       200:
 *         description: 成功獲取名片列表
 *       404:
 *         description: 專案不存在
 */
router.get('/project/:projectId', authenticateSession, [
    param('projectId').isInt({ min: 1 }).withMessage('專案 ID 必須是正整數'),
    query('page').optional().isInt({ min: 1 }).withMessage('頁碼必須是正整數'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每頁筆數必須在 1-100 之間'),
    query('search').optional().isLength({ max: 100 }).withMessage('搜尋關鍵字長度不能超過 100 字符')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const result = await businessCardService.getCardsByProject(req.params.projectId, {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            search: req.query.search || ''
        });

        return responses.success(res, result);
    } catch (error) {
        return handleServiceError(res, error, '獲取名片列表失敗');
    }
});

/**
 * @swagger
 * /api/admin/business-cards/{cardId}:
 *   get:
 *     tags: [Admin - Business Cards]
 *     summary: 獲取名片詳細資訊
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: string
 *         description: 名片 ID
 *     responses:
 *       200:
 *         description: 成功獲取名片詳情
 *       404:
 *         description: 名片不存在
 */
router.get('/:cardId', authenticateSession, [
    param('cardId').isLength({ min: 1, max: 50 }).withMessage('名片 ID 長度必須在 1-50 字符之間')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const result = await businessCardService.getCardById(req.params.cardId);
        return responses.success(res, result);
    } catch (error) {
        return handleServiceError(res, error, '獲取名片詳情失敗');
    }
});

/**
 * @swagger
 * /api/admin/business-cards/{cardId}/status:
 *   patch:
 *     tags: [Admin - Business Cards]
 *     summary: 停用/啟用名片
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: string
 *         description: 名片 ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_active:
 *                 type: boolean
 *                 description: 新狀態（可選，不提供則切換）
 *     responses:
 *       200:
 *         description: 成功更新狀態
 *       404:
 *         description: 名片不存在
 */
router.patch('/:cardId/status', authenticateSession, [
    param('cardId').isLength({ min: 1, max: 50 }).withMessage('名片 ID 長度必須在 1-50 字符之間')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const result = await businessCardService.toggleStatus(req.params.cardId, req.body.is_active);
        return responses.success(res, result, result.message);
    } catch (error) {
        return handleServiceError(res, error, '更新名片狀態失敗');
    }
});

/**
 * @swagger
 * /api/admin/business-cards/{cardId}:
 *   delete:
 *     tags: [Admin - Business Cards]
 *     summary: 刪除名片
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: string
 *         description: 名片 ID
 *     responses:
 *       200:
 *         description: 成功刪除名片
 *       404:
 *         description: 名片不存在
 */
router.delete('/:cardId', authenticateSession, [
    param('cardId').isLength({ min: 1, max: 50 }).withMessage('名片 ID 長度必須在 1-50 字符之間')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const result = await businessCardService.deleteCard(req.params.cardId);
        return responses.success(res, result, '名片刪除成功');
    } catch (error) {
        return handleServiceError(res, error, '刪除名片失敗');
    }
});

module.exports = router;
