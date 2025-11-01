/**
 * 用戶追蹤路由
 */
const express = require('express');
const router = express.Router();
const database = require('../../config/database');
const responses = require('../../utils/responses');

// 用戶追蹤頁面
router.get('/', (req, res) => {
    res.render('admin/user-tracking', {
        layout: 'admin',
        pageTitle: '用戶追蹤',
        currentPage: 'user-tracking',
        user: req.user,
        breadcrumbs: [
            { name: '首頁', url: '/admin' },
            { name: '用戶追蹤', url: '/admin/user-tracking' }
        ]
    });
});

// 獲取當天用戶列表（API）
router.get('/api/daily-users', async (req, res) => {
    try {
        const { date, project_id } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        let query = `
            SELECT 
                fs.trace_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.company_name,
                fs.submitter_phone,
                fs.project_id,
                p.project_name,
                fs.created_at as registration_time,
                cr.checked_in_at,
                COUNT(DISTINCT gs.id) as game_sessions,
                MAX(gs.final_score) as highest_score,
                COUNT(DISTINCT vr.id) as vouchers_redeemed
            FROM form_submissions fs
            LEFT JOIN invitation_projects p ON fs.project_id = p.id
            LEFT JOIN checkin_records cr ON fs.trace_id = cr.trace_id
            LEFT JOIN game_sessions gs ON fs.trace_id = gs.trace_id
            LEFT JOIN voucher_redemptions vr ON fs.trace_id = vr.trace_id
            WHERE DATE(fs.created_at) = ?
        `;

        const params = [targetDate];

        if (project_id) {
            query += ' AND fs.project_id = ?';
            params.push(project_id);
        }

        query += ' GROUP BY fs.trace_id ORDER BY fs.created_at DESC';

        const users = await database.query(query, params);

        return responses.success(res, '獲取用戶列表成功', { 
            users,
            date: targetDate
        });
    } catch (error) {
        console.error('獲取用戶列表失敗:', error);
        return responses.serverError(res, '獲取用戶列表失敗');
    }
});

// 獲取用戶完整軌跡（API）
router.get('/api/user-journey/:traceId', async (req, res) => {
    try {
        const { traceId } = req.params;

        // 1. 用戶基本資訊
        const userInfo = await database.get(`
            SELECT 
                fs.trace_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.company_name,
                fs.submitter_phone,
                fs.position,
                fs.project_id,
                p.project_name,
                fs.created_at as registration_time,
                cr.checked_in_at
            FROM form_submissions fs
            LEFT JOIN invitation_projects p ON fs.project_id = p.id
            LEFT JOIN checkin_records cr ON fs.trace_id = cr.trace_id
            WHERE fs.trace_id = ?
        `, [traceId]);

        if (!userInfo) {
            return responses.notFound(res, '找不到用戶資料');
        }

        // 2. 遊戲會話記錄
        const gameSessions = await database.query(`
            SELECT 
                gs.id,
                gs.game_id,
                g.game_name_zh,
                g.game_name_en,
                gs.booth_id,
                b.booth_name,
                b.booth_code,
                gs.session_start,
                gs.session_end,
                gs.total_play_time,
                gs.final_score,
                gs.voucher_earned,
                v.voucher_name
            FROM game_sessions gs
            LEFT JOIN games g ON gs.game_id = g.id
            LEFT JOIN booths b ON gs.booth_id = b.id
            LEFT JOIN vouchers v ON gs.voucher_id = v.id
            WHERE gs.trace_id = ?
            ORDER BY gs.session_start ASC
        `, [traceId]);

        // 3. 兌換記錄
        const redemptions = await database.query(`
            SELECT 
                vr.id,
                vr.voucher_id,
                v.voucher_name,
                v.vendor_name,
                v.voucher_value,
                vr.booth_id,
                b.booth_name,
                vr.redemption_code,
                vr.redeemed_at,
                vr.is_used,
                vr.used_at
            FROM voucher_redemptions vr
            LEFT JOIN vouchers v ON vr.voucher_id = v.id
            LEFT JOIN booths b ON vr.booth_id = b.id
            WHERE vr.trace_id = ?
            ORDER BY vr.redeemed_at ASC
        `, [traceId]);

        // 4. 參與者互動記錄
        const interactions = await database.query(`
            SELECT 
                interaction_type,
                interaction_data,
                created_at
            FROM participant_interactions
            WHERE trace_id = ?
            ORDER BY created_at ASC
        `, [traceId]);

        // 5. 遊戲日誌（最近 20 筆）
        const gameLogs = await database.query(`
            SELECT 
                gl.id,
                gl.game_id,
                g.game_name_zh,
                gl.booth_id,
                b.booth_name,
                gl.log_level,
                gl.message,
                gl.user_action,
                gl.score,
                gl.play_time,
                gl.created_at
            FROM game_logs gl
            LEFT JOIN games g ON gl.game_id = g.id
            LEFT JOIN booths b ON gl.booth_id = b.id
            WHERE gl.trace_id = ?
            ORDER BY gl.created_at DESC
            LIMIT 20
        `, [traceId]);

        return responses.success(res, '獲取用戶軌跡成功', {
            user_info: userInfo,
            game_sessions: gameSessions,
            redemptions: redemptions,
            interactions: interactions,
            game_logs: gameLogs
        });
    } catch (error) {
        console.error('獲取用戶軌跡失敗:', error);
        return responses.serverError(res, '獲取用戶軌跡失敗');
    }
});

// 獲取高分排行榜（API）
router.get('/api/leaderboard', async (req, res) => {
    try {
        const { date, project_id, game_id, limit = 10 } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        let query = `
            SELECT
                gs.trace_id,
                fs.submitter_name,
                fs.company_name,
                gs.game_id,
                g.game_name_zh,
                gs.booth_id,
                b.booth_name,
                MAX(gs.final_score) as highest_score,
                gs.total_play_time,
                gs.session_start
            FROM game_sessions gs
            LEFT JOIN form_submissions fs ON gs.trace_id = fs.trace_id
            LEFT JOIN games g ON gs.game_id = g.id
            LEFT JOIN booths b ON gs.booth_id = b.id
            WHERE DATE(gs.session_start) = ?
        `;

        const params = [targetDate];

        if (project_id) {
            query += ' AND gs.project_id = ?';
            params.push(project_id);
        }

        if (game_id) {
            query += ' AND gs.game_id = ?';
            params.push(game_id);
        }

        query += ` 
            GROUP BY gs.trace_id, gs.game_id
            ORDER BY highest_score DESC
            LIMIT ?
        `;
        params.push(parseInt(limit));

        const leaderboard = await database.query(query, params);

        return responses.success(res, '獲取排行榜成功', { 
            leaderboard,
            date: targetDate
        });
    } catch (error) {
        console.error('獲取排行榜失敗:', error);
        return responses.serverError(res, '獲取排行榜失敗');
    }
});

module.exports = router;

