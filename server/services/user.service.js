/**
 * User Service - 用戶管理業務邏輯
 *
 * @description 處理用戶 CRUD、搜索、權限
 * @refactor 2025-12-01: 從 admin/users.js 提取業務邏輯
 * @refactor 2025-12-05: 從 userController 抽取業務邏輯
 */
const BaseService = require('./base.service');
const bcrypt = require('bcrypt');

class UserService extends BaseService {
    constructor() {
        super('UserService');
        this.SALT_ROUNDS = 10;
        this.ROLE_MAP = {
            'super_admin': '超級管理員',
            'project_manager': '專案管理員',
            'vendor': '廠商',
            'project_user': '一般人員'
        };
        this.STATUS_MAP = {
            'active': '啟用',
            'inactive': '停用',
            'suspended': '暫停',
            'disabled': '禁用',
            'pending_deletion': '待刪除'
        };
    }

    // ============================================================================
    // 權限檢查
    // ============================================================================

    /**
     * 構建用戶權限過濾條件
     * @param {string} userRole - 當前用戶角色
     * @param {number} userId - 當前用戶 ID
     * @returns {{ filter: string, params: number[] }}
     */
    buildUserFilter(userRole, userId) {
        if (userRole === 'super_admin') {
            return { filter: '', params: [] };
        }

        if (userRole === 'project_manager') {
            return {
                filter: ` AND u.role != 'super_admin' AND (u.created_by = ? OR u.managed_by = ?)`,
                params: [userId, userId]
            };
        }

        // 其他角色只能看自己
        return {
            filter: ' AND u.id = ?',
            params: [userId]
        };
    }

    /**
     * 檢查用戶管理權限
     * @param {Object} currentUser - 當前用戶
     * @param {Object} targetUser - 目標用戶
     * @returns {{ canManage: boolean, reason?: string }}
     */
    checkManagePermission(currentUser, targetUser) {
        // 不能管理自己（某些操作）
        if (currentUser.id === targetUser.id) {
            return { canManage: false, reason: '不能對自己執行此操作' };
        }

        // 超級管理員可以管理所有人（除了其他超級管理員）
        if (currentUser.role === 'super_admin') {
            if (targetUser.role === 'super_admin') {
                return { canManage: false, reason: '無法管理其他超級管理員' };
            }
            return { canManage: true };
        }

        // 專案管理員只能管理自己創建/管理的一般用戶
        if (currentUser.role === 'project_manager') {
            if (targetUser.role !== 'project_user') {
                return { canManage: false, reason: '只能管理一般用戶' };
            }
            if (targetUser.managed_by !== currentUser.id && targetUser.created_by !== currentUser.id) {
                return { canManage: false, reason: '無權限管理此用戶' };
            }
            return { canManage: true };
        }

        return { canManage: false, reason: '權限不足' };
    }

    /**
     * 檢查用戶創建權限
     * @param {Object} currentUser - 當前用戶
     * @param {string} targetRole - 要創建的用戶角色
     * @returns {{ canCreate: boolean, reason?: string }}
     */
    checkCreatePermission(currentUser, targetRole) {
        if (currentUser.role === 'super_admin') {
            return { canCreate: true };
        }

        if (currentUser.role === 'project_manager') {
            if (targetRole !== 'project_user') {
                return { canCreate: false, reason: '專案管理員只能創建一般用戶' };
            }
            return { canCreate: true };
        }

        return { canCreate: false, reason: '無權限創建用戶' };
    }

    /**
     * 根據 ID 獲取用戶
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object|null>}
     */
    async getById(userId) {
        return this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
    }

