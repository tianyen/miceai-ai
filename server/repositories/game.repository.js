/**
 * Game Repository - 遊戲資料存取層
 *
 * @description 處理 games, game_sessions, game_logs 相關資料庫操作
 */
const BaseRepository = require('./base.repository');

class GameRepository extends BaseRepository {
    constructor() {
        super('games');
    }

    /**
     * 根據 ID 查詢遊戲
     * @param {number} gameId - 遊戲 ID
     * @returns {Promise<Object|null>}
     */
    async findById(gameId) {
        return this.db.get(
            'SELECT * FROM games WHERE id = ?',
            [gameId]
        );
    }

    /**
     * 查詢遊戲列表
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findAll(options = {}) {
        const { isActive, limit = 100 } = options;

        let query = 'SELECT id, game_name_zh, game_name_en, game_url, is_active, created_at FROM games WHERE 1=1';
        const params = [];

        if (isActive !== undefined && isActive !== '') {
            query += ' AND is_active = ?';
            params.push(isActive);
        }

        query += ' ORDER BY game_name_zh LIMIT ?';
        params.push(parseInt(limit));

        return this.db.query(query, params);
    }

    /**
     * 根據專案查詢綁定的遊戲
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async findByProject(projectId) {
        return this.db.query(`
            SELECT g.*, bg.booth_id, b.booth_name
            FROM games g
            JOIN booth_games bg ON g.id = bg.game_id
            JOIN booths b ON bg.booth_id = b.id
            WHERE b.project_id = ? AND bg.is_active = 1 AND g.is_active = 1
            ORDER BY g.game_name_zh
        `, [projectId]);
    }

    /**
     * 查詢遊戲綁定資訊（用於 v1 API）
     * @param {number} gameId - 遊戲 ID
     * @param {number} projectId - 專案 ID（可選）
     * @param {number} boothId - 攤位 ID（可選）
     * @returns {Promise<Object|null>}
     */
    async findGameBinding(gameId, projectId = null, boothId = null) {
        let query = `
            SELECT
                g.id as game_id,
                g.game_name_zh,
                g.game_name_en,
                g.game_url,
                g.is_active as game_active,
                bg.id as binding_id,
                bg.booth_id,
                bg.is_active as binding_active,
                b.booth_name,
                b.project_id,
                p.project_name,
                p.project_code
            FROM games g
            JOIN booth_games bg ON g.id = bg.game_id
            JOIN booths b ON bg.booth_id = b.id
            JOIN event_projects p ON b.project_id = p.id
            WHERE g.id = ? AND bg.is_active = 1 AND g.is_active = 1
        `;
        const params = [gameId];

        if (projectId) {
            query += ' AND b.project_id = ?';
            params.push(projectId);
        }

        if (boothId) {
            query += ' AND bg.booth_id = ?';
            params.push(boothId);
        }

        query += ' LIMIT 1';

        return this.db.get(query, params);
    }

    // ==================== Game Sessions ====================

