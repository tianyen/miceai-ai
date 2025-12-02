/**
 * 遊戲管理路由
 */
const express = require('express');
const router = express.Router();
const { gameService } = require('../../services');
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
        ],
        additionalCSS: ['/css/admin/pages/games.css'],
        additionalJS: ['/js/admin/pages/games.js']
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

        // 使用 Service 查詢遊戲和專案資訊
        const { game, project } = await gameService.getGameStats(gameId, project_id);

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

        // 處理特定錯誤
        if (error.code === 3004) { // GAME_NOT_FOUND
            return res.status(404).render('admin/404', {
                layout: 'admin',
                pageTitle: '遊戲不存在'
            });
        }
        if (error.code === 3002) { // PROJECT_NOT_FOUND
            return res.status(404).render('admin/404', {
                layout: 'admin',
                pageTitle: '專案不存在'
            });
        }

        res.status(500).render('admin/500', {
            layout: 'admin',
            pageTitle: '伺服器錯誤'
        });
    }
});

// ============================================================
// P1-7: 以下舊的 API 路由已廢棄
// 新的 RESTful API 已移至 /api/admin/games (server/routes/api/admin/games.js)
// 請使用新的 API 端點
// ============================================================

// 獲取遊戲列表（API，用於下拉選單）
router.get('/api/list', async (req, res) => {
    try {
        const { is_active, limit = 100 } = req.query;

        const games = await gameService.listGames({
            isActive: is_active,
            limit: parseInt(limit)
        });

        return responses.success(res, games, '獲取遊戲列表成功');
    } catch (error) {
        console.error('獲取遊戲列表失敗:', error);
        return responses.serverError(res, '獲取遊戲列表失敗');
    }
});

module.exports = router;

