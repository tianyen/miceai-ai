/**
 * Users Management Page Scripts
 * 用戶管理頁面專用 JavaScript
 * 使用安全 DOM 操作避免 XSS 風險
 */

// ========== 全域變數 ==========
var searchTimer;

// ========== 初始化 ==========
$(document).ready(function () {
    // 載入初始數據
    loadUsers();
    loadUserStats();

    // 搜尋功能 - 使用防抖動
    $('#search-input').on('keyup', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
            searchUsers();
        }, 300);
    });

    $('#search-btn').on('click', searchUsers);

    // 篩選器變更
    $('#role-filter, #status-filter').on('change', searchUsers);

    // 操作按鈕
    $('#refresh-btn').on('click', function () {
        loadUsers();
        loadUserStats();
    });

    $('#new-user-btn').on('click', function () {
        $.ajax({
            url: '/admin/users/new',
            method: 'GET',
            success: function (html) {
                $('#modal-container').html(html);
                var modal = $('#modal-container .modal')[0];
                if (modal) {
                    $(modal).addClass('show');
                    $('body').addClass('modal-open');
                }
            },
            error: function (xhr) {
                console.error('載入新增用戶表單失敗:', xhr);
                alert('載入新增用戶表單失敗');
            }
        });
    });

    $('#import-users-btn').on('click', function () {
        alert('批量匯入功能開發中...');
    });

    // 表格排序
    $('th[data-sortable]').on('click', function () {
        var column = $(this).data('sortable');
        var currentSort = $(this).data('sort-direction') || 'asc';
        var newSort = currentSort === 'asc' ? 'desc' : 'asc';

        $('th[data-sortable]').removeClass('sort-asc sort-desc');
        $(this).addClass('sort-' + newSort).data('sort-direction', newSort);

        loadUsers({ sort: column, order: newSort });
    });
});

// ========== 數據載入函數 ==========

/**
 * 載入用戶列表
 */
function loadUsers(params) {
    params = params || {};

    var searchData = {
        search: $('#search-input').val(),
        role: $('#role-filter').val(),
        status: $('#status-filter').val(),
        page: params.page || 1,
        limit: params.limit || 20,
        sort: params.sort || 'created_at',
        order: params.order || 'desc'
    };

    $.ajax({
        url: '/api/admin/users',
        method: 'GET',
        data: searchData,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function (response) {
            if (response.success) {
                renderUsersTable(response.data.users);
                renderPagination(response.data.pagination);
            }
        },
        error: function () {
            showTableError('載入失敗');
        }
    });
}

/**
 * 搜尋用戶
 */
function searchUsers() {
    var searchData = {
        search: $('#search-input').val(),
        role: $('#role-filter').val(),
        status: $('#status-filter').val()
    };

    $.ajax({
        url: '/admin/users/search',
        method: 'GET',
        data: searchData,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        },
        success: function (html) {
            $('#users-table-body').html(html);
        },
        error: function () {
            showTableError('搜尋失敗');
        }
    });
}

/**
 * 載入統計數據
 */
function loadUserStats() {
    $.ajax({
        url: '/api/admin/users/stats',
        method: 'GET',
        success: function (response) {
            if (response.success) {
                var data = response.data;
                $('#total-users').text(data.totalUsers || 0);
                $('#active-users').text(data.activeUsers || 0);
                $('#inactive-users').text(data.disabledUsers || 0);
            }
        },
        error: function () {
            console.error('載入統計數據失敗');
        }
    });
}

// ========== UI 渲染函數（安全 DOM 操作）==========

/**
 * 顯示表格錯誤
 */
function showTableError(message) {
    var tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.textContent = '';
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.setAttribute('colspan', '9');
    td.className = 'text-center text-danger';
    td.textContent = message;
    tr.appendChild(td);
    tbody.appendChild(tr);
}

/**
 * 渲染用戶表格 (使用安全 DOM 操作)
 */
