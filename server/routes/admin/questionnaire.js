/**
 * 問卷管理路由
 */
const express = require('express');
const router = express.Router();
const database = require('../../config/database');
const responses = require('../../utils/responses');
const questionnaireController = require('../../controllers/questionnaireController');

// 問卷設計頁面
router.get('/design', (req, res) => {
    res.render('admin/questionnaire-design', {
        layout: 'admin',
        pageTitle: '問卷設計',
        currentPage: 'questionnaire-design',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '問卷設計' }
        ]
    });
});

// 問卷統計頁面
router.get('/stats', (req, res) => {
    res.render('admin/questionnaire-stats', {
        layout: 'admin',
        pageTitle: '問卷統計報告',
        currentPage: 'questionnaire-stats',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '問卷統計報告' }
        ]
    });
});

// 問卷 QR Code 頁面
router.get('/qr', (req, res) => {
    res.render('admin/questionnaire-qr', {
        layout: 'admin',
        pageTitle: '問卷 QR Code',
        currentPage: 'questionnaire-qr',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '問卷 QR Code' }
        ]
    });
});

// API端点：获取问卷统计HTML内容
router.get('/api/stats', async (req, res) => {
    try {
        const questionnaireId = req.query.questionnaire_id;

        if (!questionnaireId) {
            return res.send(`
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <div class="empty-text">
                        <h4>請選擇問卷</h4>
                        <p>請從上方下拉選單選擇要查看統計的問卷</p>
                    </div>
                </div>
            `);
        }

        const userId = req.user.id;
        const userRole = req.user.role;

        // 检查权限
        const questionnaire = await database.get(
            'SELECT project_id, title, description FROM questionnaires WHERE id = ?',
            [questionnaireId]
        );

        if (!questionnaire) {
            return res.send(`
                <div class="alert alert-danger">
                    <h4>問卷不存在</h4>
                    <p>您要查看的問卷不存在或已被刪除</p>
                </div>
            `);
        }

        if (userRole !== 'super_admin') {
            const hasPermission = await questionnaireController.checkProjectPermission(userId, questionnaire.project_id);
            if (!hasPermission) {
                return res.send(`
                    <div class="alert alert-warning">
                        <h4>無權限查看</h4>
                        <p>您無權限查看此問卷的統計資料</p>
                    </div>
                `);
            }
        }

        // 获取基本统计
        const basicStats = await database.get(`
            SELECT
                COUNT(DISTINCT qv.trace_id) as view_count,
                COUNT(DISTINCT qr.trace_id) as response_count,
                COUNT(DISTINCT CASE WHEN qr.is_completed = 1 THEN qr.trace_id END) as completed_count
            FROM questionnaire_views qv
            LEFT JOIN questionnaire_responses qr ON qv.questionnaire_id = qr.questionnaire_id
                AND qv.trace_id = qr.trace_id
            WHERE qv.questionnaire_id = ?
        `, [questionnaireId]);

        // 获取最近的回应
        const recentResponses = await database.query(`
            SELECT 
                qr.response_data,
                qr.completed_at,
                qr.respondent_name,
                qr.respondent_email
            FROM questionnaire_responses qr
            WHERE qr.questionnaire_id = ? AND qr.is_completed = 1
            ORDER BY qr.completed_at DESC
            LIMIT 10
        `, [questionnaireId]);

        // 获取问卷状态
        const now = new Date();
        const endDate = questionnaire.end_date ? new Date(questionnaire.end_date) : null;
        const isActive = questionnaire.is_active === 1;
        let status = '進行中';

        if (!isActive) {
            status = '已停用';
        } else if (endDate && now > endDate) {
            status = '已結束';
        }

        let html = `
            <div class="stats-container">
                <div class="questionnaire-header">
                    <h3>${questionnaire.title}</h3>
                    <p>${questionnaire.description || '暫無描述'}</p>
                </div>

                <div class="stats-summary">
                    <div class="stat-card">
                        <h4>總回應數</h4>
                        <div class="stat-number">${basicStats.completed_count || 0}</div>
                    </div>
                    <div class="stat-card">
                        <h4>問卷狀態</h4>
                        <div class="stat-text">${status}</div>
                    </div>
                </div>
        `;

        if (recentResponses.length > 0) {
            html += `<div class="responses-list"><h4>最新回應</h4>`;

            recentResponses.forEach(response => {
                let responseTime = '未知時間';
                if (response.completed_at) {
                    try {
                        const date = new Date(response.completed_at);
                        responseTime = date.toLocaleString('zh-TW');
                    } catch (e) {
                        responseTime = '時間格式錯誤';
                    }
                }

                let responseDisplay = '無回應資料';
                if (response.response_data) {
                    try {
                        const data = JSON.parse(response.response_data);
                        const firstAnswer = Object.values(data)[0];
                        responseDisplay = firstAnswer ? String(firstAnswer).substring(0, 100) + '...' : '空回應';
                    } catch (e) {
                        responseDisplay = '資料格式錯誤';
                    }
                }

                html += `
                    <div class="response-item">
                        <div class="response-meta">
                            <strong>${response.respondent_name || '匿名'}</strong>
                            <span class="response-time">${responseTime}</span>
                        </div>
                        <div class="response-data">${responseDisplay}</div>
                    </div>
                `;
            });

            html += `</div>`;
        } else {
            html += `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <div class="empty-text">
                        <h4>尚無問卷回應</h4>
                        <p>還沒有人填寫這份問卷</p>
                    </div>
                </div>
            `;
        }

        html += `</div>`;

        res.send(html);

    } catch (error) {
        console.error('獲取問卷統計失敗:', error);
        res.send(`
            <div class="alert alert-danger">
                <h4>載入失敗</h4>
                <p>無法載入問卷統計資料，請稍後再試</p>
            </div>
        `);
    }
});

