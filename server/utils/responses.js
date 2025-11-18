/**
 * 統一響應格式工具
 */
const logger = require('./logger');
const AppError = require('./app-error');

/**
 * 成功響應
 * @param {Object} res - Express response object
 * @param {*} data - 回應數據
 * @param {string} message - 成功訊息
 * @param {number} statusCode - HTTP 狀態碼（預設 200）
 */
const success = (res, data = null, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

/**
 * 錯誤響應
 * @param {Object} res - Express response object
 * @param {string|AppError} messageOrError - 錯誤訊息或 AppError 對象
 * @param {number} statusCode - HTTP 狀態碼
 * @param {*} details - 額外的錯誤詳情
 * @param {number} errorCode - 錯誤碼（可選）
 */
const error = (res, messageOrError = 'Error', statusCode = 500, details = null, errorCode = null) => {
    let message = messageOrError;
    let code = errorCode;
    let errorDetails = details;

    // 如果傳入的是 AppError 對象
    if (messageOrError instanceof AppError) {
        message = messageOrError.message;
        statusCode = messageOrError.statusCode;
        code = messageOrError.code;
        errorDetails = messageOrError.details;
    }

    // 自動記錄錯誤日誌
    if (statusCode >= 400 && statusCode < 500) {
        logger.log4xx(res.req, res, statusCode, message);
    } else if (statusCode >= 500) {
        const err = new Error(message);
        logger.log5xx(res.req, res, statusCode, err, message);
    }

    const response = {
        success: false,
        error: {
            message
        }
    };

    if (code) {
        response.error.code = code;
    }

    if (errorDetails) {
        response.error.details = errorDetails;
    }

    return res.status(statusCode).json(response);
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
 * 錯誤請求響應 (400)
 */
const badRequest = (res, message = 'Bad Request', details = null) => {
    logger.log4xx(res.req, res, 400, message);
    return res.status(400).json({
        success: false,
        message,
        ...(details && { details })
    });
};

/**
 * 伺服器錯誤響應 (500)
 */
const serverError = (res, message = 'Internal Server Error', errorDetails = null) => {
    const error = errorDetails instanceof Error ? errorDetails : new Error(message);
    logger.log5xx(res.req, res, 500, error, message);
    return res.status(500).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && errorDetails && {
            error: errorDetails.message || errorDetails
        })
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
    badRequest,
    serverError,
    paginated,
    html
};