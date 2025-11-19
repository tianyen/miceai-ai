/**
 * 攤位遊戲綁定 API 路由
 * 路徑: /api/admin/booths/:boothId/games
 * 
 * 符合規範:
 * - P1-2: 遊戲綁定從專案層級改為攤位層級
 * - P1-6: 欄位命名統一（使用 _at 後綴）
 * - P1-7: API 端點命名統一（/api/admin/*）
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const { param, body, validationResult } = require('express-validator');
const database = require('../../../config/database');
const responses = require('../../../utils/responses');
const QRCode = require('qrcode');
const config = require('../../../config');
const ErrorCodes = require('../../../utils/error-codes');
const AppError = require('../../../utils/app-error');

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

        const boothId = req.params.boothId;

        // 檢查攤位是否存在
        const booth = await database.get('SELECT * FROM booths WHERE id = ?', [boothId]);
        if (!booth) {
            throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { resource: 'booth', id: boothId });
        }

        // 獲取攤位綁定的遊戲列表
        const boothGames = await database.query(`
            SELECT
                bg.*,
                g.game_name_zh,
                g.game_name_en,
                g.game_url,
                g.game_version,
                g.is_active as game_is_active,
                v.voucher_name,
                v.voucher_value,
                v.remaining_quantity,
                v.total_quantity
            FROM booth_games bg
            LEFT JOIN games g ON bg.game_id = g.id
            LEFT JOIN vouchers v ON bg.voucher_id = v.id
            WHERE bg.booth_id = ?
            ORDER BY bg.created_at DESC
        `, [boothId]);

        return responses.success(res, { games: boothGames }, '獲取遊戲列表成功');
    } catch (error) {
        if (error instanceof AppError) {
            return responses.error(res, error);
        }
        console.error('獲取遊戲列表失敗:', error);
        return responses.serverError(res, '獲取遊戲列表失敗', error);
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

        const boothId = req.params.boothId;
        const { game_id, voucher_id } = req.body;

        // 檢查攤位是否存在
        const booth = await database.get('SELECT * FROM booths WHERE id = ?', [boothId]);
        if (!booth) {
            throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { resource: 'booth', id: boothId });
        }

        // 檢查遊戲是否存在
        const game = await database.get('SELECT * FROM games WHERE id = ?', [game_id]);
        if (!game) {
            throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { resource: 'game', id: game_id });
        }

        // 檢查是否已綁定
        const existing = await database.get(
            'SELECT * FROM booth_games WHERE booth_id = ? AND game_id = ?',
            [boothId, game_id]
        );
        if (existing) {
            throw new AppError(ErrorCodes.DUPLICATE_ENTRY, { message: '此遊戲已綁定到該攤位' });
        }

        // 如果有兌換券，檢查兌換券是否存在
        if (voucher_id) {
            const voucher = await database.get('SELECT * FROM vouchers WHERE id = ?', [voucher_id]);
            if (!voucher) {
                throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { resource: 'voucher', id: voucher_id });
            }
        }

        // 生成 QR Code
        const qrData = {
            type: 'game',
            booth_id: boothId,
            game_id: game_id,
            booth_code: booth.booth_code,
            game_name: game.game_name_zh
        };

        const qrCodeUrl = `${config.app.baseUrl}/api/v1/game/start?data=${encodeURIComponent(JSON.stringify(qrData))}`;
        const qrCodeBase64 = await QRCode.toDataURL(qrCodeUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // 插入綁定記錄
        const result = await database.run(`
            INSERT INTO booth_games (booth_id, game_id, voucher_id, qr_code_base64)
            VALUES (?, ?, ?, ?)
        `, [boothId, game_id, voucher_id || null, qrCodeBase64]);

        return responses.success(res, { id: result.lastID }, '遊戲綁定成功', 201);
    } catch (error) {
        if (error instanceof AppError) {
            return responses.error(res, error);
        }
        console.error('綁定遊戲失敗:', error);
        return responses.serverError(res, '綁定遊戲失敗', error);
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

        const { boothId, id } = req.params;
        const { voucher_id, is_active } = req.body;

        // 檢查綁定是否存在
        const binding = await database.get(
            'SELECT * FROM booth_games WHERE id = ? AND booth_id = ?',
            [id, boothId]
        );
        if (!binding) {
            throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { resource: 'game binding', id });
        }

        // 更新綁定
        const updates = [];
        const params = [];

        if (voucher_id !== undefined) {
            updates.push('voucher_id = ?');
            params.push(voucher_id || null);
        }

        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id, boothId);

            await database.run(`
                UPDATE booth_games
                SET ${updates.join(', ')}
                WHERE id = ? AND booth_id = ?
            `, params);
        }

        return responses.success(res, null, '更新成功');
    } catch (error) {
        if (error instanceof AppError) {
            return responses.error(res, error);
        }
        console.error('更新綁定失敗:', error);
        return responses.serverError(res, '更新綁定失敗', error);
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

        const { boothId, id } = req.params;

        // 檢查綁定是否存在
        const binding = await database.get(
            'SELECT * FROM booth_games WHERE id = ? AND booth_id = ?',
            [id, boothId]
        );
        if (!binding) {
            throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { resource: 'game binding', id });
        }

        // 刪除綁定
        await database.run('DELETE FROM booth_games WHERE id = ? AND booth_id = ?', [id, boothId]);

        return responses.success(res, null, '解除綁定成功');
    } catch (error) {
        if (error instanceof AppError) {
            return responses.error(res, error);
        }
        console.error('解除綁定失敗:', error);
        return responses.serverError(res, '解除綁定失敗', error);
    }
});

module.exports = router;

