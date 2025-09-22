/**
 * Session 配置
 */
const session = require('express-session');
const { SESSION_SECRET } = require('../middleware/auth');

const sessionConfig = session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // 開發環境設為 false，生產環境應該設為 true
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 小時
    }
});

module.exports = sessionConfig;