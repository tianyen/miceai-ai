/**
 * User Service - 用戶管理業務邏輯
 *
 * @description 處理用戶 CRUD、搜索、權限
 * @refactor 2025-12-01: 從 admin/users.js 提取業務邏輯
 */
const BaseService = require('./base.service');
const bcrypt = require('bcrypt');

class UserService extends BaseService {
    constructor() {
        super('UserService');
        this.SALT_ROUNDS = 10;
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

    /**
     * 獲取用戶列表（含分頁）
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
        const statusMap = {
            'active': '啟用',
            'inactive': '停用',
            'pending': '待啟用'
        };
        return statusMap[status] || status;
    }
}

module.exports = new UserService();
