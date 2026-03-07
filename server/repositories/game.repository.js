/**
 * Game Repository - 遊戲資料存取層
 *
 * @description 處理 games, game_sessions, game_logs 相關資料庫操作
 */
const BaseRepository = require('./base.repository');
const database = require('../config/database');
const { getGMT8DateRange, toDbUtcTimestamp } = require('../utils/timezone');

function hasTable(tableName) {
    try {
        const row = database.getSync(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
            [tableName]
        );
        return !!row;
    } catch (error) {
        return false;
    }
}

function buildUnifiedSessionsCTE() {
    const hasFlowSessions = hasTable('game_flow_sessions');

    if (!hasFlowSessions) {
        return `
            WITH unified_sessions AS (
                SELECT
                    gs.id,
                    'legacy:' || gs.id AS session_key,
                    'legacy' AS source_type,
                    gs.project_id,
                    gs.game_id,
                    gs.booth_id,
                    gs.trace_id,
                    gs.user_id,
                    gs.session_start,
                    gs.session_end,
                    gs.total_play_time,
                    gs.final_score,
                    gs.voucher_earned,
                    gs.voucher_id,
                    NULL AS flow_session_id,
                    CASE WHEN gs.session_end IS NULL THEN 'active' ELSE 'completed' END AS status,
                    NULL AS entry_stage_id,
                    NULL AS exit_stage_id,
                    NULL AS completion_stage_id
                FROM game_sessions gs
            )
        `;
    }

    return `
        WITH unified_sessions AS (
            SELECT
                gs.id,
                'legacy:' || gs.id AS session_key,
                'legacy' AS source_type,
                gs.project_id,
                gs.game_id,
                gs.booth_id,
                gs.trace_id,
                gs.user_id,
                gs.session_start,
                gs.session_end,
                gs.total_play_time,
                gs.final_score,
                gs.voucher_earned,
                gs.voucher_id,
                NULL AS flow_session_id,
                CASE WHEN gs.session_end IS NULL THEN 'active' ELSE 'completed' END AS status,
                NULL AS entry_stage_id,
                NULL AS exit_stage_id,
                NULL AS completion_stage_id
            FROM game_sessions gs

            UNION ALL

            SELECT
                gfs.id,
                'flow:' || gfs.id AS session_key,
                'flow' AS source_type,
                gfs.project_id,
                gfs.game_id,
                gfs.booth_id,
                gfs.trace_id,
                NULL AS user_id,
                gfs.started_at AS session_start,
                gfs.ended_at AS session_end,
                CASE
                    WHEN gfs.ended_at IS NOT NULL THEN
                        CASE
                            WHEN CAST((julianday(gfs.ended_at) - julianday(gfs.started_at)) * 86400 AS INTEGER) > 0
                                THEN CAST((julianday(gfs.ended_at) - julianday(gfs.started_at)) * 86400 AS INTEGER)
                            ELSE 0
                        END
                    WHEN gfs.last_event_at IS NOT NULL THEN
                        CASE
                            WHEN CAST((julianday(gfs.last_event_at) - julianday(gfs.started_at)) * 86400 AS INTEGER) > 0
                                THEN CAST((julianday(gfs.last_event_at) - julianday(gfs.started_at)) * 86400 AS INTEGER)
                            ELSE 0
                        END
                    ELSE 0
                END AS total_play_time,
                0 AS final_score,
                0 AS voucher_earned,
                NULL AS voucher_id,
                gfs.flow_session_id,
                gfs.status,
                gfs.entry_stage_id,
                gfs.exit_stage_id,
                gfs.completion_stage_id
            FROM game_flow_sessions gfs
        )
    `;
}

