/**
 * 安全配置
 */
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

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
const corsConfig = cors({
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true
});

// API 限流配置
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分鐘
    max: 500, // 每個 IP 最多 500 次請求（增加限制）
    message: {
        success: false,
        message: 'Too many requests, please try again later'
    }
});

// 前端 API 限流配置（更寬鬆）
const frontendApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分鐘
    max: 1000, // 每個 IP 最多 1000 次請求
    message: {
        success: false,
        message: 'Too many requests, please try again later'
    }
});

// 登入限流配置
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分鐘
    max: 5, // 每個 IP 最多 5 次登入嘗試
    message: {
        success: false,
        message: 'Too many login attempts, please try again after 15 minutes'
    }
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