/**
 * 表單數據管理路由
 */
const express = require('express');
const router = express.Router();
const database = require('../../config/database');
const responses = require('../../utils/responses');

// 表單數據管理頁面
router.get('/', (req, res) => {
    res.render('admin/submissions', {
        layout: 'admin',
        pageTitle: '表單數據',
        currentPage: 'submissions',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '表單數據' }
        ]
    });
});

// 搜尋表單提交記錄
router.get('/search', async (req, res) => {
    try {
        const { search, 'project-filter': projectFilter, 'status-filter': statusFilter } = req.query;

        let searchQuery = `
            SELECT fs.*, p.project_name 
            FROM form_submissions fs
            LEFT JOIN event_projects p ON fs.project_id = p.id
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

        // 生成 HTML 表格行
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
                        <button class="btn btn-sm btn-outline-primary" onclick="viewSubmission(${submission.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success" onclick="editSubmission(${submission.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteSubmission(${submission.id})">
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

// 分頁 API
router.get('/pagination', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const countQuery = 'SELECT COUNT(*) as count FROM form_submissions';
        const totalResult = await database.get(countQuery);
        const total = totalResult?.count || 0;
        const pages = Math.ceil(total / limit);

        let paginationHtml = '<div class="pagination-info">';
        paginationHtml += `<span>共 ${total} 筆提交記錄，第 ${page} 頁 / 共 ${pages} 頁</span>`;
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

        paginationHtml += `
        <script>
            function loadSubmissionsPage(page) {
                $.get('/api/admin/submissions?page=' + page).done(function(data) {
                    if (data.success) {
                        $('#submissions-table-body').html(data.html || '');
                    }
                });
                $.get('/admin/submissions/pagination?page=' + page).done(function(html) {
                    $('#pagination-container').html(html);
                });
            }
        </script>
        `;

        responses.html(res, paginationHtml);
    } catch (error) {
        console.error('Get submissions pagination error:', error);
        responses.html(res, '<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
    }
});

// 查看提交詳情（返回 Modal HTML）
router.get('/:id', async (req, res) => {
    try {
        const submissionId = req.params.id;

        const submission = await database.get(`
            SELECT s.*, p.project_name, p.project_code, p.event_date, p.event_location
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
            WHERE s.id = ?
        `, [submissionId]);

        if (!submission) {
            return res.status(404).send(`
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
                                <p>找不到指定的提交記錄</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="closeModal()">關閉</button>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        }

        // 格式化數據
        const submittedAt = new Date(submission.created_at).toLocaleString('zh-TW');
        const eventDate = submission.event_date ? new Date(submission.event_date).toLocaleDateString('zh-TW') : '-';

        const getStatusText = (status) => {
            const statusMap = {
                'pending': '待處理',
                'approved': '已批准',
                'rejected': '已拒絕',
                'confirmed': '已確認',
                'cancelled': '已取消'
            };
            return statusMap[status] || status;
        };

        const getStatusClass = (status) => {
            const statusMap = {
                'pending': 'warning',
                'approved': 'success',
                'rejected': 'danger',
                'confirmed': 'success',
                'cancelled': 'secondary'
            };
            return statusMap[status] || 'secondary';
        };

        // 解析表單數據（如果是JSON格式）
        let formData = {};
        try {
            if (submission.form_data) {
                formData = typeof submission.form_data === 'string' ?
                    JSON.parse(submission.form_data) : submission.form_data;
            }
        } catch (e) {
            console.error('解析表單數據失敗:', e);
        }

        const html = `
            <div class="modal show" style="display: flex; align-items: center; justify-content: center;">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h4 class="modal-title">提交詳情 - ${submission.submitter_name}</h4>
                            <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="submission-details">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h5>基本資訊</h5>
                                        <p><strong>姓名：</strong>${submission.submitter_name}</p>
                                        <p><strong>電子郵件：</strong>${submission.submitter_email}</p>
                                        <p><strong>聯絡電話：</strong>${submission.submitter_phone || '-'}</p>
                                        <p><strong>參與程度：</strong>${submission.participation_level || 50}%</p>
                                        <p><strong>公司：</strong>${submission.company_name || '-'}</p>
                                        <p><strong>職位：</strong>${submission.position || '-'}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <h5>專案資訊</h5>
                                        <p><strong>專案名稱：</strong>${submission.project_name || '-'}</p>
                                        <p><strong>專案代碼：</strong>${submission.project_code || '-'}</p>
                                        <p><strong>活動日期：</strong>${eventDate}</p>
                                        <p><strong>活動地點：</strong>${submission.event_location || '-'}</p>
                                        
                                        <h5 class="mt-3">通知偏好</h5>
                                        <p><strong>活動通知：</strong>${submission.activity_notifications ? '✓ 已訂閱' : '✗ 未訂閱'}</p>
                                        <p><strong>產品更新：</strong>${submission.product_updates ? '✓ 已訂閱' : '✗ 未訂閱'}</p>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-12">
                                        <h5>狀態資訊</h5>
                                        <p><strong>狀態：</strong>
                                            <span class="badge badge-${getStatusClass(submission.status)}">
                                                ${getStatusText(submission.status)}
                                            </span>
                                        </p>
                                        <p><strong>提交時間：</strong>${submittedAt}</p>
                                        <p><strong>更新時間：</strong>${new Date(submission.updated_at).toLocaleString('zh-TW')}</p>
                                    </div>
                                </div>
                                ${submission.notes ? `
                                <div class="row mt-3">
                                    <div class="col-12">
                                        <h5>備註</h5>
                                        <p>${submission.notes}</p>
                                    </div>
                                </div>
                                ` : ''}
                                ${Object.keys(formData).length > 0 ? `
                                <div class="row mt-3">
                                    <div class="col-12">
                                        <h5>額外表單數據</h5>
                                        <div class="form-data-display">
                                            ${Object.entries(formData).map(([key, value]) =>
            `<p><strong>${key}：</strong>${value}</p>`
        ).join('')}
                                        </div>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">關閉</button>
                            <button type="button" class="btn btn-primary" onclick="editSubmission(${submission.id})">編輯</button>
                            ${submission.status === 'pending' ? `
                                <button type="button" class="btn btn-success" onclick="confirmSubmission(${submission.id})">確認</button>
                                <button type="button" class="btn btn-warning" onclick="cancelSubmission(${submission.id})">取消</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        responses.html(res, html);
    } catch (error) {
        console.error('獲取提交詳情失敗:', error);
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
                            <p>載入提交詳情失敗</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">關閉</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
    }
});

// 编辑提交记录（返回 Modal HTML）
router.get('/:id/edit', async (req, res) => {
    try {
        const submissionId = req.params.id;

        const submission = await database.get(`
            SELECT s.*, p.project_name, p.project_code
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
            WHERE s.id = ?
        `, [submissionId]);

        if (!submission) {
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
                                <p>找不到指定的提交记录</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        }

        // 获取所有项目供选择
        const projects = await database.query('SELECT id, project_name FROM event_projects ORDER BY project_name');

        const html = `
            <div class="modal show" style="display: flex; align-items: center; justify-content: center;">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h4 class="modal-title">编辑提交记录</h4>
                            <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="edit-submission-form">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="submitter_name">姓名 <span class="text-danger">*</span></label>
                                            <input type="text" id="submitter_name" name="submitter_name" class="form-control" 
                                                   value="${submission.submitter_name || ''}" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="submitter_email">电子邮件 <span class="text-danger">*</span></label>
                                            <input type="email" id="submitter_email" name="submitter_email" class="form-control" 
                                                   value="${submission.submitter_email || ''}" required>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="submitter_phone">联系电话</label>
                                            <input type="text" id="submitter_phone" name="submitter_phone" class="form-control" 
                                                   value="${submission.submitter_phone || ''}">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="company_name">公司名称</label>
                                            <input type="text" id="company_name" name="company_name" class="form-control" 
                                                   value="${submission.company_name || ''}">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="position">职位</label>
                                            <input type="text" id="position" name="position" class="form-control" 
                                                   value="${submission.position || ''}">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label for="project_id">所属项目</label>
                                            <select id="project_id" name="project_id" class="form-control">
                                                <option value="">请选择项目</option>
                                                ${projects.map(project =>
            `<option value="${project.id}" ${project.id == submission.project_id ? 'selected' : ''}>
                                                        ${project.project_name}
                                                    </option>`
        ).join('')}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="status">状态</label>
                                    <select id="status" name="status" class="form-control">
                                        <option value="pending" ${submission.status === 'pending' ? 'selected' : ''}>待处理</option>
                                        <option value="approved" ${submission.status === 'approved' ? 'selected' : ''}>已批准</option>
                                        <option value="rejected" ${submission.status === 'rejected' ? 'selected' : ''}>已拒绝</option>
                                        <option value="confirmed" ${submission.status === 'confirmed' ? 'selected' : ''}>已确认</option>
                                        <option value="cancelled" ${submission.status === 'cancelled' ? 'selected' : ''}>已取消</option>
                                    </select>
                                </div>
                                

                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                            <button type="button" class="btn btn-primary" onclick="submitEditSubmission(${submission.id})">
                                <i class="fas fa-save"></i> 保存修改
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                function submitEditSubmission(id) {
                    const form = document.getElementById('edit-submission-form');
                    const formData = new FormData(form);
                    const data = {};
                    
                    for (let [key, value] of formData.entries()) {
                        data[key] = value;
                    }
                    
                    $.ajax({
                        url: '/api/admin/submissions/' + id,
                        method: 'PUT',
                        data: JSON.stringify(data),
                        contentType: 'application/json',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        success: function(response) {
                            if (response.success) {
                                closeModal();
                                showNotification('提交記錄已更新', 'success');
                                // 重新載入列表
                                if (typeof window.loadSubmissions === 'function') {
                                    window.loadSubmissions();
                                }
                                if (typeof window.loadSubmissionStats === 'function') {
                                    window.loadSubmissionStats();
                                }
                                // 如果函數不存在，刷新頁面
                                if (typeof window.loadSubmissions !== 'function') {
                                    window.location.reload();
                                }
                            } else {
                                showNotification(response.message || '更新失敗', 'error');
                            }
                        },
                        error: function(xhr) {
                            console.error('更新提交记录失败:', xhr);
                            showNotification('更新提交记录失败', 'error');
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

module.exports = router;