/**
 * 用戶管理路由
 */
const express = require('express');
const router = express.Router();

// 用戶管理頁面
router.get('/', (req, res) => {
    res.render('admin/users', {
        layout: 'admin',
        pageTitle: '用戶管理',
        currentPage: 'users',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '用戶管理' }
        ]
    });
});

// 搜尋用戶 API
router.get('/search', async (req, res) => {
    try {
        const { search, role, status } = req.query;
        const database = require('../../config/database');

        let searchQuery = `
            SELECT * FROM users 
            WHERE 1=1
        `;
        let queryParams = [];

        if (search && search.trim()) {
            searchQuery += ` AND (username LIKE ? OR full_name LIKE ? OR email LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        if (role && role.trim()) {
            searchQuery += ` AND role = ?`;
            queryParams.push(role);
        }

        if (status && status.trim()) {
            searchQuery += ` AND status = ?`;
            queryParams.push(status);
        }

        searchQuery += ` ORDER BY created_at DESC LIMIT 50`;

        const users = await database.query(searchQuery, queryParams);

        // 生成 HTML 表格行
        let html = '';
        if (users.length === 0) {
            html = '<tr><td colspan="8" class="text-center">無符合條件的用戶</td></tr>';
        } else {
            users.forEach(user => {
                const avatar = user.full_name ? user.full_name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase();
                const statusClass = user.status === 'active' ? 'active' : user.status === 'disabled' ? 'inactive' : 'pending';
                const statusText = user.status === 'active' ? '啟用' : user.status === 'disabled' ? '停用' : '待啟用';
                const roleText = getRoleText(user.role);
                const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString('zh-TW') : '從未登入';

                html += `
                <tr>
                    <td>
                        <div class="user-avatar">${avatar}</div>
                    </td>
                    <td>
                        <div class="user-info">
                            <div class="user-name">${user.full_name || '未設定'}</div>
                            <div class="user-username">@${user.username}</div>
                        </div>
                    </td>
                    <td>${user.full_name || '未設定'}</td>
                    <td>${user.email}</td>
                    <td><span class="user-role ${user.role}">${roleText}</span></td>
                    <td><span class="user-status ${statusClass}">
                        <i class="fas fa-circle"></i> ${statusText}
                    </span></td>
                    <td class="last-login">${lastLogin}</td>
                    <td>
                        <div class="user-actions">
                            <button class="btn btn-sm btn-outline-primary" onclick="viewUser(${user.id})" title="查看詳情">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-secondary" onclick="editUser(${user.id})" title="編輯">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-warning" onclick="resetPassword(${user.id})" title="重設密碼">
                                <i class="fas fa-key"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${user.id})" title="刪除">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
                `;
            });
        }

        const responses = require('../../utils/responses');
        responses.html(res, html);
    } catch (error) {
        console.error('Search users error:', error);
        const responses = require('../../utils/responses');
        responses.html(res, '<tr><td colspan="8" class="text-center text-danger">搜尋失敗</td></tr>');
    }
});

// 新增用戶模態框
router.get('/new', async (req, res) => {
    const responses = require('../../utils/responses');
    const modalContent = `
    <div class="modal active">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h4>新增用戶</h4>
                    <button type="button" class="close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="new-user-form">
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label for="username">用戶名稱 <span class="text-danger">*</span></label>
                                <input type="text" id="username" name="username" class="form-control" required>
                            </div>
                            <div class="form-group col-md-6">
                                <label for="email">電子郵件 <span class="text-danger">*</span></label>
                                <input type="email" id="email" name="email" class="form-control" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label for="full_name">真實姓名</label>
                                <input type="text" id="full_name" name="full_name" class="form-control">
                            </div>
                            <div class="form-group col-md-6">
                                <label for="phone">電話號碼</label>
                                <input type="tel" id="phone" name="phone" class="form-control">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label for="password">密碼 <span class="text-danger">*</span></label>
                                <input type="password" id="password" name="password" class="form-control" required>
                                <small class="form-text text-muted">密碼至少8個字符</small>
                            </div>
                            <div class="form-group col-md-6">
                                <label for="confirm_password">確認密碼 <span class="text-danger">*</span></label>
                                <input type="password" id="confirm_password" name="confirm_password" class="form-control" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label for="role">角色 <span class="text-danger">*</span></label>
                                <select id="role" name="role" class="form-control" required>
                                    <option value="">請選擇角色</option>
                                    <option value="project_user">一般用戶</option>
                                    <option value="vendor">廠商用戶</option>
                                    <option value="project_manager">專案管理員</option>
                                    <option value="super_admin">超級管理員</option>
                                </select>
                            </div>
                            <div class="form-group col-md-6">
                                <label for="status">狀態</label>
                                <select id="status" name="status" class="form-control">
                                    <option value="active">啟用</option>
                                    <option value="inactive">停用</option>
                                    <option value="pending">待啟用</option>
                                </select>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                    <button type="button" class="btn btn-primary" onclick="submitNewUser()">
                        <i class="fas fa-user-plus"></i> 建立用戶
                    </button>
                </div>
            </div>
        </div>
    </div>
    <script>
        function closeModal() {
            document.getElementById('modal-container').innerHTML = '';
            document.body.classList.remove('modal-open');
        }
        
        function submitNewUser() {
            const form = document.getElementById('new-user-form');
            const formData = new FormData(form);
            const data = {};
            
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            
            // 驗證必填欄位
            if (!data.username || !data.email || !data.password || !data.role) {
                showAlert('請填寫所有必填欄位', 'danger');
                return;
            }
            
            // 驗證密碼一致性
            if (data.password !== data.confirm_password) {
                showAlert('密碼與確認密碼不一致', 'danger');
                return;
            }
            
            delete data.confirm_password; // 移除確認密碼欄位
            
            $.ajax({
                url: '/api/admin/users',
                method: 'POST',
                data: data,
                success: function(response) {
                    if (response.success) {
                        showAlert('用戶建立成功', 'success');
                        closeModal();
                        if (window.loadUsers) {
                            window.loadUsers();
                        }
                        if (window.loadUserStats) {
                            window.loadUserStats();
                        }
                    } else {
                        showAlert(response.message || '建立失敗', 'danger');
                    }
                },
                error: function() {
                    showAlert('建立用戶時發生錯誤', 'danger');
                }
            });
        }
        
        function showAlert(message, type) {
            if (typeof showNotification === 'function') {
                showNotification(message, type === 'danger' ? 'error' : type);
            } else {
                alert(message);
            }
        }
    </script>
    `;

    responses.html(res, modalContent);
});

// 用戶分頁 API
router.get('/pagination', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const database = require('../../config/database');

        const countQuery = 'SELECT COUNT(*) as count FROM users';
        const totalResult = await database.get(countQuery);
        const total = totalResult?.count || 0;
        const pages = Math.ceil(total / limit);

        let paginationHtml = '<div class="pagination-info">';
        paginationHtml += `<span>共 ${total} 位用戶，第 ${page} 頁 / 共 ${pages} 頁</span>`;
        paginationHtml += '</div>';

        if (pages > 1) {
            paginationHtml += '<div class="pagination-buttons">';

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

        const responses = require('../../utils/responses');
        responses.html(res, paginationHtml);
    } catch (error) {
        console.error('Get users pagination error:', error);
        const responses = require('../../utils/responses');
        responses.html(res, '<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
    }
});

// 輔助函數
function getRoleText(role) {
    const roleMap = {
        'super_admin': '超級管理員',
        'project_manager': '專案管理員',
        'vendor': '廠商用戶',
        'project_user': '一般用戶'
    };
    return roleMap[role] || role;
}

// 新增用戶模態框
router.get('/new', async (req, res) => {
    try {
        const modalContent = `
        <div class="modal active">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4>新增用戶</h4>
                        <button type="button" class="close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="new-user-form">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="username">用戶名稱 *</label>
                                        <input type="text" id="username" name="username" class="form-control" required>
                                        <small class="form-text text-muted">僅能包含字母、數字和下劃線</small>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="email">電子郵件 *</label>
                                        <input type="email" id="email" name="email" class="form-control" required>
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="full_name">真實姓名 *</label>
                                        <input type="text" id="full_name" name="full_name" class="form-control" required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="phone">聯絡電話</label>
                                        <input type="tel" id="phone" name="phone" class="form-control">
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="role">角色 *</label>
                                        <select id="role" name="role" class="form-control" required>
                                            <option value="">請選擇角色</option>
                                            <option value="project_user">一般用戶</option>
                                            <option value="vendor">廠商用戶</option>
                                            <option value="project_manager">專案管理員</option>
                                            <option value="super_admin">超級管理員</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="status">狀態 *</label>
                                        <select id="status" name="status" class="form-control" required>
                                            <option value="active">啟用</option>
                                            <option value="inactive">停用</option>
                                            <option value="pending">待啟用</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="password">密碼 *</label>
                                        <input type="password" id="password" name="password" class="form-control" minlength="8" required>
                                        <small class="form-text text-muted">至少8個字符</small>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="confirm_password">確認密碼 *</label>
                                        <input type="password" id="confirm_password" name="confirm_password" class="form-control" required>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                        <button type="button" class="btn btn-primary" onclick="saveNewUser()">儲存用戶</button>
                    </div>
                </div>
            </div>
        </div>
        <script>
            function saveNewUser() {
                const form = $('#new-user-form');
                const formData = {
                    username: $('#username').val(),
                    email: $('#email').val(),
                    full_name: $('#full_name').val(),
                    phone: $('#phone').val(),
                    role: $('#role').val(),
                    status: $('#status').val(),
                    password: $('#password').val(),
                    confirm_password: $('#confirm_password').val()
                };

                // 驗證密碼
                if (formData.password !== formData.confirm_password) {
                    alert('密碼與確認密碼不一致');
                    return;
                }

                $.ajax({
                    url: '/api/admin/users',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    data: JSON.stringify(formData),
                    success: function(response) {
                        if (response.success) {
                            alert('用戶新增成功');
                            closeModal();
                            if (typeof loadUsers === 'function') loadUsers();
                            if (typeof loadUserStats === 'function') loadUserStats();
                        } else {
                            alert('新增失敗：' + response.message);
                        }
                    },
                    error: function(xhr) {
                        alert('新增失敗：' + (xhr.responseJSON?.message || '系統錯誤'));
                    }
                });
            }
        </script>
        `;

        return responses.html(res, modalContent);
    } catch (error) {
        console.error('載入新增用戶模態框失敗:', error);
        return responses.html(res, '<div class="alert alert-danger">載入失敗</div>');
    }
});

// 查看用戶詳情模態框
router.get('/:id/view', async (req, res) => {
    try {
        const userId = req.params.id;
        const database = require('../../config/database');

        const user = await database.get('SELECT * FROM users WHERE id = ?', [userId]);

        if (!user) {
            return responses.html(res, '<div class="alert alert-danger">用戶不存在</div>');
        }

        const roleText = {
            'super_admin': '超級管理員',
            'project_manager': '專案管理員',
            'vendor': '廠商用戶',
            'project_user': '一般用戶'
        }[user.role] || user.role;

        const statusText = {
            'active': '啟用',
            'inactive': '停用',
            'pending': '待啟用'
        }[user.status] || user.status;

        const modalContent = `
        <div class="modal active">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4>用戶詳情 - ${user.full_name || user.username}</h4>
                        <button type="button" class="close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="info-group">
                                    <label>用戶名稱</label>
                                    <p>${user.username}</p>
                                </div>
                                <div class="info-group">
                                    <label>真實姓名</label>
                                    <p>${user.full_name || '未設定'}</p>
                                </div>
                                <div class="info-group">
                                    <label>電子郵件</label>
                                    <p>${user.email}</p>
                                </div>
                                <div class="info-group">
                                    <label>聯絡電話</label>
                                    <p>${user.phone || '未設定'}</p>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-group">
                                    <label>角色</label>
                                    <p><span class="user-role ${user.role}">${roleText}</span></p>
                                </div>
                                <div class="info-group">
                                    <label>狀態</label>
                                    <p><span class="user-status ${user.status}">${statusText}</span></p>
                                </div>
                                <div class="info-group">
                                    <label>創建時間</label>
                                    <p>${new Date(user.created_at).toLocaleString('zh-TW')}</p>
                                </div>
                                <div class="info-group">
                                    <label>最後登入</label>
                                    <p>${user.last_login ? new Date(user.last_login).toLocaleString('zh-TW') : '從未登入'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">關閉</button>
                        <button type="button" class="btn btn-primary" onclick="closeModal(); editUser(${user.id})">編輯用戶</button>
                    </div>
                </div>
            </div>
        </div>
        <style>
            .info-group {
                margin-bottom: 1rem;
            }
            .info-group label {
                font-weight: 600;
                color: var(--gray-700);
                display: block;
                margin-bottom: 0.25rem;
            }
            .info-group p {
                margin: 0;
                color: var(--gray-900);
            }
        </style>
        `;

        return responses.html(res, modalContent);
    } catch (error) {
        console.error('載入用戶詳情失敗:', error);
        return responses.html(res, '<div class="alert alert-danger">載入失敗</div>');
    }
});

// 編輯用戶模態框
router.get('/:id/edit', async (req, res) => {
    try {
        const userId = req.params.id;
        const database = require('../../config/database');

        const user = await database.get('SELECT * FROM users WHERE id = ?', [userId]);

        if (!user) {
            return responses.html(res, '<div class="alert alert-danger">用戶不存在</div>');
        }

        const modalContent = `
        <div class="modal active">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4>編輯用戶 - ${user.full_name || user.username}</h4>
                        <button type="button" class="close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="edit-user-form">
                            <input type="hidden" id="user_id" value="${user.id}">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="edit_username">用戶名稱</label>
                                        <input type="text" id="edit_username" name="username" class="form-control" value="${user.username}" readonly>
                                        <small class="form-text text-muted">用戶名稱無法修改</small>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="edit_email">電子郵件 *</label>
                                        <input type="email" id="edit_email" name="email" class="form-control" value="${user.email}" required>
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="edit_full_name">真實姓名 *</label>
                                        <input type="text" id="edit_full_name" name="full_name" class="form-control" value="${user.full_name || ''}" required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="edit_phone">聯絡電話</label>
                                        <input type="tel" id="edit_phone" name="phone" class="form-control" value="${user.phone || ''}">
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="edit_role">角色 *</label>
                                        <select id="edit_role" name="role" class="form-control" required>
                                            <option value="project_user" ${user.role === 'project_user' ? 'selected' : ''}>一般用戶</option>
                                            <option value="vendor" ${user.role === 'vendor' ? 'selected' : ''}>廠商用戶</option>
                                            <option value="project_manager" ${user.role === 'project_manager' ? 'selected' : ''}>專案管理員</option>
                                            <option value="super_admin" ${user.role === 'super_admin' ? 'selected' : ''}>超級管理員</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="edit_status">狀態 *</label>
                                        <select id="edit_status" name="status" class="form-control" required>
                                            <option value="active" ${user.status === 'active' ? 'selected' : ''}>啟用</option>
                                            <option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>停用</option>
                                            <option value="pending" ${user.status === 'pending' ? 'selected' : ''}>待啟用</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                        <button type="button" class="btn btn-primary" onclick="saveEditUser()">儲存變更</button>
                    </div>
                </div>
            </div>
        </div>
        <script>
            function saveEditUser() {
                const userId = $('#user_id').val();
                const formData = {
                    email: $('#edit_email').val(),
                    full_name: $('#edit_full_name').val(),
                    phone: $('#edit_phone').val(),
                    role: $('#edit_role').val(),
                    status: $('#edit_status').val()
                };

                $.ajax({
                    url: '/api/admin/users/' + userId,
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    data: JSON.stringify(formData),
                    success: function(response) {
                        if (response.success) {
                            alert('用戶更新成功');
                            closeModal();
                            if (typeof loadUsers === 'function') loadUsers();
                            if (typeof loadUserStats === 'function') loadUserStats();
                        } else {
                            alert('更新失敗：' + response.message);
                        }
                    },
                    error: function(xhr) {
                        alert('更新失敗：' + (xhr.responseJSON?.message || '系統錯誤'));
                    }
                });
            }
        </script>
        `;

        return responses.html(res, modalContent);
    } catch (error) {
        console.error('載入編輯用戶模態框失敗:', error);
        return responses.html(res, '<div class="alert alert-danger">載入失敗</div>');
    }
});

// 编辑用户模态框
router.get('/:id/edit', async (req, res) => {
    try {
        const userId = req.params.id;
        const database = require('../../config/database');

        const user = await database.get(`
            SELECT * FROM users WHERE id = ?
        `, [userId]);

        if (!user) {
            return res.status(404).send(`
                <div class="modal show" style="display: flex; align-items: center; justify-content: center;">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h4 class="modal-title">错误</h4>
                                <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div class="modal-body">
                                <p>找不到指定的用户</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        }

        const html = `
            <div class="modal show" style="display: flex; align-items: center; justify-content: center;">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h4 class="modal-title">编辑用户</h4>
                            <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="edit-user-form">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="username">用户名 <span class="text-danger">*</span></label>
                                            <input type="text" id="username" name="username" class="form-control" 
                                                   value="${user.username || ''}" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="full_name">全名 <span class="text-danger">*</span></label>
                                            <input type="text" id="full_name" name="full_name" class="form-control" 
                                                   value="${user.full_name || ''}" required>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="email">电子邮件 <span class="text-danger">*</span></label>
                                    <input type="email" id="email" name="email" class="form-control" 
                                           value="${user.email || ''}" required>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="role">角色 <span class="text-danger">*</span></label>
                                            <select id="role" name="role" class="form-control" required>
                                                <option value="">请选择角色</option>
                                                <option value="super_admin" ${user.role === 'super_admin' ? 'selected' : ''}>超级管理员</option>
                                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>管理员</option>
                                                <option value="project_manager" ${user.role === 'project_manager' ? 'selected' : ''}>项目经理</option>
                                                <option value="vendor" ${user.role === 'vendor' ? 'selected' : ''}>供应商</option>
                                                <option value="user" ${user.role === 'user' ? 'selected' : ''}>普通用户</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="status">状态</label>
                                            <select id="status" name="status" class="form-control">
                                                <option value="active" ${user.status === 'active' ? 'selected' : ''}>启用</option>
                                                <option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>禁用</option>
                                                <option value="suspended" ${user.status === 'suspended' ? 'selected' : ''}>暂停</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="password">新密码 <small>(留空则不修改)</small></label>
                                    <input type="password" id="password" name="password" class="form-control" 
                                           placeholder="输入新密码...">
                                </div>
                                
                                <div class="form-group">
                                    <label for="confirm_password">确认密码</label>
                                    <input type="password" id="confirm_password" name="confirm_password" class="form-control" 
                                           placeholder="再次输入新密码...">
                                </div>
                                

                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                            <button type="button" class="btn btn-primary" onclick="submitEditUser(${user.id})">
                                <i class="fas fa-save"></i> 保存修改
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                function submitEditUser(id) {
                    const form = document.getElementById('edit-user-form');
                    const formData = new FormData(form);
                    const data = {};
                    
                    for (let [key, value] of formData.entries()) {
                        data[key] = value;
                    }
                    
                    // 验证密码
                    if (data.password && data.password !== data.confirm_password) {
                        showNotification('密码和确认密码不匹配', 'error');
                        return;
                    }
                    
                    // 如果密码为空，删除密码字段
                    if (!data.password) {
                        delete data.password;
                        delete data.confirm_password;
                    }
                    
                    $.ajax({
                        url: '/api/admin/users/' + id,
                        method: 'PUT',
                        data: JSON.stringify(data),
                        contentType: 'application/json',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        success: function(response) {
                            if (response.success) {
                                closeModal();
                                showNotification('用户已更新', 'success');
                                loadUsers();
                                loadUserStats();
                            } else {
                                showNotification(response.message || '更新失败', 'error');
                            }
                        },
                        error: function(xhr) {
                            console.error('更新用户失败:', xhr);
                            showNotification('更新用户失败', 'error');
                        }
                    });
                }
                
                function closeModal() {
                    document.getElementById('modal-container').innerHTML = '';
                    $('body').removeClass('modal-open');
                }
            </script>
        `;

        const responses = require('../../utils/responses');
        responses.html(res, html);
    } catch (error) {
        console.error('获取编辑表单失败:', error);
        res.status(500).send(`
            <div class="modal show" style="display: flex; align-items: center; justify-content: center;">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h4 class="modal-title">错误</h4>
                            <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <p>加载编辑表单失败</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
    }
});

module.exports = router;