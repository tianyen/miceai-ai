/**
 * 全局錯誤處理中間件
 */
const AppError = require('../utils/app-error');
const ErrorCodes = require('../utils/error-codes');
const responses = require('../utils/responses');
const logger = require('../utils/logger');

/**
 * 全局錯誤處理中間件
 * 捕獲所有未處理的錯誤並返回統一格式的錯誤響應
 */
const errorHandler = (err, req, res, next) => {
    // 如果是 AppError，直接使用其錯誤碼和訊息
    if (err instanceof AppError) {
        return responses.error(res, err);
    }

    // SQLite 錯誤處理
    if (err.code && err.code.startsWith('SQLITE_')) {
        logger.log5xx(req, res, 500, err, 'Database error');
        
        // 根據 SQLite 錯誤類型返回不同的錯誤訊息
        if (err.code === 'SQLITE_CONSTRAINT') {
            // 唯一性約束違反
            if (err.message.includes('UNIQUE')) {
                return responses.error(
                    res,
                    new AppError(ErrorCodes.DUPLICATE_ENTRY, err.message)
                );
            }
        }
        
        return responses.error(
            res,
            new AppError(ErrorCodes.DATABASE_ERROR, err.message)
        );
    }

    // 驗證錯誤（express-validator）
    if (err.array && typeof err.array === 'function') {
        const errors = err.array();
        return responses.validationError(res, errors);
    }

    // 其他未知錯誤
    logger.log5xx(req, res, 500, err, 'Unhandled error');
    
    // 開發環境返回詳細錯誤，生產環境返回通用錯誤
    if (process.env.NODE_ENV === 'development') {
        return responses.error(
            res,
            err.message || '伺服器內部錯誤',
            500,
            {
                stack: err.stack,
                name: err.name
            },
            ErrorCodes.INTERNAL_SERVER_ERROR.code
        );
    }
    
    return responses.error(
        res,
        new AppError(ErrorCodes.INTERNAL_SERVER_ERROR)
    );
};

/**
 * 404 錯誤處理中間件
 * 當沒有路由匹配時調用
 */
const notFoundHandler = (req, res, next) => {
    return responses.error(
        res,
        new AppError(ErrorCodes.NOT_FOUND, `路由 ${req.method} ${req.path} 不存在`)
    );
};

/**
 * 異步路由錯誤包裝器
 * 自動捕獲異步路由中的錯誤並傳遞給錯誤處理中間件
 * 
 * 使用方式：
 * router.get('/path', asyncHandler(async (req, res) => {
 *     // 異步操作
 * }));
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler
};

