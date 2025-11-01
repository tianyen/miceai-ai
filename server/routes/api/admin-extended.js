/**
 * 管理後台擴展 API 路由
 * 包含原始 server.js 中的特殊 API 端點
 */
const express = require('express');
const router = express.Router();
const { authenticateSession } = require('../../middleware/auth');
const database = require('../../config/database');
const responses = require('../../utils/responses');

// 項目分頁 API
router.get('/projects/pagination', authenticateSession, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const countQuery = 'SELECT COUNT(*) as count FROM invitation_projects';
        const totalResult = await database.get(countQuery);
        const total = totalResult?.count || 0;
        const pages = Math.ceil(total / limit);

        let paginationHtml = '<div class="pagination-info">';
        paginationHtml += `<span>共 ${total} 個專案，第 ${page} 頁 / 共 ${pages} 頁</span>`;
        paginationHtml += '</div>';

        if (pages > 1) {
            paginationHtml += '<div class="pagination-buttons">';

            if (page > 1) {
                paginationHtml += `<button class="btn btn-sm btn-outline-primary" onclick="loadProjectsPage(${page - 1})">上一頁</button>`;
            }

            const startPage = Math.max(1, page - 2);
            const endPage = Math.min(pages, page + 2);

            for (let i = startPage; i <= endPage; i++) {
                const activeClass = i === page ? 'btn-primary' : 'btn-outline-primary';
                paginationHtml += `<button class="btn btn-sm ${activeClass}" onclick="loadProjectsPage(${i})">${i}</button>`;
            }

            if (page < pages) {
                paginationHtml += `<button class="btn btn-sm btn-outline-primary" onclick="loadProjectsPage(${page + 1})">下一頁</button>`;
            }

            paginationHtml += '</div>';
        }

        paginationHtml += `
        <script>
            function loadProjectsPage(page) {
                $.get('/api/admin/projects?page=' + page).done(function(data) {
                    if (data.success) {
                        $('#projects-table-body').html(data.html || '');
                    }
                });
                $.get('/api/admin/projects/pagination?page=' + page).done(function(html) {
                    $('#pagination-container').html(html);
                });
            }
        </script>
        `;

        responses.html(res, paginationHtml);
    } catch (error) {
        console.error('Get projects pagination error:', error);
        responses.html(res, '<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
    }
});

