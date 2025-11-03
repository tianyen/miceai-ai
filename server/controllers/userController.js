const bcrypt = require('bcrypt');
const database = require('../config/database');
const { logUserActivity } = require('../middleware/auth');
const responses = require('../utils/responses');

class UserController {
    // 獲取用戶列表 - 支持HTML響應
    async getUsers(req, res) {
        try {

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            const roleFilter = req.query.role;
            const statusFilter = req.query.status;
            const searchFilter = req.query.search;
            const userId = req.user.id;
            const userRole = req.user.role;

            let query = `
                SELECT 
                    u.*,
                    creator.full_name as created_by_name,
                    manager.full_name as managed_by_name
                FROM users u
                LEFT JOIN users creator ON u.created_by = creator.id
                LEFT JOIN users manager ON u.managed_by = manager.id
                WHERE 1=1
            `;
            let countQuery = `SELECT COUNT(*) as count FROM users u WHERE 1=1`;
            let queryParams = [];
            let countParams = [];

            // Role-based access control
            if (userRole === 'super_admin') {
                // Super admin can see all users
            } else if (userRole === 'project_manager') {
                // Project manager can only see non-super_admin users they created/manage
                query += ` AND u.role != 'super_admin' AND (u.created_by = ? OR u.managed_by = ?)`;
                countQuery += ` AND u.role != 'super_admin' AND (u.created_by = ? OR u.managed_by = ?)`;
                queryParams.push(userId, userId);
                countParams.push(userId, userId);
            } else {
                // Other users can only see themselves
                query += ` AND u.id = ?`;
                countQuery += ` AND u.id = ?`;
                queryParams.push(userId);
                countParams.push(userId);
            }

            // Search filter
            if (searchFilter && searchFilter.trim()) {
                query += ` AND (u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)`;
                countQuery += ` AND (u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)`;
                const searchTerm = `%${searchFilter.trim()}%`;
                queryParams.push(searchTerm, searchTerm, searchTerm);
                countParams.push(searchTerm, searchTerm, searchTerm);
            }

            // Role filter
            if (roleFilter && roleFilter.trim()) {
                query += ` AND u.role = ?`;
                countQuery += ` AND u.role = ?`;
                queryParams.push(roleFilter.trim());
                countParams.push(roleFilter.trim());
            }

            // Status filter
            if (statusFilter && statusFilter.trim()) {
                query += ` AND u.status = ?`;
                countQuery += ` AND u.status = ?`;
                queryParams.push(statusFilter.trim());
                countParams.push(statusFilter.trim());
            }

            query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
            const users = await database.query(query, [...queryParams, limit, offset]);

            const totalResult = await database.get(countQuery, countParams);
            const total = totalResult.count;

            // 直接返回 JSON 響應，暫時跳過 HTML 生成
            const pagination = {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            };

            return responses.success(res, {
                users,
                pagination
            });

            // 暫時註釋掉 HTML 生成部分
            /*
            // HTML generation temporarily disabled for debugging
            if (false && req.headers['x-requested-with'] === 'XMLHttpRequest' || req.query.format === 'html') {
                let html = '';
                
                if (users.length === 0) {
                    html = `
                        <tr>
                            <td colspan="7" class="empty-state">
                                <div class="empty-icon">👥</div>
                                <div class="empty-text">
                                    <h4>尚無用戶資料</h4>
                                    <p>還沒有任何用戶記錄</p>
                                </div>
                            </td>
                        </tr>
                    `;
                } else {
                    // Define helper functions locally
                    const getRoleBadge = (role) => {
                        const roleMap = {
                            'super_admin': '<span class="badge badge-danger">超級管理員</span>',
                            'project_manager': '<span class="badge badge-warning">專案管理員</span>',
                            'vendor': '<span class="badge badge-info">廠商</span>',
                            'project_user': '<span class="badge badge-primary">一般人員</span>'
                        };
                        return roleMap[role] || '<span class="badge badge-secondary">未知</span>';
                    };
                    
                    const getStatusBadge = (status, disabledAt) => {
                        const statusMap = {
                            'active': '<span class="badge badge-success">啟用</span>',
                            'inactive': '<span class="badge badge-secondary">停用</span>',
                            'suspended': '<span class="badge badge-warning">暫停</span>',
                            'disabled': '<span class="badge badge-danger">禁用</span>',
                            'pending_deletion': '<span class="badge badge-dark">待刪除</span>'
                        };
                        return statusMap[status] || '<span class="badge badge-secondary">未知</span>';
                    };

                    users.forEach(user => {
                        const roleBadge = getRoleBadge(user.role);
                        const statusBadge = getStatusBadge(user.status, user.disabled_at);
                        const createdAt = new Date(user.created_at).toLocaleString('zh-TW');
                        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString('zh-TW') : '-';
                        
                        // Permission check for actions
                        let actions = '';
                        const canManage = (userRole === 'super_admin') || 
                                         (userRole === 'project_manager' && user.role !== 'super_admin');
                        
                        if (canManage && user.id !== userId) {
                            actions = `
                                <div class="user-actions">
                                    <button class="btn btn-sm btn-primary" onclick="viewUser(${user.id})" title="查看詳情">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn btn-sm btn-success" onclick="editUser(${user.id})" title="編輯">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    ${user.status === 'active' ? 
                                        `<button class="btn btn-sm btn-warning" onclick="toggleUserStatus(${user.id}, 'disabled')" title="禁用">
                                            <i class="fas fa-ban"></i>
                                        </button>` :
                                        `<button class="btn btn-sm btn-info" onclick="toggleUserStatus(${user.id}, 'active')" title="啟用">
                                            <i class="fas fa-check"></i>
                                        </button>`
                                    }
                                    ${userRole === 'super_admin' ? 
                                        `<button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})" title="刪除">
                                            <i class="fas fa-trash"></i>
                                        </button>` : ''
                                    }
                                </div>
                            `;
                        } else if (user.id === userId) {
                            actions = `
                                <div class="user-actions">
                                    <button class="btn btn-sm btn-primary" onclick="viewUser(${user.id})" title="查看詳情">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn btn-sm btn-success" onclick="editUser(${user.id})" title="編輯個人資料">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                </div>
                            `;
                        }

                        html += `
                            <tr>
                                <td>
                                    <div class="user-info">
                                        <strong>${user.full_name}</strong>
                                        <div class="user-username">${user.username}</div>
                                    </div>
                                </td>
                                <td>${user.email}</td>
                                <td>${roleBadge}</td>
                                <td>${statusBadge}</td>
                                <td>${lastLogin}</td>
                                <td>${createdAt}</td>
                                <td>${actions}</td>
                            </tr>
                        `;
                    });
                }
                
                res.send(html);
            } else {
                res.json({
                    success: true,
                    data: {
                        users,
                        pagination: {
                            page,
                            limit,
                            total,
                            pages: Math.ceil(total / limit)
                        }
                    }
                });
            }
            */

        } catch (error) {
            console.error('獲取用戶列表失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取用戶列表失敗'
            });
        }
    }

    // 獲取專案管理員管理的用戶
    async getManagedUsers(req, res) {
        try {
            const managerId = req.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            const users = await database.query(`
                SELECT
                    u.id, u.username, u.email, u.full_name, u.role, u.status,
                    u.created_at, u.updated_at, u.last_login, u.account_expires_at,
                    u.disabled_at, u.can_delete_after
                FROM users u
                WHERE u.managed_by = ? OR u.created_by = ?
                ORDER BY u.created_at DESC
                LIMIT ? OFFSET ?
            `, [managerId, managerId, limit, offset]);

            const totalResult = await database.get(`
                SELECT COUNT(*) as count FROM users
                WHERE managed_by = ? OR created_by = ?
            `, [managerId, managerId]);
            const total = totalResult.count;

            res.json({
                success: true,
                data: {
                    users,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit)
                    }
                }
            });

        } catch (error) {
            console.error('獲取管理用戶列表失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取管理用戶列表失敗'
            });
        }
    }

    async getUser(req, res) {
        try {
            const userId = req.params.id;

            const user = await database.get(`
                SELECT id, username, email, full_name, role, status, created_at, updated_at, last_login,
                       (SELECT full_name FROM users WHERE id = u.created_by) as creator_name
                FROM users u
                WHERE id = ?
            `, [userId]);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用戶不存在'
                });
            }

            // 獲取用戶創建的項目統計
            const projectStats = await database.get(`
                SELECT 
                    COUNT(*) as total_projects,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_projects,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects
                FROM event_projects
                WHERE created_by = ?
            `, [userId]);

            // 獲取用戶參與的項目統計
            const participatingProjects = await database.get(`
                SELECT COUNT(*) as count
                FROM user_project_permissions
                WHERE user_id = ?
            `, [userId]);

            res.json({
                success: true,
                data: {
                    ...user,
                    project_stats: projectStats,
                    participating_projects: participatingProjects.count
                }
            });

        } catch (error) {
            console.error('獲取用戶詳情失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取用戶詳情失敗'
            });
        }
    }

    async createUser(req, res) {
        try {
            const {
                username,
                email,
                password,
                full_name,
                role,
                account_expires_months
            } = req.body;

            const currentUser = req.user;

            // 權限檢查
            if (currentUser.role === 'project_manager' && role !== 'project_user') {
                return res.status(403).json({
                    success: false,
                    message: '專案管理員只能創建一般用戶'
                });
            }

            if (currentUser.role === 'project_user') {
                return res.status(403).json({
                    success: false,
                    message: '無權限創建用戶'
                });
            }

            // 檢查用戶名和郵箱是否已存在
            const existingUser = await database.get(`
                SELECT id FROM users WHERE username = ? OR email = ?
            `, [username, email]);

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: '用戶名或郵箱已存在'
                });
            }

            // 加密密碼
            const passwordHash = await bcrypt.hash(password, 10);

            // 計算帳號到期時間
            let accountExpiresAt = null;
            if (account_expires_months && account_expires_months > 0) {
                const expiresDate = new Date();
                expiresDate.setMonth(expiresDate.getMonth() + parseInt(account_expires_months));
                accountExpiresAt = expiresDate.toISOString();
            }

            // 創建用戶
            const result = await database.run(`
                INSERT INTO users (
                    username, email, password_hash, full_name, role, status,
                    created_by, managed_by, account_expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                username,
                email,
                passwordHash,
                full_name,
                role,
                'active',
                currentUser.id,
                currentUser.role === 'project_manager' ? currentUser.id : null,
                accountExpiresAt
            ]);

            // 記錄狀態歷史
            await database.run(`
                INSERT INTO user_status_history (
                    user_id, old_status, new_status, changed_by, change_reason, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                result.lastID,
                null,
                'active',
                currentUser.id,
                '創建用戶',
                accountExpiresAt
            ]);

            // 記錄操作日誌
            await logUserActivity(
                currentUser.id,
                'user_created',
                'user',
                result.lastID,
                {
                    username,
                    role,
                    created_for: full_name,
                    expires_at: accountExpiresAt
                },
                req.ip
            );

            res.json({
                success: true,
                message: '用戶創建成功',
                user_id: result.lastID
            });

        } catch (error) {
            console.error('創建用戶失敗:', error);
            res.status(500).json({
                success: false,
                message: '創建用戶失敗'
            });
        }
    }

    async updateUser(req, res) {
        try {
            const userId = req.params.id;
            const updates = req.body;

            // 檢查用戶是否存在
            const existingUser = await database.get('SELECT * FROM users WHERE id = ?', [userId]);
            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    message: '用戶不存在'
                });
            }

            // 防止修改超級管理員帳號（除了自己）
            if (existingUser.role === 'super_admin' && parseInt(userId) !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: '無法修改其他超級管理員帳號'
                });
            }

            // 構建更新查詢
            const allowedFields = ['username', 'email', 'full_name', 'role', 'status'];
            const updateFields = [];
            const updateValues = [];

            // 特殊處理密碼
            if (updates.password) {
                const hashedPassword = await bcrypt.hash(updates.password, 10);
                updateFields.push('password_hash = ?');
                updateValues.push(hashedPassword);
            }

            // 處理其他字段
            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    // 檢查用戶名和郵箱唯一性
                    if (field === 'username' || field === 'email') {
                        const duplicate = await database.get(
                            `SELECT id FROM users WHERE ${field} = ? AND id != ?`,
                            [updates[field], userId]
                        );
                        if (duplicate) {
                            return res.status(409).json({
                                success: false,
                                message: `${field === 'username' ? '用戶名' : '郵箱'}已存在`
                            });
                        }
                    }

                    updateFields.push(`${field} = ?`);
                    updateValues.push(updates[field]);
                }
            }

            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '沒有有效的更新字段'
                });
            }

            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            updateValues.push(userId);

            const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
            await database.run(query, updateValues);

            await logUserActivity(
                req.user.id,
                'user_updated',
                'user',
                userId,
                { updated_fields: Object.keys(updates), target_user: existingUser.username },
                req.ip
            );

            res.json({
                success: true,
                message: '用戶更新成功'
            });

        } catch (error) {
            console.error('更新用戶失敗:', error);
            res.status(500).json({
                success: false,
                message: '更新用戶失敗'
            });
        }
    }

    async deleteUser(req, res) {
        try {
            const userId = req.params.id;

            // 檢查用戶是否存在
            const user = await database.get('SELECT * FROM users WHERE id = ?', [userId]);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用戶不存在'
                });
            }

            // 防止刪除超級管理員（除了自己）
            if (user.role === 'super_admin' && parseInt(userId) !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: '無法刪除其他超級管理員帳號'
                });
            }

            // 防止刪除自己
            if (parseInt(userId) === req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: '無法刪除自己的帳號'
                });
            }

            // 檢查用戶是否有創建的項目
            const hasProjects = await database.get(
                'SELECT COUNT(*) as count FROM event_projects WHERE created_by = ?',
                [userId]
            );

            if (hasProjects.count > 0) {
                return res.status(409).json({
                    success: false,
                    message: '該用戶有創建的項目，無法刪除'
                });
            }

            // 開始事務
            await database.beginTransaction();

            try {
                // 刪除用戶相關數據
                await database.run('DELETE FROM user_project_permissions WHERE user_id = ?', [userId]);
                await database.run('UPDATE event_projects SET assigned_to = NULL WHERE assigned_to = ?', [userId]);
                await database.run('DELETE FROM users WHERE id = ?', [userId]);

                await database.commit();

                await logUserActivity(
                    req.user.id,
                    'user_deleted',
                    'user',
                    userId,
                    { target_user: user.username },
                    req.ip
                );

                res.json({
                    success: true,
                    message: '用戶刪除成功'
                });

            } catch (error) {
                await database.rollback();
                throw error;
            }

        } catch (error) {
            console.error('刪除用戶失敗:', error);
            res.status(500).json({
                success: false,
                message: '刪除用戶失敗'
            });
        }
    }

    async resetPassword(req, res) {
        try {
            const userId = req.params.id;
            const { new_password } = req.body;

            // 檢查用戶是否存在
            const user = await database.get('SELECT * FROM users WHERE id = ?', [userId]);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用戶不存在'
                });
            }

            // 加密新密碼
            const hashedPassword = await bcrypt.hash(new_password, 10);

            // 更新密碼
            await database.run(
                'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [hashedPassword, userId]
            );

            await logUserActivity(
                req.user.id,
                'password_reset',
                'user',
                userId,
                { target_user: user.username },
                req.ip
            );

            res.json({
                success: true,
                message: '密碼重置成功'
            });

        } catch (error) {
            console.error('重置密碼失敗:', error);
            res.status(500).json({
                success: false,
                message: '重置密碼失敗'
            });
        }
    }

    async getUserActivities(req, res) {
        try {
            const userId = req.params.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            const activities = await database.query(`
                SELECT * FROM system_logs
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `, [userId, limit, offset]);

            const totalResult = await database.get(
                'SELECT COUNT(*) as count FROM system_logs WHERE user_id = ?',
                [userId]
            );

            res.json({
                success: true,
                data: {
                    activities,
                    pagination: {
                        page,
                        limit,
                        total: totalResult.count,
                        pages: Math.ceil(totalResult.count / limit)
                    }
                }
            });

        } catch (error) {
            console.error('獲取用戶活動失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取用戶活動失敗'
            });
        }
    }

    // 更新用戶狀態（包含軟刪除邏輯）
    async updateUserStatus(req, res) {
        try {
            const userId = req.params.id;
            const { status, reason, account_expires_months } = req.body;
            const currentUser = req.user;

            // 獲取目標用戶
            const targetUser = await database.get(`
                SELECT * FROM users WHERE id = ?
            `, [userId]);

            if (!targetUser) {
                return res.status(404).json({
                    success: false,
                    message: '用戶不存在'
                });
            }

            // 權限檢查
            if (currentUser.role === 'project_manager') {
                if (targetUser.managed_by !== currentUser.id && targetUser.created_by !== currentUser.id) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限管理此用戶'
                    });
                }
                if (targetUser.role !== 'project_user') {
                    return res.status(403).json({
                        success: false,
                        message: '只能管理一般用戶'
                    });
                }
            }

            // 不能修改自己的狀態
            if (targetUser.id === currentUser.id) {
                return res.status(400).json({
                    success: false,
                    message: '不能修改自己的狀態'
                });
            }

            // 防止停用超級管理員
            if (targetUser.role === 'super_admin' && status !== 'active') {
                return res.status(403).json({
                    success: false,
                    message: '無法停用超級管理員帳號'
                });
            }

            const oldStatus = targetUser.status;
            let updateData = {
                status,
                updated_at: new Date().toISOString()
            };

            // 處理不同狀態的邏輯
            if (status === 'disabled') {
                updateData.disabled_at = new Date().toISOString();
                // 設置7天後可刪除
                const canDeleteDate = new Date();
                canDeleteDate.setDate(canDeleteDate.getDate() + 7);
                updateData.can_delete_after = canDeleteDate.toISOString();
            } else if (status === 'active') {
                updateData.disabled_at = null;
                updateData.can_delete_after = null;

                // 更新帳號到期時間
                if (account_expires_months && account_expires_months > 0) {
                    const expiresDate = new Date();
                    expiresDate.setMonth(expiresDate.getMonth() + parseInt(account_expires_months));
                    updateData.account_expires_at = expiresDate.toISOString();
                }
            }

            // 構建更新 SQL
            const updateFields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
            const updateValues = Object.values(updateData);

            await database.run(`
                UPDATE users SET ${updateFields} WHERE id = ?
            `, [...updateValues, userId]);

            // 記錄狀態歷史
            await database.run(`
                INSERT INTO user_status_history (
                    user_id, old_status, new_status, changed_by, change_reason, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                userId,
                oldStatus,
                status,
                currentUser.id,
                reason || `狀態變更為 ${status}`,
                updateData.account_expires_at || null
            ]);

            // 記錄操作日誌
            await logUserActivity(
                currentUser.id,
                'user_status_changed',
                'user',
                userId,
                {
                    old_status: oldStatus,
                    new_status: status,
                    reason,
                    target_user: targetUser.username
                },
                req.ip
            );

            res.json({
                success: true,
                message: '用戶狀態更新成功'
            });

        } catch (error) {
            console.error('更新用戶狀態失敗:', error);
            res.status(500).json({
                success: false,
                message: '更新用戶狀態失敗'
            });
        }
    }

    // 軟刪除用戶（標記為待刪除）
    async softDeleteUser(req, res) {
        try {
            const userId = req.params.id;
            const currentUser = req.user;

            // 獲取目標用戶
            const targetUser = await database.get(`
                SELECT * FROM users WHERE id = ?
            `, [userId]);

            if (!targetUser) {
                return res.status(404).json({
                    success: false,
                    message: '用戶不存在'
                });
            }

            // 檢查是否可以刪除
            if (targetUser.status !== 'disabled') {
                return res.status(400).json({
                    success: false,
                    message: '用戶必須先停用才能刪除'
                });
            }

            if (!targetUser.can_delete_after || new Date() < new Date(targetUser.can_delete_after)) {
                return res.status(400).json({
                    success: false,
                    message: '用戶停用未滿7天，無法刪除'
                });
            }

            // 權限檢查
            if (currentUser.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: '只有超級管理員可以刪除用戶'
                });
            }

            // 標記為待刪除
            await database.run(`
                UPDATE users SET status = 'pending_deletion', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [userId]);

            // 記錄狀態歷史
            await database.run(`
                INSERT INTO user_status_history (
                    user_id, old_status, new_status, changed_by, change_reason
                ) VALUES (?, ?, ?, ?, ?)
            `, [
                userId,
                targetUser.status,
                'pending_deletion',
                currentUser.id,
                '標記為待刪除'
            ]);

            // 記錄操作日誌
            await logUserActivity(
                currentUser.id,
                'user_marked_for_deletion',
                'user',
                userId,
                { target_user: targetUser.username },
                req.ip
            );

            res.json({
                success: true,
                message: '用戶已標記為待刪除'
            });

        } catch (error) {
            console.error('軟刪除用戶失敗:', error);
            res.status(500).json({
                success: false,
                message: '軟刪除用戶失敗'
            });
        }
    }

    // 獲取用戶狀態歷史
    async getUserStatusHistory(req, res) {
        try {
            const userId = req.params.id;

            const history = await database.query(`
                SELECT
                    ush.*,
                    u.full_name as changed_by_name
                FROM user_status_history ush
                LEFT JOIN users u ON ush.changed_by = u.id
                WHERE ush.user_id = ?
                ORDER BY ush.created_at DESC
            `, [userId]);

            res.json({
                success: true,
                data: history
            });

        } catch (error) {
            console.error('獲取用戶狀態歷史失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取用戶狀態歷史失敗'
            });
        }
    }

    // 重置用戶密碼
    async resetPassword(req, res) {
        try {
            const userId = req.params.id;
            const { new_password } = req.body;
            const currentUser = req.user;

            // 獲取目標用戶
            const targetUser = await database.get(`
                SELECT * FROM users WHERE id = ?
            `, [userId]);

            if (!targetUser) {
                return res.status(404).json({
                    success: false,
                    message: '用戶不存在'
                });
            }

            // 權限檢查（只有超級管理員可以重置密碼）
            if (currentUser.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: '只有超級管理員可以重置密碼'
                });
            }

            // 加密新密碼
            const passwordHash = await bcrypt.hash(new_password, 10);

            // 更新密碼
            await database.run(`
                UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [passwordHash, userId]);

            // 記錄操作日誌
            await logUserActivity(
                currentUser.id,
                'password_reset',
                'user',
                userId,
                { target_user: targetUser.username },
                req.ip
            );

            res.json({
                success: true,
                message: '密碼重置成功'
            });

        } catch (error) {
            console.error('重置密碼失敗:', error);
            res.status(500).json({
                success: false,
                message: '重置密碼失敗'
            });
        }
    }

    // 獲取用戶活動記錄
    async getUserActivities(req, res) {
        try {
            const userId = req.params.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            // 權限檢查（只有超級管理員可以查看活動記錄）
            if (req.user.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: '只有超級管理員可以查看用戶活動記錄'
                });
            }

            const activities = await database.query(`
                SELECT
                    al.*,
                    u.full_name as user_name
                FROM system_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE al.user_id = ?
                ORDER BY al.created_at DESC
                LIMIT ? OFFSET ?
            `, [userId, limit, offset]);

            const totalResult = await database.get(`
                SELECT COUNT(*) as count FROM system_logs WHERE user_id = ?
            `, [userId]);
            const total = totalResult.count;

            res.json({
                success: true,
                data: {
                    activities,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit)
                    }
                }
            });

        } catch (error) {
            console.error('獲取用戶活動記錄失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取用戶活動記錄失敗'
            });
        }
    }

    // 獲取當前用戶信息
    async getCurrentUser(req, res) {
        try {
            const user = await database.get(`
                SELECT id, username, email, full_name, role, status,
                       account_expires_at, last_login, created_at
                FROM users WHERE id = ?
            `, [req.user.id]);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用戶不存在'
                });
            }

            res.json({
                success: true,
                data: user
            });

        } catch (error) {
            console.error('獲取當前用戶信息失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取當前用戶信息失敗'
            });
        }
    }

    // 用戶分頁
    async getUsersPagination(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;

            const totalResult = await database.get('SELECT COUNT(*) as count FROM users WHERE status != "pending_deletion"');
            const total = totalResult.count;
            const pages = Math.ceil(total / limit);

            let paginationHtml = '<div class="pagination-info">';
            paginationHtml += `<span>共 ${total} 位用戶，第 ${page} 頁 / 共 ${pages} 頁</span>`;
            paginationHtml += '</div>';

            if (pages > 1) {
                paginationHtml += '<div class="pagination-controls">';

                if (page > 1) {
                    paginationHtml += `<button class="btn btn-sm btn-outline-primary" onclick="loadUsers({page: ${page - 1}})">上一頁</button>`;
                }

                const startPage = Math.max(1, page - 2);
                const endPage = Math.min(pages, page + 2);

                for (let i = startPage; i <= endPage; i++) {
                    const activeClass = i === page ? 'btn-primary' : 'btn-outline-primary';
                    paginationHtml += `<button class="btn btn-sm ${activeClass}" onclick="loadUsers({page: ${i}})">${i}</button>`;
                }

                if (page < pages) {
                    paginationHtml += `<button class="btn btn-sm btn-outline-primary" onclick="loadUsers({page: ${page + 1}})">下一頁</button>`;
                }

                paginationHtml += '</div>';
            }

            res.send(paginationHtml);

        } catch (error) {
            console.error('獲取用戶分頁失敗:', error);
            res.send('<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
        }
    }

    // 搜索用戶
    async searchUsers(req, res) {
        try {
            const { search, role, status } = req.query;
            const userId = req.user.id;
            const userRole = req.user.role;

            let searchQuery = `
                SELECT u.id, u.username, u.email, u.full_name, u.role, u.status,
                       u.created_at, u.last_login,
                       creator.full_name as created_by_name
                FROM users u
                LEFT JOIN users creator ON u.created_by = creator.id
                WHERE 1=1
            `;
            let queryParams = [];

            // 權限限制
            if (userRole === 'project_manager') {
                searchQuery += ` AND (u.created_by = ? OR u.managed_by = ?)`;
                queryParams.push(userId, userId);
            }

            // 搜索條件
            if (search && search.trim()) {
                searchQuery += ` AND (u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)`;
                const searchTerm = `%${search.trim()}%`;
                queryParams.push(searchTerm, searchTerm, searchTerm);
            }

            // 角色篩選
            if (role && role.trim() && role !== 'all') {
                searchQuery += ` AND u.role = ?`;
                queryParams.push(role.trim());
            }

            // 狀態篩選
            if (status && status.trim() && status !== 'all') {
                searchQuery += ` AND u.status = ?`;
                queryParams.push(status.trim());
            }

            searchQuery += ` ORDER BY u.created_at DESC LIMIT 50`;

            const users = await database.query(searchQuery, queryParams);

            // Check if HTML response is requested
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                let html = '';

                if (users.length === 0) {
                    html = `
                        <tr>
                            <td colspan="7" class="empty-state">
                                <div class="empty-icon">🔍</div>
                                <div class="empty-text">
                                    <h4>找不到符合的用戶</h4>
                                    <p>請嘗試調整搜尋條件</p>
                                </div>
                            </td>
                        </tr>
                    `;
                } else {
                    // Use same helper functions and logic as getUsers
                    const getRoleBadge = (role) => {
                        const roleMap = {
                            'super_admin': '<span class="badge badge-danger">超級管理員</span>',
                            'project_manager': '<span class="badge badge-warning">專案管理員</span>',
                            'vendor': '<span class="badge badge-info">廠商</span>',
                            'project_user': '<span class="badge badge-primary">一般人員</span>'
                        };
                        return roleMap[role] || '<span class="badge badge-secondary">未知</span>';
                    };

                    const getStatusBadge = (status) => {
                        const statusMap = {
                            'active': '<span class="badge badge-success">啟用</span>',
                            'inactive': '<span class="badge badge-secondary">停用</span>',
                            'suspended': '<span class="badge badge-warning">暫停</span>',
                            'disabled': '<span class="badge badge-danger">禁用</span>',
                            'pending_deletion': '<span class="badge badge-dark">待刪除</span>'
                        };
                        return statusMap[status] || '<span class="badge badge-secondary">未知</span>';
                    };

                    users.forEach(user => {
                        const roleBadge = getRoleBadge(user.role);
                        const statusBadge = getStatusBadge(user.status);
                        const createdAt = new Date(user.created_at).toLocaleString('zh-TW');
                        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString('zh-TW') : '-';

                        // Permission check for actions
                        let actions = '';
                        const canManage = (userRole === 'super_admin') ||
                            (userRole === 'project_manager' && user.role !== 'super_admin');

                        if (canManage && user.id !== userId) {
                            actions = `
                                <div class="user-actions">
                                    <button class="btn btn-sm btn-primary" onclick="viewUser(${user.id})" title="查看詳情">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn btn-sm btn-success" onclick="editUser(${user.id})" title="編輯">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    ${user.status === 'active' ?
                                    `<button class="btn btn-sm btn-warning" onclick="toggleUserStatus(${user.id}, 'disabled')" title="禁用">
                                            <i class="fas fa-ban"></i>
                                        </button>` :
                                    `<button class="btn btn-sm btn-info" onclick="toggleUserStatus(${user.id}, 'active')" title="啟用">
                                            <i class="fas fa-check"></i>
                                        </button>`
                                }
                                    ${userRole === 'super_admin' ?
                                    `<button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})" title="刪除">
                                            <i class="fas fa-trash"></i>
                                        </button>` : ''
                                }
                                </div>
                            `;
                        } else if (user.id === userId) {
                            actions = `
                                <div class="user-actions">
                                    <button class="btn btn-sm btn-primary" onclick="viewUser(${user.id})" title="查看詳情">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn btn-sm btn-success" onclick="editUser(${user.id})" title="編輯個人資料">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                </div>
                            `;
                        }

                        html += `
                            <tr>
                                <td>
                                    <div class="user-info">
                                        <strong>${user.full_name}</strong>
                                        <div class="user-username">${user.username}</div>
                                    </div>
                                </td>
                                <td>${user.email}</td>
                                <td>${roleBadge}</td>
                                <td>${statusBadge}</td>
                                <td>${lastLogin}</td>
                                <td>${createdAt}</td>
                                <td>${actions}</td>
                            </tr>
                        `;
                    });
                }

                res.send(html);
            } else {
                res.json({
                    success: true,
                    data: { users: users || [] }
                });
            }

        } catch (error) {
            console.error('搜索用戶失敗:', error);
            res.status(500).json({
                success: false,
                message: '搜索用戶失敗'
            });
        }
    }

    // 獲取用戶統計
    async getUserStats(req, res) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;

            let stats = {};

            if (userRole === 'super_admin') {
                // 超級管理員可以看到所有統計
                const totalUsers = await database.get('SELECT COUNT(*) as count FROM users');
                const activeUsers = await database.get("SELECT COUNT(*) as count FROM users WHERE status = 'active'");
                const disabledUsers = await database.get("SELECT COUNT(*) as count FROM users WHERE status = 'disabled'");
                const newUsersThisMonth = await database.get(`
                    SELECT COUNT(*) as count FROM users 
                    WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
                `);

                stats = {
                    totalUsers: totalUsers.count,
                    activeUsers: activeUsers.count,
                    disabledUsers: disabledUsers.count,
                    newUsersThisMonth: newUsersThisMonth.count
                };
            } else if (userRole === 'project_manager') {
                // 專案管理員只能看到自己管理的用戶統計
                const managedUsers = await database.get(`
                    SELECT COUNT(*) as count FROM users 
                    WHERE managed_by = ? OR created_by = ?
                `, [userId, userId]);
                const activeManaged = await database.get(`
                    SELECT COUNT(*) as count FROM users 
                    WHERE (managed_by = ? OR created_by = ?) AND status = 'active'
                `, [userId, userId]);

                stats = {
                    managedUsers: managedUsers.count,
                    activeManaged: activeManaged.count,
                    disabledManaged: managedUsers.count - activeManaged.count
                };
            }

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('獲取用戶統計失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取用戶統計失敗'
            });
        }
    }

    // 批量導入用戶
    async importUsers(req, res) {
        try {
            const { users } = req.body;
            const currentUser = req.user;

            // 權限檢查
            if (currentUser.role === 'project_user') {
                return res.status(403).json({
                    success: false,
                    message: '無權限導入用戶'
                });
            }

            if (!Array.isArray(users) || users.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '請提供有效的用戶數據'
                });
            }

            let successCount = 0;
            let failureCount = 0;
            const errors = [];

            for (let i = 0; i < users.length; i++) {
                try {
                    const userData = users[i];
                    const { username, email, password, full_name, role } = userData;

                    // 檢查必填字段
                    if (!username || !email || !password || !full_name || !role) {
                        throw new Error('缺少必填字段');
                    }

                    // 檢查用戶名和郵箱是否已存在
                    const existingUser = await database.get(`
                        SELECT id FROM users WHERE username = ? OR email = ?
                    `, [username, email]);

                    if (existingUser) {
                        throw new Error('用戶名或郵箱已存在');
                    }

                    // 權限檢查
                    if (currentUser.role === 'project_manager' && role !== 'project_user') {
                        throw new Error('專案管理員只能創建一般用戶');
                    }

                    // 加密密碼
                    const passwordHash = await bcrypt.hash(password, 10);

                    // 創建用戶
                    const result = await database.run(`
                        INSERT INTO users (
                            username, email, password_hash, full_name, role, status,
                            created_by, managed_by
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        username,
                        email,
                        passwordHash,
                        full_name,
                        role,
                        'active',
                        currentUser.id,
                        currentUser.role === 'project_manager' ? currentUser.id : null
                    ]);

                    successCount++;

                } catch (error) {
                    failureCount++;
                    errors.push({
                        index: i + 1,
                        username: users[i]?.username || 'N/A',
                        error: error.message
                    });
                }
            }

            // 記錄操作日誌
            await logUserActivity(
                currentUser.id,
                'users_imported',
                'user',
                null,
                {
                    total: users.length,
                    success: successCount,
                    failures: failureCount
                },
                req.ip
            );

            res.json({
                success: true,
                message: `導入完成：成功 ${successCount} 個，失敗 ${failureCount} 個`,
                data: {
                    successCount,
                    failureCount,
                    errors: errors.slice(0, 10) // 只返回前10個錯誤
                }
            });

        } catch (error) {
            console.error('批量導入用戶失敗:', error);
            res.status(500).json({
                success: false,
                message: '批量導入用戶失敗'
            });
        }
    }
}

module.exports = new UserController();