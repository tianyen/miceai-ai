/**
 * User Service - 用戶管理業務邏輯
 *
 * @description 處理用戶 CRUD、搜索、權限
 * @refactor 2025-12-01: 從 admin/users.js 提取業務邏輯
 * @refactor 2025-12-05: 從 userController 抽取業務邏輯
 * @refactor 2026-01-08: 使用 Repository Pattern 重構
 */
const BaseService = require('./base.service');
const { userRepository } = require('../repositories');
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
        return userRepository.findById(userId);
    }

    /**
     * 搜索用戶
     * @param {Object} options - 搜索選項
     * @returns {Promise<Array>}
     */
    async search({ search, role, status, limit = 50 } = {}) {
        return userRepository.search(search, { limit });
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
        return userRepository.getListWithPermissionFilter({ userId, userRole, page, limit, search, role, status });
    }

    /**
     * 取得專案管理員管理的用戶
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getManagedUsers({ managerId, page = 1, limit = 20 }) {
        return userRepository.getManagedUsers(managerId, { page, limit });
    }

    /**
     * 搜尋用戶
     * @param {Object} params - 搜尋參數
     * @returns {Promise<Array>}
     */
    async searchUsers({ userId, userRole, search, role, status, limit = 50 }) {
        return userRepository.searchWithPermissionFilter({ userId, userRole, search, role, status, limit });
    }

    /**
     * 獲取用戶列表（含分頁）- 舊版兼容
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getList({ page = 1, limit = 20, search, role, status } = {}) {
        return userRepository.getListWithPagination({ page, limit, search, role, status });
    }

    /**
     * 獲取分頁資訊
     * @param {number} page - 頁碼
     * @param {number} limit - 每頁筆數
     * @returns {Promise<Object>}
     */
    async getPagination(page = 1, limit = 20) {
        const countResult = await userRepository.count();
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
        const existingUsername = await userRepository.existsByUsername(username);
        if (existingUsername) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '用戶名已存在'
            });
        }

        // 檢查 email 是否存在
        const existingEmail = await userRepository.existsByEmail(email);
        if (existingEmail) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '電子郵件已存在'
            });
        }

        // 密碼加密
        const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

        const result = await userRepository.rawRun(`
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
        const user = await userRepository.findById(userId);
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
            const existingEmail = await userRepository.existsByEmail(email, userId);
            if (existingEmail) {
                this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                    message: '電子郵件已被使用'
                });
            }
        }

        await userRepository.rawRun(`
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
        const user = await userRepository.findById(userId);
        if (!user) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '用戶不存在' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

        await userRepository.updatePassword(userId, hashedPassword);

        this.log('resetPassword', { userId });

        return { id: userId, passwordReset: true };
    }

    /**
     * 刪除用戶
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object>}
     */
    async delete(userId) {
        const user = await userRepository.findById(userId);
        if (!user) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '用戶不存在' });
        }

        await userRepository.delete(userId);

        this.log('delete', { userId });

        return { deleted: true };
    }

    /**
     * 獲取用戶統計
     * @returns {Promise<Object>}
     */
    async getStats() {
        const stats = await userRepository.getStats();
        return {
            total: stats?.total_users || 0,
            active: stats?.active_users || 0,
            inactive: 0,
            pending: 0
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
        const user = await userRepository.getUserDetail(userId);

        if (!user) return null;

        // 用戶創建的項目統計
        const projectStats = await userRepository.getProjectStats(userId);

        // 參與的項目統計
        const participatingProjects = await userRepository.countParticipatingProjects(userId);

        return {
            ...user,
            project_stats: projectStats,
            participating_projects: participatingProjects
        };
    }

    /**
     * 取得當前用戶資訊
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object|null>}
     */
    async getCurrentUserInfo(userId) {
        return userRepository.getCurrentUserInfo(userId);
    }

    /**
     * 取得用戶活動記錄
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getUserActivities({ userId, page = 1, limit = 20 }) {
        return userRepository.getUserActivities(userId, { page, limit });
    }

    /**
     * 取得用戶狀態歷史
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Array>}
     */
    async getUserStatusHistory(userId) {
        return userRepository.getUserStatusHistory(userId);
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
        const existingUser = await userRepository.findByUsernameOrEmail(username, email);
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
        const result = await userRepository.rawRun(`
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
        await userRepository.rawRun(`
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
        const existingUser = await userRepository.findById(userId);
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
                    const duplicate = await userRepository.checkUnique(field, updates[field], userId);
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
        await userRepository.rawRun(query, updateValues);

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

        const targetUser = await userRepository.findById(userId);
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

        await userRepository.updateDynamic(userId, updateData);

        // 記錄狀態歷史
        await userRepository.rawRun(`
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
        const user = await userRepository.findById(userId);
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
        const hasProjects = await userRepository.countProjectsByUser(userId);

        if (hasProjects > 0) {
            return { success: false, error: 'CONFLICT', message: '該用戶有創建的項目，無法刪除' };
        }

        await this.db.beginTransaction();

        try {
            await userRepository.deleteUserCascade(userId);

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

        const targetUser = await userRepository.findById(userId);
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

        await userRepository.softDelete(userId);

        // 記錄狀態歷史
        await userRepository.rawRun(`
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

        const user = await userRepository.findById(userId);
        if (!user) {
            return { success: false, error: 'NOT_FOUND', message: '用戶不存在' };
        }

        const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

        await userRepository.updatePassword(userId, hashedPassword);

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
        return userRepository.getDashboardStats(userRole, userId);
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

                const existingUser = await userRepository.findByUsernameOrEmail(username, email);

                if (existingUser) {
                    throw new Error('用戶名或郵箱已存在');
                }

                if (currentUser.role === 'project_manager' && role !== 'project_user') {
                    throw new Error('專案管理員只能創建一般用戶');
                }

                const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

                await userRepository.rawRun(`
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
