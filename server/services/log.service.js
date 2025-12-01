/**
 * Log Service - 系統日誌相關業務邏輯
 *
 * 職責：
 * - 日誌查詢
 * - 日誌統計
 * - 日誌分頁
 *
 * @description 從 admin-extended.js 抽取的業務邏輯
 * @refactor 2025-12-01: 使用 Repository 層
 */
const BaseService = require('./base.service');
const logRepository = require('../repositories/log.repository');

class LogService extends BaseService {
    constructor() {
        super('LogService');
        this.repository = logRepository;
    }

    /**
     * 取得日誌統計
     * @returns {Promise<Object>} 統計數據
     */
    async getStats() {
        const stats = await this.repository.getStats();

        return {
            error_count: stats.errorCount,
            warning_count: stats.warningCount,
            total_count: stats.totalCount
        };
    }

    /**
     * 取得日誌列表
     * @param {Object} params - 查詢參數
     * @param {number} params.page - 頁碼
     * @param {number} params.limit - 每頁筆數
     * @returns {Promise<Array>} 日誌列表
     */
    async getLogs({ page = 1, limit = 20 } = {}) {
        return this.repository.getLogsWithUser({ page, limit });
    }

    /**
     * 取得日誌詳情
     * @param {number} logId - 日誌 ID
     * @returns {Promise<Object|null>} 日誌詳情
     */
    async getLogById(logId) {
        return this.repository.getLogByIdWithUser(logId);
    }

    /**
     * 刪除日誌
     * @param {number} logId - 日誌 ID
     * @returns {Promise<Object>} 刪除結果
     */
    async deleteLog(logId) {
        await this.repository.deleteLog(logId);

        this.log('deleteLog', { logId });

        return { success: true, message: '日誌已刪除' };
    }

    /**
     * 解析日誌等級
     * @param {string} action - 操作類型
     * @returns {string} 日誌等級 (error | warning | info)
     */
    parseLogLevel(action) {
        if (action.includes('error') || action.includes('failed')) {
            return 'error';
        }
        if (action.includes('warning')) {
            return 'warning';
        }
        return 'info';
    }

    /**
     * 格式化日誌列表（加入等級）
     * @param {Array} logs - 日誌列表
     * @returns {Array} 格式化後的日誌列表
     */
    formatLogs(logs) {
        return logs.map(log => ({
            ...log,
            level: this.parseLogLevel(log.action),
            displayName: log.full_name || log.username || '系統'
        }));
    }
}

// Singleton pattern
module.exports = new LogService();