// API端點：获取问卷列表HTML内容
router.get('/api/questionnaires', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const projectId = req.query.project_id;
        const search = req.query.search;
        const userId = req.user.id;
        const userRole = req.user.role;

        let query = `
            SELECT 
                q.*,
                p.project_name,
                u.full_name as creator_name,
                COUNT(qq.id) as question_count,
                COUNT(qr.id) as response_count
            FROM questionnaires q
            LEFT JOIN invitation_projects p ON q.project_id = p.id
            LEFT JOIN users u ON q.created_by = u.id
            LEFT JOIN questionnaire_questions qq ON q.id = qq.questionnaire_id
            LEFT JOIN questionnaire_responses qr ON q.id = qr.questionnaire_id AND qr.is_completed = 1
            WHERE 1=1
        `;
        let countQuery = `
            SELECT COUNT(DISTINCT q.id) as count
            FROM questionnaires q
            LEFT JOIN invitation_projects p ON q.project_id = p.id
            WHERE 1=1
        `;
        let queryParams = [];

        // 权限过滤
        if (userRole !== 'super_admin') {
            const permissionClause = ` AND (p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            ))`;
            query += permissionClause;
            countQuery += permissionClause;
            queryParams.push(userId, userId);
        }

        // 项目过滤
        if (projectId) {
            query += ` AND q.project_id = ?`;
            countQuery += ` AND q.project_id = ?`;
            queryParams.push(projectId);
        }

        // 搜索过滤
        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            query += ` AND (q.title LIKE ? OR q.description LIKE ?)`;
            countQuery += ` AND (q.title LIKE ? OR q.description LIKE ?)`;
            queryParams.push(searchTerm, searchTerm);
        }

        query += ` GROUP BY q.id ORDER BY q.created_at DESC LIMIT ? OFFSET ?`;
        const questionnaires = await database.query(query, [...queryParams, limit, offset]);

        const totalResult = await database.get(countQuery, queryParams);
        const total = totalResult.count;

        // 检查是否需要返回HTML
        if (req.query.format === 'html') {
            let html = '';

            if (questionnaires.length === 0) {
                html = `
                    <tr>
                        <td colspan="7" class="empty-state">
                            <div class="empty-icon">📝</div>
                            <div class="empty-text">
                                <h4>尚無問卷</h4>
                                <p>還沒有任何問卷，請先建立一個問卷</p>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                questionnaires.forEach(questionnaire => {
                    const statusBadge = questionnaire.is_active === 1
                        ? '<span class="badge badge-success">啟用</span>'
                        : '<span class="badge badge-warning">停用</span>';

                    const createdAt = new Date(questionnaire.created_at).toLocaleString('zh-TW');
                    const canEdit = userRole === 'super_admin' || userRole === 'project_manager';

                    html += `
                        <tr>
                            <td>
                                <div class="questionnaire-info">
                                    <strong>${questionnaire.title}</strong>
                                    <div class="questionnaire-description" style="font-size: 0.875rem; color: var(--gray-600);">
                                        ${questionnaire.description || '無描述'}
                                    </div>
                                </div>
                            </td>
                            <td>${questionnaire.project_name || '-'}</td>
                            <td><span class="question-count">${questionnaire.question_count || 0}</span></td>
                            <td><span class="response-count">${questionnaire.response_count || 0}</span></td>
                            <td>${statusBadge}</td>
                            <td>${createdAt}</td>
                            <td>
                                <div class="questionnaire-actions">
                                    <button class="btn btn-sm btn-primary" onclick="designQuestionnaire(${questionnaire.id})" title="設計問題">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-info" onclick="previewQuestionnaire(${questionnaire.id})" title="預覽問卷">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    ${canEdit ? `
                                        <button class="btn btn-sm btn-success" onclick="editQuestionnaire(${questionnaire.id})" title="編輯設定">
                                            <i class="fas fa-cog"></i>
                                        </button>
                                        <button class="btn btn-sm btn-warning" onclick="duplicateQuestionnaire(${questionnaire.id})" title="複製問卷">
                                            <i class="fas fa-copy"></i>
                                        </button>
                                        <button class="btn btn-sm ${questionnaire.is_active === 1 ? 'btn-secondary' : 'btn-success'}" 
                                                onclick="toggleQuestionnaireStatus(${questionnaire.id}, '${questionnaire.is_active === 1 ? 'active' : 'inactive'}')" 
                                                title="${questionnaire.is_active === 1 ? '停用' : '啟用'}">
                                            <i class="fas fa-${questionnaire.is_active === 1 ? 'pause' : 'play'}"></i>
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="deleteQuestionnaire(${questionnaire.id})" title="刪除問卷">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }

            res.send(html);
        } else {
            res.json({
                success: true,
                data: {
                    questionnaires,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit)
                    }
                }
            });
        }

    } catch (error) {
        console.error('獲取問卷列表失敗:', error);
        if (req.query.format === 'html') {
            res.send('<tr><td colspan="7" class="text-center text-danger">載入問卷列表失敗</td></tr>');
        } else {
            res.status(500).json({
                success: false,
                message: '獲取問卷列表失敗'
            });
        }
    }
});

