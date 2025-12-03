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
}

module.exports = new GameRepository();