    /**
     * 建立遊戲會話
     * @param {Object} sessionData - 會話資料
     * @returns {Promise<Object>}
     */
    async createSession(sessionData) {
        const { projectId, gameId, boothId, traceId, userId, ipAddress, userAgent } = sessionData;

        return this.db.run(`
            INSERT INTO game_sessions (
                project_id, game_id, booth_id, trace_id, user_id,
                ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            projectId,
            gameId,
            boothId || null,
            traceId,
            userId || null,
            ipAddress || null,
            userAgent || null
        ]);
    }

    /**
     * 查詢會話
     * @param {number} sessionId - 會話 ID
     * @returns {Promise<Object|null>}
     */
    async findSessionById(sessionId) {
        return this.db.get(
            'SELECT * FROM game_sessions WHERE id = ?',
            [sessionId]
        );
    }

    /**
     * 根據 trace_id 查詢進行中的會話
     * @param {string} traceId - 追蹤 ID
     * @param {number} gameId - 遊戲 ID
     * @param {number} projectId - 專案 ID（可選）
     * @returns {Promise<Object|null>}
     */
    async findActiveSession(traceId, gameId, projectId = null) {
        let query = `
            SELECT * FROM game_sessions
            WHERE trace_id = ? AND game_id = ? AND session_end IS NULL
        `;
        const params = [traceId, gameId];

        if (projectId) {
            query += ' AND project_id = ?';
            params.push(projectId);
        }

        query += ' ORDER BY session_start DESC LIMIT 1';

        return this.db.get(query, params);
    }

    /**
     * 結束會話
     * @param {number} sessionId - 會話 ID
     * @param {Object} endData - 結束資料
     * @returns {Promise<Object>}
     */
    async endSession(sessionId, endData) {
        const { finalScore, totalPlayTime } = endData;

        return this.db.run(`
            UPDATE game_sessions
            SET session_end = CURRENT_TIMESTAMP,
                final_score = ?,
                total_play_time = ?
            WHERE id = ?
        `, [finalScore, totalPlayTime, sessionId]);
    }

    /**
     * 更新會話兌換券資訊
     * @param {number} sessionId - 會話 ID
     * @param {number} voucherId - 兌換券 ID
     * @returns {Promise<Object>}
     */
    async updateSessionVoucher(sessionId, voucherId) {
        return this.db.run(`
            UPDATE game_sessions
            SET voucher_earned = 1, voucher_id = ?
            WHERE id = ?
        `, [voucherId, sessionId]);
    }

    // ==================== Game Logs ====================

    /**
     * 記錄遊戲日誌（相容現有 schema）
     * @param {Object} logData - 日誌資料
     * @returns {Promise<Object>}
     */
    async createLog(logData) {
        const {
            projectId, gameId, boothId, traceId, userId,
            logLevel = 'info', message, userAction, score = 0, playTime = 0,
            ipAddress, userAgent
        } = logData;

        return this.db.run(`
            INSERT INTO game_logs (
                project_id, game_id, booth_id, trace_id, user_id,
                log_level, message, user_action, score, play_time,
                ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            projectId,
            gameId,
            boothId || null,
            traceId,
            userId || null,
            logLevel || 'info',
            message || null,
            userAction || null,
            score || 0,
            playTime || 0,
            ipAddress || null,
            userAgent || null
        ]);
    }

    /**
     * 查詢遊戲日誌
     * @param {Object} filters - 過濾條件
     * @returns {Promise<Array>}
     */
    async findLogs(filters = {}) {
        const { gameId, projectId, traceId, sessionId, limit = 100 } = filters;

        let query = 'SELECT * FROM game_logs WHERE 1=1';
        const params = [];

        if (gameId) {
            query += ' AND game_id = ?';
            params.push(gameId);
        }
        if (projectId) {
            query += ' AND project_id = ?';
            params.push(projectId);
        }
        if (traceId) {
            query += ' AND trace_id = ?';
            params.push(traceId);
        }
        if (sessionId) {
            query += ' AND session_id = ?';
            params.push(sessionId);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);

        return this.db.query(query, params);
    }

    // ==================== 攤位遊戲綁定 ====================

    /**
     * 查詢攤位遊戲綁定（直接用 booth_id）
     * @param {number} boothId - 攤位 ID
     * @param {number} gameId - 遊戲 ID
     * @returns {Promise<Object|null>}
     */
    async findBoothGameBinding(boothId, gameId) {
        return this.db.get(`
            SELECT bg.*, g.game_name_zh, g.game_name_en, g.game_url, b.project_id
            FROM booth_games bg
            JOIN games g ON bg.game_id = g.id
            JOIN booths b ON bg.booth_id = b.id
            WHERE bg.booth_id = ? AND bg.game_id = ? AND bg.is_active = 1
        `, [boothId, gameId]);
    }

