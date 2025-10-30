/**
 * 遊戲統計 API（後端管理專用）
 */
const express = require('express');
const router = express.Router();
const { authenticateSession } = require('../../../middleware/auth');
const database = require('../../../config/database');
const responses = require('../../../utils/responses');

/**
 * 獲取遊戲統計資料
 * GET /api/admin/games/:gameId/stats
 */
router.get('/:gameId/stats', authenticateSession, async (req, res) => {
    try {
        const { gameId } = req.params;
        const { project_id, date, type = 'summary' } = req.query;

        if (!project_id) {
            return responses.badRequest(res, '缺少 project_id 參數');
        }

        let statsData = {};

        // 基礎查詢條件
        let whereClause = 'WHERE gs.game_id = ? AND gs.project_id = ?';
        let params = [gameId, project_id];

        if (date) {
            whereClause += ' AND DATE(gs.session_start) = ?';
            params.push(date);
        }

        switch (type) {
            case 'summary':
                // 總覽統計
                const summary = await database.get(`
                    SELECT 
                        COUNT(DISTINCT gs.trace_id) as total_players,
                        COUNT(gs.id) as total_sessions,
                        AVG(gs.final_score) as avg_score,
                        MAX(gs.final_score) as max_score,
                        MIN(gs.final_score) as min_score,
                        AVG(gs.total_play_time) as avg_play_time,
                        MIN(gs.total_play_time) as min_play_time,
                        MAX(gs.total_play_time) as max_play_time
                    FROM game_sessions gs
                    ${whereClause}
                      AND gs.session_end IS NOT NULL
                `, params);

                statsData = {
                    total_players: summary.total_players || 0,
                    total_sessions: summary.total_sessions || 0,
                    avg_score: Math.round(summary.avg_score * 10) / 10 || 0,
                    max_score: summary.max_score || 0,
                    min_score: summary.min_score || 0,
                    avg_play_time: Math.round(summary.avg_play_time * 10) / 10 || 0,
                    min_play_time: summary.min_play_time || 0,
                    max_play_time: summary.max_play_time || 0
                };
                break;

            case 'hourly':
                // 每小時玩家數統計
                const hourlyStats = await database.query(`
                    SELECT 
                        strftime('%Y-%m-%d %H:00', gs.session_start) as hour,
                        COUNT(DISTINCT gs.trace_id) as player_count,
                        COUNT(gs.id) as session_count,
                        AVG(gs.final_score) as avg_score
                    FROM game_sessions gs
                    ${whereClause}
                      AND gs.session_end IS NOT NULL
                    GROUP BY hour
                    ORDER BY hour DESC
                    LIMIT 24
                `, params);

                statsData = {
                    hourly_stats: hourlyStats.map(row => ({
                        hour: row.hour,
                        player_count: row.player_count,
                        session_count: row.session_count,
                        avg_score: Math.round(row.avg_score * 10) / 10 || 0
                    }))
                };
                break;

            case 'fastest':
                // 最快完成的玩家
                const fastest = await database.query(`
                    SELECT 
                        gs.trace_id,
                        gs.final_score,
                        gs.total_play_time,
                        gs.session_start,
                        fs.submitter_name,
                        fs.submitter_email
                    FROM game_sessions gs
                    LEFT JOIN form_submissions fs ON gs.trace_id = fs.trace_id
                    ${whereClause}
                      AND gs.session_end IS NOT NULL
                      AND gs.total_play_time > 0
                    ORDER BY gs.total_play_time ASC
                    LIMIT 10
                `, params);

                statsData = {
                    fastest_players: fastest.map(row => ({
                        trace_id: row.trace_id,
                        name: row.submitter_name || '匿名玩家',
                        email: row.submitter_email,
                        score: row.final_score,
                        play_time: row.total_play_time,
                        session_start: row.session_start
                    }))
                };
                break;

            case 'top_scores':
                // 最高分玩家
                const topScores = await database.query(`
                    SELECT 
                        gs.trace_id,
                        gs.final_score,
                        gs.total_play_time,
                        gs.session_start,
                        fs.submitter_name,
                        fs.submitter_email
                    FROM game_sessions gs
                    LEFT JOIN form_submissions fs ON gs.trace_id = fs.trace_id
                    ${whereClause}
                      AND gs.session_end IS NOT NULL
                    ORDER BY gs.final_score DESC
                    LIMIT 10
                `, params);

                statsData = {
                    top_scores: topScores.map(row => ({
                        trace_id: row.trace_id,
                        name: row.submitter_name || '匿名玩家',
                        email: row.submitter_email,
                        score: row.final_score,
                        play_time: row.total_play_time,
                        session_start: row.session_start
                    }))
                };
                break;

            default:
                return responses.badRequest(res, '無效的統計類型');
        }

        return responses.success(res, statsData, '統計資料查詢成功');

    } catch (error) {
        console.error('查詢遊戲統計失敗:', error);
        return responses.serverError(res, '查詢遊戲統計失敗', error);
    }
});

module.exports = router;

