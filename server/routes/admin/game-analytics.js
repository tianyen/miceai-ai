/**
 * 遊戲分析路由
 *
 * @refactor 2025-12-01: 使用 gameService，遵循 3-Tier Architecture
 */
const express = require('express');
const router = express.Router();
const { gameService } = require('../../services');
const responses = require('../../utils/responses');

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

// 遊戲分析頁面
router.get('/', (req, res) => {
    res.render('admin/game-analytics', {
        layout: 'admin',
        pageTitle: '遊戲分析',
        currentPage: 'game-analytics',
        user: req.user,
        breadcrumbs: [
            { name: '首頁', url: '/admin' },
            { name: '遊戲室', url: '/admin/games' },
            { name: '遊戲分析', url: '/admin/game-analytics' }
        ]
    });
});

// 獲取當天用戶列表（API）
router.get('/api/daily-users', async (req, res) => {
    try {
        const { date, project_id, page, limit, start_at, end_at } = req.query;
        const result = await gameService.getDailyUsers({ date, project_id, page, limit, start_at, end_at });
        return responses.success(res, result, '獲取用戶列表成功');
    } catch (error) {
        return handleServiceError(res, error, '獲取用戶列表失敗');
    }
});

// 獲取玩家行為分析（API）
router.get('/api/engagement', async (req, res) => {
    try {
        const { date, project_id } = req.query;
        const result = await gameService.getEngagementAnalytics({ date, project_id });
        return responses.success(res, result, '獲取玩家行為分析成功');
    } catch (error) {
        return handleServiceError(res, error, '獲取玩家行為分析失敗');
    }
});

// 獲取用戶完整軌跡（API）
router.get('/api/user-journey/:traceId', async (req, res) => {
    try {
        const { traceId } = req.params;
        const result = await gameService.getUserJourney(traceId);
        return responses.success(res, result, '獲取用戶軌跡成功');
    } catch (error) {
        return handleServiceError(res, error, '獲取用戶軌跡失敗');
    }
});

// 獲取高分排行榜（API）
router.get('/api/leaderboard', async (req, res) => {
    try {
        const { date, project_id, game_id, limit } = req.query;
        const result = await gameService.getLeaderboard({
            date,
            project_id,
            game_id,
            limit: parseInt(limit) || 10
        });
        return responses.success(res, result, '獲取排行榜成功');
    } catch (error) {
        return handleServiceError(res, error, '獲取排行榜失敗');
    }
});

module.exports = router;
