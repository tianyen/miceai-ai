/**
 * 請求日誌記錄中間件
 * 自動記錄 4xx 和 5xx 錯誤
 */
const logger = require('../utils/logger');

/**
 * 請求日誌中間件
 */
const requestLogger = (req, res, next) => {
    // 記錄請求開始時間
    const startTime = Date.now();
    let logged = false;

    // 保存原始的 res.end 方法
    const originalEnd = res.end;
    const originalSend = res.send;
    const originalJson = res.json;

    // 攔截響應
    res.end = function(chunk, encoding) {
        res.end = originalEnd;
        logResponse();
        res.end(chunk, encoding);
    };

    res.send = function(body) {
        res.send = originalSend;
        logResponse();
        res.send(body);
    };

    res.json = function(obj) {
        res.json = originalJson;
        logResponse();
        res.json(obj);
    };

    function logResponse() {
        if (logged) return; // 防止重複記錄
        logged = true;

        const responseTime = Date.now() - startTime;

        // 只在響應頭未發送時設置
        if (!res.headersSent) {
            res.set('X-Response-Time', `${responseTime}ms`);
        }

        const statusCode = res.statusCode;
        
        // 記錄 4xx 錯誤
        if (statusCode >= 400 && statusCode < 500) {
            let message = '';
            
            switch (statusCode) {
                case 400:
                    message = 'Bad Request - 請求格式錯誤';
                    break;
                case 401:
                    message = 'Unauthorized - 未授權訪問';
                    break;
                case 403:
                    message = 'Forbidden - 禁止訪問';
                    break;
                case 404:
                    message = 'Not Found - 資源不存在';
                    break;
                case 405:
                    message = 'Method Not Allowed - 方法不允許';
                    break;
                case 409:
                    message = 'Conflict - 資源衝突';
                    break;
                case 422:
                    message = 'Unprocessable Entity - 無法處理的實體';
                    break;
                case 429:
                    message = 'Too Many Requests - 請求過於頻繁';
                    break;
                default:
                    message = `Client Error ${statusCode}`;
            }
            
            logger.log4xx(req, res, statusCode, message);
        }
        
        // 記錄 5xx 錯誤
        else if (statusCode >= 500) {
            let message = '';
            let error = req.error || new Error(`Server Error ${statusCode}`);
            
            switch (statusCode) {
                case 500:
                    message = 'Internal Server Error - 內部服務器錯誤';
                    break;
                case 501:
                    message = 'Not Implemented - 功能未實現';
                    break;
                case 502:
                    message = 'Bad Gateway - 網關錯誤';
                    break;
                case 503:
                    message = 'Service Unavailable - 服務不可用';
                    break;
                case 504:
                    message = 'Gateway Timeout - 網關超時';
                    break;
                default:
                    message = `Server Error ${statusCode}`;
            }
            
            logger.log5xx(req, res, statusCode, error, message);
        }
        
        // 記錄訪問日誌 (所有請求)
        logger.access(req, res);
    }
    
    next();
};

/**
 * 錯誤捕獲中間件 (用於捕獲未處理的錯誤)
 */
const errorCatcher = (err, req, res, next) => {
    // 將錯誤附加到請求對象上，供日誌記錄使用
    req.error = err;
    
    // 記錄詳細的錯誤信息
    logger.log5xx(req, res, 500, err, '未捕獲的服務器錯誤');
    
    // 繼續到下一個錯誤處理中間件
    next(err);
};

/**
 * 開發環境下的詳細日誌中間件
 */
const devLogger = (req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        const timestamp = new Date().toISOString();
        console.log(`📝 [${timestamp}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
        
        // 記錄請求體 (POST/PUT/PATCH)
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
            console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
        }
        
        // 記錄查詢參數
        if (Object.keys(req.query).length > 0) {
            console.log('🔍 Query Params:', req.query);
        }
    }
    
    next();
};

/**
 * API 路由專用日誌中間件
 */
const apiLogger = (req, res, next) => {
    // 為 API 路由添加額外的日誌信息
    req.isApiRequest = true;
    
    // 記錄 API 調用
    logger.debug('API Request', {
        method: req.method,
        url: req.originalUrl,
        ip: logger.getClientIP(req),
        userAgent: req.get('User-Agent'),
        user: req.user ? {
            id: req.user.id,
            username: req.user.username
        } : null
    });
    
    next();
};

/**
 * 管理後台專用日誌中間件
 */
const adminLogger = (req, res, next) => {
    // 為管理後台添加額外的日誌信息
    req.isAdminRequest = true;
    
    // 記錄管理後台操作
    if (req.user) {
        logger.debug('Admin Operation', {
            action: req.method,
            url: req.originalUrl,
            admin: {
                id: req.user.id,
                username: req.user.username,
                role: req.user.role
            },
            ip: logger.getClientIP(req)
        });
    }
    
    next();
};

module.exports = {
    requestLogger,
    errorCatcher,
    devLogger,
    apiLogger,
    adminLogger
};
