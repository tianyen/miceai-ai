/**
 * 邀請函管理系統 - 主服務器文件
 * 重構版本，採用模組化架構
 */
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 導入配置
const config = require('./config');
const handlebarsConfig = require('./config/handlebars');
const securityConfig = require('./config/security');
const sessionConfig = require('./config/session');
const { setupSwaggerUI } = require('./config/swagger');

// 導入中間件
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestLogger, errorCatcher, devLogger, apiLogger, adminLogger } = require('./middleware/requestLogger');

// 導入路由
const mainRoutes = require('./routes');

const app = express();

// ===== 基礎配置 =====
app.set('view engine', 'handlebars');
app.set('views', config.paths.views);
app.engine('handlebars', handlebarsConfig.create());

// ===== 安全中間件 =====
app.use(securityConfig.helmet);
app.use(securityConfig.cors);

// API 限流
app.use('/api/frontend/', securityConfig.frontendApiLimiter); // 前端 API 使用更寬鬆的限制
app.use('/api/admin/', securityConfig.apiLimiter); // 管理 API 使用標準限制

// ===== 日誌中間件 =====
app.use(requestLogger);
app.use(devLogger);

// ===== 基本中間件 =====
app.use(express.json({ limit: config.upload.maxFileSize }));
app.use(express.urlencoded({ extended: true, limit: config.upload.maxFileSize }));

// Session 配置
app.use(sessionConfig);

// ===== 靜態文件服務 =====
app.use(express.static(config.paths.public));
app.use(express.static(path.join(config.paths.frontend, 'public')));

// ===== Swagger API 文件 =====
if (config.server.env !== 'production') {
  setupSwaggerUI(app);
}

// ===== 路由註冊 =====
app.use('/', mainRoutes);

// ===== 錯誤處理 =====
app.use(notFoundHandler);
app.use(errorCatcher);
app.use(errorHandler);

// ===== 服務器啟動 =====
function startServer() {
    // HTTP 服務器
    app.listen(config.server.port, () => {
        console.log(`🚀 邀請函管理系統已啟動`);
        console.log(`📍 HTTP: http://localhost:${config.server.port}`);
        console.log(`🌍 環境: ${config.server.env}`);
        console.log(`⏰ 時間: ${new Date().toLocaleString('zh-TW')}`);
    });

    // HTTPS 服務器 (如果有證書)
    const certPath = path.join(__dirname, 'certs/cert.pem');
    const keyPath = path.join(__dirname, 'certs/key.pem');
    
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        const httpsOptions = {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath)
        };
        
        https.createServer(httpsOptions, app).listen(config.server.httpsPort, () => {
            console.log(`🔐 HTTPS: https://localhost:${config.server.httpsPort}`);
        });
    }
}

// 優雅關閉處理
process.on('SIGINT', () => {
    console.log('\n📝 正在關閉服務器...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n📝 正在關閉服務器...');
    process.exit(0);
});

// 未捕獲異常處理
process.on('uncaughtException', (err) => {
    console.error('未捕獲的異常:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未處理的 Promise 拒絕:', reason);
    // 不退出進程，只記錄錯誤
});

// 啟動服務器
startServer();

module.exports = app;