    /**
     * 搜索用戶
     * @param {Object} options - 搜索選項
     * @returns {Promise<Array>}
     */
    async search({ search, role, status, limit = 50 } = {}) {
        let query = 'SELECT * FROM users WHERE 1=1';
        let params = [];

        if (search && search.trim()) {
            query += ' AND (username LIKE ? OR full_name LIKE ? OR email LIKE ?)';
            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (role && role.trim()) {
            query += ' AND role = ?';
            params.push(role);
        }

        if (status && status.trim()) {
            query += ' AND status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);

        return this.db.query(query, params);
    }

    // ============================================================================
    // 列表查詢
    // ============================================================================

    /**
     * 取得用戶列表（含分頁和權限過濾）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getUsersList({ userId, userRole, page = 1, limit = 20, search, role, status }) {
        const offset = (page - 1) * limit;
        const { filter: roleFilter, params: roleParams } = this.buildUserFilter(userRole, userId);

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

        const users = await this.db.query(query, [...queryParams, limit, offset]);
        const totalResult = await this.db.get(countQuery, countParams);

        return {
            users,
            pagination: {
                page,
                limit,
                total: totalResult.count,
                pages: Math.ceil(totalResult.count / limit)
            }
        };
    }

    /**
     * 取得專案管理員管理的用戶
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getManagedUsers({ managerId, page = 1, limit = 20 }) {
        const offset = (page - 1) * limit;

        const users = await this.db.query(`
            SELECT
                u.id, u.username, u.email, u.full_name, u.role, u.status,
                u.created_at, u.updated_at, u.last_login, u.account_expires_at,
                u.disabled_at, u.can_delete_after
            FROM users u
            WHERE u.managed_by = ? OR u.created_by = ?
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `, [managerId, managerId, limit, offset]);

        const totalResult = await this.db.get(`
            SELECT COUNT(*) as count FROM users
            WHERE managed_by = ? OR created_by = ?
        `, [managerId, managerId]);

        return {
            users,
            pagination: {
                page,
                limit,
                total: totalResult.count,
                pages: Math.ceil(totalResult.count / limit)
            }
        };
    }

    /**
     * 搜尋用戶
     * @param {Object} params - 搜尋參數
     * @returns {Promise<Array>}
     */
    async searchUsers({ userId, userRole, search, role, status, limit = 50 }) {
        const { filter: roleFilter, params: roleParams } = this.buildUserFilter(userRole, userId);

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

        return this.db.query(query, queryParams);
    }

    /**
     * 獲取用戶列表（含分頁）- 舊版兼容
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getList({ page = 1, limit = 20, search, role, status } = {}) {
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        let params = [];

        if (search) {
            whereClause += ' AND (username LIKE ? OR full_name LIKE ? OR email LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (role) {
            whereClause += ' AND role = ?';
            params.push(role);
        }

        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }

        // 獲取總數
        const countResult = await this.db.get(`
            SELECT COUNT(*) as total FROM users ${whereClause}
        `, params);

        // 獲取列表
        const users = await this.db.query(`
            SELECT id, username, email, full_name, phone, role, status,
                   created_at, updated_at, last_login
            FROM users
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        const total = countResult.total;
        return {
            users,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * 獲取分頁資訊
     * @param {number} page - 頁碼
     * @param {number} limit - 每頁筆數
     * @returns {Promise<Object>}
     */
    async getPagination(page = 1, limit = 20) {
        const countResult = await this.db.get(
            'SELECT COUNT(*) as count FROM users'
        );
        const total = countResult?.count || 0;
        return {
            total,
            pages: Math.ceil(total / limit)
        };
    }

    /**
     * 創建用戶
     * @param {Object} data - 用戶資料
     * @returns {Promise<Object>}
     */
    async create(data) {
        const {
            username,
            email,
            password,
            full_name,
            phone,
            role,
            status
        } = data;

        // 檢查用戶名是否存在
        const existingUsername = await this.db.get(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        if (existingUsername) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '用戶名已存在'
            });
        }

        // 檢查 email 是否存在
        const existingEmail = await this.db.get(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );
        if (existingEmail) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '電子郵件已存在'
            });
        }

        // 密碼加密
        const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

        const result = await this.db.run(`
            INSERT INTO users (
                username, email, password, full_name, phone, role, status,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
            username,
            email,
            hashedPassword,
            full_name || null,
            phone || null,
            role || 'project_user',
            status || 'active'
        ]);

        this.log('create', { userId: result.lastID, username });

        return {
            id: result.lastID,
            username,
            email
        };
    }

    /**
     * 更新用戶
     * @param {number} userId - 用戶 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async update(userId, data) {
        const user = await this.getById(userId);
        if (!user) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '用戶不存在' });
        }

        const {
            email,
            full_name,
            phone,
            role,
            status
        } = data;

        // 如果要更新 email，檢查是否被其他用戶使用
        if (email && email !== user.email) {
            const existingEmail = await this.db.get(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, userId]
            );
            if (existingEmail) {
                this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                    message: '電子郵件已被使用'
                });
            }
        }

        await this.db.run(`
            UPDATE users SET
                email = COALESCE(?, email),
                full_name = COALESCE(?, full_name),
                phone = COALESCE(?, phone),
                role = COALESCE(?, role),
                status = COALESCE(?, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [email, full_name, phone, role, status, userId]);

        this.log('update', { userId });

        return { id: userId, updated: true };
    }

    /**
     * 重設密碼
     * @param {number} userId - 用戶 ID
     * @param {string} newPassword - 新密碼
     * @returns {Promise<Object>}
     */
    async resetPassword(userId, newPassword) {
        const user = await this.getById(userId);
        if (!user) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '用戶不存在' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

        await this.db.run(`
            UPDATE users SET
                password = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [hashedPassword, userId]);

        this.log('resetPassword', { userId });

        return { id: userId, passwordReset: true };
    }

    /**
     * 刪除用戶
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object>}
     */
    async delete(userId) {
        const user = await this.getById(userId);
        if (!user) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '用戶不存在' });
        }

        await this.db.run('DELETE FROM users WHERE id = ?', [userId]);

        this.log('delete', { userId });

        return { deleted: true };
    }

    /**
     * 獲取用戶統計
     * @returns {Promise<Object>}
     */
    async getStats() {
        const stats = await this.db.get(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
            FROM users
        `);

        return {
            total: stats.total || 0,
            active: stats.active || 0,
            inactive: stats.inactive || 0,
            pending: stats.pending || 0
        };
    }

    /**
     * 獲取角色顯示文字
     * @param {string} role - 角色代碼
     * @returns {string}
     */
    getRoleText(role) {
        const roleMap = {
            'super_admin': '超級管理員',
            'project_manager': '專案管理員',
            'vendor': '廠商用戶',
            'project_user': '一般用戶'
        };
        return roleMap[role] || role;
    }

    /**
     * 獲取狀態顯示文字
     * @param {string} status - 狀態代碼
     * @returns {string}
     */
    getStatusText(status) {
        return this.STATUS_MAP[status] || status;
    }

    // ============================================================================
    // 詳情查詢
    // ============================================================================

    /**
     * 取得用戶詳情（含統計）
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object|null>}
     */
    async getUserDetail(userId) {
        const user = await this.db.get(`
            SELECT id, username, email, full_name, role, status, created_at, updated_at, last_login,
                   (SELECT full_name FROM users WHERE id = u.created_by) as creator_name
            FROM users u
            WHERE id = ?
        `, [userId]);

        if (!user) return null;

        // 用戶創建的項目統計
        const projectStats = await this.db.get(`
            SELECT
                COUNT(*) as total_projects,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_projects,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects
            FROM event_projects
            WHERE created_by = ?
        `, [userId]);

        // 參與的項目統計
        const participatingProjects = await this.db.get(`
            SELECT COUNT(*) as count FROM user_project_permissions WHERE user_id = ?
        `, [userId]);

        return {
            ...user,
            project_stats: projectStats,
            participating_projects: participatingProjects.count
        };
    }

    /**
     * 取得當前用戶資訊
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object|null>}
     */
    async getCurrentUserInfo(userId) {
        return this.db.get(`
            SELECT id, username, email, full_name, role, status,
                   account_expires_at, last_login, created_at
            FROM users WHERE id = ?
        `, [userId]);
    }

    /**
     * 取得用戶活動記錄
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getUserActivities({ userId, page = 1, limit = 20 }) {
        const offset = (page - 1) * limit;

        const activities = await this.db.query(`
            SELECT al.*, u.full_name as user_name
            FROM system_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.user_id = ?
            ORDER BY al.created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, limit, offset]);

        const totalResult = await this.db.get(
            'SELECT COUNT(*) as count FROM system_logs WHERE user_id = ?',
            [userId]
        );

        return {
            activities,
            pagination: {
                page,
                limit,
                total: totalResult.count,
                pages: Math.ceil(totalResult.count / limit)
            }
        };
    }

    /**
     * 取得用戶狀態歷史
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Array>}
     */
    async getUserStatusHistory(userId) {
        return this.db.query(`
            SELECT ush.*, u.full_name as changed_by_name
            FROM user_status_history ush
            LEFT JOIN users u ON ush.changed_by = u.id
            WHERE ush.user_id = ?
            ORDER BY ush.created_at DESC
        `, [userId]);
    }

    // ============================================================================
    // CRUD 操作（含權限檢查）
    // ============================================================================

    /**
     * 創建用戶（含權限檢查）
     * @param {Object} data - 用戶資料
     * @param {Object} currentUser - 當前用戶
     * @returns {Promise<Object>}
     */
    async createUser(data, currentUser) {
        const { username, email, password, full_name, role, account_expires_months } = data;

        // 權限檢查
        const { canCreate, reason } = this.checkCreatePermission(currentUser, role);
        if (!canCreate) {
            return { success: false, error: 'FORBIDDEN', message: reason };
        }

        // 檢查用戶名和郵箱是否已存在
        const existingUser = await this.db.get(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
        if (existingUser) {
            return { success: false, error: 'CONFLICT', message: '用戶名或郵箱已存在' };
        }

        // 加密密碼
        const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

        // 計算帳號到期時間
        let accountExpiresAt = null;
        if (account_expires_months && account_expires_months > 0) {
            const expiresDate = new Date();
            expiresDate.setMonth(expiresDate.getMonth() + parseInt(account_expires_months));
            accountExpiresAt = expiresDate.toISOString();
        }

        // 創建用戶
        const result = await this.db.run(`
            INSERT INTO users (
                username, email, password_hash, full_name, role, status,
                created_by, managed_by, account_expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            username,
            email,
            passwordHash,
            full_name,
            role,
            'active',
            currentUser.id,
            currentUser.role === 'project_manager' ? currentUser.id : null,
            accountExpiresAt
        ]);

        // 記錄狀態歷史
        await this.db.run(`
            INSERT INTO user_status_history (
                user_id, old_status, new_status, changed_by, change_reason, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [result.lastID, null, 'active', currentUser.id, '創建用戶', accountExpiresAt]);

        this.log('createUser', { userId: result.lastID, username, role });

        return {
            success: true,
            id: result.lastID,
            username,
            expires_at: accountExpiresAt
        };
    }

    /**
     * 更新用戶（含權限檢查）
     * @param {number} userId - 用戶 ID
     * @param {Object} updates - 更新資料
     * @param {Object} currentUser - 當前用戶
     * @returns {Promise<Object>}
     */
    async updateUser(userId, updates, currentUser) {
        const existingUser = await this.getById(userId);
        if (!existingUser) {
            return { success: false, error: 'NOT_FOUND', message: '用戶不存在' };
        }

        // 不能修改其他超級管理員
        if (existingUser.role === 'super_admin' && userId !== currentUser.id) {
            return { success: false, error: 'FORBIDDEN', message: '無法修改其他超級管理員帳號' };
        }

        const allowedFields = ['username', 'email', 'full_name', 'role', 'status'];
        const updateFields = [];
        const updateValues = [];

        // 特殊處理密碼
        if (updates.password) {
            const hashedPassword = await bcrypt.hash(updates.password, this.SALT_ROUNDS);
            updateFields.push('password_hash = ?');
            updateValues.push(hashedPassword);
        }

        // 處理其他字段
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                // 檢查用戶名和郵箱唯一性
                if (field === 'username' || field === 'email') {
                    const duplicate = await this.db.get(
                        `SELECT id FROM users WHERE ${field} = ? AND id != ?`,
                        [updates[field], userId]
                    );
                    if (duplicate) {
                        return {
                            success: false,
                            error: 'CONFLICT',
                            message: `${field === 'username' ? '用戶名' : '郵箱'}已存在`
                        };
                    }
                }

                updateFields.push(`${field} = ?`);
                updateValues.push(updates[field]);
            }
        }

        if (updateFields.length === 0) {
            return { success: false, error: 'NO_FIELDS', message: '沒有有效的更新字段' };
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(userId);

        const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        await this.db.run(query, updateValues);

        this.log('updateUser', { userId, fields: Object.keys(updates) });

        return { success: true, user: existingUser };
    }

    /**
     * 更新用戶狀態
     * @param {number} userId - 用戶 ID
     * @param {Object} data - 狀態資料
     * @param {Object} currentUser - 當前用戶
     * @returns {Promise<Object>}
     */
    async updateUserStatus(userId, data, currentUser) {
        const { status, reason, account_expires_months } = data;

        const targetUser = await this.getById(userId);
        if (!targetUser) {
            return { success: false, error: 'NOT_FOUND', message: '用戶不存在' };
        }

        // 權限檢查
        const { canManage, reason: permReason } = this.checkManagePermission(currentUser, targetUser);
        if (!canManage) {
            return { success: false, error: 'FORBIDDEN', message: permReason };
        }

        // 防止停用超級管理員
        if (targetUser.role === 'super_admin' && status !== 'active') {
            return { success: false, error: 'FORBIDDEN', message: '無法停用超級管理員帳號' };
        }

        const oldStatus = targetUser.status;
        let updateData = { status, updated_at: new Date().toISOString() };

        // 處理不同狀態的邏輯
        if (status === 'disabled') {
            updateData.disabled_at = new Date().toISOString();
            const canDeleteDate = new Date();
            canDeleteDate.setDate(canDeleteDate.getDate() + 7);
            updateData.can_delete_after = canDeleteDate.toISOString();
        } else if (status === 'active') {
            updateData.disabled_at = null;
            updateData.can_delete_after = null;

            if (account_expires_months && account_expires_months > 0) {
                const expiresDate = new Date();
                expiresDate.setMonth(expiresDate.getMonth() + parseInt(account_expires_months));
                updateData.account_expires_at = expiresDate.toISOString();
            }
        }

        const updateFields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
        const updateValues = Object.values(updateData);

        await this.db.run(`UPDATE users SET ${updateFields} WHERE id = ?`, [...updateValues, userId]);

        // 記錄狀態歷史
        await this.db.run(`
            INSERT INTO user_status_history (
                user_id, old_status, new_status, changed_by, change_reason, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            userId, oldStatus, status, currentUser.id,
            reason || `狀態變更為 ${status}`,
            updateData.account_expires_at || null
        ]);

        this.log('updateUserStatus', { userId, oldStatus, newStatus: status });

        return { success: true, user: targetUser, oldStatus, newStatus: status };
    }

    /**
     * 刪除用戶（含權限檢查和相關資料）
     * @param {number} userId - 用戶 ID
     * @param {Object} currentUser - 當前用戶
     * @returns {Promise<Object>}
     */
    async deleteUser(userId, currentUser) {
        const user = await this.getById(userId);
        if (!user) {
            return { success: false, error: 'NOT_FOUND', message: '用戶不存在' };
        }

        // 防止刪除超級管理員
        if (user.role === 'super_admin' && userId !== currentUser.id) {
            return { success: false, error: 'FORBIDDEN', message: '無法刪除其他超級管理員帳號' };
        }

        // 防止刪除自己
        if (userId === currentUser.id) {
            return { success: false, error: 'FORBIDDEN', message: '無法刪除自己的帳號' };
        }

        // 檢查用戶是否有創建的項目
        const hasProjects = await this.db.get(
            'SELECT COUNT(*) as count FROM event_projects WHERE created_by = ?',
            [userId]
        );

        if (hasProjects.count > 0) {
            return { success: false, error: 'CONFLICT', message: '該用戶有創建的項目，無法刪除' };
        }

        await this.db.beginTransaction();

        try {
            await this.db.run('DELETE FROM user_project_permissions WHERE user_id = ?', [userId]);
            await this.db.run('UPDATE event_projects SET assigned_to = NULL WHERE assigned_to = ?', [userId]);
            await this.db.run('DELETE FROM users WHERE id = ?', [userId]);

            await this.db.commit();

            this.log('deleteUser', { userId, username: user.username });

            return { success: true, user };
        } catch (error) {
            await this.db.rollback();
            throw error;
        }
    }

    /**
     * 軟刪除用戶（標記為待刪除）
     * @param {number} userId - 用戶 ID
     * @param {Object} currentUser - 當前用戶
     * @returns {Promise<Object>}
     */
    async softDeleteUser(userId, currentUser) {
        // 只有超級管理員可以軟刪除
        if (currentUser.role !== 'super_admin') {
            return { success: false, error: 'FORBIDDEN', message: '只有超級管理員可以刪除用戶' };
        }

        const targetUser = await this.getById(userId);
        if (!targetUser) {
            return { success: false, error: 'NOT_FOUND', message: '用戶不存在' };
        }

        // 檢查是否可以刪除
        if (targetUser.status !== 'disabled') {
            return { success: false, error: 'BAD_REQUEST', message: '用戶必須先停用才能刪除' };
        }

        if (!targetUser.can_delete_after || new Date() < new Date(targetUser.can_delete_after)) {
            return { success: false, error: 'BAD_REQUEST', message: '用戶停用未滿7天，無法刪除' };
        }

        await this.db.run(
            'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['pending_deletion', userId]
        );

        // 記錄狀態歷史
        await this.db.run(`
            INSERT INTO user_status_history (
                user_id, old_status, new_status, changed_by, change_reason
            ) VALUES (?, ?, ?, ?, ?)
        `, [userId, targetUser.status, 'pending_deletion', currentUser.id, '標記為待刪除']);

        this.log('softDeleteUser', { userId, username: targetUser.username });

        return { success: true, user: targetUser };
    }

    /**
     * 重置密碼（含權限檢查）
     * @param {number} userId - 用戶 ID
     * @param {string} newPassword - 新密碼
     * @param {Object} currentUser - 當前用戶
     * @returns {Promise<Object>}
     */
    async resetUserPassword(userId, newPassword, currentUser) {
        // 只有超級管理員可以重置密碼
        if (currentUser.role !== 'super_admin') {
            return { success: false, error: 'FORBIDDEN', message: '只有超級管理員可以重置密碼' };
        }

        const user = await this.getById(userId);
        if (!user) {
            return { success: false, error: 'NOT_FOUND', message: '用戶不存在' };
        }

        const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

        await this.db.run(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedPassword, userId]
        );

        this.log('resetUserPassword', { userId, username: user.username });

        return { success: true, user };
    }

    // ============================================================================
    // 統計與匯入
    // ============================================================================

    /**
     * 取得用戶統計（含權限過濾）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getUserStats({ userId, userRole }) {
        if (userRole === 'super_admin') {
            const totalUsers = await this.db.get('SELECT COUNT(*) as count FROM users');
            const activeUsers = await this.db.get("SELECT COUNT(*) as count FROM users WHERE status = 'active'");
            const disabledUsers = await this.db.get("SELECT COUNT(*) as count FROM users WHERE status = 'disabled'");
            const newUsersThisMonth = await this.db.get(`
                SELECT COUNT(*) as count FROM users
                WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
            `);

            return {
                totalUsers: totalUsers.count,
                activeUsers: activeUsers.count,
                disabledUsers: disabledUsers.count,
                newUsersThisMonth: newUsersThisMonth.count
            };
        }

        if (userRole === 'project_manager') {
            const managedUsers = await this.db.get(`
                SELECT COUNT(*) as count FROM users WHERE managed_by = ? OR created_by = ?
            `, [userId, userId]);
            const activeManaged = await this.db.get(`
                SELECT COUNT(*) as count FROM users
                WHERE (managed_by = ? OR created_by = ?) AND status = 'active'
            `, [userId, userId]);

            return {
                managedUsers: managedUsers.count,
                activeManaged: activeManaged.count,
                disabledManaged: managedUsers.count - activeManaged.count
            };
        }

        return {};
    }

    /**
     * 批量匯入用戶
     * @param {Array} users - 用戶資料陣列
     * @param {Object} currentUser - 當前用戶
     * @returns {Promise<Object>}
     */
    async importUsers(users, currentUser) {
        // 權限檢查
        if (currentUser.role === 'project_user') {
            return { success: false, error: 'FORBIDDEN', message: '無權限導入用戶' };
        }

        let successCount = 0;
        let failureCount = 0;
        const errors = [];

        for (let i = 0; i < users.length; i++) {
            try {
                const userData = users[i];
                const { username, email, password, full_name, role } = userData;

                if (!username || !email || !password || !full_name || !role) {
                    throw new Error('缺少必填字段');
                }

                const existingUser = await this.db.get(
                    'SELECT id FROM users WHERE username = ? OR email = ?',
                    [username, email]
                );

                if (existingUser) {
                    throw new Error('用戶名或郵箱已存在');
                }

                if (currentUser.role === 'project_manager' && role !== 'project_user') {
                    throw new Error('專案管理員只能創建一般用戶');
                }

                const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

                await this.db.run(`
                    INSERT INTO users (
                        username, email, password_hash, full_name, role, status,
                        created_by, managed_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    username, email, passwordHash, full_name, role, 'active',
                    currentUser.id,
                    currentUser.role === 'project_manager' ? currentUser.id : null
                ]);

                successCount++;
            } catch (error) {
                failureCount++;
                errors.push({
                    index: i + 1,
                    username: users[i]?.username || 'N/A',
                    error: error.message
                });
            }
        }

        this.log('importUsers', { total: users.length, success: successCount, failures: failureCount });

        return {
            success: true,
            successCount,
            failureCount,
            errors: errors.slice(0, 10)
        };
    }
}

module.exports = new UserService();