// 項目搜尋 API
router.get('/projects/search', authenticateSession, async (req, res) => {
    try {
        const { search, status } = req.query;

        let searchQuery = `
            SELECT p.*, COUNT(fs.id) as submission_count
            FROM invitation_projects p
            LEFT JOIN form_submissions fs ON p.id = fs.project_id
            WHERE 1=1
        `;
        let queryParams = [];

        if (search && search.trim()) {
            searchQuery += ` AND (p.project_name LIKE ? OR p.project_code LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            queryParams.push(searchTerm, searchTerm);
        }

        if (status && status.trim()) {
            searchQuery += ` AND p.status = ?`;
            queryParams.push(status);
        }

        searchQuery += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT 50`;

        const projects = await database.query(searchQuery, queryParams);

        let html = '';
        if (projects.length === 0) {
            html = '<tr><td colspan="7" class="text-center">無符合條件的專案</td></tr>';
        } else {
            projects.forEach(project => {
                const statusBadge = project.status === 'active' ?
                    '<span class="badge badge-success">進行中</span>' :
                    '<span class="badge badge-secondary">已結束</span>';
                const createdDate = new Date(project.created_at).toLocaleDateString('zh-TW');

                html += `
                    <tr>
                        <td>${project.id}</td>
                        <td>${project.project_name}</td>
                        <td>${project.project_code}</td>
                        <td>${statusBadge}</td>
                        <td>${project.submission_count || 0}</td>
                        <td>${createdDate}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-sm btn-primary" onclick="viewProject(${project.id})" title="專案管理">
                                    <i class="fas fa-cogs"></i>
                                </button>
                                ${project.status === 'active' ? `
                                <button class="btn btn-sm btn-info" onclick="getRegistrationLinks(${project.id})" title="獲取報名連結">
                                    <i class="fas fa-qrcode"></i>
                                </button>
                                ` : ''}
                                <button class="btn btn-sm btn-success" onclick="editProject(${project.id})" title="編輯專案">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-warning" onclick="duplicateProject(${project.id})" title="複製專案">
                                    <i class="fas fa-copy"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteProject(${project.id})" title="刪除專案">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        responses.html(res, html);
    } catch (error) {
        console.error('Search projects error:', error);
        responses.html(res, '<tr><td colspan="7" class="text-center text-danger">搜尋失敗</td></tr>');
    }
});

// 表單提交搜尋 API
router.get('/submissions/search', authenticateSession, async (req, res) => {
    try {
        const { search, 'project-filter': projectFilter, 'status-filter': statusFilter } = req.query;

        let searchQuery = `
            SELECT fs.*, p.project_name 
            FROM form_submissions fs
            LEFT JOIN invitation_projects p ON fs.project_id = p.id
            WHERE 1=1
        `;
        let queryParams = [];

        if (search && search.trim()) {
            searchQuery += ` AND (fs.submitter_name LIKE ? OR fs.submitter_email LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            queryParams.push(searchTerm, searchTerm);
        }

        if (projectFilter && projectFilter.trim()) {
            searchQuery += ` AND fs.project_id = ?`;
            queryParams.push(projectFilter);
        }

        if (statusFilter && statusFilter.trim()) {
            searchQuery += ` AND fs.status = ?`;
            queryParams.push(statusFilter);
        }

        searchQuery += ` ORDER BY fs.created_at DESC LIMIT 50`;

        const submissions = await database.query(searchQuery, queryParams);

        let html = '';
        if (submissions.length === 0) {
            html = '<tr><td colspan="7" class="text-center">無符合條件的表單提交記錄</td></tr>';
        } else {
            submissions.forEach(submission => {
                const statusClass = submission.status === 'confirmed' ? 'success' :
                    submission.status === 'cancelled' ? 'danger' : 'warning';
                const submittedAt = new Date(submission.created_at).toLocaleString('zh-TW');

                html += `
                <tr>
                    <td>${submission.submitter_name}</td>
                    <td>${submission.submitter_email}</td>
                    <td>${submission.submitter_phone || '-'}</td>
                    <td>${submission.project_name || '-'}</td>
                    <td><span class="badge badge-${statusClass}">${submission.status || 'pending'}</span></td>
                    <td>${submittedAt}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="viewSubmission(${submission.id})" title="查看詳情">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-info" onclick="generateQRCode(${submission.id})" title="生成 QR Code">
                            <i class="fas fa-qrcode"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success" onclick="editSubmission(${submission.id})" title="編輯">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteSubmission(${submission.id})" title="刪除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
                `;
            });
        }

        responses.html(res, html);
    } catch (error) {
        console.error('Search submissions error:', error);
        responses.html(res, '<tr><td colspan="7" class="text-center text-danger">搜尋失敗</td></tr>');
    }
});

// 報到搜尋 API
router.get('/checkin/search', authenticateSession, async (req, res) => {
    try {
        const { search } = req.query;

        let searchQuery = `
            SELECT fs.*, p.project_name 
            FROM form_submissions fs
            LEFT JOIN invitation_projects p ON fs.project_id = p.id
            WHERE 1=1
        `;
        let queryParams = [];

        if (search && search.trim()) {
            searchQuery += ` AND (fs.submitter_name LIKE ? OR fs.submitter_email LIKE ? OR fs.submitter_phone LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        searchQuery += ` ORDER BY fs.created_at DESC LIMIT 50`;

        const participants = await database.query(searchQuery, queryParams);

        let html = '';
        if (participants.length === 0) {
            html = '<tr><td colspan="7" class="text-center">無符合條件的參與者</td></tr>';
        } else {
            participants.forEach(participant => {
                const checkinStatus = participant.checked_in_at ?
                    '<span class="badge badge-success">已報到</span>' :
                    '<span class="badge badge-warning">未報到</span>';
                const checkinTime = participant.checked_in_at ?
                    new Date(participant.checked_in_at).toLocaleString('zh-TW') : '-';

                html += `
                <tr>
                    <td>${participant.submitter_name}</td>
                    <td>${participant.submitter_email}</td>
                    <td>${participant.submitter_phone || '-'}</td>
                    <td>${checkinStatus}</td>
                    <td>${checkinTime}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="showQRCode(${participant.id})">
                            <i class="fas fa-qrcode"></i>
                        </button>
                    </td>
                    <td>
                        ${!participant.checked_in_at ?
                        `<button class="btn btn-sm btn-success" onclick="manualCheckin(${participant.id})">
                                <i class="fas fa-check"></i> 報到
                            </button>` :
                        `<button class="btn btn-sm btn-warning" onclick="cancelCheckin(${participant.id})">
                                <i class="fas fa-times"></i> 取消
                            </button>`
                    }
                        <button class="btn btn-sm btn-info" onclick="viewCheckinDetails(${participant.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
                `;
            });
        }

        responses.html(res, html);
    } catch (error) {
        console.error('Search participants error:', error);
        responses.html(res, '<tr><td colspan="7" class="text-center text-danger">搜尋失敗</td></tr>');
    }
});

// 日誌統計 API - 必須在通用 /logs 路由之前
router.get('/logs/stats', authenticateSession, async (req, res) => {
    try {
        const errorCount = await database.get("SELECT COUNT(*) as count FROM system_logs WHERE action LIKE '%error%' OR action LIKE '%failed%'");
        const warningCount = await database.get("SELECT COUNT(*) as count FROM system_logs WHERE action LIKE '%warning%'");
        const totalCount = await database.get("SELECT COUNT(*) as count FROM system_logs");

        responses.success(res, {
            error_count: errorCount?.count || 0,
            warning_count: warningCount?.count || 0,
            total_count: totalCount?.count || 0
        });
    } catch (error) {
        console.error('Get logs stats error:', error);
        responses.error(res, 'Failed to get logs stats', 500);
    }
});

// 系統日誌 API
router.get('/logs', authenticateSession, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const logs = await database.query(`
            SELECT 
                l.*,
                u.username,
                u.full_name
            FROM system_logs l
            LEFT JOIN users u ON l.user_id = u.id
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        let tableRows = '';
        if (logs && logs.length > 0) {
            logs.forEach(log => {
                const levelClass = log.action.includes('error') || log.action.includes('failed') ? 'error' :
                    log.action.includes('warning') ? 'warning' : 'info';

                tableRows += `
                <tr>
                    <td><span class="log-level ${levelClass}">${levelClass}</span></td>
                    <td class="log-timestamp">${new Date(log.created_at).toLocaleString('zh-TW')}</td>
                    <td class="log-user">
                        <div class="log-user-avatar">${(log.full_name || log.username || '系統').charAt(0)}</div>
                        <span>${log.full_name || log.username || '系統'}</span>
                    </td>
                    <td class="log-action">${log.action}</td>
                    <td class="log-details" onclick="viewLogDetails(${log.id})">${log.details || '無詳細資訊'}</td>
                    <td class="log-ip">${log.ip_address || '未知'}</td>
                    <td class="log-actions">
                        <button class="btn btn-sm btn-outline-primary" onclick="viewLogDetails(${log.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteLog(${log.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
                `;
            });
        } else {
            tableRows = '<tr><td colspan="7" class="text-center">暫無日誌記錄</td></tr>';
        }

        responses.html(res, tableRows);
    } catch (error) {
        console.error('Get logs error:', error);
        responses.html(res, '<tr><td colspan="7" class="text-center text-danger">載入日誌失敗</td></tr>');
    }
});

// 日誌統計 API 已移至前面，避免與 /logs 路由衝突

// 用戶統計 API 已移至 admin.js 中的 userController.getUserStats

// 重設用戶密碼 API
router.post('/users/:id/reset-password', authenticateSession, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const bcrypt = require('bcrypt');

        // 生成新密碼
        const newPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await database.run('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, userId]);

        responses.success(res, {
            message: '密碼重設成功',
            newPassword: newPassword
        });
    } catch (error) {
        console.error('Reset password error:', error);
        responses.error(res, '重設密碼失敗', 500);
    }
});

// 更新表單提交記錄 API
router.put('/submissions/:id', authenticateSession, async (req, res) => {
    try {
        const submissionId = req.params.id;
        const {
            submitter_name,
            submitter_email,
            submitter_phone,
            company_name,
            position,
            project_id,
            status
        } = req.body;

        // 驗證必要欄位
        if (!submitter_name || !submitter_email) {
            return responses.badRequest(res, '姓名和電子郵件為必填欄位');
        }

        // 驗證電子郵件格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(submitter_email)) {
            return responses.badRequest(res, '請輸入有效的電子郵件地址');
        }

        // 檢查提交記錄是否存在
        const submission = await database.get(
            'SELECT id FROM form_submissions WHERE id = ?',
            [submissionId]
        );

        if (!submission) {
            return responses.notFound(res, '找不到指定的提交記錄');
        }

        // 更新提交記錄
        await database.run(`
            UPDATE form_submissions
            SET submitter_name = ?,
                submitter_email = ?,
                submitter_phone = ?,
                company_name = ?,
                position = ?,
                project_id = ?,
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            submitter_name,
            submitter_email,
            submitter_phone || null,
            company_name || null,
            position || null,
            project_id || null,
            status || 'pending',
            submissionId
        ]);

        responses.success(res, {
            message: '提交記錄已更新',
            data: { id: submissionId }
        });
    } catch (error) {
        console.error('更新提交記錄失敗:', error);
        responses.error(res, '更新提交記錄失敗', 500);
    }
});

// 表單提交分頁 API
router.get('/submissions/pagination', authenticateSession, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const countQuery = 'SELECT COUNT(*) as count FROM form_submissions';
        const totalResult = await database.get(countQuery);
        const total = totalResult?.count || 0;
        const pages = Math.ceil(total / limit);

        let paginationHtml = '<div class="pagination-info">';
        paginationHtml += `<span>共 ${total} 筆提交，第 ${page} 頁 / 共 ${pages} 頁</span>`;
        paginationHtml += '</div>';

        if (pages > 1) {
            paginationHtml += '<div class="pagination-buttons">';

            if (page > 1) {
                paginationHtml += `<button class="btn btn-sm btn-outline-primary" onclick="loadSubmissionsPage(${page - 1})">上一頁</button>`;
            }

            const startPage = Math.max(1, page - 2);
            const endPage = Math.min(pages, page + 2);

            for (let i = startPage; i <= endPage; i++) {
                const activeClass = i === page ? 'btn-primary' : 'btn-outline-primary';
                paginationHtml += `<button class="btn btn-sm ${activeClass}" onclick="loadSubmissionsPage(${i})">${i}</button>`;
            }

            if (page < pages) {
                paginationHtml += `<button class="btn btn-sm btn-outline-primary" onclick="loadSubmissionsPage(${page + 1})">下一頁</button>`;
            }

            paginationHtml += '</div>';
        }

        responses.html(res, paginationHtml);
    } catch (error) {
        console.error('Submissions pagination error:', error);
        responses.html(res, '<div class="alert alert-danger">載入分頁失敗</div>');
    }
});

// Profile API 端點
router.put('/profile/basic', authenticateSession, async (req, res) => {
    try {

        const { username, full_name, email, phone } = req.body;
        const userId = req.user.id;

        // 驗證必要欄位
        if (!full_name || !email) {
            return responses.error(res, '姓名和電子郵件為必填欄位', 400);
        }

        // 驗證電子郵件格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return responses.error(res, '請輸入有效的電子郵件地址', 400);
        }

        await database.run(
            'UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?',
            [full_name, email, phone || null, userId]
        );

        responses.success(res, { message: '基本資訊更新成功' });
    } catch (error) {
        console.error('Update profile basic error:', error);
        responses.error(res, '更新基本資訊失敗', 500);
    }
});

router.put('/profile/password', authenticateSession, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        const userId = req.user.id;
        const bcrypt = require('bcrypt');

        // 驗證必要欄位
        if (!current_password || !new_password) {
            return responses.error(res, '請填寫當前密碼和新密碼', 400);
        }

        // 驗證新密碼長度
        if (new_password.length < 8) {
            return responses.error(res, '新密碼至少需要8個字符', 400);
        }

        // 驗證當前密碼
        const user = await database.get('SELECT password_hash FROM users WHERE id = ?', [userId]);
        if (!user) {
            return responses.error(res, '用戶不存在', 404);
        }

        const isValid = await bcrypt.compare(current_password, user.password_hash);
        if (!isValid) {
            return responses.error(res, '當前密碼不正確', 400);
        }

        // 更新密碼
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await database.run('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, userId]);

        responses.success(res, { message: '密碼更新成功' });
    } catch (error) {
        console.error('Update password error:', error);
        responses.error(res, '更新密碼失敗', 500);
    }
});

// 獲取用戶偏好設定
router.get('/profile/preferences', authenticateSession, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await database.get('SELECT preferences FROM users WHERE id = ?', [userId]);

        let preferences = {
            language: 'zh-TW',
            timezone: 'Asia/Taipei',
            email_notifications: false,
            browser_notifications: false
        };

        if (user && user.preferences) {
            try {
                const userPrefs = JSON.parse(user.preferences);
                preferences = { ...preferences, ...userPrefs };
            } catch (e) {
                console.error('Parse preferences error:', e);
            }
        }

        responses.success(res, preferences);
    } catch (error) {
        console.error('Get preferences error:', error);
        responses.error(res, '獲取偏好設定失敗', 500);
    }
});

// 更新用戶偏好設定
router.put('/profile/preferences', authenticateSession, async (req, res) => {
    try {
        const { language, timezone, email_notifications, browser_notifications } = req.body;
        const userId = req.user.id;

        // 構建偏好設定對象
        const preferences = {
            language: language || 'zh-TW',
            timezone: timezone || 'Asia/Taipei',
            email_notifications: Boolean(email_notifications),
            browser_notifications: Boolean(browser_notifications)
        };

        const preferencesJson = JSON.stringify(preferences);
        await database.run('UPDATE users SET preferences = ? WHERE id = ?', [preferencesJson, userId]);

        responses.success(res, { message: '偏好設定更新成功' });
    } catch (error) {
        console.error('Update preferences error:', error);
        responses.error(res, '更新偏好設定失敗', 500);
    }
});

router.get('/profile/login-history', authenticateSession, async (req, res) => {
    try {
        const userId = req.user.id;

        const history = await database.query(`
            SELECT action, ip_address, created_at
            FROM system_logs
            WHERE user_id = ? AND action LIKE '%login%'
            ORDER BY created_at DESC
            LIMIT 10
        `, [userId]);

        let html = '';
        if (history.length === 0) {
            html = '<p class="text-center text-muted">暫無登入記錄</p>';
        } else {
            history.forEach(record => {
                const date = new Date(record.created_at).toLocaleString('zh-TW');
                html += `
                    <div class="login-record">
                        <div class="login-time">${date}</div>
                        <div class="login-ip">IP: ${record.ip_address}</div>
                        <div class="login-action">${record.action}</div>
                    </div>
                `;
            });
        }

        responses.success(res, html);
    } catch (error) {
        console.error('Get login history error:', error);
        responses.error(res, '載入登入記錄失敗', 500);
    }
});

// 問卷統計 API
router.get('/questionnaire/stats', authenticateSession, async (req, res) => {
    try {
        const { questionnaire_id } = req.query;

        let html = '<div class="stats-container">';

        if (!questionnaire_id) {
            // 顯示所有問卷的概覽統計
            const totalSubmissions = await database.get('SELECT COUNT(*) as count FROM questionnaire_responses');
            const totalQuestionnaires = await database.get('SELECT COUNT(*) as count FROM questionnaires');

            html += `
                <div class="overview-stats">
                    <div class="stat-card">
                        <h4>總問卷數</h4>
                        <div class="stat-number">${totalQuestionnaires?.count || 0}</div>
                    </div>
                    <div class="stat-card">
                        <h4>總回應數</h4>
                        <div class="stat-number">${totalSubmissions?.count || 0}</div>
                    </div>
                </div>
                <p class="text-center text-muted">請選擇問卷查看詳細統計</p>
            `;
        } else {
            // 顯示特定問卷的詳細統計
            const questionnaire = await database.get('SELECT * FROM questionnaires WHERE id = ?', [questionnaire_id]);

            if (!questionnaire) {
                html += '<div class="alert alert-warning">問卷不存在</div>';
            } else {
                const responses = await database.query('SELECT * FROM questionnaire_responses WHERE questionnaire_id = ?', [questionnaire_id]);
                const responseCount = responses.length;

                html += `
                    <div class="questionnaire-header">
                        <h3>${questionnaire.title}</h3>
                        <p>${questionnaire.description || ''}</p>
                    </div>

                    <div class="stats-summary">
                        <div class="stat-card">
                            <h4>總回應數</h4>
                            <div class="stat-number">${responseCount}</div>
                        </div>
                        <div class="stat-card">
                            <h4>問卷狀態</h4>
                            <div class="stat-text">${questionnaire.status === 'active' ? '進行中' : '已結束'}</div>
                        </div>
                    </div>
                `;

                if (responseCount > 0) {
                    html += '<div class="responses-list"><h4>最新回應</h4>';
                    responses.slice(0, 10).forEach(response => {
                        const submittedAt = new Date(response.submitted_at).toLocaleString('zh-TW');
                        html += `
                            <div class="response-item">
                                <div class="response-time">${submittedAt}</div>
                                <div class="response-data">${JSON.stringify(response.response_data).substring(0, 100)}...</div>
                            </div>
                        `;
                    });
                    html += '</div>';
                } else {
                    html += '<div class="alert alert-info">尚無回應數據</div>';
                }
            }
        }

        html += '</div>';
        responses.html(res, html);
    } catch (error) {
        console.error('Get questionnaire stats error:', error);
        responses.html(res, '<div class="alert alert-danger">載入統計失敗</div>');
    }
});

// 問卷匯出 API
router.get('/questionnaire/:id/export', authenticateSession, async (req, res) => {
    try {
        const questionnaireId = req.params.id;

        const questionnaire = await database.get('SELECT * FROM questionnaires WHERE id = ?', [questionnaireId]);
        const responses = await database.query('SELECT * FROM questionnaire_responses WHERE questionnaire_id = ?', [questionnaireId]);

        if (!questionnaire) {
            return responses.error(res, '問卷不存在', 404);
        }

        // 生成 CSV 格式的匯出數據
        let csvContent = '提交時間,回應數據\n';
        responses.forEach(response => {
            const submittedAt = new Date(response.submitted_at).toLocaleString('zh-TW');
            const responseData = JSON.stringify(response.response_data).replace(/"/g, '""');
            csvContent += `"${submittedAt}","${responseData}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="questionnaire-${questionnaireId}-export.csv"`);
        res.send('\uFEFF' + csvContent); // 添加 BOM 以支援中文
    } catch (error) {
        console.error('Export questionnaire error:', error);
        responses.error(res, '匯出失敗', 500);
    }
});

// 問卷 QR Code 列表 API
router.get('/questionnaire/qr-codes', authenticateSession, async (req, res) => {
    try {
        const { questionnaire_id } = req.query;

        let html = '<div class="qr-codes-container">';

        if (!questionnaire_id) {
            html += '<p class="text-center text-muted">請選擇問卷查看 QR Code</p>';
        } else {
            const questionnaire = await database.get('SELECT * FROM questionnaires WHERE id = ?', [questionnaire_id]);

            if (!questionnaire) {
                html += '<div class="alert alert-warning">問卷不存在</div>';
            } else {
                const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
                const questionnaireUrl = `${baseUrl}/questionnaire/${questionnaire.id}`;

                html += `
                    <div class="questionnaire-info">
                        <h3>${questionnaire.title}</h3>
                        <p>${questionnaire.description || ''}</p>
                        <p class="text-muted">問卷 ID: ${questionnaire.id}</p>
                    </div>

                    <div class="qr-code-section">
                        <h4>問卷 QR Code</h4>
                        <div class="qr-code-display" id="qr-code-${questionnaire.id}">
                            <!-- QR Code 將在此生成 -->
                        </div>
                        <div class="qr-url">
                            <strong>問卷連結:</strong>
                            <input type="text" class="form-control" value="${questionnaireUrl}" readonly onclick="this.select()">
                            <button class="btn btn-sm btn-secondary" onclick="copyQRUrl('${questionnaireUrl}')">
                                <i class="fas fa-copy"></i> 複製
                            </button>
                        </div>
                        <div class="qr-actions">
                            <button class="btn btn-primary" onclick="downloadQR(${questionnaire.id}, 'questionnaire')">
                                <i class="fas fa-download"></i> 下載 QR Code
                            </button>
                        </div>
                    </div>

                    <script>
                        // 生成 QR Code
                        (function() {
                            const container = document.getElementById('qr-code-${questionnaire.id}');
                            if (container && typeof QRCode !== 'undefined') {
                                new QRCode(container, {
                                    text: '${questionnaireUrl}',
                                    width: 300,
                                    height: 300,
                                    colorDark: '#000000',
                                    colorLight: '#ffffff',
                                    correctLevel: QRCode.CorrectLevel.H
                                });
                            }
                        })();
                    </script>
                `;
            }
        }

        html += '</div>';
        responses.html(res, html);
    } catch (error) {
        console.error('Get QR codes error:', error);
        responses.html(res, '<div class="alert alert-danger">載入 QR Code 失敗</div>');
    }
});

// QR Code 下載 API
router.get('/questionnaire/:id/qr-download', authenticateSession, async (req, res) => {
    try {
        const questionnaireId = req.params.id;
        const { type } = req.query;
        const QRCode = require('qrcode');

        // 獲取問卷資訊
        const questionnaire = await database.get('SELECT * FROM questionnaires WHERE id = ?', [questionnaireId]);

        if (!questionnaire) {
            return responses.error(res, '問卷不存在', 404);
        }

        // 生成問卷 URL
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const questionnaireUrl = `${baseUrl}/questionnaire/${questionnaireId}`;

        // 生成 QR Code 圖片
        const qrImageBuffer = await QRCode.toBuffer(questionnaireUrl, {
            type: 'png',
            width: 400,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // 設置響應頭
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="questionnaire-${questionnaireId}-qr.png"`);
        res.send(qrImageBuffer);
    } catch (error) {
        console.error('Download QR code error:', error);
        responses.error(res, 'QR Code 下載失敗', 500);
    }
});

// QR Code 生成 API
router.post('/questionnaire-qr/generate', authenticateSession, async (req, res) => {
    try {
        const { questionnaire_id, type } = req.body;

        // 這裡應該實現 QR Code 生成邏輯
        // 暫時返回成功響應
        responses.success(res, {
            message: 'QR Code 生成成功',
            questionnaire_id,
            type
        });
    } catch (error) {
        console.error('Generate QR code error:', error);
        responses.error(res, 'QR Code 生成失敗', 500);
    }
});

// QR Scanner APIs
// QR Scanner 報到 API
router.post('/qr-scanner/checkin', authenticateSession, async (req, res) => {
    try {
        const { qrData } = req.body;

        if (!qrData) {
            return responses.error(res, 'QR Code 數據不能為空', 400);
        }

        // 解析 QR Code 數據 - 支援 JSON 或純 trace_id
        let participantData;
        try {
            // 嘗試解析為 JSON
            participantData = JSON.parse(qrData);
        } catch (parseError) {
            // 如果不是 JSON，假設是純 trace_id
            participantData = { traceId: qrData.trim() };
        }

        // 驗證必要欄位
        if (!participantData.submissionId && !participantData.traceId) {
            return responses.error(res, 'QR Code 缺少必要的識別信息', 400);
        }

        // 查找參與者
        const participant = await database.get(`
            SELECT * FROM form_submissions
            WHERE id = ? OR trace_id = ?
        `, [participantData.submissionId, participantData.traceId]);

        if (!participant) {
            return responses.error(res, '找不到對應的參與者記錄', 404);
        }

        // 檢查是否已經報到
        const existingCheckin = await database.get(`
            SELECT * FROM checkin_records WHERE submission_id = ?
        `, [participant.id]);

        if (existingCheckin) {
            return responses.error(res, '此參與者已經完成報到', 400);
        }

        // 執行報到 - 創建報到記錄
        const checkinTime = new Date().toISOString();
        await database.run(`
            INSERT INTO checkin_records (
                project_id, submission_id, trace_id, attendee_name, 
                scanned_by, scanner_location, checkin_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            participant.project_id,
            participant.id,
            participant.trace_id,
            participant.submitter_name,
            req.user.id,
            'qr_scanner',
            checkinTime
        ]);

        // 記錄系統日誌
        await database.run(`
            INSERT INTO system_logs (user_id, action, target_type, target_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [req.user.id, 'qr_scan', 'checkin', participant.id, JSON.stringify({qr_data: qrData}), req.ip]);

        responses.success(res, {
            message: `${participant.submitter_name} 報到成功`,
            participant: {
                id: participant.id,
                name: participant.submitter_name,
                email: participant.submitter_email,
                checkinTime: checkinTime
            }
        });
    } catch (error) {
        console.error('QR Scanner checkin error:', error);
        responses.error(res, '報到處理失敗', 500);
    }
});

// QR Scanner 今日統計 API
router.get('/qr-scanner/today-stats', authenticateSession, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // 今日報到統計
        const todayCheckins = await database.get(`
            SELECT COUNT(*) as count
            FROM checkin_records
            WHERE DATE(checkin_time) = ?
        `, [today]);

        // 今日掃描次數
        const todayScans = await database.get(`
            SELECT COUNT(*) as count
            FROM system_logs
            WHERE action = 'qr_scan' AND DATE(created_at) = ?
        `, [today]);

        // 總參與者數
        const totalParticipants = await database.get(`
            SELECT COUNT(*) as count
            FROM form_submissions
        `);

        // 報到率
        const checkinRate = totalParticipants.count > 0
            ? Math.round((todayCheckins.count / totalParticipants.count) * 100)
            : 0;

        const html = `
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${todayCheckins.count}</div>
                    <div class="stat-label">今日報到</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${todayScans.count}</div>
                    <div class="stat-label">掃描次數</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${totalParticipants.count}</div>
                    <div class="stat-label">總參與者</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${checkinRate}%</div>
                    <div class="stat-label">報到率</div>
                </div>
            </div>
        `;

        responses.html(res, html);
    } catch (error) {
        console.error('Get today stats error:', error);
        responses.html(res, '<div class="alert alert-danger">載入統計失敗</div>');
    }
});

// QR Scanner 掃描歷史 API
router.get('/qr-scanner/history', authenticateSession, async (req, res) => {
    try {
        const recentScans = await database.query(`
            SELECT
                al.created_at as scan_time,
                al.action as scan_method,
                fs.submitter_name,
                fs.submitter_email,
                cr.checkin_time as checked_in_at
            FROM system_logs al
            LEFT JOIN form_submissions fs ON al.target_id = fs.id
            LEFT JOIN checkin_records cr ON fs.id = cr.submission_id
            WHERE al.action = 'qr_scan'
            ORDER BY al.created_at DESC
            LIMIT 10
        `);

        let html = '<div class="scan-history-list">';

        if (recentScans.length === 0) {
            html += '<p class="text-center text-muted">暫無掃描記錄</p>';
        } else {
            recentScans.forEach(scan => {
                const scanTime = new Date(scan.scan_time).toLocaleString('zh-TW');
                const status = scan.checked_in_at ? '已報到' : '掃描失敗';
                const statusClass = scan.checked_in_at ? 'success' : 'danger';

                html += `
                    <div class="scan-item">
                        <div class="scan-info">
                            <strong>${scan.submitter_name || '未知參與者'}</strong>
                            <small>${scan.submitter_email || ''}</small>
                        </div>
                        <div class="scan-meta">
                            <span class="scan-time">${scanTime}</span>
                            <span class="badge badge-${statusClass}">${status}</span>
                        </div>
                    </div>
                `;
            });
        }

        html += '</div>';
        responses.html(res, html);
    } catch (error) {
        console.error('Get scan history error:', error);
        responses.html(res, '<div class="alert alert-danger">載入掃描記錄失敗</div>');
    }
});

// QR Code 生成 API for Participants
router.post('/participants/:id/generate-qr', authenticateSession, async (req, res) => {
    try {
        const participantId = req.params.id;

        // 獲取參與者資料
        const participant = await database.get(`
            SELECT fs.*, p.project_name, p.event_date, p.event_location
            FROM form_submissions fs
            LEFT JOIN invitation_projects p ON fs.project_id = p.id
            WHERE fs.id = ?
        `, [participantId]);

        if (!participant) {
            return responses.error(res, '找不到參與者記錄', 404);
        }

        // 生成 QR Code 數據
        const qrData = {
            // 活動信息
            eventName: participant.project_name,
            eventDate: participant.event_date,
            eventLocation: participant.event_location,
            eventId: participant.project_id,

            // 參加者信息
            submissionId: participant.id,
            traceId: participant.trace_id,
            attendeeName: participant.submitter_name,
            attendeeEmail: participant.submitter_email,
            attendeePhone: participant.submitter_phone,

            // 驗證信息
            qrType: 'attendee_checkin',
            generatedAt: new Date().toISOString(),
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天有效期

            // 系統信息
            version: '2.0',
            issuer: 'MICE-AI-SYSTEM'
        };

        const qrDataString = JSON.stringify(qrData);

        // 檢查是否已存在 QR Code
        let qrRecord = await database.get(`
            SELECT * FROM qr_codes
            WHERE submission_id = ? AND project_id = ?
        `, [participantId, participant.project_id]);

        if (qrRecord) {
            // 更新現有記錄
            await database.run(`
                UPDATE qr_codes
                SET qr_data = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [qrDataString, qrRecord.id]);
        } else {
            // 創建新記錄
            await database.run(`
                INSERT INTO qr_codes (project_id, submission_id, qr_code, qr_data)
                VALUES (?, ?, ?, ?)
            `, [participant.project_id, participantId, qrDataString, qrDataString]);
        }

        responses.success(res, {
            message: `已為 ${participant.submitter_name} 生成 QR Code`,
            qrData: qrData,
            participant: {
                id: participant.id,
                name: participant.submitter_name,
                email: participant.submitter_email
            }
        });
    } catch (error) {
        console.error('Generate QR code error:', error);
        responses.error(res, 'QR Code 生成失敗', 500);
    }
});

// QR Code 顯示 API
router.get('/participants/:id/qr-code', authenticateSession, async (req, res) => {
    try {
        const participantId = req.params.id;

        // 獲取參與者和 QR Code 資料
        const participant = await database.get(`
            SELECT fs.*, p.project_name, qr.qr_data, qr.created_at as qr_created_at
            FROM form_submissions fs
            LEFT JOIN invitation_projects p ON fs.project_id = p.id
            LEFT JOIN qr_codes qr ON fs.id = qr.submission_id
            WHERE fs.id = ?
        `, [participantId]);

        if (!participant) {
            return responses.error(res, '找不到參與者記錄', 404);
        }

        let qrData = null;
        if (participant.qr_data) {
            try {
                qrData = JSON.parse(participant.qr_data);
            } catch (e) {
                console.error('Parse QR data error:', e);
            }
        }

        const html = `
            <div class="modal fade show" style="display: block;">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-qrcode"></i>
                                ${participant.submitter_name} 的 QR Code
                            </h5>
                            <button type="button" class="btn-close" onclick="closeModal()"></button>
                        </div>
                        <div class="modal-body">
                            <div class="participant-info">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6>參與者資訊</h6>
                                        <p><strong>姓名：</strong>${participant.submitter_name}</p>
                                        <p><strong>電子郵件：</strong>${participant.submitter_email}</p>
                                        <p><strong>電話：</strong>${participant.submitter_phone || '-'}</p>
                                        <p><strong>專案：</strong>${participant.project_name || '-'}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="qr-code-container text-center">
                                            ${qrData ? `
                                                <div id="qr-code-display" class="qr-code-display">
                                                    <!-- QR Code 將在這裡生成 -->
                                                </div>
                                                <p class="text-muted mt-2">掃描此 QR Code 進行報到</p>
                                            ` : `
                                                <div class="alert alert-warning">
                                                    <i class="fas fa-exclamation-triangle"></i>
                                                    尚未生成 QR Code
                                                </div>
                                            `}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            ${qrData ? `
                                <div class="qr-actions mt-3">
                                    <button class="btn btn-primary" onclick="downloadQRCode(${participantId})">
                                        <i class="fas fa-download"></i> 下載 QR Code
                                    </button>
                                    <button class="btn btn-secondary" onclick="printQRCode()">
                                        <i class="fas fa-print"></i> 列印 QR Code
                                    </button>
                                    <button class="btn btn-info" onclick="regenerateQRCode(${participantId})">
                                        <i class="fas fa-sync"></i> 重新生成
                                    </button>
                                </div>
                            ` : `
                                <div class="qr-actions mt-3">
                                    <button class="btn btn-primary" onclick="generateNewQRCode(${participantId})">
                                        <i class="fas fa-plus"></i> 生成 QR Code
                                    </button>
                                </div>
                            `}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">關閉</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop fade show"></div>

            ${qrData ? `
                <script>
                    // 生成 QR Code 顯示
                    document.addEventListener('DOMContentLoaded', function() {
                        const qrData = ${JSON.stringify(participant.qr_data)};
                        if (typeof QRCode !== 'undefined') {
                            const qr = new QRCode(document.getElementById('qr-code-display'), {
                                text: qrData,
                                width: 200,
                                height: 200,
                                colorDark: '#000000',
                                colorLight: '#ffffff'
                            });
                        } else {
                            // 使用 qrcode-generator 作為備用
                            const qr = qrcode(0, 'M');
                            qr.addData(qrData);
                            qr.make();
                            document.getElementById('qr-code-display').innerHTML = qr.createImgTag(4);
                        }
                    });
                </script>
            ` : ''}
        `;

        responses.html(res, html);
    } catch (error) {
        console.error('Get QR code error:', error);
        responses.html(res, '<div class="alert alert-danger">載入 QR Code 失敗</div>');
    }
});

// QR Code 下載 API
router.get('/participants/:id/qr-download', authenticateSession, async (req, res) => {
    try {
        const participantId = req.params.id;

        // 獲取參與者和 QR Code 資料
        const participant = await database.get(`
            SELECT fs.*, p.project_name, qr.qr_data
            FROM form_submissions fs
            LEFT JOIN invitation_projects p ON fs.project_id = p.id
            LEFT JOIN qr_codes qr ON fs.id = qr.submission_id
            WHERE fs.id = ?
        `, [participantId]);

        if (!participant) {
            return responses.error(res, '找不到參與者記錄', 404);
        }

        if (!participant.qr_data) {
            return responses.error(res, '尚未生成 QR Code', 400);
        }

        // 這裡應該使用 QR Code 生成庫來創建實際的圖片
        // 暫時返回 QR Code 數據，前端可以用 JavaScript 生成圖片
        res.setHeader('Content-Type', 'application/json');
        responses.success(res, {
            message: 'QR Code 數據',
            participantName: participant.submitter_name,
            qrData: participant.qr_data,
            downloadUrl: `/api/admin/participants/${participantId}/qr-image`
        });
    } catch (error) {
        console.error('Download QR code error:', error);
        responses.error(res, 'QR Code 下載失敗', 500);
    }
});

// QR Code 圖片生成 API (使用 qrcode 庫)
router.get('/participants/:id/qr-image', authenticateSession, async (req, res) => {
    try {
        const participantId = req.params.id;
        const QRCode = require('qrcode');

        // 獲取 QR Code 數據
        const qrRecord = await database.get(`
            SELECT qr.qr_data, fs.submitter_name
            FROM qr_codes qr
            JOIN form_submissions fs ON qr.submission_id = fs.id
            WHERE qr.submission_id = ?
        `, [participantId]);

        if (!qrRecord) {
            return responses.error(res, '找不到 QR Code 記錄', 404);
        }

        // 生成 QR Code 圖片
        const qrImageBuffer = await QRCode.toBuffer(qrRecord.qr_data, {
            type: 'png',
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // 設置響應頭
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="qr-code-${qrRecord.submitter_name}-${participantId}.png"`);
        res.send(qrImageBuffer);
    } catch (error) {
        console.error('Generate QR image error:', error);
        responses.error(res, 'QR Code 圖片生成失敗', 500);
    }
});

// 手動簽到 API
router.post('/participants/:id/checkin', authenticateSession, async (req, res) => {
    try {
        const participantId = req.params.id;
        const projectId = req.body.project_id;

        // 檢查參加者是否存在
        const participant = await database.get(
            'SELECT * FROM form_submissions WHERE id = ?',
            [participantId]
        );

        if (!participant) {
            return responses.error(res, '參加者不存在', 404);
        }

        if (participant.checked_in_at) {
            return responses.error(res, '此參加者已經簽到', 400);
        }

        // 更新簽到狀態
        await database.run(`
            UPDATE form_submissions 
            SET checked_in_at = CURRENT_TIMESTAMP, 
                checkin_method = 'manual'
            WHERE id = ?
        `, [participantId]);

        // 記錄簽到互動
        await database.run(`
            INSERT INTO participant_interactions (
                trace_id, project_id, submission_id, interaction_type,
                interaction_target, interaction_data, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            participant.trace_id,
            projectId || participant.project_id,
            participantId,
            'manual_checkin',
            'admin_panel',
            JSON.stringify({ admin_user: req.user.username }),
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
        ]);

        responses.success(res, null, '簽到成功');

    } catch (error) {
        console.error('手動簽到失敗:', error);
        responses.error(res, '簽到失敗', 500);
    }
});

// 取消簽到 API
router.post('/participants/:id/cancel-checkin', authenticateSession, async (req, res) => {
    try {
        const participantId = req.params.id;

        // 檢查參加者是否存在
        const participant = await database.get(
            'SELECT * FROM form_submissions WHERE id = ?',
            [participantId]
        );

        if (!participant) {
            return responses.error(res, '參加者不存在', 404);
        }

        if (!participant.checked_in_at) {
            return responses.error(res, '此參加者尚未簽到', 400);
        }

        // 取消簽到
        await database.run(`
            UPDATE form_submissions 
            SET checked_in_at = NULL, 
                checkin_method = NULL
            WHERE id = ?
        `, [participantId]);

        // 記錄取消簽到互動
        await database.run(`
            INSERT INTO participant_interactions (
                trace_id, project_id, submission_id, interaction_type,
                interaction_target, interaction_data, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            participant.trace_id,
            participant.project_id,
            participantId,
            'cancel_checkin',
            'admin_panel',
            JSON.stringify({ admin_user: req.user.username }),
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
        ]);

        responses.success(res, null, '取消簽到成功');

    } catch (error) {
        console.error('取消簽到失敗:', error);
        responses.error(res, '取消簽到失敗', 500);
    }
});

// 批量簽到 API
router.post('/projects/:id/bulk-checkin', authenticateSession, async (req, res) => {
    try {
        const projectId = req.params.id;

        // 獲取所有未簽到的參加者
        const participants = await database.query(`
            SELECT id, trace_id FROM form_submissions 
            WHERE project_id = ? AND checked_in_at IS NULL
        `, [projectId]);

        if (participants.length === 0) {
            return responses.success(res, { count: 0 }, '沒有需要簽到的參加者');
        }

        // 批量更新簽到狀態
        await database.run(`
            UPDATE form_submissions 
            SET checked_in_at = CURRENT_TIMESTAMP, 
                checkin_method = 'bulk_manual'
            WHERE project_id = ? AND checked_in_at IS NULL
        `, [projectId]);

        // 記錄批量簽到互動
        for (const participant of participants) {
            await database.run(`
                INSERT INTO participant_interactions (
                    trace_id, project_id, submission_id, interaction_type,
                    interaction_target, interaction_data, ip_address, user_agent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                participant.trace_id,
                projectId,
                participant.id,
                'bulk_checkin',
                'admin_panel',
                JSON.stringify({ admin_user: req.user.username }),
                req.ip || req.connection.remoteAddress,
                req.get('User-Agent')
            ]);
        }

        responses.success(res, { count: participants.length }, `成功為 ${participants.length} 位參加者辦理簽到`);

    } catch (error) {
        console.error('批量簽到失敗:', error);
        responses.error(res, '批量簽到失敗', 500);
    }
});

// API: 獲取專案統計
router.get('/projects/:id/stats', authenticateSession, async (req, res) => {
    try {
        const projectId = req.params.id;

        const stats = await database.get(`
            SELECT 
                COUNT(DISTINCT s.id) as total_participants,
                COUNT(DISTINCT CASE WHEN s.checked_in_at IS NOT NULL THEN s.id END) as checked_in_count,
                COUNT(DISTINCT qr.id) as questionnaire_responses,
                ROUND(
                    CASE 
                        WHEN COUNT(DISTINCT s.id) > 0 THEN 
                            (COUNT(DISTINCT CASE WHEN s.checked_in_at IS NOT NULL THEN s.id END) * 100.0) / COUNT(DISTINCT s.id)
                        ELSE 0 
                    END
                ) as checkin_rate
            FROM form_submissions s
            LEFT JOIN questionnaire_responses qr ON s.trace_id = qr.trace_id
            WHERE s.project_id = ?
        `, [projectId]);

        res.json({
            success: true,
            data: stats || { total_participants: 0, checked_in_count: 0, questionnaire_responses: 0, checkin_rate: 0 }
        });

    } catch (error) {
        console.error('獲取專案統計失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取專案統計失敗'
        });
    }
});

// API: 獲取專案參加者列表 (HTML)
router.get('/projects/:id/participants', authenticateSession, async (req, res) => {
    try {
        const projectId = req.params.id;

        const participants = await database.query(`
            SELECT 
                s.id,
                s.submitter_name,
                s.submitter_email,
                s.submitter_phone,
                s.participation_level,
                s.checked_in_at,
                s.status,
                s.trace_id
            FROM form_submissions s
            WHERE s.project_id = ?
            ORDER BY s.created_at DESC
        `, [projectId]);

        let html = '';
        if (participants.length === 0) {
            html = '<tr><td colspan="6" class="text-center text-muted">暫無參加者資料</td></tr>';
        } else {
            participants.forEach(participant => {
                const checkinStatus = participant.checked_in_at ?
                    '<span class="badge badge-success">已簽到</span>' :
                    '<span class="badge badge-warning">未簽到</span>';

                html += `
                    <tr>
                        <td>${participant.submitter_name || '-'}</td>
                        <td>${participant.submitter_email || '-'}</td>
                        <td>${participant.submitter_phone || '-'}</td>
                        <td>${participant.participation_level || 50}%</td>
                        <td>${checkinStatus}</td>
                        <td>
                            <div class="btn-group">
                                ${!participant.checked_in_at ?
                        `<button class="btn btn-sm btn-success" onclick="manualCheckin(${participant.id})">
                                        <i class="fas fa-check"></i> 簽到
                                    </button>` :
                        `<button class="btn btn-sm btn-warning" onclick="cancelCheckin(${participant.id})">
                                        <i class="fas fa-times"></i> 取消簽到
                                    </button>`
                    }
                                <button class="btn btn-sm btn-info" onclick="viewParticipantTracking('${participant.trace_id}')">
                                    <i class="fas fa-search"></i> 追蹤
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        res.send(html);

    } catch (error) {
        console.error('獲取專案參加者失敗:', error);
        res.send('<tr><td colspan="6" class="text-center text-danger">載入失敗</td></tr>');
    }
});

// API: 獲取專案問卷狀況 (HTML)
router.get('/projects/:id/questionnaires', authenticateSession, async (req, res) => {
    try {
        const projectId = req.params.id;

        const questionnaires = await database.query(`
            SELECT 
                q.id,
                q.title,
                q.is_active,
                q.created_at,
                COUNT(qr.id) as response_count
            FROM questionnaires q
            LEFT JOIN questionnaire_responses qr ON q.id = qr.questionnaire_id
            WHERE q.project_id = ?
            GROUP BY q.id
            ORDER BY q.created_at DESC
        `, [projectId]);

        let html = '<div class="questionnaires-list">';

        if (questionnaires.length === 0) {
            html += '<div class="text-center text-muted py-4">此專案尚未建立問卷</div>';
        } else {
            questionnaires.forEach(questionnaire => {
                const statusBadge = questionnaire.is_active ?
                    '<span class="badge badge-success">啟用中</span>' :
                    '<span class="badge badge-secondary">已停用</span>';

                html += `
                    <div class="questionnaire-item">
                        <div class="questionnaire-header">
                            <h4>${questionnaire.title}</h4>
                            ${statusBadge}
                        </div>
                        <div class="questionnaire-stats">
                            <span class="stat">回應數：${questionnaire.response_count || 0}</span>
                            <span class="stat">建立時間：${new Date(questionnaire.created_at).toLocaleDateString('zh-TW')}</span>
                        </div>
                        <div class="questionnaire-actions">
                            <button class="btn btn-sm btn-primary" onclick="viewQuestionnaire(${questionnaire.id})">
                                <i class="fas fa-eye"></i> 查看
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="editQuestionnaire(${questionnaire.id})">
                                <i class="fas fa-edit"></i> 編輯
                            </button>
                            <button class="btn btn-sm btn-info" onclick="viewQuestionnaireStats(${questionnaire.id})">
                                <i class="fas fa-chart-bar"></i> 統計
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        html += '</div>';
        res.send(html);

    } catch (error) {
        console.error('獲取專案問卷失敗:', error);
        res.send('<div class="alert alert-danger">載入問卷資料失敗</div>');
    }
});

// API: 獲取專案簽到統計 (HTML)
router.get('/projects/:id/checkin-stats', authenticateSession, async (req, res) => {
    try {
        const projectId = req.params.id;

        const stats = await database.get(`
            SELECT 
                COUNT(*) as total_participants,
                COUNT(CASE WHEN checked_in_at IS NOT NULL THEN 1 END) as checked_in_count,
                COUNT(CASE WHEN checked_in_at IS NULL THEN 1 END) as not_checked_in_count
            FROM form_submissions
            WHERE project_id = ?
        `, [projectId]);

        const checkinRate = stats.total_participants > 0 ?
            Math.round((stats.checked_in_count / stats.total_participants) * 100) : 0;

        const html = `
            <div class="checkin-stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.total_participants || 0}</div>
                    <div class="stat-label">總參加者</div>
                </div>
                <div class="stat-card success">
                    <div class="stat-value">${stats.checked_in_count || 0}</div>
                    <div class="stat-label">已簽到</div>
                </div>
                <div class="stat-card warning">
                    <div class="stat-value">${stats.not_checked_in_count || 0}</div>
                    <div class="stat-label">未簽到</div>
                </div>
                <div class="stat-card info">
                    <div class="stat-value">${checkinRate}%</div>
                    <div class="stat-label">簽到率</div>
                </div>
            </div>
        `;

        res.send(html);

    } catch (error) {
        console.error('獲取簽到統計失敗:', error);
        res.send('<div class="alert alert-danger">載入簽到統計失敗</div>');
    }
});

// API: 獲取專案簽到記錄 (HTML)
router.get('/projects/:id/checkin-records', authenticateSession, async (req, res) => {
    try {
        const projectId = req.params.id;

        const records = await database.query(`
            SELECT 
                s.submitter_name,
                s.submitter_email,
                s.checked_in_at,
                s.checkin_method,
                s.trace_id
            FROM form_submissions s
            WHERE s.project_id = ? AND s.checked_in_at IS NOT NULL
            ORDER BY s.checked_in_at DESC
            LIMIT 50
        `, [projectId]);

        let html = '<div class="checkin-records">';

        if (records.length === 0) {
            html += '<div class="text-center text-muted py-4">暫無簽到記錄</div>';
        } else {
            html += '<div class="table-responsive"><table class="table table-sm">';
            html += '<thead><tr><th>參加者</th><th>簽到時間</th><th>簽到方式</th><th>操作</th></tr></thead><tbody>';

            records.forEach(record => {
                const checkinTime = new Date(record.checked_in_at).toLocaleString('zh-TW');
                const method = record.checkin_method === 'qr_scanner' ? 'QR掃描' : '手動簽到';

                html += `
                    <tr>
                        <td>
                            <div>${record.submitter_name}</div>
                            <small class="text-muted">${record.submitter_email}</small>
                        </td>
                        <td>${checkinTime}</td>
                        <td>${method}</td>
                        <td>
                            <button class="btn btn-sm btn-info" onclick="viewParticipantTracking('${record.trace_id}')">
                                <i class="fas fa-search"></i> 追蹤
                            </button>
                        </td>
                    </tr>
                `;
            });

            html += '</tbody></table></div>';
        }

        html += '</div>';
        res.send(html);

    } catch (error) {
        console.error('獲取簽到記錄失敗:', error);
        res.send('<div class="alert alert-danger">載入簽到記錄失敗</div>');
    }
});

// API: 參加者追蹤搜尋 (HTML)
router.get('/projects/:id/tracking', authenticateSession, async (req, res) => {
    try {
        const projectId = req.params.id;
        const searchTerm = req.query.search;

        if (!searchTerm) {
            return res.send('<div class="alert alert-warning">請輸入搜尋條件</div>');
        }

        // 搜尋參加者
        const participant = await database.get(`
            SELECT * FROM form_submissions
            WHERE project_id = ? AND (
                submitter_name LIKE ? OR 
                trace_id LIKE ? OR 
                submitter_email LIKE ?
            )
            LIMIT 1
        `, [projectId, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]);

        if (!participant) {
            return res.send('<div class="alert alert-info">未找到匹配的參加者</div>');
        }

        // 獲取互動記錄
        const interactions = await database.query(`
            SELECT * FROM participant_interactions
            WHERE trace_id = ?
            ORDER BY timestamp DESC
        `, [participant.trace_id]);

        let html = `
            <div class="tracking-result">
                <div class="participant-info">
                    <h4>${participant.submitter_name}</h4>
                    <p>Trace ID: ${participant.trace_id}</p>
                    <p>電子郵件: ${participant.submitter_email}</p>
                    <p>狀態: ${participant.checked_in_at ? '已簽到' : '未簽到'}</p>
                </div>
                <div class="interactions-timeline">
                    <h5>互動記錄</h5>
        `;

        if (interactions.length === 0) {
            html += '<p class="text-muted">暫無互動記錄</p>';
        } else {
            interactions.forEach(interaction => {
                const time = new Date(interaction.timestamp).toLocaleString('zh-TW');
                html += `
                    <div class="interaction-item">
                        <div class="interaction-time">${time}</div>
                        <div class="interaction-type">${interaction.interaction_type}</div>
                        <div class="interaction-target">${interaction.interaction_target}</div>
                    </div>
                `;
            });
        }

        html += '</div></div>';
        res.send(html);

    } catch (error) {
        console.error('搜尋參加者追蹤失敗:', error);
        res.send('<div class="alert alert-danger">搜尋失敗</div>');
    }
});

module.exports = router;