    /**
     * 根據 project_id 查詢攤位遊戲綁定（向後相容）
     * @param {number} projectId - 專案 ID
     * @param {number} gameId - 遊戲 ID
     * @returns {Promise<Object|null>}
     */
    async findBoothGameBindingByProject(projectId, gameId) {
        return this.db.get(`
            SELECT bg.*, g.game_name_zh, g.game_name_en, g.game_url, b.project_id, b.id as booth_id
            FROM booth_games bg
            JOIN games g ON bg.game_id = g.id
            JOIN booths b ON bg.booth_id = b.id
            WHERE b.project_id = ? AND bg.game_id = ? AND bg.is_active = 1
            ORDER BY b.id ASC
            LIMIT 1
        `, [projectId, gameId]);
    }

    /**
     * 查詢遊戲基本資訊（啟用狀態）
     * @param {number} gameId - 遊戲 ID
     * @returns {Promise<Object|null>}
     */
    async findActiveGame(gameId) {
        return this.db.get(
            'SELECT * FROM games WHERE id = ? AND is_active = 1',
            [gameId]
        );
    }

    // ==================== 統計查詢 ====================

    /**
     * 查詢遊戲統計
     * @param {number} gameId - 遊戲 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async getGameStats(gameId, projectId) {
        const stats = await this.db.get(`
            SELECT
                COUNT(*) as total_sessions,
                COUNT(CASE WHEN session_end IS NOT NULL THEN 1 END) as completed_sessions,
                AVG(final_score) as avg_score,
                MAX(final_score) as max_score,
                AVG(total_play_time) as avg_play_time
            FROM game_sessions
            WHERE game_id = ? AND project_id = ?
        `, [gameId, projectId]);

        return stats;
    }

    // ============================================================================
    // Admin API 方法
    // ============================================================================

    /**
     * 帶搜尋和分頁查詢遊戲列表
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async findGamesWithFilter({ page = 1, limit = 20, search = '', is_active = '' } = {}) {
        const offset = (page - 1) * limit;

        let query = `SELECT * FROM games WHERE 1=1`;
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

        const games = await this.db.query(query, params);

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

        const { total } = await this.db.get(countQuery, countParams);

        return {
            games,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(total / limit),
                total_items: total,
                items_per_page: parseInt(limit)
            }
        };
    }

    /**
     * 創建遊戲
     * @param {Object} data - 遊戲資料
     * @returns {Promise<Object>}
     */
    async createGame({ game_name_zh, game_name_en, game_url, game_version, description, is_active = 1 }) {
        return this.db.run(
            `INSERT INTO games (game_name_zh, game_name_en, game_url, game_version, description, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [game_name_zh, game_name_en, game_url, game_version || null, description || null, is_active ? 1 : 0]
        );
    }

    /**
     * 更新遊戲
     * @param {number} gameId - 遊戲 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async updateGame(gameId, data) {
        const updates = [];
        const params = [];

        if (data.game_name_zh !== undefined) {
            updates.push('game_name_zh = ?');
            params.push(data.game_name_zh);
        }
        if (data.game_name_en !== undefined) {
            updates.push('game_name_en = ?');
            params.push(data.game_name_en);
        }
        if (data.game_url !== undefined) {
            updates.push('game_url = ?');
            params.push(data.game_url);
        }
        if (data.game_version !== undefined) {
            updates.push('game_version = ?');
            params.push(data.game_version);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (data.is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(data.is_active ? 1 : 0);
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(gameId);

            return this.db.run(
                `UPDATE games SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }
        return { changes: 0 };
    }

    /**
     * 軟刪除遊戲
     * @param {number} gameId - 遊戲 ID
     * @returns {Promise<Object>}
     */
    async softDeleteGame(gameId) {
        return this.db.run(
            'UPDATE games SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [gameId]
        );
    }

    // ============================================================================
    // 會話查詢
    // ============================================================================

