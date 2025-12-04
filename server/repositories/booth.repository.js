/**
 * Booth Repository - 攤位資料存取
 *
 * 職責：
 * - 封裝 booths 表的所有 SQL 查詢
 * - 提供攤位特定的查詢方法
 *
 * @extends BaseRepository
 * @refactor 2025-12-01
 */

const BaseRepository = require('./base.repository');

class BoothRepository extends BaseRepository {
    constructor() {
        super('booths', 'id');
    }

    // ============================================================================
    // 查詢方法
    // ============================================================================

    /**
     * 取得攤位（含專案資訊）
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<Object|null>}
     */
    async findByIdWithProject(boothId) {
        const sql = `
            SELECT b.*, p.project_name
            FROM booths b
            LEFT JOIN event_projects p ON b.project_id = p.id
            WHERE b.id = ?
        `;
        return this.rawGet(sql, [boothId]);
    }

    /**
     * 取得所有攤位（含統計資訊）
     * @param {number|null} projectId - 專案 ID（可選）
     * @returns {Promise<Array>}
     */
    async findAllWithStats(projectId = null) {
        let sql = `
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
        if (projectId) {
            sql += ' WHERE b.project_id = ?';
            params.push(projectId);
        }

        sql += ' GROUP BY b.id ORDER BY b.project_id ASC, b.booth_name ASC';

        return this.rawAll(sql, params);
    }

    /**
     * 依攤位代碼查詢
     * @param {string} boothCode - 攤位代碼
     * @returns {Promise<Object|null>}
     */
    async findByCode(boothCode) {
        return this.findOne({ booth_code: boothCode });
    }

    /**
     * 檢查攤位代碼是否存在（排除指定 ID）
     * @param {string} boothCode - 攤位代碼
     * @param {number|null} excludeId - 排除的 ID
     * @returns {Promise<Object|null>}
     */
    async findByCodeExcluding(boothCode, excludeId) {
        const sql = `
            SELECT id FROM booths WHERE booth_code = ? AND id != ?
        `;
        return this.rawGet(sql, [boothCode, excludeId]);
    }

    // ============================================================================
    // 統計方法
    // ============================================================================

    /**
     * 取得攤位統計總覽
     * @param {number} boothId - 攤位 ID
     * @param {string|null} date - 日期篩選（可選）
     * @returns {Promise<Object>}
     */
    async getStatsSummary(boothId, date = null) {
        let sql = `
            SELECT
                COUNT(DISTINCT gs.trace_id) as total_players,
                COUNT(gs.id) as total_sessions,
                AVG(gs.final_score) as avg_score,
                MAX(gs.final_score) as max_score,
                AVG(gs.total_play_time) as avg_play_time,
                SUM(gs.voucher_earned) as vouchers_earned
            FROM game_sessions gs
            WHERE gs.booth_id = ?
        `;
        const params = [boothId];

        if (date) {
            sql += ' AND DATE(gs.session_start) = ?';
            params.push(date);
        }

        const result = await this.rawGet(sql, params);
        return result || {
            total_players: 0,
            total_sessions: 0,
            avg_score: 0,
            max_score: 0,
            avg_play_time: 0,
            vouchers_earned: 0
        };
    }

    /**
     * 取得每小時統計
     * @param {number} boothId - 攤位 ID
     * @param {string|null} date - 日期篩選（可選）
     * @returns {Promise<Array>}
     */
    async getHourlyStats(boothId, date = null) {
        let sql = `
            SELECT
                strftime('%Y-%m-%d %H:00', gs.session_start) as hour,
                COUNT(DISTINCT gs.trace_id) as player_count,
                COUNT(gs.id) as session_count,
                AVG(gs.final_score) as avg_score
            FROM game_sessions gs
            WHERE gs.booth_id = ?
        `;
        const params = [boothId];

        if (date) {
            sql += ' AND DATE(gs.session_start) = ?';
            params.push(date);
        }

        sql += `
            GROUP BY hour
            ORDER BY hour DESC
            LIMIT 24
        `;

        return this.rawAll(sql, params);
    }

    /**
     * 檢查攤位是否有遊戲記錄
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<boolean>}
     */
    async hasGameSessions(boothId) {
        const result = await this.rawGet(
            'SELECT COUNT(*) as count FROM game_sessions WHERE booth_id = ?',
            [boothId]
        );
        return (result?.count || 0) > 0;
    }

    // ============================================================================
    // CRUD 方法
    // ============================================================================

    /**
     * 建立攤位
     * @param {Object} data - 攤位資料
     * @returns {Promise<Object>}
     */
    async createBooth({ project_id, booth_name, booth_code, location, description }) {
        const sql = `
            INSERT INTO booths (project_id, booth_name, booth_code, location, description, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        return this.rawRun(sql, [
            project_id,
            booth_name,
            booth_code,
            location || '',
            description || '',
            1
        ]);
    }

    /**
     * 更新攤位
     * @param {number} boothId - 攤位 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async updateBooth(boothId, data) {
        const updates = [];
        const params = [];

        if (data.booth_name !== undefined) {
            updates.push('booth_name = ?');
            params.push(data.booth_name);
        }
        if (data.booth_code !== undefined) {
            updates.push('booth_code = ?');
            params.push(data.booth_code);
        }
        if (data.location !== undefined) {
            updates.push('location = ?');
            params.push(data.location);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (data.is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(data.is_active ? 1 : 0);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(boothId);

        const sql = `UPDATE booths SET ${updates.join(', ')} WHERE id = ?`;
        return this.rawRun(sql, params);
    }

    /**
     * 刪除攤位
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<Object>}
     */
    async deleteBooth(boothId) {
        return this.rawRun('DELETE FROM booths WHERE id = ?', [boothId]);
    }
}

// 單例模式
module.exports = new BoothRepository();