// API端點：获取问卷分页信息
router.get('/api/pagination', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const projectId = req.query.project_id;
        const search = req.query.search;
        const userId = req.user.id;
        const userRole = req.user.role;

        let countQuery = `
            SELECT COUNT(DISTINCT q.id) as count
            FROM questionnaires q
            LEFT JOIN invitation_projects p ON q.project_id = p.id
            WHERE 1=1
        `;
        let queryParams = [];

        // 权限过滤
        if (userRole !== 'super_admin') {
            countQuery += ` AND (p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            ))`;
            queryParams.push(userId, userId);
        }

        // 项目过滤
        if (projectId) {
            countQuery += ` AND q.project_id = ?`;
            queryParams.push(projectId);
        }

        // 搜索过滤
        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            countQuery += ` AND (q.title LIKE ? OR q.description LIKE ?)`;
            queryParams.push(searchTerm, searchTerm);
        }

        const totalResult = await database.get(countQuery, queryParams);
        const total = totalResult.count;
        const pages = Math.ceil(total / limit);

        let paginationHtml = '<div class="pagination-info">';
        paginationHtml += `<span>共 ${total} 個問卷，第 ${page} 页 / 共 ${pages} 页</span>`;
        paginationHtml += '</div>';

        if (pages > 1) {
            paginationHtml += '<div class="pagination-controls">';

            if (page > 1) {
                paginationHtml += `<button class="btn btn-sm btn-outline-primary pagination-btn" onclick="loadQuestionnairesPage(${page - 1})">上一页</button>`;
            }

            const startPage = Math.max(1, page - 2);
            const endPage = Math.min(pages, page + 2);

            for (let i = startPage; i <= endPage; i++) {
                const activeClass = i === page ? 'btn-primary' : 'btn-outline-primary';
                paginationHtml += `<button class="btn btn-sm ${activeClass} pagination-btn" onclick="loadQuestionnairesPage(${i})">${i}</button>`;
            }

            if (page < pages) {
                paginationHtml += `<button class="btn btn-sm btn-outline-primary pagination-btn" onclick="loadQuestionnairesPage(${page + 1})">下一页</button>`;
            }

            paginationHtml += '</div>';
        }

        paginationHtml += `
        <script>
            function loadQuestionnairesPage(page) {
                loadQuestionnaires(page);
                loadQuestionnairesPagination(page);
            }
        </script>
        `;

        res.send(paginationHtml);

    } catch (error) {
        console.error('獲取問卷分頁失敗:', error);
        res.send('<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
    }
});

