/**
 * 專案管理路由
 */
const express = require('express');
const router = express.Router();
const database = require('../../config/database');
const responses = require('../../utils/responses');

// 專案管理頁面
router.get('/', (req, res) => {
    res.render('admin/projects', {
        layout: 'admin',
        pageTitle: '專案管理',
        currentPage: 'projects',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '專案管理' }
        ]
    });
});

// 專案詳情頁面
router.get('/:id/detail', async (req, res) => {
    try {
        const projectId = req.params.id;

        // 獲取專案基本信息（包含模板資訊）
        const project = await database.get(`
            SELECT p.*, u.full_name as creator_name, t.template_name, t.id as template_id
            FROM event_projects p
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN invitation_templates t ON p.template_id = t.id
            WHERE p.id = ?
        `, [projectId]);

        if (!project) {
            return res.status(404).render('admin/404', {
                layout: 'admin',
                pageTitle: '專案不存在'
            });
        }

        res.render('admin/project-detail', {
            layout: 'admin',
            pageTitle: `專案詳情 - ${project.project_name}`,
            currentPage: 'projects',
            user: req.user,
            project: project,
            breadcrumbs: [
                { name: '儀表板', url: '/admin/dashboard' },
                { name: '專案管理', url: '/admin/projects' },
                { name: project.project_name }
            ]
        });

    } catch (error) {
        console.error('載入專案詳情失敗:', error);
        res.status(500).render('admin/500', {
            layout: 'admin',
            pageTitle: '伺服器錯誤'
        });
    }
});