function renderUsersTable(users) {
    var tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.textContent = '';

    if (!users || users.length === 0) {
        var emptyRow = document.createElement('tr');
        var emptyCell = document.createElement('td');
        emptyCell.setAttribute('colspan', '9');
        emptyCell.className = 'text-center text-muted';
        emptyCell.textContent = '暫無用戶數據';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        return;
    }

    users.forEach(function (user) {
        var row = createUserRow(user);
        tbody.appendChild(row);
    });
}

/**
 * 創建用戶行 (安全 DOM 操作)
 */
function createUserRow(user) {
    var currentUser = window.currentUser || {};
    var row = document.createElement('tr');

    // Avatar cell
    var avatarCell = document.createElement('td');
    var avatarDiv = document.createElement('div');
    avatarDiv.className = 'user-avatar';
    avatarDiv.textContent = user.full_name ? user.full_name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase();
    avatarCell.appendChild(avatarDiv);
    row.appendChild(avatarCell);

    // ID cell
    var idCell = document.createElement('td');
    var idBadge = document.createElement('span');
    idBadge.className = 'badge badge-secondary';
    idBadge.textContent = '#' + user.id;
    idCell.appendChild(idBadge);
    row.appendChild(idCell);

    // Username cell
    var usernameCell = document.createElement('td');
    var userInfoDiv = document.createElement('div');
    userInfoDiv.className = 'user-info';
    var nameDiv = document.createElement('div');
    nameDiv.className = 'user-name';
    nameDiv.textContent = user.full_name || '未設定';
    var usernameDiv = document.createElement('div');
    usernameDiv.className = 'user-username';
    usernameDiv.textContent = '@' + user.username;
    userInfoDiv.appendChild(nameDiv);
    userInfoDiv.appendChild(usernameDiv);
    usernameCell.appendChild(userInfoDiv);
    row.appendChild(usernameCell);

    // Full name cell
    var fullNameCell = document.createElement('td');
    fullNameCell.textContent = user.full_name || '未設定';
    row.appendChild(fullNameCell);

    // Email cell
    var emailCell = document.createElement('td');
    emailCell.textContent = user.email;
    row.appendChild(emailCell);

    // Role cell
    var roleCell = document.createElement('td');
    var roleSpan = document.createElement('span');
    roleSpan.className = 'user-role ' + user.role;
    roleSpan.textContent = getRoleText(user.role);
    roleCell.appendChild(roleSpan);
    row.appendChild(roleCell);

    // Status cell
    var statusCell = document.createElement('td');
    var statusClass = user.status === 'active' ? 'active' : user.status === 'disabled' ? 'inactive' : 'pending';
    var statusText = user.status === 'active' ? '啟用' : user.status === 'disabled' ? '停用' : '待啟用';
    var statusSpan = document.createElement('span');
    statusSpan.className = 'user-status ' + statusClass;
    var statusIcon = document.createElement('i');
    statusIcon.className = 'fas fa-circle';
    statusSpan.appendChild(statusIcon);
    statusSpan.appendChild(document.createTextNode(' ' + statusText));
    statusCell.appendChild(statusSpan);
    row.appendChild(statusCell);

    // Last login cell
    var lastLoginCell = document.createElement('td');
    lastLoginCell.className = 'last-login';
    lastLoginCell.textContent = user.last_login ? new Date(user.last_login).toLocaleString('zh-TW') : '從未登入';
    row.appendChild(lastLoginCell);

    // Actions cell
    var actionsCell = document.createElement('td');
    var actionsDiv = document.createElement('div');
    actionsDiv.className = 'user-actions';

    // View button
    var viewBtn = createActionButton('btn-outline-primary', 'fa-eye', '查看詳情', function () {
        viewUser(user.id);
    });
    actionsDiv.appendChild(viewBtn);

    // Edit button (based on permissions)
    if (canEditUser(currentUser, user)) {
        var editBtn = createActionButton('btn-outline-secondary', 'fa-edit', '編輯', function () {
            editUser(user.id);
        });
        actionsDiv.appendChild(editBtn);
    }

    // Status toggle button
    if (canToggleUserStatus(currentUser, user)) {
        if (user.status === 'active') {
            var deactivateBtn = createActionButton('btn-outline-warning', 'fa-user-slash', '停用用戶', function () {
                toggleUserStatus(user.id, 'inactive');
            });
            actionsDiv.appendChild(deactivateBtn);
        } else {
            var activateBtn = createActionButton('btn-outline-success', 'fa-user-check', '啟用用戶', function () {
                toggleUserStatus(user.id, 'active');
            });
            actionsDiv.appendChild(activateBtn);
        }
    }

    // Password reset button
    if (canResetPassword(currentUser, user)) {
        var resetBtn = createActionButton('btn-outline-warning', 'fa-key', '重設密碼', function () {
            resetPassword(user.id);
        });
        actionsDiv.appendChild(resetBtn);
    }

    // Delete button
    if (canDeleteUser(currentUser, user)) {
        var deleteBtn = createActionButton('btn-outline-danger', 'fa-trash', '刪除', function () {
            deleteUser(user.id);
        });
        actionsDiv.appendChild(deleteBtn);
    }

    actionsCell.appendChild(actionsDiv);
    row.appendChild(actionsCell);

    return row;
}

