/**
 * 主配置文件
 */
const path = require('path');

// 載入環境變數
require('dotenv').config();

module.exports = {
    // 服務器配置
    server: {
        port: process.env.PORT || 3000,
        httpsPort: process.env.HTTPS_PORT || 3443,
        env: process.env.NODE_ENV || 'development'
    },

    // 應用程式配置
    app: {
        name: process.env.APP_NAME || 'MICE-AI ',
        baseUrl: process.env.BASE_URL || 'http://localhost:3000',
        productionDomain: process.env.PRODUCTION_DOMAIN || 'https://your-production-domain.com'
    },

    // 路徑配置
    paths: {
        views: path.join(__dirname, '../views'),
        layouts: path.join(__dirname, '../views/layouts'),
        partials: path.join(__dirname, '../views/partials'),
        public: path.join(__dirname, '../public'),
        frontend: path.join(__dirname, '../frontend')
    },

    // 資料庫配置
    database: {
        path: process.env.DATABASE_PATH || './data/mice_ai.db'
    },

    // Session 配置
    session: {
        secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-this-in-production',
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000 // 24小時
    },

    // 安全配置
    security: {
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        apiRateLimit: {
            windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 900000, // 15分鐘
            maxRequests: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 100
        },
        frontendApiRateLimit: {
            windowMs: parseInt(process.env.FRONTEND_API_RATE_LIMIT_WINDOW_MS) || 900000, // 15分鐘
            maxRequests: parseInt(process.env.FRONTEND_API_RATE_LIMIT_MAX_REQUESTS) || 200
        }
    },

    // 文件上傳配置
    upload: {
        maxFileSize: process.env.MAX_FILE_SIZE || '10mb',
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif']
    },

    // 分頁配置
    pagination: {
        defaultLimit: 20,
        maxLimit: 100
    },

    // 日誌配置
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        enableConsole: process.env.ENABLE_CONSOLE_LOG === 'true',
        enableDevLogs: process.env.ENABLE_DEV_LOGS === 'true',
        enableApiDebug: process.env.ENABLE_API_DEBUG === 'true'
    },

    // Swagger 配置
    swagger: {
        title: process.env.SWAGGER_TITLE || 'MICE-AI  API',
        description: process.env.SWAGGER_DESCRIPTION || 'MICE-AI 的 RESTful API 文件，包含管理後台和前端 API',
        version: process.env.SWAGGER_VERSION || '1.0.0'
    },

    // Email 配置 (Google SMTP)
    email: {
        enabled: process.env.SMTP_ENABLED === 'true',
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        from: {
            name: process.env.SMTP_FROM_NAME || 'MICE-AI 活動系統',
            email: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER
        },
        // Email Banner 圖片設定
        banner: {
            // Top Banner: 600x200px - 活動主視覺
            topUrl: process.env.EMAIL_BANNER_TOP_URL || 'https://via.placeholder.com/600x200/667eea/ffffff?text=Top+Banner+(600x200)',
            topAlt: process.env.EMAIL_BANNER_TOP_ALT || '活動主視覺',
            // Footer Banner: 600x150px - 主辦單位/贊助商
            footerUrl: process.env.EMAIL_BANNER_FOOTER_URL || 'https://via.placeholder.com/600x150/764ba2/ffffff?text=Footer+Banner+(600x150)',
            footerAlt: process.env.EMAIL_BANNER_FOOTER_ALT || '主辦單位資訊'
        }
    }
};