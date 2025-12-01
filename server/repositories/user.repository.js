/**
 * User Repository - 用戶資料存取
 *
 * 職責：
 * - 封裝 users 表的所有 SQL 查詢
 * - 提供用戶認證、資料更新等方法
 *
 * @extends BaseRepository
 */

const BaseRepository = require('./base.repository');

class UserRepository extends BaseRepository {
    constructor() {
        super('users', 'id');
    }

    // ============================================================================
    // 查詢方法
    // ============================================================================

    /**
     * 依使用者名稱查詢
     * @param {string} username - 使用者名稱
     * @returns {Promise<Object|null>}
     */
    async findByUsername(username) {
        return this.findOne({ username });
    }

    /**
     * 依電子郵件查詢
     * @param {string} email - 電子郵件
     * @returns {Promise<Object|null>}
     */
    async findByEmail(email) {
        return this.findOne({ email });
    }

    /**
     * 取得用戶（不含敏感資訊）
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object|null>}
     */
    async findByIdSafe(userId) {
        const sql = `
            SELECT id, username, email, full_name, phone, role, status,
                   preferences, created_at, updated_at, last_login_at
            FROM users
            WHERE id = ?
        `;
        return this.rawGet(sql, [userId]);
    }

    /**
     * 取得用戶認證資料（含密碼雜湊）
     * @param {string} username - 使用者名稱
     * @returns {Promise<Object|null>}
     */
    async findForAuth(username) {
        const sql = `
            SELECT id, username, email, full_name, password_hash, role, status
            FROM users
            WHERE username = ? AND status = 'active'
        `;
        return this.rawGet(sql, [username]);
    }

    /**
     * 取得密碼雜湊
     * @param {number} userId - 用戶 ID
     * @returns {Promise<string|null>}
     */
    async getPasswordHash(userId) {
        const result = await this.rawGet(
            'SELECT password_hash FROM users WHERE id = ?',
            [userId]
        );
        return result?.password_hash || null;
    }

    /**
     * 取得用戶偏好設定
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object|null>}
     */
    async getPreferences(userId) {
        const result = await this.rawGet(
            'SELECT preferences FROM users WHERE id = ?',
            [userId]
        );
        return result?.preferences ? JSON.parse(result.preferences) : null;
    }

    /**
     * 依角色查詢用戶
     * @param {string} role - 角色
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findByRole(role, { limit = 100, offset = 0 } = {}) {
        const sql = `
            SELECT id, username, email, full_name, phone, role, status,
                   created_at, last_login_at
            FROM users
            WHERE role = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;
        return this.rawAll(sql, [role, limit, offset]);
    }

    /**
     * 搜尋用戶
     * @param {string} searchTerm - 搜尋關鍵字
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async search(searchTerm, { limit = 50 } = {}) {
        const sql = `
            SELECT id, username, email, full_name, phone, role, status,
                   created_at, last_login_at
            FROM users
            WHERE username LIKE ? OR email LIKE ? OR full_name LIKE ?
            ORDER BY created_at DESC
            LIMIT ?
        `;
        const term = `%${searchTerm}%`;
        return this.rawAll(sql, [term, term, term, limit]);
    }

    // ============================================================================
    // 更新方法
    // ============================================================================

    /**
     * 更新基本資料
     * @param {number} userId - 用戶 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async updateBasicInfo(userId, { full_name, email, phone }) {
        const sql = `
            UPDATE users
            SET full_name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return this.rawRun(sql, [full_name, email, phone, userId]);
    }

    /**
     * 更新密碼
     * @param {number} userId - 用戶 ID
     * @param {string} passwordHash - 密碼雜湊
     * @returns {Promise<Object>}
     */
    async updatePassword(userId, passwordHash) {
        const sql = `
            UPDATE users
            SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return this.rawRun(sql, [passwordHash, userId]);
    }

    /**
     * 更新偏好設定
     * @param {number} userId - 用戶 ID
     * @param {Object} preferences - 偏好設定
     * @returns {Promise<Object>}
     */
    async updatePreferences(userId, preferences) {
        const preferencesJson = JSON.stringify(preferences);
        const sql = `
            UPDATE users
            SET preferences = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return this.rawRun(sql, [preferencesJson, userId]);
    }

    /**
     * 更新最後登入時間
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object>}
     */
    async updateLastLogin(userId) {
        const sql = `
            UPDATE users
            SET last_login_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return this.rawRun(sql, [userId]);
    }

    /**
     * 更新用戶狀態
     * @param {number} userId - 用戶 ID
     * @param {string} status - 狀態 ('active', 'inactive', 'suspended')
     * @returns {Promise<Object>}
     */
    async updateStatus(userId, status) {
        return this.update(userId, { status, updated_at: new Date().toISOString() });
    }

    // ============================================================================
    // 統計方法
    // ============================================================================

    /**
     * 依角色統計用戶數
     * @returns {Promise<Array>}
     */
    async countByRole() {
        const sql = `
            SELECT role, COUNT(*) as count
            FROM users
            GROUP BY role
        `;
        return this.rawAll(sql);
    }

    /**
     * 依狀態統計用戶數
     * @returns {Promise<Array>}
     */
    async countByStatus() {
        const sql = `
            SELECT status, COUNT(*) as count
            FROM users
            GROUP BY status
        `;
        return this.rawAll(sql);
    }

    /**
     * 取得用戶總覽統計
     * @returns {Promise<Object>}
     */
    async getStats() {
        const sql = `
            SELECT
                COUNT(*) as total_users,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
                SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_count,
                SUM(CASE WHEN DATE(last_login_at) = DATE('now') THEN 1 ELSE 0 END) as today_logins
            FROM users
        `;
        return this.rawGet(sql);
    }

    // ============================================================================
    // 登入歷史（跨表查詢）
    // ============================================================================

    /**
     * 取得登入歷史
     * @param {number} userId - 用戶 ID
     * @param {number} limit - 限制筆數
     * @returns {Promise<Array>}
     */
    async getLoginHistory(userId, limit = 10) {
        const sql = `
            SELECT action, ip_address, details, created_at
            FROM system_logs
            WHERE user_id = ? AND action LIKE '%login%'
            ORDER BY created_at DESC
            LIMIT ?
        `;
        return this.rawAll(sql, [userId, limit]);
    }
}

// 單例模式
module.exports = new UserRepository();
