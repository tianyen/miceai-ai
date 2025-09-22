/**
 * 主配置文件
 */
const path = require('path');

module.exports = {
    // 服務器配置
    server: {
        port: process.env.PORT || 3000,
        httpsPort: process.env.HTTPS_PORT || 3443,
        env: process.env.NODE_ENV || 'development'
    },
    
    // 路徑配置
    paths: {
        views: path.join(__dirname, '../views'),
        layouts: path.join(__dirname, '../views/layouts'),
        partials: path.join(__dirname, '../views/partials'),
        public: path.join(__dirname, '../public'),
        frontend: path.join(__dirname, '../frontend')
    },
    
    // 文件上傳配置
    upload: {
        maxFileSize: '10mb',
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif']
    },
    
    // 分頁配置
    pagination: {
        defaultLimit: 20,
        maxLimit: 100
    }
};