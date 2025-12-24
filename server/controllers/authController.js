/**
 * Auth Controller - 認證控制器
 *
 * @description 處理 HTTP 請求，調用 AuthService 處理業務邏輯
 * @refactor 2025-12-05: 使用 AuthService，移除直接 DB 訪問
 */
const { authService } = require('../services');
const { generateToken, logUserActivity } = require('../middleware/auth');
const { validationResult } = require('express-validator');
const autoBind = require('../utils/autoBind');
const { isCheckinOperator, getAllowedProjects } = require('../middleware/checkinOperator');

class AuthController {
    /**
     * 判斷是否為 AJAX 請求
     */
    _isAjaxRequest(req) {
        return req.xhr ||
            req.headers['x-requested-with'] === 'XMLHttpRequest' ||
            req.headers['content-type'] === 'application/json' ||
            req.headers['accept']?.includes('application/json');
    }

    /**
     * 返回錯誤響應（根據請求類型）
     */
    _errorResponse(req, res, statusCode, message) {
        if (this._isAjaxRequest(req)) {
            return res.status(statusCode).json({
                success: false,
                message
            });
        }

        return res.status(statusCode).send(`
            <!DOCTYPE html>
            <html><head><title>登入錯誤</title></head>
            <body>
                <div class="error">${message}</div>
                <script>setTimeout(() => window.history.back(), 2000);</script>
            </body></html>
        `);
    }

    /**
     * 用戶登入 (API)
     */
    async login(req, res) {
        try {
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

            const result = await authService.validateLogin(username, password);

            if (!result.success) {
                await logUserActivity(
                    result.userId || null,
                    'login_failed',
                    'user',
                    result.userId || null,
                    { reason: result.error, username },
                    ipAddress
                );
                return res.status(401).json({
                    success: false,
                    message: result.message
                });
            }

            // 生成 JWT Token
            const token = generateToken(result.user);

            // 記錄登入成功
            await logUserActivity(
                result.user.id,
                'login_success',
                'user',
                result.user.id,
                { login_method: 'username_password' },
                ipAddress
            );

            res.json({
                success: true,
                message: '登入成功',
                token,
                user: result.user
            });

        } catch (error) {
            console.error('登入錯誤:', error);
            res.status(500).json({
                success: false,
                message: '登入過程發生錯誤'
            });
        }
    }

    /**
     * 管理後台登入
     */
    async adminLogin(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return this._errorResponse(req, res, 400, '輸入數據格式錯誤');
            }

            const { username, password } = req.body;
            const ipAddress = req.ip || req.connection.remoteAddress;

            const result = await authService.validateAdminLogin(username, password);

            if (!result.success) {
                await logUserActivity(
                    result.userId || null,
                    'admin_login_failed',
                    'user',
                    result.userId || null,
                    { reason: result.error, username },
                    ipAddress
                );
                return this._errorResponse(req, res, 401, result.message);
            }

            // 設置 Session
            req.session.userId = result.user.id;
            req.session.username = result.user.username;
            req.session.role = result.user.role;
            req.session.user = result.user;

            // 記錄登入成功
            await logUserActivity(
                result.user.id,
                'admin_login_success',
                'user',
                result.user.id,
                { login_method: 'admin_panel' },
                ipAddress
            );

            // 決定登入後跳轉頁面
            let redirectUrl = '/admin/dashboard';

            // 報到專員登入後跳轉到 QR Scanner
            if (isCheckinOperator(result.user)) {
                const allowedProjects = getAllowedProjects(result.user);
                if (allowedProjects.length > 0) {
                    redirectUrl = `/admin/qr-scanner?project_id=${allowedProjects[0]}`;
                }
            }

            // 根據請求類型返回響應
            if (this._isAjaxRequest(req)) {
                return res.json({
                    success: true,
                    message: '登入成功',
                    redirect: redirectUrl
                });
            }

            res.redirect(redirectUrl);

        } catch (error) {
            console.error('管理後台登入錯誤:', error);
            return this._errorResponse(req, res, 500, '登入過程發生錯誤');
        }
    }

    /**
     * 用戶註冊
     */
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

            const result = await authService.registerUser({ username, email, password, full_name });

            if (!result.success) {
                return res.status(409).json({
                    success: false,
                    message: result.message
                });
            }

            // 記錄註冊活動
            await logUserActivity(
                result.userId,
                'user_registered',
                'user',
                result.userId,
                { registration_method: 'api' },
                ipAddress
            );

            res.status(201).json({
                success: true,
                message: '註冊成功',
                userId: result.userId
            });

        } catch (error) {
            console.error('註冊錯誤:', error);
            res.status(500).json({
                success: false,
                message: '註冊過程發生錯誤'
            });
        }
    }

    /**
     * 登出 (API)
     */
    async logout(req, res) {
        try {
            const ipAddress = req.ip || req.connection.remoteAddress;

            if (req.user) {
                await logUserActivity(
                    req.user.id,
                    'logout',
                    'user',
                    req.user.id,
                    { logout_method: 'api' },
                    ipAddress
                );
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

    /**
     * 管理後台登出
     */
    async adminLogout(req, res) {
        try {
            const ipAddress = req.ip || req.connection.remoteAddress;

            if (req.session.userId) {
                await logUserActivity(
                    req.session.userId,
                    'admin_logout',
                    'user',
                    req.session.userId,
                    { logout_method: 'admin_panel' },
                    ipAddress
                );
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

    /**
     * 獲取當前用戶信息
     */
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

    /**
     * 修改密碼
     */
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

            const result = await authService.changePassword(
                req.user.id,
                currentPassword,
                newPassword,
                req.user.password_hash
            );

            if (!result.success) {
                await logUserActivity(
                    req.user.id,
                    'password_change_failed',
                    'user',
                    req.user.id,
                    { reason: result.error },
                    ipAddress
                );
                return res.status(401).json({
                    success: false,
                    message: result.message
                });
            }

            // 記錄密碼修改
            await logUserActivity(
                req.user.id,
                'password_changed',
                'user',
                req.user.id,
                { change_method: 'api' },
                ipAddress
            );

            res.json({
                success: true,
                message: result.message
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

module.exports = autoBind(new AuthController());
