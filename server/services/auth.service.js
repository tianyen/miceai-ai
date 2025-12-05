/**
 * Auth Service - 認證業務邏輯
 *
 * @description 處理用戶認證：登入驗證、密碼比對、最後登入時間更新
 * @refactor 2025-12-05: 從 authController 提取業務邏輯
 */
const BaseService = require('./base.service');
const bcrypt = require('bcrypt');
const userRepository = require('../repositories/user.repository');

class AuthService extends BaseService {
    constructor() {
        super('AuthService');
        this.SALT_ROUNDS = 10;
        this.ADMIN_ROLES = ['super_admin', 'project_manager', 'vendor'];
    }

    /**
     * 根據用戶名查找活躍用戶
     * @param {string} username - 用戶名
     * @returns {Promise<Object|null>}
     */
    async findActiveUserByUsername(username) {
        return userRepository.findOne({
            username,
            status: 'active'
        });
    }

    /**
     * 驗證密碼
     * @param {string} plainPassword - 明文密碼
     * @param {string} hashedPassword - 加密密碼
     * @returns {Promise<boolean>}
     */
    async verifyPassword(plainPassword, hashedPassword) {
        return bcrypt.compare(plainPassword, hashedPassword);
    }

    /**
     * 加密密碼
     * @param {string} password - 明文密碼
     * @returns {Promise<string>}
     */
    async hashPassword(password) {
        return bcrypt.hash(password, this.SALT_ROUNDS);
    }

    /**
     * 更新最後登入時間
     * @param {number} userId - 用戶 ID
     * @returns {Promise<void>}
     */
    async updateLastLogin(userId) {
        await userRepository.update(userId, {
            last_login: new Date().toISOString()
        });
    }

    /**
     * 驗證用戶登入
     * @param {string} username - 用戶名
     * @param {string} password - 密碼
     * @returns {Promise<Object>} - { success, user, error }
     */
    async validateLogin(username, password) {
        const user = await this.findActiveUserByUsername(username);

        if (!user) {
            return {
                success: false,
                error: 'USER_NOT_FOUND',
                message: '用戶名或密碼錯誤'
            };
        }

        const isValidPassword = await this.verifyPassword(password, user.password_hash);

        if (!isValidPassword) {
            return {
                success: false,
                error: 'INVALID_PASSWORD',
                message: '用戶名或密碼錯誤',
                userId: user.id
            };
        }

        // 更新最後登入時間
        await this.updateLastLogin(user.id);

        // 移除敏感資訊
        const { password_hash, ...userInfo } = user;

        return {
            success: true,
            user: userInfo
        };
    }

    /**
     * 驗證管理後台登入
     * @param {string} username - 用戶名
     * @param {string} password - 密碼
     * @returns {Promise<Object>} - { success, user, error }
     */
    async validateAdminLogin(username, password) {
        const user = await this.findActiveUserByUsername(username);

        if (!user || !this.ADMIN_ROLES.includes(user.role)) {
            return {
                success: false,
                error: 'USER_NOT_FOUND_OR_NO_PERMISSION',
                message: '用戶名或密碼錯誤，或無管理權限'
            };
        }

        const isValidPassword = await this.verifyPassword(password, user.password_hash);

        if (!isValidPassword) {
            return {
                success: false,
                error: 'INVALID_PASSWORD',
                message: '用戶名或密碼錯誤',
                userId: user.id
            };
        }

        // 更新最後登入時間
        await this.updateLastLogin(user.id);

        // 移除敏感資訊
        const { password_hash, ...userInfo } = user;

        return {
            success: true,
            user: userInfo
        };
    }

    /**
     * 註冊新用戶
     * @param {Object} data - { username, email, password, full_name }
     * @returns {Promise<Object>} - { success, userId, error }
     */
    async registerUser(data) {
        const { username, email, password, full_name } = data;

        // 檢查用戶名或郵箱是否已存在
        const existingUser = await this.db.get(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser) {
            return {
                success: false,
                error: 'DUPLICATE_USER',
                message: '用戶名或郵箱已存在'
            };
        }

        // 加密密碼
        const hashedPassword = await this.hashPassword(password);

        // 創建用戶
        const result = await this.db.run(`
            INSERT INTO users (username, email, password_hash, full_name, role, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [username, email, hashedPassword, full_name, 'project_user', 'active']);

        this.log('registerUser', { userId: result.lastID, username });

        return {
            success: true,
            userId: result.lastID
        };
    }

    /**
     * 修改密碼
     * @param {number} userId - 用戶 ID
     * @param {string} currentPassword - 當前密碼
     * @param {string} newPassword - 新密碼
     * @param {string} currentPasswordHash - 當前密碼雜湊 (from req.user)
     * @returns {Promise<Object>}
     */
    async changePassword(userId, currentPassword, newPassword, currentPasswordHash) {
        // 驗證當前密碼
        const isValidPassword = await this.verifyPassword(currentPassword, currentPasswordHash);

        if (!isValidPassword) {
            return {
                success: false,
                error: 'INVALID_CURRENT_PASSWORD',
                message: '當前密碼錯誤'
            };
        }

        // 加密新密碼
        const hashedNewPassword = await this.hashPassword(newPassword);

        // 更新密碼
        await this.db.run(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedNewPassword, userId]
        );

        this.log('changePassword', { userId });

        return {
            success: true,
            message: '密碼修改成功'
        };
    }
}

module.exports = new AuthService();