// 新增專案模態框
router.get('/new', async (req, res) => {
    const modalContent = `
    <div class="modal active">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h4>新增專案</h4>
                    <button type="button" class="close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="new-project-form">
                        <div class="form-group">
                            <label for="project_name">專案名稱 <span class="text-danger">*</span></label>
                            <input type="text" id="project_name" name="project_name" class="form-control" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="project_code">專案代碼 <span class="text-danger">*</span></label>
                            <input type="text" id="project_code" name="project_code" class="form-control" required placeholder="例如：CONF2024">
                        </div>
                        
                        <div class="form-group">
                            <label for="description">專案描述</label>
                            <textarea id="description" name="description" class="form-control" rows="3" placeholder="請輸入專案描述..."></textarea>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label for="event_date">活動日期</label>
                                <input type="date" id="event_date" name="event_date" class="form-control">
                            </div>
                            <div class="form-group col-md-6">
                                <label for="event_location">活動地點</label>
                                <input type="text" id="event_location" name="event_location" class="form-control" placeholder="活動地點">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label for="max_participants">參加者上限</label>
                                <input type="number" id="max_participants" name="max_participants" class="form-control" min="1" placeholder="100">
                            </div>
                            <div class="form-group col-md-6">
                                <label for="status">專案狀態</label>
                                <select id="status" name="status" class="form-control">
                                    <option value="draft">草稿</option>
                                    <option value="active" selected>進行中</option>
                                    <option value="completed">已完成</option>
                                    <option value="cancelled">已取消</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="registration_deadline">報名截止日期</label>
                            <input type="datetime-local" id="registration_deadline" name="registration_deadline" class="form-control">
                        </div>
                        
                        <div class="form-group">
                            <label for="settings">專案設定 (JSON)</label>
                            <textarea id="settings" name="settings" class="form-control" rows="4" placeholder='{"email_notifications": true, "auto_approval": false}'></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                    <button type="button" class="btn btn-primary" onclick="submitNewProject()">
                        <i class="fas fa-save"></i> 建立專案
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
        
        function submitNewProject() {
            const form = document.getElementById('new-project-form');
            const formData = new FormData(form);
            const data = {};
            
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            
            // 驗證必填欄位
            if (!data.project_name || !data.project_code) {
                showAlert('請填寫專案名稱和專案代碼', 'danger');
                return;
            }
            
            // 驗證設定 JSON 格式
            if (data.settings && data.settings.trim()) {
                try {
                    JSON.parse(data.settings);
                } catch (e) {
                    showAlert('專案設定格式錯誤，請輸入有效的 JSON 格式', 'danger');
                    return;
                }
            }
            
            $.ajax({
                url: '/api/admin/projects',
                method: 'POST',
                data: data,
                success: function(response) {
                    if (response.success) {
                        showAlert('專案建立成功', 'success');
                        closeModal();
                        // 重新載入專案列表
                        if (window.loadProjects) {
                            window.loadProjects();
                        }
                    } else {
                        showAlert(response.message || '建立失敗', 'danger');
                    }
                },
                error: function() {
                    showAlert('建立專案時發生錯誤', 'danger');
                }
            });
        }
        
        // 顯示提示信息的函數
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

// 專案分頁 API
router.get('/pagination', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        // 簡化查詢，暫時不考慮權限問題
        const countQuery = 'SELECT COUNT(*) as count FROM event_projects';

        const totalResult = await database.get(countQuery);
        const total = totalResult?.count || 0;
        const pages = Math.ceil(total / limit);

        let paginationHtml = '<div class="pagination-info">';
        paginationHtml += `<span>共 ${total} 個專案，第 ${page} 頁 / 共 ${pages} 頁</span>`;
        paginationHtml += '</div>';

        if (pages > 1) {
            paginationHtml += '<div class="pagination-buttons">';

            // 上一頁
            if (page > 1) {
                paginationHtml += `<button class="btn btn-sm btn-outline-primary" onclick="loadProjectsPage(${page - 1})">上一頁</button>`;
            }

            // 頁碼
            const startPage = Math.max(1, page - 2);
            const endPage = Math.min(pages, page + 2);

            for (let i = startPage; i <= endPage; i++) {
                const activeClass = i === page ? 'btn-primary' : 'btn-outline-primary';
                paginationHtml += `<button class="btn btn-sm ${activeClass}" onclick="loadProjectsPage(${i})">${i}</button>`;
            }

            // 下一頁
            if (page < pages) {
                paginationHtml += `<button class="btn btn-sm btn-outline-primary" onclick="loadProjectsPage(${page + 1})">下一頁</button>`;
            }

            paginationHtml += '</div>';
        }

        paginationHtml += `
        <script>
            function loadProjectsPage(page) {
                const url = '/api/admin/projects?page=' + page;
                $.get(url).done(function(data) {
                    if (data.success) {
                        $('#projects-table-body').html(data.html || '');
                    }
                });
                $.get('/admin/projects/pagination?page=' + page).done(function(html) {
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

// 編輯專案模態框
router.get('/:id/edit', async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await database.get('SELECT * FROM event_projects WHERE id = ?', [projectId]);

        if (!project) {
            return responses.html(res, '<div class="alert alert-danger">專案不存在</div>');
        }

        const modalContent = `
        <div class="modal active">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4>編輯專案 - ${project.project_name}</h4>
                        <button type="button" class="close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="edit-project-form">
                            <input type="hidden" name="id" value="${project.id}">
                            
                            <div class="form-group">
                                <label for="edit_project_name">專案名稱 <span class="text-danger">*</span></label>
                                <input type="text" id="edit_project_name" name="project_name" class="form-control" value="${project.project_name}" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit_project_code">專案代碼 <span class="text-danger">*</span></label>
                                <input type="text" id="edit_project_code" name="project_code" class="form-control" value="${project.project_code}" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit_description">專案描述</label>
                                <textarea id="edit_description" name="description" class="form-control" rows="3">${project.description || ''}</textarea>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group col-md-6">
                                    <label for="edit_event_date">活動日期</label>
                                    <input type="date" id="edit_event_date" name="event_date" class="form-control" value="${project.event_date || ''}">
                                </div>
                                <div class="form-group col-md-6">
                                    <label for="edit_event_location">活動地點</label>
                                    <input type="text" id="edit_event_location" name="event_location" class="form-control" value="${project.event_location || ''}" placeholder="活動地點">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit_status">專案狀態</label>
                                <select id="edit_status" name="status" class="form-control">
                                    <option value="draft" ${project.status === 'draft' ? 'selected' : ''}>草稿</option>
                                    <option value="active" ${project.status === 'active' ? 'selected' : ''}>進行中</option>
                                    <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>已完成</option>
                                    <option value="cancelled" ${project.status === 'cancelled' ? 'selected' : ''}>已取消</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                        <button type="button" class="btn btn-primary" onclick="submitEditProject()">
                            <i class="fas fa-save"></i> 更新專案
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
            
            function submitEditProject() {
                const form = document.getElementById('edit-project-form');
                const formData = new FormData(form);
                const data = {};
                
                for (let [key, value] of formData.entries()) {
                    data[key] = value;
                }
                
                const projectId = data.id;
                delete data.id; // 移除 ID，不要在更新數據中包含
                
                $.ajax({
                    url: '/api/admin/projects/' + projectId,
                    method: 'PUT',
                    data: data,
                    success: function(response) {
                        if (response.success) {
                            showAlert('專案更新成功', 'success');
                            closeModal();
                            if (window.loadProjects) {
                                window.loadProjects();
                            }
                        } else {
                            showAlert(response.message || '更新失敗', 'danger');
                        }
                    },
                    error: function() {
                        showAlert('更新專案時發生錯誤', 'danger');
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
    } catch (error) {
        console.error('Get edit project modal error:', error);
        responses.html(res, '<div class="alert alert-danger">載入編輯表單失敗</div>');
    }
});

// 新增專案模態框
router.get('/new', async (req, res) => {
    try {
        const database = require('../../config/database');

        // 獲取可用的模板
        const templates = await database.all(
            'SELECT id, template_name, category FROM invitation_templates WHERE status = "active" ORDER BY category, template_name'
        );

        const modalContent = `
        <div class="modal active">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4>新增專案</h4>
                        <button type="button" class="close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="new-project-form">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="project_name">專案名稱 *</label>
                                        <input type="text" id="project_name" name="project_name" class="form-control" required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="project_code">專案代碼 *</label>
                                        <input type="text" id="project_code" name="project_code" class="form-control" required>
                                        <small class="form-text text-muted">唯一識別碼，建議使用英文字母和數字</small>
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="event_date">活動日期 *</label>
                                        <input type="datetime-local" id="event_date" name="event_date" class="form-control" required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="status">狀態 *</label>
                                        <select id="status" name="status" class="form-control" required>
                                            <option value="active">進行中</option>
                                            <option value="completed">已完成</option>
                                            <option value="cancelled">已取消</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="event_location">活動地點</label>
                                        <input type="text" id="event_location" name="event_location" class="form-control">
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="template_id">使用模板</label>
                                        <select id="template_id" name="template_id" class="form-control">
                                            <option value="">請選擇模板（可選）</option>
                                            ${templates.map(t => `<option value="${t.id}">[${t.category}] ${t.template_name}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="description">專案描述</label>
                                <textarea id="description" name="description" class="form-control" rows="4" placeholder="活動說明、目標受眾、注意事項等..."></textarea>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="max_participants">最大參與人數</label>
                                        <input type="number" id="max_participants" name="max_participants" class="form-control" min="1">
                                        <small class="form-text text-muted">不設限請留空</small>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="registration_deadline">報名截止日期</label>
                                        <input type="datetime-local" id="registration_deadline" name="registration_deadline" class="form-control">
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                        <button type="button" class="btn btn-primary" onclick="saveNewProject()">建立專案</button>
                    </div>
                </div>
            </div>
        </div>
        <script>
            function saveNewProject() {
                const formData = {
                    project_name: $('#project_name').val(),
                    project_code: $('#project_code').val(),
                    event_date: $('#event_date').val(),
                    status: $('#status').val(),
                    event_location: $('#event_location').val(),
                    template_id: $('#template_id').val() || null,
                    description: $('#description').val(),
                    max_participants: $('#max_participants').val() ? parseInt($('#max_participants').val()) : null,
                    registration_deadline: $('#registration_deadline').val() || null
                };

                $.ajax({
                    url: '/api/admin/projects',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    data: JSON.stringify(formData),
                    success: function(response) {
                        if (response.success) {
                            alert('專案建立成功');
                            closeModal();
                            if (typeof loadProjects === 'function') loadProjects();
                        } else {
                            alert('建立失敗：' + response.message);
                        }
                    },
                    error: function(xhr) {
                        alert('建立失敗：' + (xhr.responseJSON?.message || '系統錯誤'));
                    }
                });
            }

            // 自動生成專案代碼
            $('#project_name').on('input', function() {
                const name = $(this).val();
                if (name && !$('#project_code').val()) {
                    const code = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
                                    .toLowerCase()
                                    .substring(0, 10) + '_' + Date.now().toString().slice(-4);
                    $('#project_code').val(code);
                }
            });
        </script>
        `;

        return responses.html(res, modalContent);
    } catch (error) {
        console.error('載入新增專案模態框失敗:', error);
        return responses.html(res, '<div class="alert alert-danger">載入失敗</div>');
    }
});

// 编辑专案模态框
router.get('/:id/edit', async (req, res) => {
    try {
        const projectId = req.params.id;

        const project = await database.get(`
            SELECT * FROM event_projects WHERE id = ?
        `, [projectId]);

        if (!project) {
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
                                <p>找不到指定的专案</p>
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
                            <h4 class="modal-title">编辑专案</h4>
                            <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="edit-project-form">
                                <div class="form-group">
                                    <label for="project_name">专案名称 <span class="text-danger">*</span></label>
                                    <input type="text" id="project_name" name="project_name" class="form-control" 
                                           value="${project.project_name || ''}" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="project_code">专案代码 <span class="text-danger">*</span></label>
                                    <input type="text" id="project_code" name="project_code" class="form-control" 
                                           value="${project.project_code || ''}" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="description">专案描述</label>
                                    <textarea id="description" name="description" class="form-control" rows="3">${project.description || ''}</textarea>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="event_date">活动日期</label>
                                            <input type="date" id="event_date" name="event_date" class="form-control" 
                                                   value="${project.event_date || ''}">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="event_location">活动地点</label>
                                            <input type="text" id="event_location" name="event_location" class="form-control" 
                                                   value="${project.event_location || ''}">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="event_type">活动类型</label>
                                            <select id="event_type" name="event_type" class="form-control">
                                                <option value="conference" ${project.event_type === 'conference' ? 'selected' : ''}>会议</option>
                                                <option value="seminar" ${project.event_type === 'seminar' ? 'selected' : ''}>研讨会</option>
                                                <option value="workshop" ${project.event_type === 'workshop' ? 'selected' : ''}>工作坊</option>
                                                <option value="exhibition" ${project.event_type === 'exhibition' ? 'selected' : ''}>展览</option>
                                                <option value="party" ${project.event_type === 'party' ? 'selected' : ''}>聚会</option>
                                                <option value="other" ${project.event_type === 'other' ? 'selected' : ''}>其他</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="status">状态</label>
                                            <select id="status" name="status" class="form-control">
                                                <option value="draft" ${project.status === 'draft' ? 'selected' : ''}>草稿</option>
                                                <option value="active" ${project.status === 'active' ? 'selected' : ''}>进行中</option>
                                                <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>已完成</option>
                                                <option value="cancelled" ${project.status === 'cancelled' ? 'selected' : ''}>已取消</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                            <button type="button" class="btn btn-primary" onclick="submitEditProject(${project.id})">
                                <i class="fas fa-save"></i> 保存修改
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                function submitEditProject(id) {
                    const form = document.getElementById('edit-project-form');
                    const formData = new FormData(form);
                    const data = {};
                    
                    for (let [key, value] of formData.entries()) {
                        data[key] = value;
                    }
                    
                    $.ajax({
                        url: '/api/admin/projects/' + id,
                        method: 'PUT',
                        data: JSON.stringify(data),
                        contentType: 'application/json',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        success: function(response) {
                            if (response.success) {
                                closeModal();
                                showNotification('专案已更新', 'success');
                                loadProjects();
                                loadProjectsPagination();
                            } else {
                                showNotification(response.message || '更新失败', 'error');
                            }
                        },
                        error: function(xhr) {
                            console.error('更新专案失败:', xhr);
                            showNotification('更新专案失败', 'error');
                        }
                    });
                }
                
                function closeModal() {
                    document.getElementById('modal-container').innerHTML = '';
                    $('body').removeClass('modal-open');
                }
            </script>
        `;

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

// 獲取專案報名連結
router.get('/:id/registration-urls', async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;

        // 檢查專案權限 (這裡簡化，實際可以根據需要添加更複雜的權限檢查)
        const project = await database.get(`
            SELECT id, project_name, project_code, status, description, event_date, event_location
            FROM event_projects 
            WHERE id = ? AND (created_by = ? OR ? = 'super_admin')
        `, [projectId, userId, userRole]);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: '專案不存在或無權限查看'
            });
        }

        // 生成各種報名連結
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const registrationUrls = {
            primary: `${baseUrl}/register/${project.project_code}`,
            legacy: `${baseUrl}/form?project=${project.project_code}`,
            qr_direct: `${baseUrl}/qr?project=${project.project_code}`
        };

        // 獲取專案統計
        const stats = await database.get(`
            SELECT 
                COUNT(*) as total_submissions,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_submissions,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_submissions,
                COUNT(CASE WHEN checked_in_at IS NOT NULL THEN 1 END) as checked_in_count
            FROM form_submissions WHERE project_id = ?
        `, [projectId]);

        return responses.success(res, {
            project: {
                id: project.id,
                name: project.project_name,
                code: project.project_code,
                status: project.status,
                description: project.description,
                event_date: project.event_date,
                event_location: project.event_location
            },
            registration_urls: registrationUrls,
            statistics: stats || { total_submissions: 0, pending_submissions: 0, approved_submissions: 0, checked_in_count: 0 },
            is_open_for_registration: project.status === 'active'
        }, '獲取專案報名連結成功');

    } catch (error) {
        console.error('獲取專案報名連結失敗:', error);
        return responses.serverError(res, '獲取專案報名連結失敗');
    }
});

module.exports = router;