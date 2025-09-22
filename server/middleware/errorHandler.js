/**
 * 錯誤處理中間件
 */
const logger = require('../utils/logger');

// 全局錯誤處理中間件
const errorHandler = (err, req, res, next) => {
    // 使用新的日誌系統記錄錯誤
    logger.log5xx(req, res, 500, err, '全局錯誤處理器捕獲的錯誤');

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
                message: err.message,
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
        // AJAX 請求返回 JSON
        res.status(500).json({
            success: false,
            message: process.env.NODE_ENV === 'production' 
                ? 'Internal server error' 
                : err.message
        });
    } else {
        // 普通請求返回錯誤頁面
        res.status(500).send(`
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
                    <h1>服務器錯誤 (500)</h1>
                    <p>${process.env.NODE_ENV === 'production'
                        ? '內部服務器錯誤，請稍後再試。'
                        : err.message}</p>
                </div>
            </body>
            </html>
        `);
    }
};

// 404 處理中間件
const notFoundHandler = (req, res) => {
    // 使用新的日誌系統記錄 404 錯誤
    logger.log4xx(req, res, 404, `資源不存在: ${req.originalUrl}`);

    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' ||
        req.headers.accept?.indexOf('json') > -1 || req.originalUrl.startsWith('/api/')) {
        // AJAX 請求返回 JSON
        res.status(404).json({
            success: false,
            message: 'Resource not found'
        });
    } else {
        // 普通請求返回 404 頁面
        res.status(404).send(`
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

module.exports = {
    errorHandler,
    notFoundHandler
};