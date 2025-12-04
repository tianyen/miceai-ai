/**
 * Swagger 自動登入路由
 *
 * 提供快速登入功能，方便在 Swagger UI 中測試需要認證的 API
 *
 * @refactor 2025-12-04: 使用 Repository 層
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const userRepository = require('../repositories/user.repository');
const logRepository = require('../repositories/log.repository');

/**
 * Swagger 快速登入頁面
 * GET /swagger-login
 */
router.get('/swagger-login', (req, res) => {
    // 如果已經登入，重定向到 Swagger UI
    if (req.session && req.session.userId) {
        return res.redirect('/api-docs');
    }

    res.send(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Swagger API 測試登入</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .login-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 40px;
            width: 100%;
            max-width: 400px;
        }
        
        .logo {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .logo h1 {
            color: #667eea;
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .logo p {
            color: #666;
            font-size: 14px;
        }
        
        .quick-login {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .quick-login h3 {
            color: #333;
            font-size: 16px;
            margin-bottom: 15px;
            text-align: center;
        }
        
        .quick-login-btn {
            width: 100%;
            padding: 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
            margin-bottom: 10px;
        }
        
        .quick-login-btn:hover {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        
        .quick-login-btn:active {
            transform: translateY(0);
        }
        
        .divider {
            text-align: center;
            margin: 20px 0;
            position: relative;
        }
        
        .divider::before {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            width: 100%;
            height: 1px;
            background: #ddd;
        }
        
        .divider span {
            background: white;
            padding: 0 15px;
            color: #999;
            font-size: 14px;
            position: relative;
            z-index: 1;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
            font-size: 14px;
        }
        
        .form-group input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.3s;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .login-btn {
            width: 100%;
            padding: 12px;
            background: #764ba2;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .login-btn:hover {
            background: #653a8a;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(118, 75, 162, 0.4);
        }
        
        .message {
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 14px;
            text-align: center;
        }
        
        .message.error {
            background: #fee;
            color: #c33;
            border: 1px solid #fcc;
        }
        
        .message.success {
            background: #efe;
            color: #3c3;
            border: 1px solid #cfc;
        }
        
        .info {
            background: #f0f7ff;
            border: 1px solid #b3d9ff;
            border-radius: 6px;
            padding: 15px;
            margin-top: 20px;
            font-size: 13px;
            color: #0066cc;
        }
        
        .info strong {
            display: block;
            margin-bottom: 8px;
        }
        
        .info code {
            background: #e6f2ff;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>🔐 Swagger API 測試</h1>
            <p>快速登入以測試需要認證的 API</p>
        </div>
        
        ${req.query.error ? '<div class="message error">登入失敗：帳號或密碼錯誤</div>' : ''}
        ${req.query.success ? '<div class="message success">登入成功！正在跳轉...</div>' : ''}
        
        <div class="quick-login">
            <h3>⚡ 快速登入</h3>
            <form action="/swagger-login/quick" method="POST">
                <button type="submit" class="quick-login-btn">
                    使用測試帳號登入 (admin / admin123)
                </button>
            </form>
        </div>
        
        <div class="divider">
            <span>或使用自訂帳號</span>
        </div>
        
        <form action="/swagger-login" method="POST">
            <div class="form-group">
                <label for="username">帳號</label>
                <input type="text" id="username" name="username" required autocomplete="username">
            </div>
            
            <div class="form-group">
                <label for="password">密碼</label>
                <input type="password" id="password" name="password" required autocomplete="current-password">
            </div>
            
            <button type="submit" class="login-btn">登入</button>
        </form>
        
        <div class="info">
            <strong>💡 提示：</strong>
            登入後將自動跳轉到 Swagger UI，您可以直接測試需要認證的 API 端點。
            <br><br>
            預設測試帳號：<code>admin</code> / <code>admin123</code>
        </div>
    </div>
    
    <script>
        // 如果登入成功，3秒後自動跳轉
        if (window.location.search.includes('success=1')) {
            setTimeout(() => {
                window.location.href = '/api-docs';
            }, 2000);
        }
    </script>
</body>
</html>
    `);
});

/**
 * 快速登入處理（使用預設帳號）
 * POST /swagger-login/quick
 */
router.post('/swagger-login/quick', async (req, res) => {
    try {
        const username = 'admin';
        const password = 'admin123';

        // 使用 Repository 查詢用戶
        const user = await userRepository.findActiveByUsername(username);

        if (!user) {
            return res.redirect('/swagger-login?error=1');
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.redirect('/swagger-login?error=1');
        }

        // 設置 session（匹配 authenticateSession 中間件的格式）
        req.session.userId = user.id;
        req.session.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            role: user.role
        };

        // 使用 Repository 記錄登入日誌
        await logRepository.createAdminLog({
            userId: user.id,
            action: 'swagger_quick_login',
            details: { username: user.username, method: 'quick_login' },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });

        res.redirect('/api-docs');

    } catch (error) {
        console.error('快速登入錯誤:', error);
        res.redirect('/swagger-login?error=1');
    }
});

/**
 * 自訂帳號登入處理
 * POST /swagger-login
 */
router.post('/swagger-login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.redirect('/swagger-login?error=1');
        }

        // 使用 Repository 查詢用戶
        const user = await userRepository.findActiveByUsername(username);

        if (!user) {
            return res.redirect('/swagger-login?error=1');
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.redirect('/swagger-login?error=1');
        }

        // 設置 session（匹配 authenticateSession 中間件的格式）
        req.session.userId = user.id;
        req.session.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            role: user.role
        };

        // 使用 Repository 記錄登入日誌
        await logRepository.createAdminLog({
            userId: user.id,
            action: 'swagger_login',
            details: { username: user.username, method: 'custom_login' },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });

        res.redirect('/api-docs');

    } catch (error) {
        console.error('登入錯誤:', error);
        res.redirect('/swagger-login?error=1');
    }
});

/**
 * 登出
 * GET /swagger-logout
 */
router.get('/swagger-logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('登出錯誤:', err);
        }
        res.redirect('/swagger-login');
    });
});

module.exports = router;

