/**
 * 攤位遊戲綁定 API 路由
 * 路徑: /api/admin/booths/:boothId/games
 *
 * @refactor 2025-12-01: 使用 boothService，遵循 3-Tier Architecture
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const { param, body, validationResult } = require('express-validator');
const { boothService } = require('../../../services');
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
 * /api/admin/booths/{boothId}/games:
 *   get:
 *     summary: 獲取攤位的遊戲列表
 *     tags: [Admin - Booth Games]
 *     parameters:
 *       - in: path
 *         name: boothId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 攤位 ID
 *     responses:
 *       200:
 *         description: 成功獲取遊戲列表
 */
router.get('/', [
    param('boothId').isInt().withMessage('攤位 ID 必須是整數')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, errors.array());
        }

        const result = await boothService.getBoothGames(req.params.boothId);

        return responses.success(res, result, '獲取遊戲列表成功');
    } catch (error) {
        return handleServiceError(res, error, '獲取遊戲列表失敗');
    }
});

/**
 * @swagger
 * /api/admin/booths/{boothId}/games:
 *   post:
 *     summary: 綁定遊戲到攤位
 *     tags: [Admin - Booth Games]
 *     parameters:
 *       - in: path
 *         name: boothId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - game_id
 *             properties:
 *               game_id:
 *                 type: integer
 *               voucher_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 綁定成功
 */
router.post('/', [
    param('boothId').isInt().withMessage('攤位 ID 必須是整數'),
    body('game_id').isInt().withMessage('遊戲 ID 必須是整數'),
    body('voucher_id').optional().isInt().withMessage('兌換券 ID 必須是整數')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, errors.array());
        }

        const result = await boothService.bindGame(req.params.boothId, {
            game_id: req.body.game_id,
            voucher_id: req.body.voucher_id
        });

        logger.business('遊戲綁定', {
            booth_id: req.params.boothId,
            game_id: req.body.game_id,
            binding_id: result.id,
            user_id: req.user?.id
        });

        return responses.success(res, result, '遊戲綁定成功', 201);
    } catch (error) {
        return handleServiceError(res, error, '綁定遊戲失敗');
    }
});

/**
 * @swagger
 * /api/admin/booths/{boothId}/games/{id}:
 *   put:
 *     summary: 更新攤位遊戲綁定設定
 *     tags: [Admin - Booth Games]
 *     parameters:
 *       - in: path
 *         name: boothId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               voucher_id:
 *                 type: integer
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 更新成功
 */
router.put('/:id', [
    param('boothId').isInt().withMessage('攤位 ID 必須是整數'),
    param('id').isInt().withMessage('綁定 ID 必須是整數'),
    body('voucher_id').optional().isInt().withMessage('兌換券 ID 必須是整數'),
    body('is_active').optional().isBoolean().withMessage('is_active 必須是布林值')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, errors.array());
        }

        await boothService.updateBinding(req.params.boothId, req.params.id, {
            voucher_id: req.body.voucher_id,
            is_active: req.body.is_active
        });

        logger.business('遊戲綁定更新', {
            booth_id: req.params.boothId,
            binding_id: req.params.id,
            user_id: req.user?.id
        });

        return responses.success(res, null, '更新成功');
    } catch (error) {
        return handleServiceError(res, error, '更新綁定失敗');
    }
});

/**
 * @swagger
 * /api/admin/booths/{boothId}/games/{id}:
 *   delete:
 *     summary: 解除遊戲綁定
 *     tags: [Admin - Booth Games]
 *     parameters:
 *       - in: path
 *         name: boothId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 解除綁定成功
 */
router.delete('/:id', [
    param('boothId').isInt().withMessage('攤位 ID 必須是整數'),
    param('id').isInt().withMessage('綁定 ID 必須是整數')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, errors.array());
        }

        await boothService.unbindGame(req.params.boothId, req.params.id);

        logger.business('遊戲綁定解除', {
            booth_id: req.params.boothId,
            binding_id: req.params.id,
            user_id: req.user?.id
        });

        return responses.success(res, null, '解除綁定成功');
    } catch (error) {
        return handleServiceError(res, error, '解除綁定失敗');
    }
});

module.exports = router;
