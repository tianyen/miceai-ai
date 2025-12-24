const jwt = require('jsonwebtoken');
const database = require('../config/database');
const { isCheckinOperator, getAllowedProjects } = require('./checkinOperator');

const JWT_SECRET = process.env.JWT_SECRET || 'mice-ai-secret-key-2025';
const SESSION_SECRET = process.env.SESSION_SECRET || 'mice-ai-session-secret-2025';

// JWT 認證中間件
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: '需要訪問令牌' 
            });
        }

        jwt.verify(token, JWT_SECRET, async (err, user) => {
            if (err) {
                return res.status(403).json({ 
                    success: false, 
                    message: '無效的訪問令牌' 
                });
            }

            // 從數據庫獲取最新用戶信息
            const dbUser = await database.get(
                'SELECT * FROM users WHERE id = ? AND status = ?',
                [user.id, 'active']
            );

            if (!dbUser) {
                return res.status(403).json({ 
                    success: false, 
                    message: '用戶不存在或已被停用' 
                });
            }

            req.user = dbUser;
            next();
        });
    } catch (error) {
        console.error('認證錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '認證過程發生錯誤' 
        });
    }
};

// Session 認證中間件（用於管理後台）
const authenticateSession = async (req, res, next) => {
    try {


        if (!req.session || !req.session.userId) {
            // 檢查是否為 AJAX 請求
            if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                req.headers['accept']?.includes('application/json') ||
                req.originalUrl.startsWith('/api/')) {
                return res.status(401).json({
                    success: false,
                    message: '未認證的用戶',
                    redirect: '/admin/login'
                });
            }
            return res.redirect('/admin/login');
        }

        // 從數據庫獲取用戶信息
        const user = await database.get(
            'SELECT * FROM users WHERE id = ? AND status = ?',
            [req.session.userId, 'active']
        );

        if (!user) {
            req.session.destroy();
            // 檢查是否為 AJAX 請求
            if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                req.headers['accept']?.includes('application/json') ||
                req.originalUrl.startsWith('/api/')) {
                return res.status(401).json({
                    success: false,
                    message: '用戶不存在或已被停用',
                    redirect: '/admin/login'
                });
            }
            return res.redirect('/admin/login');
        }

        req.user = user;
        res.locals.user = user;

        // 報到專員權限變數
        const checkinOp = isCheckinOperator(user);
        res.locals.isCheckinOperator = checkinOp;
        res.locals.allowedProjects = checkinOp ? getAllowedProjects(user) : [];

        next();
    } catch (error) {
        console.error('Session 認證錯誤:', error);
        // 檢查是否為 AJAX 請求
        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' ||
            req.headers['accept']?.includes('application/json') ||
            req.originalUrl.startsWith('/api/')) {
            return res.status(500).json({
                success: false,
                message: '認證過程發生錯誤'
            });
        }
        res.status(500).render('error', {
            message: '認證過程發生錯誤',
            error: error
        });
    }
};

// 角色權限檢查中間件
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: '未認證的用戶' 
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: '權限不足' 
            });
        }

        next();
    };
};

// 項目權限檢查中間件
const requireProjectPermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            const projectId = req.params.projectId || req.body.projectId;
            
            if (!projectId) {
                return res.status(400).json({ 
                    success: false, 
                    message: '缺少項目 ID' 
                });
            }

            // 超級管理員有所有權限
            if (req.user.role === 'super_admin') {
                return next();
            }

            // 檢查項目權限
            const permission = await database.get(`
                SELECT pp.permission_level, p.created_by 
                FROM user_project_permissions pp
                JOIN event_projects p ON p.id = pp.project_id
                WHERE pp.user_id = ? AND pp.project_id = ?
            `, [req.user.id, projectId]);

            // 檢查是否為項目創建者
            const project = await database.get(
                'SELECT created_by FROM event_projects WHERE id = ?',
                [projectId]
            );

            const isCreator = project && project.created_by === req.user.id;
            const hasPermission = permission && 
                (permission.permission_level === requiredPermission || 
                 (requiredPermission === 'read' && ['write', 'admin'].includes(permission.permission_level)) ||
                 (requiredPermission === 'write' && permission.permission_level === 'admin'));

            if (!isCreator && !hasPermission) {
                return res.status(403).json({ 
                    success: false, 
                    message: '對此項目權限不足' 
                });
            }

            next();
        } catch (error) {
            console.error('項目權限檢查錯誤:', error);
            res.status(500).json({ 
                success: false, 
                message: '權限檢查過程發生錯誤' 
            });
        }
    };
};

// 生成 JWT Token
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

// 記錄用戶操作日誌
const logUserActivity = async (userId, action, targetType = null, targetId = null, details = null, ipAddress = null) => {
    try {
        await database.run(`
            INSERT INTO system_logs (user_id, action, target_type, target_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [userId, action, targetType, targetId, JSON.stringify(details), ipAddress]);
    } catch (error) {
        console.error('記錄用戶活動失敗:', error);
    }
};

module.exports = {
    authenticateToken,
    authenticateSession,
    requireRole,
    requireProjectPermission,
    generateToken,
    logUserActivity,
    JWT_SECRET,
    SESSION_SECRET
};