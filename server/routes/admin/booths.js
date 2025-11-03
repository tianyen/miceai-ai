/**
 * 攤位管理路由
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const database = require('../../config/database');
const responses = require('../../utils/responses');

// 攤位列表頁面
router.get('/', (req, res) => {
    res.render('admin/booths', {
        layout: 'admin',
        pageTitle: '攤位管理',
        currentPage: 'booths',
        user: req.user,
        breadcrumbs: [
            { name: '首頁', url: '/admin' },
            { name: '攤位管理', url: '/admin/booths' }
        ]
    });
});

// 攤位統計頁面
router.get('/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;

        // 獲取攤位資訊
        const booth = await database.get(`
            SELECT b.*, p.project_name
            FROM booths b
            LEFT JOIN event_projects p ON b.project_id = p.id
            WHERE b.id = ?
        `, [id]);

        if (!booth) {
            return res.status(404).render('admin/error', {
                layout: 'admin',
                pageTitle: '攤位不存在',
                message: '找不到指定的攤位',
                user: req.user
            });
        }

        res.render('admin/booth-stats', {
            layout: 'admin',
            pageTitle: `攤位統計 - ${booth.booth_name}`,
            currentPage: 'booths',
            user: req.user,
            booth: booth,
            breadcrumbs: [
                { name: '首頁', url: '/admin' },
                { name: '攤位管理', url: '/admin/booths' },
                { name: booth.booth_name, url: `/admin/booths/${id}/stats` }
            ]
        });
    } catch (error) {
        console.error('載入攤位統計頁面失敗:', error);
        return res.status(500).render('admin/error', {
            layout: 'admin',
            pageTitle: '系統錯誤',
            message: '載入攤位統計頁面失敗',
            user: req.user
        });
    }
});

// 獲取所有攤位（API）
router.get('/api/list', async (req, res) => {
    try {
        const { project_id } = req.query;

        let query = `
            SELECT 
                b.*,
                p.project_name,
                COUNT(DISTINCT gs.id) as session_count,
                COUNT(DISTINCT gs.trace_id) as player_count
            FROM booths b
            LEFT JOIN event_projects p ON b.project_id = p.id
            LEFT JOIN game_sessions gs ON b.id = gs.booth_id
        `;

        const params = [];
        if (project_id) {
            query += ' WHERE b.project_id = ?';
            params.push(project_id);
        }

        query += ' GROUP BY b.id ORDER BY b.created_at DESC';

        const booths = await database.query(query, params);
        return responses.success(res, { booths }, '獲取攤位列表成功');
    } catch (error) {
        console.error('獲取攤位列表失敗:', error);
        return responses.serverError(res, '獲取攤位列表失敗');
    }
});

// 獲取單個攤位詳情
router.get('/api/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const booth = await database.get(
            `SELECT b.*, p.project_name
             FROM booths b
             LEFT JOIN event_projects p ON b.project_id = p.id
             WHERE b.id = ?`,
            [id]
        );

        if (!booth) {
            return responses.notFound(res, '找不到攤位');
        }

        return responses.success(res, { booth }, '獲取攤位詳情成功');
    } catch (error) {
        console.error('獲取攤位詳情失敗:', error);
        return responses.serverError(res, '獲取攤位詳情失敗');
    }
});

// 新增攤位
router.post('/api', [
    body('project_id').isInt().withMessage('專案 ID 必須是整數'),
    body('booth_name').trim().notEmpty().withMessage('攤位名稱不能為空'),
    body('booth_code').trim().notEmpty().withMessage('攤位代碼不能為空'),
    body('location').optional().trim(),
    body('description').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.badRequest(res, errors.array()[0].msg);
        }

        const { project_id, booth_name, booth_code, location, description } = req.body;

        // 檢查攤位代碼是否已存在
        const existing = await database.get(
            'SELECT id FROM booths WHERE booth_code = ?',
            [booth_code]
        );

        if (existing) {
            return responses.badRequest(res, '攤位代碼已存在');
        }

        // 新增攤位
        const result = await database.run(
            `INSERT INTO booths (project_id, booth_name, booth_code, location, description, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [project_id, booth_name, booth_code, location || '', description || '', 1]
        );

        return responses.success(res, { id: result }, '新增攤位成功');
    } catch (error) {
        console.error('新增攤位失敗:', error);
        return responses.serverError(res, '新增攤位失敗');
    }
});

// 更新攤位
router.put('/api/:id', [
    body('booth_name').optional().trim().notEmpty().withMessage('攤位名稱不能為空'),
    body('booth_code').optional().trim().notEmpty().withMessage('攤位代碼不能為空'),
    body('location').optional().trim(),
    body('description').optional().trim(),
    body('is_active').optional().isBoolean().withMessage('狀態必須是布林值')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.badRequest(res, errors.array()[0].msg);
        }

        const { id } = req.params;
        const { booth_name, booth_code, location, description, is_active } = req.body;

        // 檢查攤位是否存在
        const booth = await database.get('SELECT id FROM booths WHERE id = ?', [id]);
        if (!booth) {
            return responses.notFound(res, '找不到攤位');
        }

        // 如果更新攤位代碼，檢查是否重複
        if (booth_code) {
            const existing = await database.get(
                'SELECT id FROM booths WHERE booth_code = ? AND id != ?',
                [booth_code, id]
            );
            if (existing) {
                return responses.badRequest(res, '攤位代碼已存在');
            }
        }

        // 更新攤位
        const updates = [];
        const params = [];

        if (booth_name !== undefined) {
            updates.push('booth_name = ?');
            params.push(booth_name);
        }
        if (booth_code !== undefined) {
            updates.push('booth_code = ?');
            params.push(booth_code);
        }
        if (location !== undefined) {
            updates.push('location = ?');
            params.push(location);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        await database.run(
            `UPDATE booths SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        return responses.success(res, null, '更新攤位成功');
    } catch (error) {
        console.error('更新攤位失敗:', error);
        return responses.serverError(res, '更新攤位失敗');
    }
});

// 刪除攤位
router.delete('/api/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 檢查攤位是否存在
        const booth = await database.get('SELECT id FROM booths WHERE id = ?', [id]);
        if (!booth) {
            return responses.notFound(res, '找不到攤位');
        }

        // 檢查是否有關聯的遊戲會話
        const sessions = await database.get(
            'SELECT COUNT(*) as count FROM game_sessions WHERE booth_id = ?',
            [id]
        );

        if (sessions.count > 0) {
            return responses.badRequest(res, '此攤位已有遊戲記錄，無法刪除');
        }

        // 刪除攤位
        await database.run('DELETE FROM booths WHERE id = ?', [id]);

        return responses.success(res, null, '刪除攤位成功');
    } catch (error) {
        console.error('刪除攤位失敗:', error);
        return responses.serverError(res, '刪除攤位失敗');
    }
});

// 攤位統計
router.get('/api/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;
        const { date } = req.query;

        // 檢查攤位是否存在
        const booth = await database.get('SELECT * FROM booths WHERE id = ?', [id]);
        if (!booth) {
            return responses.notFound(res, '找不到攤位');
        }

        let dateFilter = '';
        const params = [id];

        if (date) {
            dateFilter = 'AND DATE(gs.session_start) = ?';
            params.push(date);
        }

        // 總覽統計
        const summary = await database.get(`
            SELECT 
                COUNT(DISTINCT gs.trace_id) as total_players,
                COUNT(gs.id) as total_sessions,
                AVG(gs.final_score) as avg_score,
                MAX(gs.final_score) as max_score,
                AVG(gs.total_play_time) as avg_play_time,
                SUM(gs.voucher_earned) as vouchers_earned
            FROM game_sessions gs
            WHERE gs.booth_id = ? ${dateFilter}
        `, params);

        // 每小時統計
        const hourlyStats = await database.query(`
            SELECT 
                strftime('%Y-%m-%d %H:00', gs.session_start) as hour,
                COUNT(DISTINCT gs.trace_id) as player_count,
                COUNT(gs.id) as session_count,
                AVG(gs.final_score) as avg_score
            FROM game_sessions gs
            WHERE gs.booth_id = ? ${dateFilter}
            GROUP BY hour
            ORDER BY hour DESC
            LIMIT 24
        `, params);

        return responses.success(res, {
            booth,
            summary: {
                total_players: summary.total_players || 0,
                total_sessions: summary.total_sessions || 0,
                avg_score: Math.round(summary.avg_score * 10) / 10 || 0,
                max_score: summary.max_score || 0,
                avg_play_time: Math.round(summary.avg_play_time * 10) / 10 || 0,
                vouchers_earned: summary.vouchers_earned || 0
            },
            hourly_stats: hourlyStats
        }, '獲取攤位統計成功');
    } catch (error) {
        console.error('獲取攤位統計失敗:', error);
        return responses.serverError(res, '獲取攤位統計失敗');
    }
});

module.exports = router;

