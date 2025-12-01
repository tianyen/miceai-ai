/**
 * Log Repository - 系統日誌資料存取
 *
 * 職責：
 * - 封裝 system_logs 表的所有 SQL 查詢
 * - 管理日誌記錄相關操作
 *
 * @extends BaseRepository
 */

const BaseRepository = require('./base.repository');

class LogRepository extends BaseRepository {
    constructor() {
        super('system_logs', 'id');
    }

    // ============================================================================
    // 統計查詢
    // ============================================================================

    /**
     * 取得日誌統計
     * @returns {Promise<Object>}
     */
    async getStats() {
        const [errorCount, warningCount, totalCount] = await Promise.all([
            this.rawGet("SELECT COUNT(*) as count FROM system_logs WHERE action LIKE '%error%' OR action LIKE '%failed%'"),
            this.rawGet("SELECT COUNT(*) as count FROM system_logs WHERE action LIKE '%warning%'"),
            this.rawGet("SELECT COUNT(*) as count FROM system_logs")
        ]);

        return {
            errorCount: errorCount?.count || 0,
            warningCount: warningCount?.count || 0,
            totalCount: totalCount?.count || 0
        };
    }

    // ============================================================================
    // 日誌查詢
    // ============================================================================

    /**
     * 取得日誌列表（含用戶資訊）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Array>}
     */
    async getLogsWithUser({ page = 1, limit = 20 } = {}) {
        const offset = (page - 1) * limit;
        const sql = `
            SELECT
                l.*,
                u.username,
                u.full_name
            FROM system_logs l
            LEFT JOIN users u ON l.user_id = u.id
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `;
        return this.rawAll(sql, [limit, offset]);
    }

    /**
     * 取得日誌詳情（含用戶資訊）
     * @param {number} logId - 日誌 ID
     * @returns {Promise<Object|null>}
     */
    async getLogByIdWithUser(logId) {
        const sql = `
            SELECT
                l.*,
                u.username,
                u.full_name
            FROM system_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.id = ?
        `;
        return this.rawGet(sql, [logId]);
    }

    /**
     * 刪除日誌
     * @param {number} logId - 日誌 ID
     * @returns {Promise<Object>}
     */
    async deleteLog(logId) {
        return this.rawRun('DELETE FROM system_logs WHERE id = ?', [logId]);
    }

    /**
     * 根據操作類型搜尋日誌
     * @param {string} action - 操作類型
     * @param {number} limit - 限制筆數
     * @returns {Promise<Array>}
     */
    async findByAction(action, limit = 50) {
        const sql = `
            SELECT l.*, u.username, u.full_name
            FROM system_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.action LIKE ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `;
        return this.rawAll(sql, [`%${action}%`, limit]);
    }

    /**
     * 根據用戶 ID 查詢日誌
     * @param {number} userId - 用戶 ID
     * @param {number} limit - 限制筆數
     * @returns {Promise<Array>}
     */
    async findByUserId(userId, limit = 50) {
        const sql = `
            SELECT l.*, u.username, u.full_name
            FROM system_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.user_id = ?
            ORDER BY l.created_at DESC
            LIMIT ?
        `;
        return this.rawAll(sql, [userId, limit]);
    }

    /**
     * 根據日期範圍查詢日誌
     * @param {string} startDate - 開始日期
     * @param {string} endDate - 結束日期
     * @returns {Promise<Array>}
     */
    async findByDateRange(startDate, endDate) {
        const sql = `
            SELECT l.*, u.username, u.full_name
            FROM system_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE DATE(l.created_at) BETWEEN ? AND ?
            ORDER BY l.created_at DESC
        `;
        return this.rawAll(sql, [startDate, endDate]);
    }
}

// 單例模式
module.exports = new LogRepository();