/**
 * 創建操作按鈕
 */
function createActionButton(btnClass, iconClass, title, onClick) {
    var btn = document.createElement('button');
    btn.className = 'btn btn-sm ' + btnClass;
    btn.title = title;
    btn.addEventListener('click', onClick);
    var icon = document.createElement('i');
    icon.className = 'fas ' + iconClass;
    btn.appendChild(icon);
    return btn;
}

/**
 * 渲染分頁 (使用安全 DOM 操作)
 */
function renderPagination(pagination) {
    var container = document.getElementById('pagination-container');
    if (!container || !pagination) return;

    container.textContent = '';

    // Pagination info
    var infoDiv = document.createElement('div');
    infoDiv.className = 'pagination-info';
    var start = ((pagination.page - 1) * pagination.limit) + 1;
    var end = Math.min(pagination.page * pagination.limit, pagination.total);
    infoDiv.textContent = '顯示 ' + start + ' - ' + end + ' 共 ' + pagination.total + ' 筆記錄';
    container.appendChild(infoDiv);

    // Pagination controls
    var controlsDiv = document.createElement('div');
    controlsDiv.className = 'pagination-controls';

    // Previous button
    if (pagination.page > 1) {
        var prevBtn = document.createElement('button');
        prevBtn.className = 'btn btn-sm btn-outline-primary';
        prevBtn.textContent = '上一頁';
        prevBtn.addEventListener('click', function () {
            loadUsers({ page: pagination.page - 1 });
        });
        controlsDiv.appendChild(prevBtn);
    }

    // Page buttons
    var startPage = Math.max(1, pagination.page - 2);
    var endPage = Math.min(pagination.pages, pagination.page + 2);

    for (var i = startPage; i <= endPage; i++) {
        (function (pageNum) {
            var pageBtn = document.createElement('button');
            pageBtn.className = 'btn btn-sm ' + (pageNum === pagination.page ? 'btn-primary' : 'btn-outline-primary');
            pageBtn.textContent = pageNum;
            pageBtn.addEventListener('click', function () {
                loadUsers({ page: pageNum });
            });
            controlsDiv.appendChild(pageBtn);
        })(i);
    }

    // Next button
    if (pagination.page < pagination.pages) {
        var nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-sm btn-outline-primary';
        nextBtn.textContent = '下一頁';
        nextBtn.addEventListener('click', function () {
            loadUsers({ page: pagination.page + 1 });
        });
        controlsDiv.appendChild(nextBtn);
    }

    container.appendChild(controlsDiv);
}

// ========== 輔助函數 ==========

/**
 * 獲取角色文字
 */
