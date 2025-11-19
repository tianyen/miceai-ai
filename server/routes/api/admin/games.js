/**
 * 遊戲管理 API 路由
 * 路徑: /api/admin/games
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const database = require('../../../config/database');
const responses = require('../../../utils/responses');
const logger = require('../../../utils/logger');
const ErrorCodes = require('../../../utils/error-codes');
const AppError = require('../../../utils/app-error');

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
        const { page = 1, limit = 20, search = '', is_active = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT * FROM games
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (game_name_zh LIKE ? OR game_name_en LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        if (is_active !== '') {
            query += ` AND is_active = ?`;
            params.push(is_active);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const games = await database.all(query, params);

        // 獲取總數
        let countQuery = `SELECT COUNT(*) as total FROM games WHERE 1=1`;
        const countParams = [];

        if (search) {
            countQuery += ` AND (game_name_zh LIKE ? OR game_name_en LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`);
        }

        if (is_active !== '') {
            countQuery += ` AND is_active = ?`;
            countParams.push(is_active);
        }

        const { total } = await database.get(countQuery, countParams);

        logger.info('獲取遊戲列表', {
            page,
            limit,
            search,
            is_active,
            total,
            count: games.length
        });

        return responses.success(res, {
            games,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(total / limit),
                total_items: total,
                items_per_page: parseInt(limit)
            }
        }, '成功獲取遊戲列表');
    } catch (error) {
        logger.error('獲取遊戲列表失敗', { error: error.message }, error);
        return responses.serverError(res, '獲取遊戲列表失敗', error);
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
        const { id } = req.params;
        const game = await database.get('SELECT * FROM games WHERE id = ?', [id]);

        if (!game) {
            throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, '遊戲不存在');
        }

        logger.info('獲取遊戲資訊', { game_id: id });
        return responses.success(res, { game }, '成功獲取遊戲資訊');
    } catch (error) {
        if (error instanceof AppError) {
            return responses.error(res, error);
        }
        logger.error('獲取遊戲資訊失敗', { game_id: req.params.id, error: error.message }, error);
        return responses.serverError(res, '獲取遊戲資訊失敗', error);
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
            throw new AppError(ErrorCodes.VALIDATION_ERROR, '驗證失敗', errors.array());
        }

        const { game_name_zh, game_name_en, game_url, game_version, description, is_active = 1 } = req.body;

        const result = await database.run(
            `INSERT INTO games (game_name_zh, game_name_en, game_url, game_version, description, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [game_name_zh, game_name_en, game_url, game_version || null, description || null, is_active ? 1 : 0]
        );

        const game = await database.get('SELECT * FROM games WHERE id = ?', [result.lastID]);

        logger.business('遊戲創建', {
            game_id: result.lastID,
            game_name_zh,
            game_name_en,
            user_id: req.user?.id
        });

        return responses.success(res, { game }, '成功創建遊戲', 201);
    } catch (error) {
        if (error instanceof AppError) {
            return responses.error(res, error);
        }
        logger.error('創建遊戲失敗', { error: error.message }, error);
        return responses.serverError(res, '創建遊戲失敗', error);
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
            throw new AppError(ErrorCodes.VALIDATION_ERROR, '驗證失敗', errors.array());
        }

        const { id } = req.params;
        const game = await database.get('SELECT * FROM games WHERE id = ?', [id]);

        if (!game) {
            throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, '遊戲不存在');
        }

        const updates = [];
        const params = [];

        if (req.body.game_name_zh !== undefined) {
            updates.push('game_name_zh = ?');
            params.push(req.body.game_name_zh);
        }
        if (req.body.game_name_en !== undefined) {
            updates.push('game_name_en = ?');
            params.push(req.body.game_name_en);
        }
        if (req.body.game_url !== undefined) {
            updates.push('game_url = ?');
            params.push(req.body.game_url);
        }
        if (req.body.game_version !== undefined) {
            updates.push('game_version = ?');
            params.push(req.body.game_version);
        }
        if (req.body.description !== undefined) {
            updates.push('description = ?');
            params.push(req.body.description);
        }
        if (req.body.is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(req.body.is_active ? 1 : 0);
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id);

            await database.run(
                `UPDATE games SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }

        const updatedGame = await database.get('SELECT * FROM games WHERE id = ?', [id]);

        logger.business('遊戲更新', {
            game_id: id,
            updates: Object.keys(req.body),
            user_id: req.user?.id
        });

        return responses.success(res, { game: updatedGame }, '成功更新遊戲');
    } catch (error) {
        if (error instanceof AppError) {
            return responses.error(res, error);
        }
        logger.error('更新遊戲失敗', { game_id: req.params.id, error: error.message }, error);
        return responses.serverError(res, '更新遊戲失敗', error);
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
        const { id } = req.params;
        const game = await database.get('SELECT * FROM games WHERE id = ?', [id]);

        if (!game) {
            throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, '遊戲不存在');
        }

        // 軟刪除：設置 is_active = 0
        await database.run(
            'UPDATE games SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );

        logger.business('遊戲刪除', {
            game_id: id,
            game_name_zh: game.game_name_zh,
            user_id: req.user?.id
        });

        return responses.success(res, null, '成功刪除遊戲');
    } catch (error) {
        if (error instanceof AppError) {
            return responses.error(res, error);
        }
        logger.error('刪除遊戲失敗', { game_id: req.params.id, error: error.message }, error);
        return responses.serverError(res, '刪除遊戲失敗', error);
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
        const { id } = req.params;
        const { page = 1, limit = 20, trace_id = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT
                gs.*,
                g.game_name_zh,
                g.game_name_en,
                p.project_name,
                v.voucher_name
            FROM game_sessions gs
            LEFT JOIN games g ON gs.game_id = g.id
            LEFT JOIN event_projects p ON gs.project_id = p.id
            LEFT JOIN vouchers v ON gs.voucher_id = v.id
            WHERE gs.game_id = ?
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM game_sessions WHERE game_id = ?';
        let params = [id];
        let countParams = [id];

        if (trace_id && trace_id.trim()) {
            query += ` AND gs.trace_id LIKE ?`;
            countQuery += ` AND trace_id LIKE ?`;
            const searchTerm = `%${trace_id.trim()}%`;
            params.push(searchTerm);
            countParams.push(searchTerm);
        }

        query += ` ORDER BY gs.session_start DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const sessions = await database.all(query, params);
        const totalResult = await database.get(countQuery, countParams);
        const total = totalResult.total;

        logger.info('獲取遊戲會話列表', {
            game_id: id,
            page,
            limit,
            trace_id,
            total,
            count: sessions.length
        });

        return responses.success(res, {
            sessions,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(total / limit),
                total_items: total,
                items_per_page: parseInt(limit)
            }
        }, '成功獲取會話列表');
    } catch (error) {
        logger.error('獲取遊戲會話列表失敗', { game_id: req.params.id, error: error.message }, error);
        return responses.serverError(res, '獲取遊戲會話列表失敗', error);
    }
});

module.exports = router;