function buildUnifiedLogsCTE() {
    const hasFlowEvents = hasTable('game_stage_events');

    if (!hasFlowEvents) {
        return `
            WITH unified_logs AS (
                SELECT
                    gl.id,
                    'legacy:' || gl.id AS log_key,
                    'legacy' AS source_type,
                    gl.game_id,
                    gl.booth_id,
                    gl.trace_id,
                    gl.log_level,
                    gl.message,
                    gl.user_action,
                    gl.score,
                    gl.play_time,
                    gl.created_at
                FROM game_logs gl
            )
        `;
    }

    return `
        WITH unified_logs AS (
            SELECT
                gl.id,
                'legacy:' || gl.id AS log_key,
                'legacy' AS source_type,
                gl.game_id,
                gl.booth_id,
                gl.trace_id,
                gl.log_level,
                gl.message,
                gl.user_action,
                gl.score,
                gl.play_time,
                gl.created_at
            FROM game_logs gl

            UNION ALL

            SELECT
                gse.id,
                'flow:' || gse.id AS log_key,
                'flow' AS source_type,
                gse.game_id,
                gse.booth_id,
                gse.trace_id,
                CASE
                    WHEN gse.event_type IN ('session_end', 'stage_submit', 'throw_success', 'upload_success') THEN 'success'
                    WHEN gse.event_type IN ('session_fail', 'flow_retry', 'preview_restart', 'upload_fail') THEN 'warning'
                    ELSE 'info'
                END AS log_level,
                '流程事件: ' || gse.stage_id || ' / ' || gse.event_type AS message,
                gse.event_type AS user_action,
                0 AS score,
                CASE
                    WHEN gse.duration_ms IS NOT NULL AND gse.duration_ms > 0
                        THEN CAST(gse.duration_ms / 1000 AS INTEGER)
                    ELSE 0
                END AS play_time,
                gse.created_at
            FROM game_stage_events gse
        )
    `;
}

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
            JOIN event_projects p ON b.project_id = p.id
            WHERE b.project_id = ? AND bg.is_active = 1 AND g.is_active = 1
              AND b.is_active = 1 AND p.status = 'active'
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
              AND b.is_active = 1 AND p.status = 'active'
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
            JOIN event_projects p ON b.project_id = p.id
            WHERE bg.booth_id = ? AND bg.game_id = ? AND bg.is_active = 1
              AND g.is_active = 1 AND b.is_active = 1 AND p.status = 'active'
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
            JOIN event_projects p ON b.project_id = p.id
            WHERE b.project_id = ? AND bg.game_id = ? AND bg.is_active = 1
              AND g.is_active = 1 AND b.is_active = 1 AND p.status = 'active'
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
            ${buildUnifiedSessionsCTE()}
            SELECT
                COUNT(*) as total_sessions,
                COUNT(CASE WHEN session_end IS NOT NULL THEN 1 END) as completed_sessions,
                AVG(final_score) as avg_score,
                MAX(final_score) as max_score,
                AVG(total_play_time) as avg_play_time
            FROM unified_sessions
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
    async createGame({ game_name_zh, game_name_en, game_url, game_version, description, is_active = 1, created_by }) {
        return this.db.run(
            `INSERT INTO games (game_name_zh, game_name_en, game_url, game_version, description, is_active, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [game_name_zh, game_name_en, game_url, game_version || null, description || null, is_active ? 1 : 0, created_by]
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
            ${buildUnifiedSessionsCTE()}
            SELECT
                us.*,
                g.game_name_zh,
                g.game_name_en,
                p.project_name,
                v.voucher_name
            FROM unified_sessions us
            LEFT JOIN games g ON us.game_id = g.id
            LEFT JOIN event_projects p ON us.project_id = p.id
            LEFT JOIN vouchers v ON us.voucher_id = v.id
            WHERE us.game_id = ?
        `;
        let countQuery = `
            ${buildUnifiedSessionsCTE()}
            SELECT COUNT(*) as total
            FROM unified_sessions
            WHERE game_id = ?
        `;
        let params = [gameId];
        let countParams = [gameId];

        if (trace_id && trace_id.trim()) {
            query += ` AND us.trace_id LIKE ?`;
            countQuery += ` AND trace_id LIKE ?`;
            const searchTerm = `%${trace_id.trim()}%`;
            params.push(searchTerm);
            countParams.push(searchTerm);
        }

        query += ` ORDER BY us.session_start DESC LIMIT ? OFFSET ?`;
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
            ${buildUnifiedSessionsCTE()}
            SELECT
                COUNT(DISTINCT us.trace_id) as total_players,
                COUNT(us.session_key) as total_sessions,
                AVG(us.final_score) as avg_score,
                MAX(us.final_score) as max_score,
                MIN(us.final_score) as min_score,
                AVG(us.total_play_time) as avg_play_time,
                MIN(us.total_play_time) as min_play_time,
                MAX(us.total_play_time) as max_play_time
            FROM unified_sessions us
            ${whereClause}
              AND us.session_end IS NOT NULL
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
            ${buildUnifiedSessionsCTE()}
            SELECT
                strftime('%Y-%m-%d %H:00', us.session_start) as hour,
                COUNT(DISTINCT us.trace_id) as player_count,
                COUNT(us.session_key) as session_count,
                AVG(us.final_score) as avg_score
            FROM unified_sessions us
            ${whereClause}
              AND us.session_end IS NOT NULL
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
            ${buildUnifiedSessionsCTE()}
            SELECT
                us.trace_id,
                us.final_score,
                us.total_play_time,
                us.session_start,
                us.source_type,
                us.status,
                us.completion_stage_id,
                fs.submitter_name,
                fs.submitter_email
            FROM unified_sessions us
            LEFT JOIN form_submissions fs ON us.trace_id = fs.trace_id
            ${whereClause}
              AND us.session_end IS NOT NULL
              AND us.total_play_time > 0
            ORDER BY us.total_play_time ASC
            LIMIT 10
        `, params);

        return {
            fastest_players: fastest.map(row => ({
                trace_id: row.trace_id,
                name: row.submitter_name || '匿名玩家',
                email: row.submitter_email,
                score: row.final_score,
                play_time: row.total_play_time,
                session_start: row.session_start,
                source_type: row.source_type,
                session_status: row.status,
                completion_stage_id: row.completion_stage_id
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
            ${buildUnifiedSessionsCTE()}
            SELECT
                us.trace_id,
                us.final_score,
                us.total_play_time,
                us.session_start,
                us.source_type,
                us.status,
                us.completion_stage_id,
                fs.submitter_name,
                fs.submitter_email
            FROM unified_sessions us
            LEFT JOIN form_submissions fs ON us.trace_id = fs.trace_id
            ${whereClause}
              AND us.session_end IS NOT NULL
            ORDER BY us.final_score DESC, us.total_play_time ASC, us.session_start DESC
            LIMIT 10
        `, params);

        return {
            top_scores: topScores.map(row => ({
                trace_id: row.trace_id,
                name: row.submitter_name || '匿名玩家',
                email: row.submitter_email,
                score: row.final_score,
                play_time: row.total_play_time,
                session_start: row.session_start,
                source_type: row.source_type,
                session_status: row.status,
                completion_stage_id: row.completion_stage_id
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
    async getDailyUsers(targetDate, projectId = null, options = {}) {
        const dayRange = getGMT8DateRange(targetDate);
        const page = Math.max(parseInt(options.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(options.limit, 10) || 50, 1), 200);
        const offset = (page - 1) * limit;
        const startAtUtc = options.start_at ? toDbUtcTimestamp(options.start_at) : null;
        const endAtUtc = options.end_at ? toDbUtcTimestamp(options.end_at) : null;
        const registrationProjectFilter = projectId ? ' AND fs.project_id = ?' : '';
        const sessionProjectFilter = projectId ? ' AND us.project_id = ?' : '';

        const params = [
            dayRange.startUtc, dayRange.endUtc,
            dayRange.startUtc, dayRange.endUtc
        ];
        if (projectId) {
            params.push(projectId);
        }
        params.push(dayRange.startUtc, dayRange.endUtc);
        if (projectId) {
            params.push(projectId);
        }
        params.push(dayRange.startUtc, dayRange.endUtc);
        if (projectId) {
            params.push(projectId);
        }

        const baseQuery = `
            ${buildUnifiedSessionsCTE()}
            ,
            registration_traces AS (
                SELECT DISTINCT
                    fs.trace_id,
                    fs.project_id
                FROM form_submissions fs
                LEFT JOIN checkin_records cr ON fs.trace_id = cr.trace_id
                WHERE (
                    (fs.created_at >= ? AND fs.created_at < ?) OR
                    (cr.checkin_time >= ? AND cr.checkin_time < ?)
                )
                ${registrationProjectFilter}
            ),
            session_traces AS (
                SELECT
                    us.trace_id,
                    MIN(us.project_id) AS project_id,
                    MIN(us.session_start) AS first_session_start
                FROM unified_sessions us
                WHERE us.session_start >= ? AND us.session_start < ?
                ${sessionProjectFilter}
                GROUP BY us.trace_id
            ),
            candidate_traces AS (
                SELECT trace_id, project_id FROM registration_traces
                UNION
                SELECT trace_id, project_id FROM session_traces
            ),
            user_rows AS (
                SELECT
                    ct.trace_id,
                    fs.user_id,
                    COALESCE(fs.submitter_name, '匿名玩家') AS submitter_name,
                    fs.submitter_email,
                    fs.company_name AS submitter_company,
                    fs.submitter_phone,
                    COALESCE(fs.project_id, st.project_id, ct.project_id) AS project_id,
                    p.project_name,
                    COALESCE(fs.created_at, st.first_session_start) AS registration_time,
                    COALESCE(fs.created_at, st.first_session_start) AS activity_time_utc,
                    cr.checkin_time AS checked_in_at,
                    COUNT(DISTINCT us.session_key) AS game_sessions,
                    MAX(us.final_score) AS highest_score,
                    COUNT(DISTINCT vr.id) AS vouchers_redeemed
                FROM candidate_traces ct
                LEFT JOIN form_submissions fs ON ct.trace_id = fs.trace_id
                LEFT JOIN session_traces st ON ct.trace_id = st.trace_id
                LEFT JOIN event_projects p ON p.id = COALESCE(fs.project_id, st.project_id, ct.project_id)
                LEFT JOIN checkin_records cr ON ct.trace_id = cr.trace_id
                LEFT JOIN unified_sessions us
                    ON ct.trace_id = us.trace_id
                   AND us.session_start >= ? AND us.session_start < ?
                   ${sessionProjectFilter}
                LEFT JOIN voucher_redemptions vr ON ct.trace_id = vr.trace_id
                GROUP BY
                    ct.trace_id,
                    fs.user_id,
                    fs.submitter_name,
                    fs.submitter_email,
                    fs.company_name,
                    fs.submitter_phone,
                    COALESCE(fs.project_id, st.project_id, ct.project_id),
                    p.project_name,
                    COALESCE(fs.created_at, st.first_session_start),
                    cr.checkin_time
            )
        `;

        const timeFilter = [];
        const timeParams = [];
        if (startAtUtc) {
            timeFilter.push('activity_time_utc >= ?');
            timeParams.push(startAtUtc);
        }
        if (endAtUtc) {
            timeFilter.push('activity_time_utc <= ?');
            timeParams.push(endAtUtc);
        }
        const timeClause = timeFilter.length ? `WHERE ${timeFilter.join(' AND ')}` : '';

        const summary = await this.db.get(`
            ${baseQuery}
            SELECT
                COUNT(*) AS total_users,
                COALESCE(SUM(game_sessions), 0) AS total_sessions,
                COALESCE(SUM(vouchers_redeemed), 0) AS total_vouchers,
                COALESCE(MAX(highest_score), 0) AS highest_score
            FROM user_rows
            ${timeClause}
        `, [...params, ...timeParams]);

        const users = await this.db.query(`
            ${baseQuery}
            SELECT *
            FROM user_rows
            ${timeClause}
            ORDER BY registration_time DESC
            LIMIT ? OFFSET ?
        `, [...params, ...timeParams, limit, offset]);

        const totalUsers = Number(summary?.total_users || 0);

        return {
            users,
            date: targetDate,
            filters: {
                project_id: projectId || null,
                start_at: options.start_at || null,
                end_at: options.end_at || null
            },
            summary: {
                total_users: totalUsers,
                total_sessions: Number(summary?.total_sessions || 0),
                total_vouchers: Number(summary?.total_vouchers || 0),
                highest_score: Number(summary?.highest_score || 0)
            },
            pagination: {
                page,
                limit,
                total_items: totalUsers,
                total_pages: totalUsers > 0 ? Math.ceil(totalUsers / limit) : 1
            }
        };
    }

    async getEngagementAnalytics(targetDate, projectId = null) {
        const dayRange = getGMT8DateRange(targetDate);
        const projectClause = projectId ? ' AND us.project_id = ?' : '';
        const baseParams = [dayRange.startUtc, dayRange.endUtc];
        if (projectId) {
            baseParams.push(projectId);
        }

        const hourlyStats = await this.db.query(`
            ${buildUnifiedSessionsCTE()}
            ,
            filtered_sessions AS (
                SELECT *
                FROM unified_sessions us
                WHERE us.session_start >= ? AND us.session_start < ?
                ${projectClause}
            )
            SELECT
                strftime('%H:00', datetime(session_start, '+8 hours')) AS hour,
                COUNT(DISTINCT trace_id) AS unique_players,
                COUNT(session_key) AS total_sessions,
                AVG(total_play_time) AS avg_play_time
            FROM filtered_sessions
            GROUP BY hour
            ORDER BY hour ASC
        `, baseParams);

        const sessionDepthRows = await this.db.query(`
            ${buildUnifiedSessionsCTE()}
            ,
            filtered_sessions AS (
                SELECT *
                FROM unified_sessions us
                WHERE us.session_start >= ? AND us.session_start < ?
                ${projectClause}
            ),
            per_user AS (
                SELECT
                    trace_id,
                    COUNT(session_key) AS session_count
                FROM filtered_sessions
                GROUP BY trace_id
            )
            SELECT
                CASE
                    WHEN session_count >= 5 THEN '5+ 次'
                    ELSE CAST(session_count AS TEXT) || ' 次'
                END AS bucket,
                CASE
                    WHEN session_count >= 5 THEN 5
                    ELSE session_count
                END AS sort_order,
                COUNT(*) AS user_count
            FROM per_user
            GROUP BY bucket, sort_order
            ORDER BY sort_order ASC
        `, baseParams);

        const durationRows = await this.db.query(`
            ${buildUnifiedSessionsCTE()}
            ,
            filtered_sessions AS (
                SELECT *
                FROM unified_sessions us
                WHERE us.session_start >= ? AND us.session_start < ?
                ${projectClause}
            ),
            per_user AS (
                SELECT
                    trace_id,
                    SUM(total_play_time) AS total_play_time
                FROM filtered_sessions
                GROUP BY trace_id
            )
            SELECT
                CASE
                    WHEN total_play_time < 30 THEN '0-30 秒'
                    WHEN total_play_time < 60 THEN '30-60 秒'
                    WHEN total_play_time < 180 THEN '1-3 分鐘'
                    WHEN total_play_time < 600 THEN '3-10 分鐘'
                    ELSE '10 分鐘以上'
                END AS bucket,
                CASE
                    WHEN total_play_time < 30 THEN 1
                    WHEN total_play_time < 60 THEN 2
                    WHEN total_play_time < 180 THEN 3
                    WHEN total_play_time < 600 THEN 4
                    ELSE 5
                END AS sort_order,
                COUNT(*) AS user_count
            FROM per_user
            GROUP BY bucket, sort_order
            ORDER BY sort_order ASC
        `, baseParams);

        const retentionRows = await this.db.query(`
            ${buildUnifiedSessionsCTE()}
            ,
            cohort_traces AS (
                SELECT DISTINCT
                    us.trace_id
                FROM unified_sessions us
                WHERE us.session_start >= ? AND us.session_start < ?
                ${projectClause}
            ),
            cohort_activity AS (
                SELECT
                    us.trace_id,
                    MIN(us.session_start) AS first_seen_at,
                    MAX(COALESCE(us.session_end, us.session_start)) AS last_seen_at
                FROM unified_sessions us
                JOIN cohort_traces ct ON ct.trace_id = us.trace_id
                ${projectId ? 'WHERE us.project_id = ?' : ''}
                GROUP BY us.trace_id
            )
            SELECT
                trace_id,
                CAST((julianday(last_seen_at) - julianday(first_seen_at)) * 86400 AS INTEGER) AS retention_span_seconds
            FROM cohort_activity
        `, projectId ? [dayRange.startUtc, dayRange.endUtc, projectId, projectId] : [dayRange.startUtc, dayRange.endUtc]);

        const totalCohortUsers = retentionRows.length;
        const retentionThresholds = [
            { label: '5 分鐘', seconds: 5 * 60 },
            { label: '15 分鐘', seconds: 15 * 60 },
            { label: '30 分鐘', seconds: 30 * 60 },
            { label: '1 天', seconds: 24 * 60 * 60 },
            { label: '1 星期', seconds: 7 * 24 * 60 * 60 }
        ];

        return {
            date: targetDate,
            filters: {
                project_id: projectId || null
            },
            session_depth: sessionDepthRows.map((row) => ({
                label: row.bucket,
                user_count: row.user_count
            })),
            duration_distribution: durationRows.map((row) => ({
                label: row.bucket,
                user_count: row.user_count
            })),
            hourly_activity: hourlyStats.map((row) => ({
                hour: row.hour,
                unique_players: row.unique_players,
                total_sessions: row.total_sessions,
                avg_play_time: Math.round((row.avg_play_time || 0) * 10) / 10
            })),
            retention: retentionThresholds.map((threshold) => {
                const retainedUsers = retentionRows.filter((row) => Number(row.retention_span_seconds || 0) >= threshold.seconds).length;
                return {
                    label: threshold.label,
                    retained_users: retainedUsers,
                    retention_rate: totalCohortUsers > 0
                        ? Math.round((retainedUsers / totalCohortUsers) * 1000) / 10
                        : 0
                };
            }),
            cohort_size: totalCohortUsers
        };
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
                fs.company_name AS submitter_company,
                fs.submitter_phone,
                fs.position AS submitter_title,
                fs.status,
                fs.project_id,
                p.project_name,
                fs.created_at as registration_time,
                cr.checkin_time AS checked_in_at
            FROM form_submissions fs
            LEFT JOIN event_projects p ON fs.project_id = p.id
            LEFT JOIN checkin_records cr ON fs.trace_id = cr.trace_id
            WHERE fs.trace_id = ?
        `, [traceId]);
    }

    async findFlowUserInfoByTraceId(traceId) {
        return this.db.get(`
            ${buildUnifiedSessionsCTE()}
            SELECT
                us.trace_id,
                us.user_id,
                '匿名玩家' AS submitter_name,
                NULL AS submitter_email,
                NULL AS submitter_company,
                NULL AS submitter_phone,
                NULL AS submitter_title,
                us.status,
                us.project_id,
                p.project_name,
                us.session_start AS registration_time,
                NULL AS checked_in_at
            FROM unified_sessions us
            LEFT JOIN event_projects p ON us.project_id = p.id
            WHERE us.trace_id = ?
            ORDER BY us.session_start DESC
            LIMIT 1
        `, [traceId]);
    }

    /**
     * 取得用戶遊戲會話記錄
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Array>}
     */
    async findUserGameSessions(traceId) {
        return this.db.query(`
            ${buildUnifiedSessionsCTE()}
            SELECT
                us.id,
                us.source_type,
                us.flow_session_id,
                us.status AS session_status,
                us.entry_stage_id,
                us.exit_stage_id,
                us.completion_stage_id,
                us.game_id,
                g.game_name_zh,
                g.game_name_en,
                us.booth_id,
                b.booth_name,
                b.booth_code,
                us.session_start,
                us.session_end,
                us.total_play_time,
                us.final_score,
                us.voucher_earned,
                v.voucher_name
            FROM unified_sessions us
            LEFT JOIN games g ON us.game_id = g.id
            LEFT JOIN booths b ON us.booth_id = b.id
            LEFT JOIN vouchers v ON us.voucher_id = v.id
            WHERE us.trace_id = ?
            ORDER BY us.session_start ASC
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
            ${buildUnifiedLogsCTE()}
            SELECT
                ul.id,
                ul.source_type,
                ul.game_id,
                g.game_name_zh,
                ul.booth_id,
                b.booth_name,
                ul.log_level,
                ul.message,
                ul.user_action,
                ul.score,
                ul.play_time,
                ul.created_at
            FROM unified_logs ul
            LEFT JOIN games g ON ul.game_id = g.id
            LEFT JOIN booths b ON ul.booth_id = b.id
            WHERE ul.trace_id = ?
            ORDER BY ul.created_at ASC, ul.id ASC
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
        const dayRange = getGMT8DateRange(targetDate);
        let query = `
            ${buildUnifiedSessionsCTE()}
            SELECT
                us.trace_id,
                fs.user_id,
                fs.submitter_name,
                fs.company_name AS submitter_company,
                us.game_id,
                g.game_name_zh,
                us.booth_id,
                b.booth_name,
                MAX(us.final_score) as highest_score,
                MIN(CASE WHEN us.total_play_time > 0 THEN us.total_play_time END) as total_play_time,
                MAX(us.session_start) as session_start,
                MAX(us.source_type) as source_type,
                MAX(us.completion_stage_id) as completion_stage_id
            FROM unified_sessions us
            LEFT JOIN form_submissions fs ON us.trace_id = fs.trace_id
            LEFT JOIN games g ON us.game_id = g.id
            LEFT JOIN booths b ON us.booth_id = b.id
            WHERE us.session_start >= ? AND us.session_start < ?
        `;

        const params = [dayRange.startUtc, dayRange.endUtc];

        if (projectId) {
            query += ' AND us.project_id = ?';
            params.push(projectId);
        }

        if (gameId) {
            query += ' AND us.game_id = ?';
            params.push(gameId);
        }

        query += `
            GROUP BY us.trace_id, us.game_id, us.booth_id
            ORDER BY highest_score DESC, total_play_time ASC, session_start DESC
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
            INNER JOIN booths b ON bg.booth_id = b.id
            INNER JOIN event_projects p ON b.project_id = p.id
            WHERE bg.booth_id = ? AND bg.game_id = ? AND v.is_active = 1
              AND bg.is_active = 1 AND b.is_active = 1 AND p.status = 'active'
        `, [boothId, gameId]);
    }
}

module.exports = new GameRepository();
