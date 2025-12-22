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

    /**
     * 記錄 Admin 日誌
     * @param {Object} params - 日誌參數
     * @returns {Promise<Object>}
     */
    async createAdminLog({ userId, action, details, ipAddress, userAgent }) {
        const sql = `
            INSERT INTO admin_logs (user_id, action, details, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
        `;
        return this.rawRun(sql, [
            userId,
            action,
            details ? JSON.stringify(details) : null,
            ipAddress,
            userAgent
        ]);
    }

    /**
     * 搜尋日誌（支援關鍵字、級別、操作類型、日期過濾）
     * @param {Object} params - 搜尋參數
     * @returns {Promise<Array>}
     */
    async search({ search, level, action, dateFilter, limit = 50 } = {}) {
        let sql = `
            SELECT l.*, u.full_name as user_name
            FROM system_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (search && search.trim()) {
            sql += ` AND (l.action LIKE ? OR l.resource_type LIKE ? OR u.full_name LIKE ? OR l.details LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (level && level.trim()) {
            if (level === 'error') {
                sql += ` AND (l.action LIKE '%error%' OR l.action LIKE '%failed%')`;
            } else if (level === 'warning') {
                sql += ` AND l.action LIKE '%warning%'`;
            } else if (level === 'info') {
                sql += ` AND l.action NOT LIKE '%error%' AND l.action NOT LIKE '%failed%' AND l.action NOT LIKE '%warning%'`;
            }
        }

        // 操作類型篩選（支援模糊匹配）
        if (action && action.trim()) {
            sql += ` AND l.action LIKE ?`;
            params.push(`%${action.trim()}%`);
        }

        if (dateFilter && dateFilter.trim()) {
            const today = new Date().toISOString().split('T')[0];
            if (dateFilter === 'today') {
                sql += ` AND DATE(l.created_at) = ?`;
                params.push(today);
            } else if (dateFilter === 'week') {
                sql += ` AND l.created_at >= datetime('now', '-7 days')`;
            } else if (dateFilter === 'month') {
                sql += ` AND l.created_at >= datetime('now', '-30 days')`;
            }
        }

        sql += ` ORDER BY l.created_at DESC LIMIT ?`;
        params.push(limit);

        return this.rawAll(sql, params);
    }
}

// 單例模式
module.exports = new LogRepository();
