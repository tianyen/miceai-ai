/**
 * Profile Service - 用戶個人資料相關業務邏輯
 *
 * 職責：
 * - 更新基本資料
 * - 修改密碼
 * - 偏好設定
 * - 登入歷史
 *
 * @description 從 admin-extended.js 抽取的業務邏輯
 * @refactor 2025-12-01: 使用 Repository 層
 */
const BaseService = require('./base.service');
const userRepository = require('../repositories/user.repository');
const bcrypt = require('bcrypt');

class ProfileService extends BaseService {
    constructor() {
        super('ProfileService');
        this.repository = userRepository;
    }

    /**
     * 更新基本資料
     * @param {number} userId - 用戶 ID
     * @param {Object} data - 更新數據
     * @param {string} data.full_name - 姓名
     * @param {string} data.email - 電子郵件
     * @param {string} data.phone - 電話
     * @returns {Promise<Object>} 更新結果
     */
    async updateBasicInfo(userId, { full_name, email, phone }) {
        // 驗證必要欄位
        if (!full_name || !email) {
            this.throwError(this.ErrorCodes.MISSING_REQUIRED_FIELD, '姓名和電子郵件為必填欄位');
        }

        // 驗證電子郵件格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.throwError(this.ErrorCodes.INVALID_EMAIL);
        }

        await this.repository.updateBasicInfo(userId, { full_name, email, phone: phone || null });

        this.log('updateBasicInfo', { userId });

        return { success: true, message: '基本資訊更新成功' };
    }

    /**
     * 修改密碼
     * @param {number} userId - 用戶 ID
     * @param {string} currentPassword - 當前密碼
     * @param {string} newPassword - 新密碼
     * @returns {Promise<Object>} 更新結果
     */
    async updatePassword(userId, currentPassword, newPassword) {
        // 驗證必要欄位
        if (!currentPassword || !newPassword) {
            this.throwError(this.ErrorCodes.MISSING_REQUIRED_FIELD, '請填寫當前密碼和新密碼');
        }

        // 驗證新密碼長度
        if (newPassword.length < 8) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, '新密碼至少需要8個字符');
        }

        // 驗證當前密碼
        const passwordHash = await this.repository.getPasswordHash(userId);
        if (!passwordHash) {
            this.throwError(this.ErrorCodes.USER_NOT_FOUND);
        }

        const isValid = await bcrypt.compare(currentPassword, passwordHash);
        if (!isValid) {
            this.throwError(this.ErrorCodes.INVALID_CREDENTIALS, '當前密碼不正確');
        }

        // 更新密碼
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.repository.updatePassword(userId, hashedPassword);

        this.log('updatePassword', { userId });

        return { success: true, message: '密碼更新成功' };
    }

    /**
     * 重設用戶密碼（管理員操作）
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object>} 新密碼
     */
    async resetPassword(userId) {
        // 生成新密碼
        const newPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await this.repository.updatePassword(userId, hashedPassword);

        this.log('resetPassword', { userId });

        return {
            success: true,
            message: '密碼重設成功',
            newPassword
        };
    }

    /**
     * 取得用戶偏好設定
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object>} 偏好設定
     */
    async getPreferences(userId) {
        const defaultPreferences = {
            language: 'zh-TW',
            timezone: 'Asia/Taipei',
            email_notifications: false,
            browser_notifications: false
        };

        try {
            const userPrefs = await this.repository.getPreferences(userId);
            if (userPrefs) {
                return { ...defaultPreferences, ...userPrefs };
            }
        } catch (error) {
            this.logError('getPreferences', error);
        }

        return defaultPreferences;
    }

    /**
     * 更新用戶偏好設定
     * @param {number} userId - 用戶 ID
     * @param {Object} preferences - 偏好設定
     * @returns {Promise<Object>} 更新結果
     */
    async updatePreferences(userId, { language, timezone, email_notifications, browser_notifications }) {
        const preferences = {
            language: language || 'zh-TW',
            timezone: timezone || 'Asia/Taipei',
            email_notifications: Boolean(email_notifications),
            browser_notifications: Boolean(browser_notifications)
        };

        await this.repository.updatePreferences(userId, preferences);

        this.log('updatePreferences', { userId });

        return { success: true, message: '偏好設定更新成功' };
    }

    /**
     * 取得登入歷史
     * @param {number} userId - 用戶 ID
     * @param {number} limit - 限制筆數
     * @returns {Promise<Array>} 登入記錄
     */
    async getLoginHistory(userId, limit = 10) {
        return this.repository.getLoginHistory(userId, limit);
    }
}

// Singleton pattern
module.exports = new ProfileService();
