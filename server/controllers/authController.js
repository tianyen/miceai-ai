const bcrypt = require('bcrypt');
const database = require('../config/database');
const { generateToken, logUserActivity } = require('../middleware/auth');
const { validationResult } = require('express-validator');

class AuthController {
    // 用戶登入
    async login(req, res) {
        try {
            // 檢查驗證錯誤
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: '輸入數據格式錯誤',
                    errors: errors.array()
                });
            }

            const { username, password } = req.body;
            const ipAddress = req.ip || req.connection.remoteAddress;

            // 查找用戶
            const user = await database.get(
                'SELECT * FROM users WHERE username = ? AND status = ?',
                [username, 'active']
            );

            if (!user) {
                await logUserActivity(null, 'login_failed', 'user', null,
                    { reason: 'user_not_found', username }, ipAddress);
                return res.status(401).json({
                    success: false,
                    message: '用戶名或密碼錯誤'
                });
            }

            // 驗證密碼
            const isValidPassword = await bcrypt.compare(password, user.password_hash);

            if (!isValidPassword) {
                await logUserActivity(user.id, 'login_failed', 'user', user.id,
                    { reason: 'invalid_password' }, ipAddress);
                return res.status(401).json({
                    success: false,
                    message: '用戶名或密碼錯誤'
                });
            }

            // 更新最後登入時間
            await database.run(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [user.id]
            );

            // 生成 JWT Token
            const token = generateToken(user);

            // 記錄登入成功
            await logUserActivity(user.id, 'login_success', 'user', user.id,
                { login_method: 'username_password' }, ipAddress);

            // 移除敏感信息
            const { password_hash, ...userInfo } = user;

            res.json({
                success: true,
                message: '登入成功',
                token,
                user: userInfo
            });

        } catch (error) {
            console.error('登入錯誤:', error);
            res.status(500).json({
                success: false,
                message: '登入過程發生錯誤'
            });
        }
    }

    // 管理後台登入
    async adminLogin(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // 檢查是否為 AJAX 請求
                if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                    req.headers['content-type'] === 'application/json' ||
                    req.headers['accept']?.includes('application/json')) {
                    return res.status(400).json({
                        success: false,
                        message: '輸入數據格式錯誤',
                        errors: errors.array()
                    });
                }
                // 如果是表單提交，返回 HTML 頁面
                return res.status(400).send(`
                    <!DOCTYPE html>
                    <html><head><title>登入錯誤</title></head>
                    <body>
                        <div class="error">輸入數據格式錯誤</div>
                        <script>
                            setTimeout(() => window.history.back(), 2000);
                        </script>
                    </body></html>
                `);
            }

            const { username, password } = req.body;
            const ipAddress = req.ip || req.connection.remoteAddress;

            // 查找用戶
            const user = await database.get(
                'SELECT * FROM users WHERE username = ? AND status = ?',
                [username, 'active']
            );

            if (!user || !['super_admin', 'project_manager', 'vendor'].includes(user.role)) {
                await logUserActivity(null, 'admin_login_failed', 'user', null,
                    { reason: 'user_not_found_or_no_permission', username }, ipAddress);

                // 檢查是否為 AJAX 請求
                if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                    return res.status(401).json({
                        success: false,
                        message: '用戶名或密碼錯誤，或無管理權限'
                    });
                }

                // 檢查是否為 AJAX 請求
                if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                    req.headers['content-type'] === 'application/json' ||
                    req.headers['accept']?.includes('application/json')) {
                    return res.status(401).json({
                        success: false,
                        message: '用戶名或密碼錯誤，或無管理權限'
                    });
                }

                // 如果是表單提交，返回 HTML 頁面
                return res.status(401).send(`
                    <!DOCTYPE html>
                    <html><head><title>登入錯誤</title></head>
                    <body>
                        <div class="error">用戶名或密碼錯誤，或無管理權限</div>
                        <script>
                            setTimeout(() => window.history.back(), 2000);
                        </script>
                    </body></html>
                `);
            }

            // 驗證密碼
            const isValidPassword = await bcrypt.compare(password, user.password_hash);

            if (!isValidPassword) {
                await logUserActivity(user.id, 'admin_login_failed', 'user', user.id,
                    { reason: 'invalid_password' }, ipAddress);

                // 檢查是否為 AJAX 請求
                if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                    return res.status(401).json({
                        success: false,
                        message: '用戶名或密碼錯誤'
                    });
                }

                // 檢查是否為 AJAX 請求
                if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                    req.headers['content-type'] === 'application/json' ||
                    req.headers['accept']?.includes('application/json')) {
                    return res.status(401).json({
                        success: false,
                        message: '用戶名或密碼錯誤'
                    });
                }

                // 如果是表單提交，返回 HTML 頁面
                return res.status(401).send(`
                    <!DOCTYPE html>
                    <html><head><title>登入錯誤</title></head>
                    <body>
                        <div class="error">用戶名或密碼錯誤</div>
                        <script>
                            setTimeout(() => window.history.back(), 2000);
                        </script>
                    </body></html>
                `);
            }

            // 更新最後登入時間
            await database.run(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [user.id]
            );

            // 設置 Session
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role;

            // 設置完整的用戶資訊到 session
            const { password_hash, ...userInfo } = user;
            req.session.user = userInfo;



            // 記錄登入成功
            await logUserActivity(user.id, 'admin_login_success', 'user', user.id,
                { login_method: 'admin_panel' }, ipAddress);

            // 檢查是否為 AJAX 請求 (jQuery/統一AJAX處理)
            if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                req.headers['content-type'] === 'application/json' ||
                req.headers['accept']?.includes('application/json')) {
                return res.json({
                    success: true,
                    message: '登入成功',
                    redirect: '/admin/dashboard'
                });
            }

            // 普通表單提交，直接重定向
            res.redirect('/admin/dashboard');

        } catch (error) {
            console.error('管理後台登入錯誤:', error);

            // 檢查是否為 AJAX 請求
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(500).json({
                    success: false,
                    message: '登入過程發生錯誤'
                });
            }

            // 檢查是否為 AJAX 請求
            if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                req.headers['content-type'] === 'application/json' ||
                req.headers['accept']?.includes('application/json')) {
                return res.status(500).json({
                    success: false,
                    message: '登入過程發生錯誤'
                });
            }
            // 如果是表單提交，返回 HTML 頁面
            return res.status(500).send(`
                <!DOCTYPE html>
                <html><head><title>登入錯誤</title></head>
                <body>
                    <div class="error">登入過程發生錯誤</div>
                    <script>
                        setTimeout(() => window.history.back(), 2000);
                    </script>
                </body></html>
            `);
        }
    }

    // 用戶註冊
    async register(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: '輸入數據格式錯誤',
                    errors: errors.array()
                });
            }

            const { username, email, password, full_name } = req.body;
            const ipAddress = req.ip || req.connection.remoteAddress;

            // 檢查用戶名是否已存在
            const existingUser = await database.get(
                'SELECT id FROM users WHERE username = ? OR email = ?',
                [username, email]
            );

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: '用戶名或郵箱已存在'
                });
            }

            // 加密密碼
            const hashedPassword = await bcrypt.hash(password, 10);

            // 創建用戶
            const result = await database.run(`
                INSERT INTO users (username, email, password_hash, full_name, role, status)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [username, email, hashedPassword, full_name, 'project_user', 'active']);

            // 記錄註冊活動
            await logUserActivity(result.lastID, 'user_registered', 'user', result.lastID,
                { registration_method: 'api' }, ipAddress);

            res.status(201).json({
                success: true,
                message: '註冊成功',
                userId: result.lastID
            });

        } catch (error) {
            console.error('註冊錯誤:', error);
            res.status(500).json({
                success: false,
                message: '註冊過程發生錯誤'
            });
        }
    }

    // 登出
    async logout(req, res) {
        try {
            const ipAddress = req.ip || req.connection.remoteAddress;

            if (req.user) {
                await logUserActivity(req.user.id, 'logout', 'user', req.user.id,
                    { logout_method: 'api' }, ipAddress);
            }

            res.json({
                success: true,
                message: '登出成功'
            });

        } catch (error) {
            console.error('登出錯誤:', error);
            res.status(500).json({
                success: false,
                message: '登出過程發生錯誤'
            });
        }
    }

    // 管理後台登出
    async adminLogout(req, res) {
        try {
            const ipAddress = req.ip || req.connection.remoteAddress;

            if (req.session.userId) {
                await logUserActivity(req.session.userId, 'admin_logout', 'user', req.session.userId,
                    { logout_method: 'admin_panel' }, ipAddress);
            }

            req.session.destroy((err) => {
                if (err) {
                    console.error('Session 銷毀錯誤:', err);
                }
                res.redirect('/admin/login');
            });

        } catch (error) {
            console.error('管理後台登出錯誤:', error);
            res.redirect('/admin/login');
        }
    }

    // 獲取當前用戶信息
    async getCurrentUser(req, res) {
        try {
            const { password_hash, ...userInfo } = req.user;
            res.json({
                success: true,
                user: userInfo
            });
        } catch (error) {
            console.error('獲取用戶信息錯誤:', error);
            res.status(500).json({
                success: false,
                message: '獲取用戶信息失敗'
            });
        }
    }

    // 修改密碼
    async changePassword(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: '輸入數據格式錯誤',
                    errors: errors.array()
                });
            }

            const { currentPassword, newPassword } = req.body;
            const ipAddress = req.ip || req.connection.remoteAddress;

            // 驗證當前密碼
            const isValidPassword = await bcrypt.compare(currentPassword, req.user.password_hash);

            if (!isValidPassword) {
                await logUserActivity(req.user.id, 'password_change_failed', 'user', req.user.id,
                    { reason: 'invalid_current_password' }, ipAddress);
                return res.status(401).json({
                    success: false,
                    message: '當前密碼錯誤'
                });
            }

            // 加密新密碼
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);

            // 更新密碼
            await database.run(
                'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [hashedNewPassword, req.user.id]
            );

            // 記錄密碼修改
            await logUserActivity(req.user.id, 'password_changed', 'user', req.user.id,
                { change_method: 'api' }, ipAddress);

            res.json({
                success: true,
                message: '密碼修改成功'
            });

        } catch (error) {
            console.error('修改密碼錯誤:', error);
            res.status(500).json({
                success: false,
                message: '修改密碼過程發生錯誤'
            });
        }
    }
}

module.exports = new AuthController();