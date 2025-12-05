/**
 * User Controller - 用戶控制器
 *
 * @description 處理 HTTP 請求，調用 UserService 處理業務邏輯
 * @refactor 2025-12-05: 使用 UserService，移除直接 DB 訪問
 */
const { userService } = require('../services');
const { logUserActivity } = require('../middleware/auth');
const responses = require('../utils/responses');
const vh = require('../utils/viewHelpers');
const autoBind = require('../utils/autoBind');

class UserController {
    // ============================================================================
    // 列表與查詢
    // ============================================================================

    /**
     * 取得用戶列表
     */
    async getUsers(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const { role, status, search } = req.query;

            const result = await userService.getUsersList({
                userId: req.user.id,
                userRole: req.user.role,
                page,
                limit,
                search,
                role,
                status
            });

            return responses.success(res, result);

        } catch (error) {
            console.error('獲取用戶列表失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取用戶列表失敗'
            });
        }
    }

    /**
     * 取得專案管理員管理的用戶
     */
    async getManagedUsers(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;

            const result = await userService.getManagedUsers({
                managerId: req.user.id,
                page,
                limit
            });

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('獲取管理用戶列表失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取管理用戶列表失敗'
            });
        }
    }

    /**
     * 搜尋用戶
     */
    async searchUsers(req, res) {
        try {
            const { search, role, status } = req.query;

            const users = await userService.searchUsers({
                userId: req.user.id,
                userRole: req.user.role,
                search,
                role,
                status
            });

            // 檢查是否要求 HTML 格式
            if (this._isHtmlRequest(req)) {
                const html = this._renderUsersTable(users, req.user);
                return res.send(html);
            }

            res.json({
                success: true,
                data: { users: users || [] }
            });

        } catch (error) {
            console.error('搜索用戶失敗:', error);
            res.status(500).json({
                success: false,
                message: '搜索用戶失敗'
            });
        }
    }

    /**
     * 取得用戶分頁資訊
     */
    async getUsersPagination(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;

            const pagination = await userService.getPagination(page, limit);

            const html = this._renderPagination(pagination, page);
            res.send(html);

        } catch (error) {
            console.error('獲取用戶分頁失敗:', error);
            res.send('<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
        }
    }

    // ============================================================================
    // 用戶詳情
    // ============================================================================

    /**
     * 取得用戶詳情
     */
    async getUser(req, res) {
        try {
            const userId = req.params.id;

            const user = await userService.getUserDetail(userId);

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
            console.error('獲取用戶詳情失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取用戶詳情失敗'
            });
        }
    }

    /**
     * 取得當前用戶資訊
     */
    async getCurrentUser(req, res) {
        try {
            const user = await userService.getCurrentUserInfo(req.user.id);

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

    /**
     * 取得用戶活動記錄
     */
    async getUserActivities(req, res) {
        try {
            const userId = req.params.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;

            // 權限檢查
            if (req.user.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: '只有超級管理員可以查看用戶活動記錄'
                });
            }

            const result = await userService.getUserActivities({ userId, page, limit });

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('獲取用戶活動記錄失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取用戶活動記錄失敗'
            });
        }
    }

    /**
     * 取得用戶狀態歷史
     */
    async getUserStatusHistory(req, res) {
        try {
            const userId = req.params.id;

            const history = await userService.getUserStatusHistory(userId);

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

    /**
     * 取得用戶統計
     */
    async getUserStats(req, res) {
        try {
            const stats = await userService.getUserStats({
                userId: req.user.id,
                userRole: req.user.role
            });

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

    // ============================================================================
    // CRUD 操作
    // ============================================================================

    /**
     * 創建用戶
     */
    async createUser(req, res) {
        try {
            const result = await userService.createUser(req.body, req.user);

            if (!result.success) {
                const statusCode = {
                    'FORBIDDEN': 403,
                    'CONFLICT': 400
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'user_created',
                'user',
                result.id,
                {
                    username: result.username,
                    role: req.body.role,
                    expires_at: result.expires_at
                },
                req.ip
            );

            res.json({
                success: true,
                message: '用戶創建成功',
                user_id: result.id
            });

        } catch (error) {
            console.error('創建用戶失敗:', error);
            res.status(500).json({
                success: false,
                message: '創建用戶失敗'
            });
        }
    }

    /**
     * 更新用戶
     */
    async updateUser(req, res) {
        try {
            const userId = parseInt(req.params.id);

            const result = await userService.updateUser(userId, req.body, req.user);

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403,
                    'CONFLICT': 409,
                    'NO_FIELDS': 400
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'user_updated',
                'user',
                userId,
                { updated_fields: Object.keys(req.body), target_user: result.user.username },
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

    /**
     * 更新用戶狀態
     */
    async updateUserStatus(req, res) {
        try {
            const userId = parseInt(req.params.id);

            const result = await userService.updateUserStatus(userId, req.body, req.user);

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403,
                    'BAD_REQUEST': 400
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'user_status_changed',
                'user',
                userId,
                {
                    old_status: result.oldStatus,
                    new_status: result.newStatus,
                    reason: req.body.reason,
                    target_user: result.user.username
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

    /**
     * 刪除用戶
     */
    async deleteUser(req, res) {
        try {
            const userId = parseInt(req.params.id);

            const result = await userService.deleteUser(userId, req.user);

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403,
                    'CONFLICT': 409
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'user_deleted',
                'user',
                userId,
                { target_user: result.user.username },
                req.ip
            );

            res.json({
                success: true,
                message: '用戶刪除成功'
            });

        } catch (error) {
            console.error('刪除用戶失敗:', error);
            res.status(500).json({
                success: false,
                message: '刪除用戶失敗'
            });
        }
    }

    /**
     * 軟刪除用戶
     */
    async softDeleteUser(req, res) {
        try {
            const userId = parseInt(req.params.id);

            const result = await userService.softDeleteUser(userId, req.user);

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403,
                    'BAD_REQUEST': 400
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'user_marked_for_deletion',
                'user',
                userId,
                { target_user: result.user.username },
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

    /**
     * 重置密碼
     */
    async resetPassword(req, res) {
        try {
            const userId = parseInt(req.params.id);
            const { new_password } = req.body;

            const result = await userService.resetUserPassword(userId, new_password, req.user);

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'password_reset',
                'user',
                userId,
                { target_user: result.user.username },
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

    /**
     * 批量導入用戶
     */
    async importUsers(req, res) {
        try {
            const { users } = req.body;

            if (!Array.isArray(users) || users.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '請提供有效的用戶數據'
                });
            }

            const result = await userService.importUsers(users, req.user);

            if (!result.success) {
                return res.status(403).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'users_imported',
                'user',
                null,
                {
                    total: users.length,
                    success: result.successCount,
                    failures: result.failureCount
                },
                req.ip
            );

            res.json({
                success: true,
                message: `導入完成：成功 ${result.successCount} 個，失敗 ${result.failureCount} 個`,
                data: {
                    successCount: result.successCount,
                    failureCount: result.failureCount,
                    errors: result.errors
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

    // ============================================================================
    // 輔助方法 (Private)
    // ============================================================================

    /**
     * 判斷是否為 HTML 請求
     * @private
     */
    _isHtmlRequest(req) {
        return req.headers['x-requested-with'] === 'XMLHttpRequest';
    }

    /**
     * 取得角色徽章 HTML
     * @private
     */
    _getRoleBadge(role) {
        const roleMap = {
            'super_admin': '<span class="badge badge-danger">超級管理員</span>',
            'project_manager': '<span class="badge badge-warning">專案管理員</span>',
            'vendor': '<span class="badge badge-info">廠商</span>',
            'project_user': '<span class="badge badge-primary">一般人員</span>'
        };
        return roleMap[role] || '<span class="badge badge-secondary">未知</span>';
    }

    /**
     * 取得狀態徽章 HTML
     * @private
     */
    _getStatusBadge(status) {
        const statusMap = {
            'active': '<span class="badge badge-success">啟用</span>',
            'inactive': '<span class="badge badge-secondary">停用</span>',
            'suspended': '<span class="badge badge-warning">暫停</span>',
            'disabled': '<span class="badge badge-danger">禁用</span>',
            'pending_deletion': '<span class="badge badge-dark">待刪除</span>'
        };
        return statusMap[status] || '<span class="badge badge-secondary">未知</span>';
    }

    /**
     * 渲染用戶列表表格
     * @private
     */
    _renderUsersTable(users, currentUser) {
        if (users.length === 0) {
            return vh.emptyTableRow('找不到符合的用戶', 7, '🔍', '請嘗試調整搜尋條件');
        }

        return users.map(user => {
            const roleBadge = this._getRoleBadge(user.role);
            const statusBadge = this._getStatusBadge(user.status);
            const createdAt = new Date(user.created_at).toLocaleString('zh-TW');
            const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString('zh-TW') : '-';

            const actions = this._renderUserActions(user, currentUser);

            return `
                <tr>
                    <td>
                        <div class="user-info">
                            <strong>${vh.escapeHtml(user.full_name)}</strong>
                            <div class="user-username">${vh.escapeHtml(user.username)}</div>
                        </div>
                    </td>
                    <td>${vh.escapeHtml(user.email)}</td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td>${lastLogin}</td>
                    <td>${createdAt}</td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * 渲染用戶操作按鈕
     * @private
     */
    _renderUserActions(user, currentUser) {
        const canManage = (currentUser.role === 'super_admin') ||
            (currentUser.role === 'project_manager' && user.role !== 'super_admin');

        if (canManage && user.id !== currentUser.id) {
            return `
                <div class="user-actions">
                    <button class="btn btn-sm btn-primary" onclick="viewUser(${user.id})" title="查看詳情">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="editUser(${user.id})" title="編輯">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${user.status === 'active'
                    ? `<button class="btn btn-sm btn-warning" onclick="toggleUserStatus(${user.id}, 'disabled')" title="禁用">
                               <i class="fas fa-ban"></i>
                           </button>`
                    : `<button class="btn btn-sm btn-info" onclick="toggleUserStatus(${user.id}, 'active')" title="啟用">
                               <i class="fas fa-check"></i>
                           </button>`
                }
                    ${currentUser.role === 'super_admin'
                    ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})" title="刪除">
                               <i class="fas fa-trash"></i>
                           </button>`
                    : ''
                }
                </div>
            `;
        }

        if (user.id === currentUser.id) {
            return `
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

        return '';
    }

    /**
     * 渲染分頁控制
     * @private
     */
    _renderPagination(pagination, currentPage) {
        const { total, pages } = pagination;

        let html = '<div class="pagination-info">';
        html += `<span>共 ${total} 位用戶，第 ${currentPage} 頁 / 共 ${pages} 頁</span>`;
        html += '</div>';

        if (pages > 1) {
            html += '<div class="pagination-controls">';

            if (currentPage > 1) {
                html += `<button class="btn btn-sm btn-outline-primary" onclick="loadUsers({page: ${currentPage - 1}})">上一頁</button>`;
            }

            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(pages, currentPage + 2);

            for (let i = startPage; i <= endPage; i++) {
                const activeClass = i === currentPage ? 'btn-primary' : 'btn-outline-primary';
                html += `<button class="btn btn-sm ${activeClass}" onclick="loadUsers({page: ${i}})">${i}</button>`;
            }

            if (currentPage < pages) {
                html += `<button class="btn btn-sm btn-outline-primary" onclick="loadUsers({page: ${currentPage + 1}})">下一頁</button>`;
            }

            html += '</div>';
        }

        return html;
    }
}

module.exports = autoBind(new UserController());
