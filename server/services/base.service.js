/**
 * Base Service - 所有 Service 的基類
 * 提供共用功能：日誌、錯誤處理、資料庫存取
 *
 * @description 3-Tier Architecture 的 Business Logic Layer
 * Controller -> Service -> Repository (Database)
 */
const database = require('../config/database');
const AppError = require('../utils/app-error');
const ErrorCodes = require('../utils/error-codes');
const logger = require('../utils/logger');

class BaseService {
    constructor(serviceName) {
        this.serviceName = serviceName;
        this.db = database;
        this.AppError = AppError;
        this.ErrorCodes = ErrorCodes;
        this.logger = logger;
    }

    /**
     * 記錄操作日誌
     * @param {string} action - 操作類型
     * @param {Object} data - 日誌數據
     */
    log(action, data = {}) {
        this.logger.info(`[${this.serviceName}] ${action}`, data);
    }

    /**
     * 記錄錯誤日誌
     * @param {string} action - 操作類型
     * @param {Error} error - 錯誤對象
     * @param {Object} context - 上下文數據
     */
    logError(action, error, context = {}) {
        this.logger.error(`[${this.serviceName}] ${action} failed`, {
            error: error.message,
            stack: error.stack,
            ...context
        });
    }

    /**
     * 拋出應用錯誤
     * @param {Object} errorCode - 錯誤碼對象
     * @param {*} details - 額外詳情
     */
    throwError(errorCode, details = null) {
        throw new this.AppError(errorCode, details);
    }

    /**
     * 記錄系統日誌到資料庫
     * @param {number} userId - 用戶 ID
     * @param {string} action - 操作類型
     * @param {string} targetType - 目標類型
     * @param {number} targetId - 目標 ID
     * @param {Object} details - 詳細資訊
     * @param {string} ipAddress - IP 地址
     */
    async logToDatabase(userId, action, targetType, targetId, details = null, ipAddress = null) {
        try {
            await this.db.run(`
                INSERT INTO system_logs (user_id, action, target_type, target_id, details, ip_address)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                userId,
                action,
                targetType,
                targetId,
                details ? JSON.stringify(details) : null,
                ipAddress
            ]);
        } catch (error) {
            // 日誌失敗不應該阻止主流程
            this.logError('logToDatabase', error);
        }
    }

    /**
     * 包裝資料庫操作，統一錯誤處理
     * @param {Function} operation - 資料庫操作函數
     * @param {string} operationName - 操作名稱（用於日誌）
     */
    async withErrorHandling(operation, operationName) {
        try {
            return await operation();
        } catch (error) {
            this.logError(operationName, error);

            // 如果已經是 AppError，直接拋出
            if (error instanceof AppError) {
                throw error;
            }

            // 否則包裝成系統錯誤
            throw new AppError(ErrorCodes.DATABASE_ERROR, {
                operation: operationName,
                originalError: error.message
            });
        }
    }
}

module.exports = BaseService;