    /**
     * 查詢遊戲會話列表（帶分頁和搜尋）
     * @param {number} gameId - 遊戲 ID
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async findSessionsWithFilter(gameId, { page = 1, limit = 20, trace_id = '' } = {}) {
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
        let params = [gameId];
        let countParams = [gameId];

        if (trace_id && trace_id.trim()) {
            query += ` AND gs.trace_id LIKE ?`;
            countQuery += ` AND trace_id LIKE ?`;
            const searchTerm = `%${trace_id.trim()}%`;
            params.push(searchTerm);
            countParams.push(searchTerm);
        }

        query += ` ORDER BY gs.session_start DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const sessions = await this.db.query(query, params);
        const { total } = await this.db.get(countQuery, countParams);

        return {
            sessions,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(total / limit),
                total_items: total,
                items_per_page: parseInt(limit)
            }
        };
    }

    // ============================================================================
    // 統計查詢
    // ============================================================================

    /**
     * 取得總覽統計
     * @param {string} whereClause - WHERE 子句
     * @param {Array} params - 參數
     * @returns {Promise<Object>}
     */
    async getSummaryStats(whereClause, params) {
        const summary = await this.db.get(`
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

        return {
            total_players: summary.total_players || 0,
            total_sessions: summary.total_sessions || 0,
            avg_score: Math.round((summary.avg_score || 0) * 10) / 10,
            max_score: summary.max_score || 0,
            min_score: summary.min_score || 0,
            avg_play_time: Math.round((summary.avg_play_time || 0) * 10) / 10,
            min_play_time: summary.min_play_time || 0,
            max_play_time: summary.max_play_time || 0
        };
    }

    /**
     * 取得每小時統計
     * @param {string} whereClause - WHERE 子句
     * @param {Array} params - 參數
     * @returns {Promise<Object>}
     */
    async getHourlyStats(whereClause, params) {
        const hourlyStats = await this.db.query(`
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

        return {
            hourly_stats: hourlyStats.map(row => ({
                hour: row.hour,
                player_count: row.player_count,
                session_count: row.session_count,
                avg_score: Math.round((row.avg_score || 0) * 10) / 10
            }))
        };
    }

    /**
     * 取得最快完成玩家
     * @param {string} whereClause - WHERE 子句
     * @param {Array} params - 參數
     * @returns {Promise<Object>}
     */
    async getFastestPlayers(whereClause, params) {
        const fastest = await this.db.query(`
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

        return {
            fastest_players: fastest.map(row => ({
                trace_id: row.trace_id,
                name: row.submitter_name || '匿名玩家',
                email: row.submitter_email,
                score: row.final_score,
                play_time: row.total_play_time,
                session_start: row.session_start
            }))
        };
    }

    /**
     * 取得最高分玩家
     * @param {string} whereClause - WHERE 子句
     * @param {Array} params - 參數
     * @returns {Promise<Object>}
     */
    async getTopScores(whereClause, params) {
        const topScores = await this.db.query(`
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

        return {
            top_scores: topScores.map(row => ({
                trace_id: row.trace_id,
                name: row.submitter_name || '匿名玩家',
                email: row.submitter_email,
                score: row.final_score,
                play_time: row.total_play_time,
                session_start: row.session_start
            }))
        };
    }

    // ============================================================================
    // 用戶相關查詢
    // ============================================================================

    /**
     * 取得當天活動用戶列表
     * @param {string} targetDate - 目標日期
     * @param {number|null} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async getDailyUsers(targetDate, projectId = null) {
        let query = `
            SELECT
                fs.trace_id,
                fs.user_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.company_name,
                fs.submitter_phone,
                fs.project_id,
                p.project_name,
                fs.created_at as registration_time,
                cr.checkin_time,
                COUNT(DISTINCT gs.id) as game_sessions,
                MAX(gs.final_score) as highest_score,
                COUNT(DISTINCT vr.id) as vouchers_redeemed
            FROM form_submissions fs
            LEFT JOIN event_projects p ON fs.project_id = p.id
            LEFT JOIN checkin_records cr ON fs.trace_id = cr.trace_id
            LEFT JOIN game_sessions gs ON fs.trace_id = gs.trace_id
            LEFT JOIN voucher_redemptions vr ON fs.trace_id = vr.trace_id
            WHERE (
                DATE(fs.created_at) = ? OR
                DATE(cr.checkin_time) = ? OR
                DATE(gs.session_start) = ?
            )
        `;

        const params = [targetDate, targetDate, targetDate];

        if (projectId) {
            query += ' AND fs.project_id = ?';
            params.push(projectId);
        }

        query += ' GROUP BY fs.trace_id ORDER BY fs.created_at DESC';

        const users = await this.db.query(query, params);

        return { users, date: targetDate };
    }

    /**
     * 取得用戶基本資訊
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object|null>}
     */
    async findUserInfoByTraceId(traceId) {
        return this.db.get(`
            SELECT
                fs.trace_id,
                fs.user_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.company_name,
                fs.submitter_phone,
                fs.position,
                fs.project_id,
                p.project_name,
                fs.created_at as registration_time,
                cr.checkin_time
            FROM form_submissions fs
            LEFT JOIN event_projects p ON fs.project_id = p.id
            LEFT JOIN checkin_records cr ON fs.trace_id = cr.trace_id
            WHERE fs.trace_id = ?
        `, [traceId]);
    }

    /**
     * 取得用戶遊戲會話記錄
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Array>}
     */
    async findUserGameSessions(traceId) {
        return this.db.query(`
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
    }

    /**
     * 取得用戶互動記錄
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Array>}
     */
    async findUserInteractions(traceId) {
        return this.db.query(`
            SELECT
                interaction_type,
                interaction_data,
                timestamp
            FROM participant_interactions
            WHERE trace_id = ?
            ORDER BY timestamp ASC
        `, [traceId]);
    }

    /**
     * 取得用戶遊戲日誌（最近 20 筆）
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Array>}
     */
    async findUserGameLogs(traceId) {
        return this.db.query(`
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
    }

    // ============================================================================
    // 排行榜
    // ============================================================================

    /**
     * 取得高分排行榜
     * @param {string} targetDate - 目標日期
     * @param {number|null} projectId - 專案 ID
     * @param {number|null} gameId - 遊戲 ID
     * @param {number} limit - 限制筆數
     * @returns {Promise<Object>}
     */
    async getLeaderboard(targetDate, projectId = null, gameId = null, limit = 10) {
        let query = `
            SELECT
                gs.trace_id,
                fs.user_id,
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

        if (projectId) {
            query += ' AND gs.project_id = ?';
            params.push(projectId);
        }

        if (gameId) {
            query += ' AND gs.game_id = ?';
            params.push(gameId);
        }

        query += `
            GROUP BY gs.trace_id, gs.game_id
            ORDER BY highest_score DESC
            LIMIT ?
        `;
        params.push(parseInt(limit));

        const leaderboard = await this.db.query(query, params);

        return { leaderboard, date: targetDate };
    }

    // ============================================================================
    // 兌換券相關
    // ============================================================================

    /**
     * 查詢有效兌換券
     * @param {number} voucherId - 兌換券 ID
     * @returns {Promise<Object|null>}
     */
    async findActiveVoucher(voucherId) {
        return this.db.get(
            'SELECT * FROM vouchers WHERE id = ? AND is_active = 1',
            [voucherId]
        );
    }

    /**
     * 查詢兌換條件
     * @param {number} voucherId - 兌換券 ID
     * @returns {Promise<Object|null>}
     */
    async findVoucherConditions(voucherId) {
        return this.db.get(
            'SELECT * FROM voucher_conditions WHERE voucher_id = ?',
            [voucherId]
        );
    }

    /**
     * 查詢遊戲綁定的兌換券（帶條件）
     * @param {number} boothId - 攤位 ID
     * @param {number} gameId - 遊戲 ID
     * @returns {Promise<Object|null>}
     */
    async findBoothVoucherWithConditions(boothId, gameId) {
        return this.db.get(`
            SELECT v.*, vc.min_score, vc.min_play_time
            FROM vouchers v
            LEFT JOIN voucher_conditions vc ON v.id = vc.voucher_id
            INNER JOIN booth_games bg ON v.id = bg.voucher_id
            WHERE bg.booth_id = ? AND bg.game_id = ? AND v.is_active = 1
        `, [boothId, gameId]);
    }
}

module.exports = new GameRepository();
