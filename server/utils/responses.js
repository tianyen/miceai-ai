/**
 * 統一響應格式工具
 */
const logger = require('./logger');

/**
 * 成功響應
 */
const success = (res, data = null, message = 'Success') => {
    return res.json({
        success: true,
        message,
        data
    });
};

/**
 * 錯誤響應
 */
const error = (res, message = 'Error', statusCode = 500, details = null) => {
    // 自動記錄錯誤日誌
    if (statusCode >= 400 && statusCode < 500) {
        logger.log4xx(res.req, res, statusCode, message);
    } else if (statusCode >= 500) {
        const error = new Error(message);
        logger.log5xx(res.req, res, statusCode, error, message);
    }

    return res.status(statusCode).json({
        success: false,
        message,
        ...(details && { details })
    });
};

/**
 * 驗證錯誤響應
 */
const validationError = (res, errors) => {
    return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
    });
};

/**
 * 未找到資源響應
 */
const notFound = (res, resource = 'Resource') => {
    return res.status(404).json({
        success: false,
        message: `${resource} not found`
    });
};

/**
 * 未授權響應
 */
const unauthorized = (res, message = 'Unauthorized') => {
    logger.log4xx(res.req, res, 401, message);
    return res.status(401).json({
        success: false,
        message
    });
};

/**
 * 禁止訪問響應
 */
const forbidden = (res, message = 'Forbidden') => {
    logger.log4xx(res.req, res, 403, message);
    return res.status(403).json({
        success: false,
        message
    });
};

/**
 * 分頁響應
 */
const paginated = (res, data, pagination, message = 'Success') => {
    return res.json({
        success: true,
        message,
        data,
        pagination
    });
};

/**
 * HTML 響應 (用於 AJAX 請求返回 HTML)
 */
const html = (res, html) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
};

module.exports = {
    success,
    error,
    validationError,
    notFound,
    unauthorized,
    forbidden,
    paginated,
    html
};