/**
 * 遊戲管理 API 路由
 * 路徑: /api/admin/games
 *
 * @refactor 2025-12-01: 使用 gameService，遵循 3-Tier Architecture
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { gameService } = require('../../../services');
const responses = require('../../../utils/responses');
const logger = require('../../../utils/logger');

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
 * /api/admin/games:
 *   get:
 *     tags: [Admin - Games]
 *     summary: 獲取遊戲列表
 *     description: 獲取所有遊戲列表，支援分頁、搜尋和篩選
 *     parameters:
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
 *         description: 每頁數量
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜尋關鍵字（遊戲名稱）
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: string
 *           enum: ['1', '0']
 *         description: 是否啟用（1=啟用, 0=停用）
 *     responses:
 *       200:
 *         description: 成功獲取遊戲列表
 */
router.get('/', async (req, res) => {
    try {
        const result = await gameService.getList({
            page: req.query.page,
            limit: req.query.limit,
            search: req.query.search,
            is_active: req.query.is_active
        });

        return responses.success(res, result, '成功獲取遊戲列表');
    } catch (error) {
        return handleServiceError(res, error, '獲取遊戲列表失敗');
    }
});

/**
 * @swagger
 * /api/admin/games/{id}:
 *   get:
 *     tags: [Admin - Games]
 *     summary: 獲取單一遊戲
 *     description: 根據 ID 獲取遊戲詳細資訊
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 遊戲 ID
 *     responses:
 *       200:
 *         description: 成功獲取遊戲資訊
 *       404:
 *         description: 遊戲不存在
 */
router.get('/:id', async (req, res) => {
    try {
        const result = await gameService.getById(req.params.id);
        return responses.success(res, result, '成功獲取遊戲資訊');
    } catch (error) {
        return handleServiceError(res, error, '獲取遊戲資訊失敗');
    }
});

/**
 * @swagger
 * /api/admin/games:
 *   post:
 *     tags: [Admin - Games]
 *     summary: 新增遊戲
 *     description: 創建新的遊戲
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - game_name_zh
 *               - game_name_en
 *               - game_url
 *             properties:
 *               game_name_zh:
 *                 type: string
 *                 example: "Loki 飛鏢遊戲"
 *               game_name_en:
 *                 type: string
 *                 example: "Loki Dart Game"
 *               game_url:
 *                 type: string
 *                 format: uri
 *                 example: "https://loki-game.example.com"
 *               game_version:
 *                 type: string
 *                 example: "1.0.0"
 *               description:
 *                 type: string
 *                 example: "飛鏢遊戲"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: 成功創建遊戲
 *       400:
 *         description: 驗證錯誤
 */
router.post('/', [
    body('game_name_zh').trim().notEmpty().withMessage('遊戲中文名稱為必填'),
    body('game_name_en').trim().notEmpty().withMessage('遊戲英文名稱為必填'),
    body('game_url').trim().isURL().withMessage('遊戲 URL 格式不正確'),
    body('game_version').optional().trim(),
    body('description').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.badRequest(res, '驗證失敗', errors.array());
        }

        const result = await gameService.create(req.body);

        logger.business('遊戲創建', {
            game_id: result.game.id,
            game_name_zh: req.body.game_name_zh,
            game_name_en: req.body.game_name_en,
            user_id: req.user?.id
        });

        return responses.success(res, result, '成功創建遊戲', 201);
    } catch (error) {
        return handleServiceError(res, error, '創建遊戲失敗');
    }
});

/**
 * @swagger
 * /api/admin/games/{id}:
 *   put:
 *     tags: [Admin - Games]
 *     summary: 更新遊戲
 *     description: 更新遊戲資訊
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               game_name_zh:
 *                 type: string
 *               game_name_en:
 *                 type: string
 *               game_url:
 *                 type: string
 *                 format: uri
 *               game_version:
 *                 type: string
 *               description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 成功更新遊戲
 *       404:
 *         description: 遊戲不存在
 */
router.put('/:id', [
    body('game_name_zh').optional().trim().notEmpty().withMessage('遊戲中文名稱不能為空'),
    body('game_name_en').optional().trim().notEmpty().withMessage('遊戲英文名稱不能為空'),
    body('game_url').optional().trim().isURL().withMessage('遊戲 URL 格式不正確'),
    body('game_version').optional().trim(),
    body('description').optional().trim(),
    body('is_active').optional().isBoolean().withMessage('is_active 必須為布林值')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.badRequest(res, '驗證失敗', errors.array());
        }

        const result = await gameService.update(req.params.id, req.body);

        logger.business('遊戲更新', {
            game_id: req.params.id,
            updates: Object.keys(req.body),
            user_id: req.user?.id
        });

        return responses.success(res, result, '成功更新遊戲');
    } catch (error) {
        return handleServiceError(res, error, '更新遊戲失敗');
    }
});

/**
 * @swagger
 * /api/admin/games/{id}:
 *   delete:
 *     tags: [Admin - Games]
 *     summary: 刪除遊戲（軟刪除）
 *     description: 將遊戲標記為停用
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 遊戲 ID
 *     responses:
 *       200:
 *         description: 成功刪除遊戲
 *       404:
 *         description: 遊戲不存在
 */
router.delete('/:id', async (req, res) => {
    try {
        await gameService.delete(req.params.id);

        logger.business('遊戲刪除', {
            game_id: req.params.id,
            user_id: req.user?.id
        });

        return responses.success(res, null, '成功刪除遊戲');
    } catch (error) {
        return handleServiceError(res, error, '刪除遊戲失敗');
    }
});

/**
 * @swagger
 * /api/admin/games/{id}/sessions:
 *   get:
 *     tags: [Admin - Games]
 *     summary: 獲取遊戲會話列表
 *     description: 獲取指定遊戲的所有會話記錄
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 遊戲 ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: trace_id
 *         schema:
 *           type: string
 *         description: 搜尋 trace_id
 *     responses:
 *       200:
 *         description: 成功獲取會話列表
 */
router.get('/:id/sessions', async (req, res) => {
    try {
        const result = await gameService.getSessions(req.params.id, {
            page: req.query.page,
            limit: req.query.limit,
            trace_id: req.query.trace_id
        });

        return responses.success(res, result, '成功獲取會話列表');
    } catch (error) {
        return handleServiceError(res, error, '獲取遊戲會話列表失敗');
    }
});

module.exports = router;
