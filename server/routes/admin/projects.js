/**
 * 專案管理路由
 *
 * @refactor 2025-12-01: 使用 projectService
 */
const express = require('express');
const router = express.Router();
const responses = require('../../utils/responses');
const { projectService } = require('../../services');
const vh = require('../../utils/viewHelpers');

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
        ],
        additionalCSS: ['/css/admin/pages/projects.css'],
        additionalJS: ['/js/admin/pages/projects.js']
    });
});

// 專案詳情頁面 (使用 projectService)
router.get('/:id/detail', async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await projectService.getProjectDetail(projectId);

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
            ],
            additionalCSS: ['/css/admin/pages/project-detail.css'],
            additionalJS: ['/js/admin/pages/project-detail.js']
        });

    } catch (error) {
        console.error('載入專案詳情失敗:', error);
        res.status(500).render('admin/500', {
            layout: 'admin',
            pageTitle: '伺服器錯誤'
        });
    }
});

// 專案分頁 API (使用 projectService)
router.get('/pagination', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        // 使用 Service 取得分頁資訊
        const pagination = await projectService.getPagination(page, limit);
        const { total, pages } = pagination;

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

// 新增專案模態框 (使用 projectService)
router.get('/new', async (req, res) => {
    try {
        // 使用 Service 取得可用模板
        const templates = await projectService.getActiveTemplates();

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

// 编辑专案模态框 (使用 projectService)
router.get('/:id/edit', async (req, res) => {
    try {
        const projectId = req.params.id;

        // 使用 Service 取得專案資料
        const project = await projectService.getById(projectId);

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

// 獲取專案報名連結 (使用 projectService)
router.get('/:id/registration-urls', async (req, res) => {
    try {
        const projectId = req.params.id;
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        // 使用 Service 取得報名連結資訊
        const result = await projectService.getRegistrationUrls(projectId, req.user, baseUrl);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: '專案不存在或無權限查看'
            });
        }

        return responses.success(res, result, '獲取專案報名連結成功');

    } catch (error) {
        console.error('獲取專案報名連結失敗:', error);
        return responses.serverError(res, '獲取專案報名連結失敗');
    }
});

// 獲取專案綁定的遊戲列表（HTML 片段，使用 projectService）
router.get('/:id/games', async (req, res) => {
    try {
        const projectId = req.params.id;
        const games = await projectService.getProjectGames(projectId);

        if (!games || games.length === 0) {
            return responses.html(res, `
                <tr>
                    <td colspan="6" class="text-center text-muted">
                        <i class="fas fa-info-circle"></i> 尚未綁定任何遊戲
                    </td>
                </tr>
            `);
        }

        // 使用 viewHelper 生成 HTML（如果有）或直接生成
        let html = '';
        games.forEach(game => {
            const statusBadge = game.is_active
                ? '<span class="badge bg-success">啟用</span>'
                : '<span class="badge bg-secondary">停用</span>';

            const voucherInfo = game.voucher_id
                ? `${game.voucher_name} (${game.remaining_quantity}/${game.total_quantity})`
                : '<span class="text-muted">未設定</span>';

            html += `
                <tr>
                    <td>${game.game_id}</td>
                    <td>
                        <strong>${game.game_name_zh}</strong><br>
                        <small class="text-muted">${game.game_name_en}</small><br>
                        <small class="text-info">攤位: ${game.booth_name}</small>
                    </td>
                    <td>${statusBadge}</td>
                    <td>${voucherInfo}</td>
                    <td>${game.remaining_quantity || 0}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="editProjectGame(${game.binding_id})">
                            <i class="fas fa-edit"></i> 編輯
                        </button>
                        <button class="btn btn-sm btn-info" onclick="viewGameQR(${game.binding_id})">
                            <i class="fas fa-qrcode"></i> QR Code
                        </button>
                        <button class="btn btn-sm btn-success" onclick="viewGameStats(${game.game_id})">
                            <i class="fas fa-chart-bar"></i> 統計
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="unbindGame(${game.binding_id})">
                            <i class="fas fa-unlink"></i> 解綁
                        </button>
                    </td>
                </tr>
            `;
        });

        return responses.html(res, html);

    } catch (error) {
        console.error('獲取專案遊戲列表失敗:', error);
        return responses.html(res, `
            <tr>
                <td colspan="6" class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle"></i> 載入失敗：${error.message}
                </td>
            </tr>
        `);
    }
});

// 獲取遊戲綁定的 QR Code (使用 projectService)
router.get('/:projectId/games/:bindingId/qr', async (req, res) => {
    try {
        const { projectId, bindingId } = req.params;
        const result = await projectService.getGameBindingQrCode(bindingId, projectId);

        if (!result) {
            return responses.error(res, { message: '綁定不存在' }, 404);
        }

        return responses.success(res, result);

    } catch (error) {
        console.error('獲取 QR Code 失敗:', error);
        return responses.serverError(res, '獲取 QR Code 失敗');
    }
});

// 更新遊戲綁定 (使用 projectService)
router.put('/:projectId/games/:bindingId', async (req, res) => {
    try {
        const { projectId, bindingId } = req.params;
        const { voucher_id } = req.body;

        const result = await projectService.updateGameBinding(bindingId, projectId, { voucher_id });
        return responses.success(res, null, result.message);

    } catch (error) {
        if (error.code === 'NOT_FOUND') {
            return responses.error(res, { message: error.message }, 404);
        }
        console.error('更新綁定失敗:', error);
        return responses.serverError(res, '更新綁定失敗');
    }
});

// 解除遊戲綁定 (使用 projectService)
router.delete('/:projectId/games/:bindingId', async (req, res) => {
    try {
        const { projectId, bindingId } = req.params;

        const result = await projectService.deleteGameBinding(bindingId, projectId);
        return responses.success(res, null, result.message);

    } catch (error) {
        if (error.code === 'NOT_FOUND') {
            return responses.error(res, { message: error.message }, 404);
        }
        console.error('解除綁定失敗:', error);
        return responses.serverError(res, '解除綁定失敗');
    }
});

module.exports = router;