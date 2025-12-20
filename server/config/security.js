/**
 * 安全配置
 *
 * 使用 config/index.js 的環境變數配置
 * - CORS_ORIGIN: 允許的來源（逗號分隔）
 * - API_RATE_LIMIT_*: API 限流配置
 * - FRONTEND_API_RATE_LIMIT_*: 前端 API 限流配置
 */
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./index');

// Helmet 安全配置
const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://code.jquery.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            mediaSrc: ["'self'", "blob:", "data:"],
            connectSrc: ["'self'", "https:", "wss:", "ws:"],
            workerSrc: ["'self'", "blob:"]
        }
    }
});

// CORS 配置
// 所有允許的來源都從 CORS_ORIGIN 環境變數讀取（逗號分隔）
const allowedOrigins = config.security.corsOrigin
    ? config.security.corsOrigin.split(',').map(o => o.trim()).filter(o => o)
    : ['http://localhost:3000'];

const corsConfig = cors({
    origin: function (origin, callback) {
        // 允許沒有 origin 的請求（例如 Postman 或服務器到服務器）
        if (!origin) return callback(null, true);

        // 開發環境允許所有來源
        if (config.server.env !== 'production') {
            return callback(null, true);
        }

        // 生產環境檢查是否在允許列表中
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token']
});

// API 限流配置（使用環境變數）
const apiLimiter = rateLimit({
    windowMs: config.security.apiRateLimit.windowMs,
    max: config.security.apiRateLimit.maxRequests,
    message: {
        success: false,
        message: 'Too many requests, please try again later'
    },
    validate: { trustProxy: false }
});

// 前端 API 限流配置（使用環境變數，更寬鬆）
const frontendApiLimiter = rateLimit({
    windowMs: config.security.frontendApiRateLimit.windowMs,
    max: config.security.frontendApiRateLimit.maxRequests,
    message: {
        success: false,
        message: 'Too many requests, please try again later'
    },
    validate: { trustProxy: false }
});

// 登入限流配置
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分鐘
    max: 5, // 每個 IP 最多 5 次登入嘗試
    message: {
        success: false,
        message: 'Too many login attempts, please try again after 15 minutes'
    },
    validate: { trustProxy: false } // 禁用 trust proxy 验证
});

// 創建自定義限流器
const createLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            message: message || 'Too many requests'
        }
    });
};

module.exports = {
    helmet: helmetConfig,
    cors: corsConfig,
    apiLimiter,
    frontendApiLimiter,
    loginLimiter,
    createLimiter
};