// 新建问卷模态框
router.get('/new', async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        // 检查权限
        if (userRole !== 'super_admin' && userRole !== 'project_manager') {
            return res.status(403).send(`
                <div class="modal show" style="display: flex; align-items: center; justify-content: center;">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h4 class="modal-title">權限不足</h4>
                                <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div class="modal-body">
                                <p>您沒有新建問卷的權限</p>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        }

        // 获取用户可访问的项目
        let projects = [];
        if (userRole === 'super_admin') {
            projects = await database.query('SELECT id, project_name FROM invitation_projects ORDER BY project_name');
        } else {
            projects = await database.query(`
                SELECT DISTINCT p.id, p.project_name 
                FROM invitation_projects p
                WHERE p.created_by = ? OR p.id IN (
                    SELECT project_id FROM user_project_permissions WHERE user_id = ?
                )
                ORDER BY p.project_name
            `, [userId, userId]);
        }

        let projectOptions = '<option value="">請選擇專案</option>';
        projects.forEach(project => {
            projectOptions += `<option value="${project.id}">${project.project_name}</option>`;
        });

        const modalHtml = `
            <div class="modal show" style="display: flex; align-items: center; justify-content: center;">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h4 class="modal-title">新建問卷</h4>
                            <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <form id="new-questionnaire-form">
                            <div class="modal-body">
                                <div class="form-group">
                                    <label for="project_id">所屬專案 <span class="text-danger">*</span></label>
                                    <select id="project_id" name="project_id" class="form-control" required>
                                        ${projectOptions}
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="title">問卷標題 <span class="text-danger">*</span></label>
                                    <input type="text" id="title" name="title" class="form-control" 
                                           placeholder="請輸入問卷標題..." required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="description">問卷描述</label>
                                    <textarea id="description" name="description" class="form-control" rows="3" 
                                              placeholder="請輸入問卷描述..."></textarea>
                                </div>
                                
                                <div class="form-group">
                                    <label for="instructions">填寫說明</label>
                                    <textarea id="instructions" name="instructions" class="form-control" rows="3" 
                                              placeholder="請輸入填寫說明..."></textarea>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="start_time">開始時間</label>
                                            <input type="datetime-local" id="start_time" name="start_time" class="form-control">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="end_time">結束時間</label>
                                            <input type="datetime-local" id="end_time" name="end_time" class="form-control">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <div class="form-check">
                                        <input type="checkbox" id="allow_multiple_submissions" name="allow_multiple_submissions" 
                                               class="form-check-input" value="1">
                                        <label for="allow_multiple_submissions" class="form-check-label">
                                            允許多次提交
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <div class="form-check">
                                        <input type="checkbox" id="is_active" name="is_active" 
                                               class="form-check-input" value="1" checked>
                                        <label for="is_active" class="form-check-label">
                                            立即啟用
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                                <button type="submit" class="btn btn-primary">建立問卷</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            
            <script>
                $('#new-questionnaire-form').on('submit', function(e) {
                    e.preventDefault();
                    
                    const formData = {
                        project_id: $('#project_id').val(),
                        title: $('#title').val(),
                        description: $('#description').val(),
                        instructions: $('#instructions').val(),
                        start_time: $('#start_time').val(),
                        end_time: $('#end_time').val(),
                        allow_multiple_submissions: $('#allow_multiple_submissions').is(':checked') ? 1 : 0,
                        is_active: $('#is_active').is(':checked') ? 1 : 0
                    };
                    
                    $.ajax({
                        url: '/api/admin/questionnaire',
                        method: 'POST',
                        data: formData,
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        success: function(response) {
                            if (response.success) {
                                showNotification('問卷建立成功', 'success');
                                closeModal();
                                loadQuestionnaires();
                                loadQuestionnairesPagination();
                            } else {
                                showNotification(response.message || '建立失敗', 'error');
                            }
                        },
                        error: function() {
                            showNotification('建立問卷失敗', 'error');
                        }
                    });
                });
            </script>
        `;

        res.send(modalHtml);

    } catch (error) {
        console.error('載入新建問卷表單失敗:', error);
        res.status(500).send(`
            <div class="modal show" style="display: flex; align-items: center; justify-content: center;">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h4 class="modal-title">錯誤</h4>
                            <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <p>載入新建問卷表單失敗</p>
                        </div>
                    </div>
                </div>
            </div>
        `);
    }
});

// 编辑问卷模态框
router.get('/:id/edit', async (req, res) => {
    try {
        const questionnaireId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;

        // 检查权限
        if (userRole !== 'super_admin' && userRole !== 'project_manager') {
            return res.status(403).send(`
                <div class="modal show" style="display: flex; align-items: center; justify-content: center;">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h4 class="modal-title">權限不足</h4>
                                <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div class="modal-body">
                                <p>您沒有編輯問卷的權限</p>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        }

        // 获取问卷信息
        const questionnaire = await database.get(`
            SELECT q.*, p.project_name 
            FROM questionnaires q
            LEFT JOIN invitation_projects p ON q.project_id = p.id
            WHERE q.id = ?
        `, [questionnaireId]);

        if (!questionnaire) {
            return res.status(404).send(`
                <div class="modal show" style="display: flex; align-items: center; justify-content: center;">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h4 class="modal-title">問卷不存在</h4>
                                <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div class="modal-body">
                                <p>您要編輯的問卷不存在或已被刪除</p>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        }

        // 检查项目权限
        if (userRole !== 'super_admin') {
            const hasPermission = await questionnaireController.checkProjectPermission(userId, questionnaire.project_id);
            if (!hasPermission) {
                return res.status(403).send(`
                    <div class="modal show" style="display: flex; align-items: center; justify-content: center;">
                        <div class="modal-dialog">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h4 class="modal-title">權限不足</h4>
                                    <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                        <span aria-hidden="true">&times;</span>
                                    </button>
                                </div>
                                <div class="modal-body">
                                    <p>您沒有編輯此問卷的權限</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `);
            }
        }

        // 获取用户可访问的项目
        let projects = [];
        if (userRole === 'super_admin') {
            projects = await database.query('SELECT id, project_name FROM invitation_projects ORDER BY project_name');
        } else {
            projects = await database.query(`
                SELECT DISTINCT p.id, p.project_name 
                FROM invitation_projects p
                WHERE p.created_by = ? OR p.id IN (
                    SELECT project_id FROM user_project_permissions WHERE user_id = ?
                )
                ORDER BY p.project_name
            `, [userId, userId]);
        }

        let projectOptions = '';
        projects.forEach(project => {
            const selected = project.id === questionnaire.project_id ? 'selected' : '';
            projectOptions += `<option value="${project.id}" ${selected}>${project.project_name}</option>`;
        });

        const modalHtml = `
            <div class="modal show" style="display: flex; align-items: center; justify-content: center;">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h4 class="modal-title">編輯問卷 - ${questionnaire.title}</h4>
                            <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <form id="edit-questionnaire-form">
                            <div class="modal-body">
                                <div class="form-group">
                                    <label for="project_id">所屬專案 <span class="text-danger">*</span></label>
                                    <select id="project_id" name="project_id" class="form-control" required>
                                        ${projectOptions}
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="title">問卷標題 <span class="text-danger">*</span></label>
                                    <input type="text" id="title" name="title" class="form-control" 
                                           value="${questionnaire.title}" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="description">問卷描述</label>
                                    <textarea id="description" name="description" class="form-control" rows="3">${questionnaire.description || ''}</textarea>
                                </div>
                                
                                <div class="form-group">
                                    <label for="instructions">填寫說明</label>
                                    <textarea id="instructions" name="instructions" class="form-control" rows="3">${questionnaire.instructions || ''}</textarea>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="start_time">開始時間</label>
                                            <input type="datetime-local" id="start_time" name="start_time" class="form-control" 
                                                   value="${questionnaire.start_time ? new Date(questionnaire.start_time).toISOString().slice(0, 16) : ''}">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="end_time">結束時間</label>
                                            <input type="datetime-local" id="end_time" name="end_time" class="form-control"
                                                   value="${questionnaire.end_time ? new Date(questionnaire.end_time).toISOString().slice(0, 16) : ''}">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <div class="form-check">
                                        <input type="checkbox" id="allow_multiple_submissions" name="allow_multiple_submissions" 
                                               class="form-check-input" value="1" ${questionnaire.allow_multiple_submissions ? 'checked' : ''}>
                                        <label for="allow_multiple_submissions" class="form-check-label">
                                            允許多次提交
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <div class="form-check">
                                        <input type="checkbox" id="is_active" name="is_active" 
                                               class="form-check-input" value="1" ${questionnaire.is_active ? 'checked' : ''}>
                                        <label for="is_active" class="form-check-label">
                                            問卷啟用
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                                <button type="submit" class="btn btn-primary">更新問卷</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            
            <script>
                $('#edit-questionnaire-form').on('submit', function(e) {
                    e.preventDefault();
                    
                    const formData = {
                        project_id: $('#project_id').val(),
                        title: $('#title').val(),
                        description: $('#description').val(),
                        instructions: $('#instructions').val(),
                        start_time: $('#start_time').val(),
                        end_time: $('#end_time').val(),
                        allow_multiple_submissions: $('#allow_multiple_submissions').is(':checked') ? 1 : 0,
                        is_active: $('#is_active').is(':checked') ? 1 : 0
                    };
                    
                    $.ajax({
                        url: '/api/admin/questionnaire/${questionnaireId}',
                        method: 'PUT',
                        data: formData,
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        success: function(response) {
                            if (response.success) {
                                showNotification('問卷更新成功', 'success');
                                closeModal();
                                loadQuestionnaires();
                                loadQuestionnairesPagination();
                            } else {
                                showNotification(response.message || '更新失敗', 'error');
                            }
                        },
                        error: function() {
                            showNotification('更新問卷失敗', 'error');
                        }
                    });
                });
            </script>
        `;

        res.send(modalHtml);

    } catch (error) {
        console.error('載入編輯問卷表單失敗:', error);
        res.status(500).send(`
            <div class="modal show" style="display: flex; align-items: center; justify-content: center;">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h4 class="modal-title">錯誤</h4>
                            <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <p>載入編輯問卷表單失敗</p>
                        </div>
                    </div>
                </div>
            </div>
        `);
    }
});

module.exports = router;