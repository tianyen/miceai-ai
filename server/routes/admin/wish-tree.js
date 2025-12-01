/**
 * 許願樹管理路由
 */
const express = require('express');
const router = express.Router();
const database = require('../../config/database');
const { Parser } = require('json2csv');

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
            currentProjectId: projectId,
            additionalCSS: ['/css/admin/pages/wish-tree-stats.css'],
            additionalJS: ['/js/admin/pages/wish-tree-stats.js']
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

/**
 * 匯出許願樹 CSV
 */
router.get('/export-csv', async (req, res) => {
    try {
        const projectId = req.query.project_id || 5;

        // 獲取專案資訊
        const project = await database.get(
            'SELECT project_name, project_code FROM event_projects WHERE id = ?',
            [projectId]
        );

        if (!project) {
            return res.status(404).send('專案不存在');
        }

        // 獲取所有許願記錄（包含攤位資訊）
        const wishes = await database.query(
            `SELECT
                w.id,
                w.wish_text,
                w.created_at,
                w.ip_address,
                b.booth_name,
                b.booth_code
             FROM wish_tree_interactions w
             LEFT JOIN booths b ON w.booth_id = b.id
             WHERE w.project_id = ?
             ORDER BY w.created_at DESC`,
            [projectId]
        );

        if (wishes.length === 0) {
            return res.status(404).send('暫無許願記錄');
        }

        // 準備 CSV 數據
        const csvData = wishes.map(wish => ({
            'ID': wish.id,
            '許願內容': wish.wish_text,
            '提交時間': wish.created_at,
            '攤位名稱': wish.booth_name || '-',
            '攤位代碼': wish.booth_code || '-',
            'IP 地址': wish.ip_address || '-'
        }));

        // 使用 json2csv 轉換
        const parser = new Parser({
            fields: ['ID', '許願內容', '提交時間', '攤位名稱', '攤位代碼', 'IP 地址'],
            withBOM: true // 添加 BOM 以支援 Excel 正確顯示中文
        });

        const csv = parser.parse(csvData);

        // 生成檔案名稱（包含專案代碼和日期）
        const date = new Date().toISOString().split('T')[0];
        const filename = `wish-tree-${project.project_code}-${date}.csv`;

        // 設定回應標頭
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

        // 發送 CSV
        res.send(csv);

        console.log(`✅ 匯出許願樹 CSV: ${filename}, 共 ${wishes.length} 筆記錄`);

    } catch (error) {
        console.error('匯出 CSV 失敗:', error);
        res.status(500).send('匯出失敗');
    }
});

module.exports = router;
