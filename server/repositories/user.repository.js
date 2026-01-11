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
     * 依使用者名稱查詢活躍用戶（用於登入）
     * @param {string} username - 使用者名稱
     * @returns {Promise<Object|null>}
     */
    async findActiveByUsername(username) {
        const sql = `SELECT * FROM users WHERE username = ? AND status = 'active'`;
        return this.rawGet(sql, [username]);
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

    // ============================================================================
    // 列表查詢方法
    // ============================================================================

    /**
     * 取得用戶列表（含分頁和搜尋）
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getListWithPagination({ page = 1, limit = 20, search, role, status, managedBy } = {}) {
        const offset = (page - 1) * limit;

        let query = `
            SELECT u.*,
                   (SELECT full_name FROM users WHERE id = u.created_by) as creator_name
            FROM users u
            WHERE 1=1
        `;
        const countQuery = `SELECT COUNT(*) as count FROM users u WHERE 1=1`;
        const queryParams = [];
        const countParams = [];

        if (search) {
            const searchCondition = ` AND (u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)`;
            query += searchCondition;
            countQuery += searchCondition;
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        if (role) {
            const roleCondition = ` AND u.role = ?`;
            query += roleCondition;
            countQuery += roleCondition;
            queryParams.push(role);
            countParams.push(role);
        }

        if (status) {
            const statusCondition = ` AND u.status = ?`;
            query += statusCondition;
            countQuery += statusCondition;
            queryParams.push(status);
            countParams.push(status);
        }

        if (managedBy) {
            const managedCondition = ` AND (u.managed_by = ? OR u.created_by = ?)`;
            query += managedCondition;
            countQuery += managedCondition;
            queryParams.push(managedBy, managedBy);
            countParams.push(managedBy, managedBy);
        }

        query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
        const users = await this.rawAll(query, [...queryParams, limit, offset]);
        const totalResult = await this.rawGet(countQuery, countParams);

        return {
            users,
            pagination: {
                page,
                limit,
                total: totalResult?.count || 0,
                pages: Math.ceil((totalResult?.count || 0) / limit)
            }
        };
    }

    /**
     * 取得管理的用戶列表
     * @param {number} managerId - 管理者的用戶 ID
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getManagedUsers(managerId, { page = 1, limit = 20 } = {}) {
        const offset = (page - 1) * limit;

        const query = `
            SELECT u.*,
                   (SELECT full_name FROM users WHERE id = u.created_by) as creator_name
            FROM users u
            WHERE u.managed_by = ? OR u.created_by = ?
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const countQuery = `
            SELECT COUNT(*) as count FROM users
            WHERE managed_by = ? OR created_by = ?
        `;

        const users = await this.rawAll(query, [managerId, managerId, limit, offset]);
        const totalResult = await this.rawGet(countQuery, [managerId, managerId]);

        return {
            users,
            pagination: {
                page,
                limit,
                total: totalResult?.count || 0,
                pages: Math.ceil((totalResult?.count || 0) / limit)
            }
        };
    }

    /**
     * 依條件查詢用戶（含分頁）
     * @param {Object} conditions - 查詢條件
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async findByWithPagination(conditions, { page = 1, limit = 20, orderBy = 'created_at', order = 'DESC' } = {}) {
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params = [];

        Object.entries(conditions).forEach(([key, value]) => {
            whereClause += ` AND ${key} = ?`;
            params.push(value);
        });

        const countResult = await this.rawGet(
            `SELECT COUNT(*) as total FROM users ${whereClause}`,
            params
        );

        const users = await this.rawAll(
            `SELECT * FROM users ${whereClause} ORDER BY ${orderBy} ${order} LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return {
            users,
            pagination: {
                total: countResult?.total || 0,
                page,
                limit,
                pages: Math.ceil((countResult?.total || 0) / limit)
            }
        };
    }

    // ============================================================================
    // 檢查方法
    // ============================================================================

    /**
     * 檢查用戶名是否存在
     * @param {string} username - 用戶名
     * @param {number} excludeId - 排除的用戶 ID
     * @returns {Promise<boolean>}
     */
    async existsByUsername(username, excludeId = null) {
        let sql = 'SELECT id FROM users WHERE username = ?';
        const params = [username];

        if (excludeId) {
            sql += ' AND id != ?';
            params.push(excludeId);
        }

        const result = await this.rawGet(sql, params);
        return result !== null && result !== undefined;
    }

    /**
     * 檢查 email 是否存在
     * @param {string} email - 電子郵件
     * @param {number} excludeId - 排除的用戶 ID
     * @returns {Promise<boolean>}
     */
    async existsByEmail(email, excludeId = null) {
        let sql = 'SELECT id FROM users WHERE email = ?';
        const params = [email];

        if (excludeId) {
            sql += ' AND id != ?';
            params.push(excludeId);
        }

        const result = await this.rawGet(sql, params);
        return result !== null && result !== undefined;
    }

    /**
     * 檢查用戶名或 email 是否存在
     * @param {string} username - 用戶名
     * @param {string} email - 電子郵件
     * @returns {Promise<Object|null>}
     */
    async findByUsernameOrEmail(username, email) {
        return this.rawGet(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
    }

    /**
     * 檢查用戶是否有創建的項目
     * @param {number} userId - 用戶 ID
     * @returns {Promise<number>}
     */
    async countProjectsByUser(userId) {
        const result = await this.rawGet(
            'SELECT COUNT(*) as count FROM event_projects WHERE created_by = ?',
            [userId]
        );
        return result?.count || 0;
    }

    // ============================================================================
    // 進階查詢方法
    // ============================================================================

    /**
     * 取得用戶詳情（含創建者名稱）
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object|null>}
     */
    async getUserDetail(userId) {
        const sql = `
            SELECT u.*,
                   (SELECT full_name FROM users WHERE id = u.created_by) as creator_name
            FROM users u
            WHERE u.id = ?
        `;
        return this.rawGet(sql, [userId]);
    }

    /**
     * 取得當前用戶資訊
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object|null>}
     */
    async getCurrentUserInfo(userId) {
        const sql = `
            SELECT id, username, email, full_name, role, status,
                   account_expires_at, last_login, created_at
            FROM users
            WHERE id = ?
        `;
        return this.rawGet(sql, [userId]);
    }

    /**
     * 取得用戶的項目統計
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object>}
     */
    async getProjectStats(userId) {
        const sql = `
            SELECT
                COUNT(*) as total_projects,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_projects,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects
            FROM event_projects
            WHERE created_by = ?
        `;
        return this.rawGet(sql, [userId]);
    }

    /**
     * 取得參與的項目數量
     * @param {number} userId - 用戶 ID
     * @returns {Promise<number>}
     */
    async countParticipatingProjects(userId) {
        const result = await this.rawGet(
            'SELECT COUNT(*) as count FROM user_project_permissions WHERE user_id = ?',
            [userId]
        );
        return result?.count || 0;
    }

    // ============================================================================
    // 創建方法
    // ============================================================================

    /**
     * 創建用戶（完整版）
     * @param {Object} data - 用戶資料
     * @returns {Promise<Object>}
     */
    async createUser(data) {
        const {
            username,
            email,
            password_hash,
            full_name,
            phone,
            role,
            status,
            managed_by,
            preferences
        } = data;

        const sql = `
            INSERT INTO users (
                username, email, password_hash, full_name, phone, role, status,
                managed_by, preferences, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        const result = await this.rawRun(sql, [
            username,
            email,
            password_hash,
            full_name,
            phone,
            role || 'project_user',
            status || 'active',
            managed_by,
            preferences ? JSON.stringify(preferences) : null
        ]);

        return { id: result.lastID, username, email };
    }

    // ============================================================================
    // 批量/特殊更新方法
    // ============================================================================

    /**
     * 更新用戶（動態欄位）
     * @param {number} userId - 用戶 ID
     * @param {Object} updates - 更新資料
     * @returns {Promise<Object>}
     */
    async updateDynamic(userId, updates) {
        const allowedFields = [
            'username', 'email', 'full_name', 'phone', 'role', 'status',
            'managed_by', 'preferences', 'account_expires_at'
        ];

        const updateFields = [];
        const updateValues = [];

        Object.entries(updates).forEach(([key, value]) => {
            if (allowedFields.includes(key) && value !== undefined) {
                updateFields.push(`${key} = ?`);
                if (key === 'preferences') {
                    updateValues.push(JSON.stringify(value));
                } else {
                    updateValues.push(value);
                }
            }
        });

        if (updateFields.length === 0) {
            return { changes: 0 };
        }

        updateValues.push(userId);
        const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        return this.rawRun(query, updateValues);
    }

    /**
     * 批量更新狀態
     * @param {number} userId - 用戶 ID
     * @param {string} status - 新狀態
     * @param {Object} options - 選項
     * @returns {Promise<Object>}
     */
    async updateStatusWithHistory(userId, status, { changedBy, changeReason, expiresAt } = {}) {
        // 更新狀態
        const result = await this.rawRun(
            'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, userId]
        );

        // 記錄狀態歷史
        if (changedBy) {
            await this.rawRun(`
                INSERT INTO user_status_history (
                    user_id, old_status, new_status, changed_by, change_reason, expires_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [userId, status, status, changedBy, changeReason, expiresAt]);
        }

        return result;
    }

    /**
     * 軟刪除用戶
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object>}
     */
    async softDelete(userId) {
        return this.rawRun(
            'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['pending_deletion', userId]
        );
    }

    /**
     * 檢查用戶名和郵箱唯一性
     * @param {string} field - 欄位名稱
     * @param {string} value - 值
     * @param {number} excludeId - 排除的用戶 ID
     * @returns {Promise<Object|null>}
     */
    async checkUnique(field, value, excludeId) {
        return this.rawGet(
            `SELECT id FROM users WHERE ${field} = ? AND id != ?`,
            [value, excludeId]
        );
    }

    // ============================================================================
    // 管理員統計方法
    // ============================================================================

    /**
     * 取得用戶統計（管理員儀表板用）
     * @param {string} userRole - 用戶角色
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object>}
     */
    async getDashboardStats(userRole, userId) {
        if (userRole === 'super_admin') {
            const totalUsers = await this.rawGet('SELECT COUNT(*) as count FROM users');
            const activeUsers = await this.rawGet("SELECT COUNT(*) as count FROM users WHERE status = 'active'");
            const disabledUsers = await this.rawGet("SELECT COUNT(*) as count FROM users WHERE status = 'disabled'");
            const newUsersThisMonth = await this.rawGet(`
                SELECT COUNT(*) as count FROM users
                WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
            `);

            return {
                totalUsers: totalUsers?.count || 0,
                activeUsers: activeUsers?.count || 0,
                disabledUsers: disabledUsers?.count || 0,
                newUsersThisMonth: newUsersThisMonth?.count || 0
            };
        }

        if (userRole === 'project_manager') {
            const managedUsers = await this.rawGet(
                'SELECT COUNT(*) as count FROM users WHERE managed_by = ? OR created_by = ?',
                [userId, userId]
            );
            const activeManaged = await this.rawGet(
                `SELECT COUNT(*) as count FROM users
                 WHERE (managed_by = ? OR created_by = ?) AND status = 'active'`,
                [userId, userId]
            );

            return {
                totalUsers: managedUsers?.count || 0,
                activeUsers: activeManaged?.count || 0
            };
        }

        return { totalUsers: 0, activeUsers: 0 };
    }

    // ============================================================================
    // 用戶活動與歷史
    // ============================================================================

    /**
     * 取得用戶活動記錄
     * @param {number} userId - 用戶 ID
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getUserActivities(userId, { page = 1, limit = 20 } = {}) {
        const offset = (page - 1) * limit;

        const activities = await this.rawAll(`
            SELECT al.*, u.full_name as user_name
            FROM system_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.user_id = ?
            ORDER BY al.created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, limit, offset]);

        const totalResult = await this.rawGet(
            'SELECT COUNT(*) as count FROM system_logs WHERE user_id = ?',
            [userId]
        );

        return {
            activities,
            pagination: {
                page,
                limit,
                total: totalResult?.count || 0,
                pages: Math.ceil((totalResult?.count || 0) / limit)
            }
        };
    }

    /**
     * 取得用戶狀態歷史
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Array>}
     */
    async getUserStatusHistory(userId) {
        return this.rawAll(`
            SELECT ush.*, u.full_name as changed_by_name
            FROM user_status_history ush
            LEFT JOIN users u ON ush.changed_by = u.id
            WHERE ush.user_id = ?
            ORDER BY ush.created_at DESC
        `, [userId]);
    }

    // ============================================================================
    // 交易操作
    // ============================================================================

    /**
     * 刪除用戶及其所有關聯資料
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object>}
     */
    async deleteUserCascade(userId) {
        // 注意：此方法需要在 Service 層的事務中調用
        await this.rawRun('DELETE FROM user_project_permissions WHERE user_id = ?', [userId]);
        await this.rawRun('UPDATE event_projects SET assigned_to = NULL WHERE assigned_to = ?', [userId]);
        return this.delete(userId);
    }

    /**
     * 批量更新用戶狀態
     * @param {Array} userIds - 用戶 ID 陣列
     * @param {string} status - 新狀態
     * @returns {Promise<Object>}
     */
    async updateStatusBulk(userIds, status) {
        if (!userIds || userIds.length === 0) {
            return { changes: 0 };
        }

        const placeholders = userIds.map(() => '?').join(', ');
        const sql = `UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
        return this.rawRun(sql, [status, ...userIds]);
    }

    /**
     * 取得用戶列表（含分頁、權限過濾和搜尋）
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getListWithPermissionFilter({ userId, userRole, page = 1, limit = 20, search, role, status } = {}) {
        const offset = (page - 1) * limit;

        // 構建權限過濾條件
        let roleFilter = '';
        let roleParams = [];

        if (userRole !== 'super_admin') {
            if (userRole === 'project_manager') {
                roleFilter = ' AND u.role != ? AND (u.created_by = ? OR u.managed_by = ?)';
                roleParams = ['super_admin', userId, userId];
            } else {
                roleFilter = ' AND u.id = ?';
                roleParams = [userId];
            }
        }

        let query = `
            SELECT
                u.*,
                creator.full_name as created_by_name,
                manager.full_name as managed_by_name
            FROM users u
            LEFT JOIN users creator ON u.created_by = creator.id
            LEFT JOIN users manager ON u.managed_by = manager.id
            WHERE 1=1 ${roleFilter}
        `;
        let countQuery = `SELECT COUNT(*) as count FROM users u WHERE 1=1 ${roleFilter}`;
        const queryParams = [...roleParams];
        const countParams = [...roleParams];

        // 搜尋過濾
        if (search && search.trim()) {
            const searchClause = ` AND (u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)`;
            query += searchClause;
            countQuery += searchClause;
            const searchTerm = `%${search.trim()}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        // 角色過濾
        if (role && role.trim()) {
            query += ` AND u.role = ?`;
            countQuery += ` AND u.role = ?`;
            queryParams.push(role.trim());
            countParams.push(role.trim());
        }

        // 狀態過濾
        if (status && status.trim()) {
            query += ` AND u.status = ?`;
            countQuery += ` AND u.status = ?`;
            queryParams.push(status.trim());
            countParams.push(status.trim());
        }

        query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;

        const users = await this.rawAll(query, [...queryParams, limit, offset]);
        const totalResult = await this.rawGet(countQuery, countParams);

        return {
            users,
            pagination: {
                page,
                limit,
                total: totalResult?.count || 0,
                pages: Math.ceil((totalResult?.count || 0) / limit)
            }
        };
    }

    /**
     * 搜尋用戶（帶權限過濾）
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async searchWithPermissionFilter({ userId, userRole, search, role, status, limit = 50 } = {}) {
        // 構建權限過濾條件
        let roleFilter = '';
        let roleParams = [];

        if (userRole !== 'super_admin') {
            if (userRole === 'project_manager') {
                roleFilter = ' AND u.role != ? AND (u.created_by = ? OR u.managed_by = ?)';
                roleParams = ['super_admin', userId, userId];
            } else {
                roleFilter = ' AND u.id = ?';
                roleParams = [userId];
            }
        }

        let query = `
            SELECT u.id, u.username, u.email, u.full_name, u.role, u.status,
                   u.created_at, u.last_login,
                   creator.full_name as created_by_name
            FROM users u
            LEFT JOIN users creator ON u.created_by = creator.id
            WHERE 1=1 ${roleFilter}
        `;
        const queryParams = [...roleParams];

        if (search && search.trim()) {
            query += ` AND (u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        if (role && role.trim() && role !== 'all') {
            query += ` AND u.role = ?`;
            queryParams.push(role.trim());
        }

        if (status && status.trim() && status !== 'all') {
            query += ` AND u.status = ?`;
            queryParams.push(status.trim());
        }

        query += ` ORDER BY u.created_at DESC LIMIT ?`;
        queryParams.push(limit);

        return this.rawAll(query, queryParams);
    }
}

// 單例模式
module.exports = new UserRepository();
