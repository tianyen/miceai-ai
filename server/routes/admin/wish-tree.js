/**
 * 許願樹管理路由
 */
const express = require('express');
const router = express.Router();
const database = require('../../config/database');

/**
 * 許願樹統計頁面
 */
router.get('/stats', async (req, res) => {
    try {
        const projectId = req.query.project_id || 5; // 預設為資訊月互動許願樹

        // 獲取專案資訊
        const project = await database.get(
            'SELECT * FROM event_projects WHERE id = ?',
            [projectId]
        );

        if (!project) {
            return res.status(404).send('專案不存在');
        }

        // 獲取攤位資訊
        const booth = await database.get(
            'SELECT * FROM booths WHERE project_id = ? LIMIT 1',
            [projectId]
        );

        // 獲取所有專案列表（供切換用）
        const projects = await database.query(
            'SELECT id, project_name, project_code FROM event_projects WHERE status = ? ORDER BY created_at DESC',
            ['active']
        );

        res.render('admin/wish-tree-stats', {
            layout: 'admin',
            pageTitle: '許願樹統計',
            title: '許願樹統計',
            user: req.session.user,
            project,
            booth,
            projects,
            currentProjectId: projectId
        });
    } catch (error) {
        console.error('載入許願樹統計頁面失敗:', error);
        res.status(500).send('伺服器錯誤');
    }
});

/**
 * 許願樹列表頁面
 */
router.get('/list', async (req, res) => {
    try {
        const projectId = req.query.project_id || 5;
        const page = parseInt(req.query.page) || 1;
        const limit = 50;
        const offset = (page - 1) * limit;

        // 獲取專案資訊
        const project = await database.get(
            'SELECT * FROM event_projects WHERE id = ?',
            [projectId]
        );

        // 獲取總數
        const totalResult = await database.get(
            'SELECT COUNT(*) as total FROM wish_tree_interactions WHERE project_id = ?',
            [projectId]
        );

        // 獲取許願列表
        const wishes = await database.query(
            `SELECT
                w.*,
                b.booth_name
             FROM wish_tree_interactions w
             LEFT JOIN booths b ON w.booth_id = b.id
             WHERE w.project_id = ?
             ORDER BY w.created_at DESC
             LIMIT ? OFFSET ?`,
            [projectId, limit, offset]
        );

        // 獲取所有專案列表
        const projects = await database.query(
            'SELECT id, project_name, project_code FROM event_projects WHERE status = ? ORDER BY created_at DESC',
            ['active']
        );

        const totalPages = Math.ceil(totalResult.total / limit);

        res.render('admin/wish-tree-list', {
            layout: 'admin',
            pageTitle: '許願樹列表',
            title: '許願樹列表',
            user: req.session.user,
            project,
            projects,
            wishes,
            currentProjectId: projectId,
            currentPage: page,
            totalPages,
            totalWishes: totalResult.total
        });
    } catch (error) {
        console.error('載入許願樹列表頁面失敗:', error);
        res.status(500).send('伺服器錯誤');
    }
});

module.exports = router;