function getRoleText(role) {
    var roleMap = {
        'super_admin': '超級管理員',
        'project_manager': '專案管理員',
        'vendor': '廠商用戶',
        'project_user': '一般用戶'
    };
    return roleMap[role] || role;
}

// ========== 權限檢查函數 ==========

function canEditUser(currentUser, targetUser) {
    if (currentUser.role === 'super_admin') return true;
    if (currentUser.role === 'project_manager' && targetUser.role === 'project_user') return true;
    return false;
}

function canToggleUserStatus(currentUser, targetUser) {
    if (currentUser.id === targetUser.id) return false;
    if (currentUser.role === 'super_admin') return true;
    if (currentUser.role === 'project_manager' && targetUser.role === 'project_user') return true;
    return false;
}

function canResetPassword(currentUser, targetUser) {
    if (currentUser.id === targetUser.id) return false;
    if (currentUser.role === 'super_admin') return true;
    if (currentUser.role === 'project_manager' && targetUser.role === 'project_user') return true;
    return false;
}

function canDeleteUser(currentUser, targetUser) {
    if (currentUser.id === targetUser.id) return false;
    if (currentUser.role === 'super_admin') return true;
    if (currentUser.role === 'project_manager' && targetUser.role === 'project_user') return true;
    return false;
}

// ========== 用戶操作函數 ==========

function viewUser(id) {
    $.ajax({
        url: '/admin/users/' + id + '/view',
        method: 'GET',
        success: function (html) {
            $('#modal-container').html(html);
            var modal = $('#modal-container .modal')[0];
            if (modal) {
                $(modal).addClass('show');
                $('body').addClass('modal-open');
            }
        },
        error: function (xhr) {
            console.error('載入用戶詳情失敗:', xhr);
            alert('載入用戶詳情失敗');
        }
    });
}

function editUser(id) {
    $.ajax({
        url: '/admin/users/' + id + '/edit',
        method: 'GET',
        success: function (html) {
            $('#modal-container').html(html);
            var modal = $('#modal-container .modal')[0];
            if (modal) {
                $(modal).addClass('show');
                $('body').addClass('modal-open');
            }
        },
        error: function (xhr) {
            console.error('載入編輯用戶表單失敗:', xhr);
            alert('載入編輯用戶表單失敗');
        }
    });
}

function resetPassword(id) {
    if (confirm('確定要重設此用戶的密碼嗎？')) {
        $.ajax({
            url: '/api/admin/users/' + id + '/reset-password',
            method: 'POST',
            success: function (response) {
                if (response.success) {
                    alert('密碼重設成功！');
                    loadUsers();
                } else {
                    alert('密碼重設失敗：' + response.message);
                }
            },
            error: function () {
                alert('操作失敗，請稍後再試');
            }
        });
    }
}

function deleteUser(id) {
    if (confirm('確定要刪除此用戶嗎？此操作無法復原。')) {
        $.ajax({
            url: '/api/admin/users/' + id,
            method: 'DELETE',
            success: function (response) {
                if (response.success) {
                    alert('用戶刪除成功！');
                    loadUsers();
                    loadUserStats();
                } else {
                    alert('刪除失敗：' + response.message);
                }
            },
            error: function () {
                alert('操作失敗，請稍後再試');
            }
        });
    }
}

function toggleUserStatus(id, newStatus) {
    var statusText = newStatus === 'active' ? '啟用' : '停用';
    if (confirm('確定要' + statusText + '此用戶嗎？')) {
        $.ajax({
            url: '/api/admin/users/' + id + '/status',
            method: 'PATCH',
            data: { status: newStatus },
            success: function (response) {
                if (response.success) {
                    alert('用戶' + statusText + '成功！');
                    loadUsers();
                    loadUserStats();
                } else {
                    alert(statusText + '失敗：' + response.message);
                }
            },
            error: function () {
                alert('操作失敗，請稍後再試');
            }
        });
    }
}
