/**
 * 遊戲管理路由
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const database = require('../../config/database');
const responses = require('../../utils/responses');

// 遊戲管理頁面
router.get('/', (req, res) => {
    res.render('admin/games', {
        layout: 'admin',
        pageTitle: '遊戲管理',
        currentPage: 'games',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '遊戲室', url: '#' },
            { name: '遊戲管理' }
        ]
    });
});

// 遊戲統計報告頁面
router.get('/:gameId/stats', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { project_id } = req.query;

        if (!project_id) {
            return res.status(400).render('admin/404', {
                layout: 'admin',
                pageTitle: '缺少參數',
                message: '缺少 project_id 參數'
            });
        }

        // 查詢遊戲資訊
        const game = await database.get(
            'SELECT * FROM games WHERE id = ?',
            [gameId]
        );

        if (!game) {
            return res.status(404).render('admin/404', {
                layout: 'admin',
                pageTitle: '遊戲不存在'
            });
        }

        // 查詢專案資訊
        const project = await database.get(
            'SELECT * FROM invitation_projects WHERE id = ?',
            [project_id]
        );

        if (!project) {
            return res.status(404).render('admin/404', {
                layout: 'admin',
                pageTitle: '專案不存在'
            });
        }

        res.render('admin/game-stats', {
            layout: 'admin',
            pageTitle: `遊戲統計 - ${game.game_name_zh}`,
            currentPage: 'games',
            user: req.user,
            gameId: gameId,
            projectId: project_id,
            gameName: game.game_name_zh,
            projectName: project.project_name,
            breadcrumbs: [
                { name: '儀表板', url: '/admin/dashboard' },
                { name: '活動管理', url: '/admin/projects' },
                { name: project.project_name, url: `/admin/projects/${project_id}/detail` },
                { name: '遊戲統計' }
            ]
        });

    } catch (error) {
        console.error('載入遊戲統計頁面失敗:', error);
        res.status(500).render('admin/500', {
            layout: 'admin',
            pageTitle: '伺服器錯誤'
        });
    }
});

// 獲取遊戲列表 API
router.get('/api/list', async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', is_active = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT g.*, u.full_name as creator_name
            FROM games g
            LEFT JOIN users u ON g.created_by = u.id
            WHERE 1=1
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM games WHERE 1=1';
        let params = [];
        let countParams = [];

        // 搜尋條件
        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            query += ` AND (g.game_name_zh LIKE ? OR g.game_name_en LIKE ? OR g.description LIKE ?)`;
            countQuery += ` AND (game_name_zh LIKE ? OR game_name_en LIKE ? OR description LIKE ?)`;
            params.push(searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        // 狀態篩選
        if (is_active !== '') {
            query += ` AND g.is_active = ?`;
            countQuery += ` AND is_active = ?`;
            params.push(is_active);
            countParams.push(is_active);
        }

        query += ` ORDER BY g.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const games = await database.query(query, params);
        const totalResult = await database.get(countQuery, countParams);
        const total = totalResult.total;

        return responses.paginated(res, games, {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('獲取遊戲列表失敗:', error);
        return responses.error(res, '獲取遊戲列表失敗', 500);
    }
});

// 獲取單一遊戲 API
router.get('/api/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const game = await database.get('SELECT * FROM games WHERE id = ?', [id]);

        if (!game) {
            return responses.notFound(res, '遊戲');
        }

        return responses.success(res, game);
    } catch (error) {
        console.error('獲取遊戲失敗:', error);
        return responses.error(res, '獲取遊戲失敗', 500);
    }
});

// 新增遊戲 API
router.post('/api', [
    body('game_name_zh').trim().notEmpty().withMessage('遊戲中文名稱為必填'),
    body('game_name_en').trim().notEmpty().withMessage('遊戲英文名稱為必填'),
    body('game_url').trim().isURL().withMessage('遊戲 URL 格式不正確'),
    body('game_version').optional().trim(),
    body('description').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, errors.array());
        }

        const { game_name_zh, game_name_en, game_url, game_version = '1.0.0', description = '' } = req.body;
        const created_by = req.user.id;

        const result = await database.run(`
            INSERT INTO games (game_name_zh, game_name_en, game_url, game_version, description, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, 1, ?)
        `, [game_name_zh, game_name_en, game_url, game_version, description, created_by]);

        const newGame = await database.get('SELECT * FROM games WHERE id = ?', [result.lastID]);

        return responses.success(res, newGame, '遊戲新增成功');
    } catch (error) {
        console.error('新增遊戲失敗:', error);
        return responses.error(res, '新增遊戲失敗', 500);
    }
});

// 更新遊戲 API
router.put('/api/:id', [
    body('game_name_zh').optional().trim().notEmpty().withMessage('遊戲中文名稱不能為空'),
    body('game_name_en').optional().trim().notEmpty().withMessage('遊戲英文名稱不能為空'),
    body('game_url').optional().trim().isURL().withMessage('遊戲 URL 格式不正確'),
    body('game_version').optional().trim(),
    body('description').optional().trim(),
    body('is_active').optional().isBoolean().withMessage('狀態必須為布林值')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, errors.array());
        }

        const { id } = req.params;
        const game = await database.get('SELECT * FROM games WHERE id = ?', [id]);

        if (!game) {
            return responses.notFound(res, '遊戲');
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

        if (updates.length === 0) {
            return responses.error(res, '沒有要更新的欄位', 400);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        await database.run(
            `UPDATE games SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        const updatedGame = await database.get('SELECT * FROM games WHERE id = ?', [id]);

        return responses.success(res, updatedGame, '遊戲更新成功');
    } catch (error) {
        console.error('更新遊戲失敗:', error);
        return responses.error(res, '更新遊戲失敗', 500);
    }
});

// 刪除遊戲 API（軟刪除）
router.delete('/api/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const game = await database.get('SELECT * FROM games WHERE id = ?', [id]);

        if (!game) {
            return responses.notFound(res, '遊戲');
        }

        // 檢查是否有專案正在使用此遊戲
        const projectGames = await database.query(
            'SELECT COUNT(*) as count FROM project_games WHERE game_id = ? AND is_active = 1',
            [id]
        );

        if (projectGames[0].count > 0) {
            return responses.error(res, '此遊戲正在被專案使用，無法刪除', 400);
        }

        // 軟刪除
        await database.run(
            'UPDATE games SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );

        return responses.success(res, null, '遊戲刪除成功');
    } catch (error) {
        console.error('刪除遊戲失敗:', error);
        return responses.error(res, '刪除遊戲失敗', 500);
    }
});

// 切換遊戲狀態 API
router.patch('/api/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const game = await database.get('SELECT * FROM games WHERE id = ?', [id]);

        if (!game) {
            return responses.notFound(res, '遊戲');
        }

        const newStatus = game.is_active ? 0 : 1;
        await database.run(
            'UPDATE games SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newStatus, id]
        );

        const updatedGame = await database.get('SELECT * FROM games WHERE id = ?', [id]);

        return responses.success(res, updatedGame, `遊戲已${newStatus ? '啟用' : '停用'}`);
    } catch (error) {
        console.error('切換遊戲狀態失敗:', error);
        return responses.error(res, '切換遊戲狀態失敗', 500);
    }
});

// 獲取遊戲會話列表 API
router.get('/api/:id/sessions', async (req, res) => {
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
            LEFT JOIN invitation_projects p ON gs.project_id = p.id
            LEFT JOIN vouchers v ON gs.voucher_id = v.id
            WHERE gs.game_id = ?
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM game_sessions WHERE game_id = ?';
        let params = [id];
        let countParams = [id];

        // 搜尋條件
        if (trace_id && trace_id.trim()) {
            query += ` AND gs.trace_id LIKE ?`;
            countQuery += ` AND trace_id LIKE ?`;
            const searchTerm = `%${trace_id.trim()}%`;
            params.push(searchTerm);
            countParams.push(searchTerm);
        }

        query += ` ORDER BY gs.session_start DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const sessions = await database.query(query, params);
        const totalResult = await database.get(countQuery, countParams);
        const total = totalResult.total;

        return responses.paginated(res, sessions, {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('獲取遊戲會話列表失敗:', error);
        return responses.error(res, '獲取遊戲會話列表失敗', 500);
    }
});

// 獲取遊戲日誌列表 API
router.get('/api/:id/logs', async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 50, trace_id = '', log_level = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT
                gl.*,
                g.game_name_zh,
                g.game_name_en,
                p.project_name
            FROM game_logs gl
            LEFT JOIN games g ON gl.game_id = g.id
            LEFT JOIN invitation_projects p ON gl.project_id = p.id
            WHERE gl.game_id = ?
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM game_logs WHERE game_id = ?';
        let params = [id];
        let countParams = [id];

        // 搜尋條件
        if (trace_id && trace_id.trim()) {
            query += ` AND gl.trace_id LIKE ?`;
            countQuery += ` AND trace_id LIKE ?`;
            const searchTerm = `%${trace_id.trim()}%`;
            params.push(searchTerm);
            countParams.push(searchTerm);
        }

        if (log_level && log_level.trim()) {
            query += ` AND gl.log_level = ?`;
            countQuery += ` AND log_level = ?`;
            params.push(log_level.trim());
            countParams.push(log_level.trim());
        }

        query += ` ORDER BY gl.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const logs = await database.query(query, params);
        const totalResult = await database.get(countQuery, countParams);
        const total = totalResult.total;

        return responses.paginated(res, logs, {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('獲取遊戲日誌列表失敗:', error);
        return responses.error(res, '獲取遊戲日誌列表失敗', 500);
    }
});

// 獲取遊戲統計 API
router.get('/api/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;

        // 總會話數
        const totalSessions = await database.get(
            'SELECT COUNT(*) as count FROM game_sessions WHERE game_id = ?',
            [id]
        );

        // 總日誌數
        const totalLogs = await database.get(
            'SELECT COUNT(*) as count FROM game_logs WHERE game_id = ?',
            [id]
        );

        // 獨立玩家數（按 trace_id）
        const uniquePlayers = await database.get(
            'SELECT COUNT(DISTINCT trace_id) as count FROM game_sessions WHERE game_id = ?',
            [id]
        );

        // 兌換券發放數
        const vouchersEarned = await database.get(
            'SELECT COUNT(*) as count FROM game_sessions WHERE game_id = ? AND voucher_earned = 1',
            [id]
        );

        // 平均分數
        const avgScore = await database.get(
            'SELECT AVG(final_score) as avg FROM game_sessions WHERE game_id = ? AND final_score > 0',
            [id]
        );

        // 平均遊戲時間
        const avgPlayTime = await database.get(
            'SELECT AVG(total_play_time) as avg FROM game_sessions WHERE game_id = ? AND total_play_time > 0',
            [id]
        );

        // 最高分
        const highScore = await database.get(
            'SELECT MAX(final_score) as max, trace_id FROM game_sessions WHERE game_id = ?',
            [id]
        );

        return responses.success(res, {
            total_sessions: totalSessions.count,
            total_logs: totalLogs.count,
            unique_players: uniquePlayers.count,
            vouchers_earned: vouchersEarned.count,
            avg_score: Math.round(avgScore.avg || 0),
            avg_play_time: Math.round(avgPlayTime.avg || 0),
            high_score: highScore.max || 0,
            high_score_player: highScore.trace_id || null
        });
    } catch (error) {
        console.error('獲取遊戲統計失敗:', error);
        return responses.error(res, '獲取遊戲統計失敗', 500);
    }
});

module.exports = router;

