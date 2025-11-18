/**
 * 錯誤處理中間件
 */
const logger = require('../utils/logger');
const AppError = require('../utils/app-error');
const ErrorCodes = require('../utils/error-codes');

// 全局錯誤處理中間件
const errorHandler = (err, req, res, next) => {
    let statusCode = 500;
    let errorCode = ErrorCodes.INTERNAL_SERVER_ERROR.code;
    let message = '伺服器內部錯誤';
    let details = null;

    // 如果是 AppError，使用其錯誤碼和訊息
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        errorCode = err.code;
        message = err.message;
        details = err.details;
    }
    // SQLite 錯誤處理
    else if (err.code && err.code.startsWith('SQLITE_')) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            if (err.message.includes('UNIQUE')) {
                statusCode = ErrorCodes.DUPLICATE_ENTRY.statusCode;
                errorCode = ErrorCodes.DUPLICATE_ENTRY.code;
                message = ErrorCodes.DUPLICATE_ENTRY.message;
                details = err.message;
            }
        } else {
            statusCode = ErrorCodes.DATABASE_ERROR.statusCode;
            errorCode = ErrorCodes.DATABASE_ERROR.code;
            message = ErrorCodes.DATABASE_ERROR.message;
            details = process.env.NODE_ENV === 'development' ? err.message : null;
        }
    }
    // 其他錯誤
    else if (err.message) {
        message = process.env.NODE_ENV === 'production' ? '伺服器內部錯誤' : err.message;
        details = process.env.NODE_ENV === 'development' ? { stack: err.stack } : null;
    }

    // 使用日誌系統記錄錯誤
    if (statusCode >= 500) {
        logger.log5xx(req, res, statusCode, err, message);
    } else {
        logger.log4xx(req, res, statusCode, message);
    }

    // 記錄錯誤到數據庫 (保留原有功能)
    if (req.user) {
        const database = require('../config/database');
        database.run(`
            INSERT INTO system_logs (user_id, action, details, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
        `, [
            req.user.id,
            'system_error',
            JSON.stringify({
                code: errorCode,
                message: message,
                stack: err.stack,
                url: req.originalUrl,
                method: req.method,
                timestamp: new Date().toISOString()
            }),
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
        ]).catch(console.error);
    }

    // 根據請求類型返回不同格式的錯誤
    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' ||
        req.headers.accept?.indexOf('json') > -1 || req.originalUrl.startsWith('/api/')) {
        // AJAX 請求返回 JSON（統一格式）
        const response = {
            success: false,
            error: {
                code: errorCode,
                message: message
            }
        };

        if (details) {
            response.error.details = details;
        }

        res.status(statusCode).json(response);
    } else {
        // 普通請求返回錯誤頁面
        res.status(statusCode).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>服務器錯誤</title>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; margin: 50px; }
                    .error { background: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="error">
                    <h1>服務器錯誤 (${statusCode})</h1>
                    <p>${message}</p>
                    ${details && process.env.NODE_ENV === 'development' ? `<pre>${JSON.stringify(details, null, 2)}</pre>` : ''}
                </div>
            </body>
            </html>
        `);
    }
};

// 404 處理中間件
const notFoundHandler = (req, res) => {
    const statusCode = ErrorCodes.NOT_FOUND.statusCode;
    const errorCode = ErrorCodes.NOT_FOUND.code;
    const message = `路由 ${req.method} ${req.originalUrl} 不存在`;

    // 使用新的日誌系統記錄 404 錯誤
    logger.log4xx(req, res, statusCode, message);

    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' ||
        req.headers.accept?.indexOf('json') > -1 || req.originalUrl.startsWith('/api/')) {
        // AJAX 請求返回 JSON（統一格式）
        res.status(statusCode).json({
            success: false,
            error: {
                code: errorCode,
                message: message
            }
        });
    } else {
        // 普通請求返回 404 頁面
        res.status(statusCode).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>頁面不存在</title>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; margin: 50px; }
                    .error { background: #fff3cd; color: #856404; padding: 20px; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="error">
                    <h1>頁面不存在 (404)</h1>
                    <p>您訪問的頁面 <code>${req.originalUrl}</code> 不存在。</p>
                    <p><a href="/">返回首頁</a></p>
                </div>
            </body>
            </html>
        `);
    }
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