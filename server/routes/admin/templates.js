/**
 * 模板管理路由
 */
const express = require('express');
const router = express.Router();
const database = require('../../config/database');
const responses = require('../../utils/responses');

// 活動模板頁面
router.get('/', (req, res) => {
    res.render('admin/templates', {
        layout: 'admin',
        pageTitle: '活動模板',
        currentPage: 'templates',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '活動模板' }
        ]
    });
});

// 新增模板模態框
router.get('/new', async (req, res) => {
    const modalContent = `
    <div class="modal active">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h4>新增模板</h4>
                    <button type="button" class="close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="new-template-form">
                        <div class="form-group">
                            <label for="template_name">模板名稱 <span class="text-danger">*</span></label>
                            <input type="text" id="template_name" name="template_name" class="form-control" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="template_type">模板類型 <span class="text-danger">*</span></label>
                            <select id="template_type" name="template_type" class="form-control" required>
                                <option value="">請選擇</option>
                                <option value="email">電子郵件邀請函</option>
                                <option value="webpage">網頁邀請函</option>
                                <option value="pdf">PDF 邀請函</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="template_content">模板內容 <span class="text-danger">*</span></label>
                            <textarea id="template_content" name="template_content" class="form-control" rows="8" required placeholder="請輸入模板的 HTML 內容..."></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="css_styles">CSS 樣式</label>
                            <textarea id="css_styles" name="css_styles" class="form-control" rows="4" placeholder="請輸入 CSS 樣式..."></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="js_scripts">JavaScript 腳本</label>
                            <textarea id="js_scripts" name="js_scripts" class="form-control" rows="4" placeholder="請輸入 JavaScript 代碼..."></textarea>
                        </div>
                        
                        <div class="form-group">
                            <div class="checkbox">
                                <label>
                                    <input type="checkbox" id="is_default" name="is_default" value="1">
                                    設為預設模板
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                    <button type="button" class="btn btn-primary" onclick="submitNewTemplate()">
                        <i class="fas fa-save"></i> 儲存模板
                    </button>
                </div>
            </div>
        </div>
    </div>
    <script>
        function closeModal() {
            document.getElementById('modal-container').innerHTML = '';
        }
        
        function submitNewTemplate() {
            const form = document.getElementById('new-template-form');
            const formData = new FormData(form);
            const data = {};
            
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            
            // 模板內容需要解析為對象
            if (data.template_content) {
                try {
                    // 如果是 JSON 格式，解析它
                    JSON.parse(data.template_content);
                } catch (e) {
                    // 如果不是 JSON，包裝成簡單對象
                    data.template_content = { html: data.template_content };
                }
            }
            
            $.ajax({
                url: '/api/admin/templates',
                method: 'POST',
                data: data,
                success: function(response) {
                    if (response.success) {
                        showNotification('模板創建成功', 'success');
                        closeModal();
                        // 重新載入模板列表
                        if (window.loadTemplates) {
                            window.loadTemplates();
                        }
                    } else {
                        showNotification(response.message || '創建失敗', 'error');
                    }
                },
                error: function() {
                    showNotification('創建模板時發生錯誤', 'error');
                }
            });
        }
    </script>
    `;

    responses.html(res, modalContent);
});

// 模板預覽
router.get('/:id/preview', async (req, res) => {
    try {
        const templateId = req.params.id;
        const template = await database.get('SELECT * FROM invitation_templates WHERE id = ?', [templateId]);

        if (!template) {
            return responses.html(res, '<div class="alert alert-danger">模板不存在</div>');
        }

        // 解析模板内容
        let templateContent = '<p>無預覽內容</p>';
        if (template.template_content) {
            try {
                // 尝试解析JSON格式的模板内容
                const parsedContent = JSON.parse(template.template_content);
                if (parsedContent.html) {
                    templateContent = parsedContent.html;
                } else if (typeof parsedContent === 'string') {
                    templateContent = parsedContent;
                }
            } catch (e) {
                // 如果不是JSON，直接使用内容
                templateContent = template.template_content;
            }
        }

        // 模拟数据替换变量
        const sampleData = {
            '{{event_name}}': '企業數位轉型研討會',
            '{{participant_name}}': '張先生/女士',
            '{{event_date}}': '2024年12月15日',
            '{{event_time}}': '下午2:00',
            '{{event_location}}': '台北國際會議中心',
            '{{organizer_name}}': '主辦單位名稱'
        };

        // 替换模板变量
        let previewContent = templateContent;
        Object.entries(sampleData).forEach(([placeholder, value]) => {
            previewContent = previewContent.replace(new RegExp(placeholder, 'g'), value);
        });

        const previewHtml = `
            <div class="modal show" style="display: flex;">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h4 class="modal-title">模板預覽 - ${template.template_name}</h4>
                            <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="template-info mb-3">
                                <h6>模板信息：</h6>
                                <p><strong>模板類型：</strong> ${template.template_type}</p>
                                <p><strong>創建時間：</strong> ${new Date(template.created_at).toLocaleString('zh-TW')}</p>
                            </div>
                            <hr>
                            <div class="template-preview-content" style="border: 1px solid #ddd; padding: 20px; background: #f9f9f9;">
                                ${previewContent}
                            </div>
                            ${template.css_styles ? `
                            <style>
                                .template-preview-content {
                                    ${template.css_styles}
                                }
                            </style>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">關閉</button>
                            <button type="button" class="btn btn-primary" onclick="editTemplate(${template.id})">編輯模板</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        responses.html(res, previewHtml);
    } catch (error) {
        console.error('模板預覽失敗:', error);
        responses.html(res, '<div class="alert alert-danger">載入模板預覽失敗</div>');
    }
});

// 編輯模板模態框
router.get('/:id/edit', async (req, res) => {
    try {
        const templateId = req.params.id;
        const template = await database.get('SELECT * FROM invitation_templates WHERE id = ?', [templateId]);

        if (!template) {
            return responses.html(res, '<div class="alert alert-danger">模板不存在</div>');
        }

        const modalContent = `
        <div class="modal active">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4>編輯模板 - ${template.template_name}</h4>
                        <button type="button" class="close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="edit-template-form">
                            <input type="hidden" name="id" value="${template.id}">
                            
                            <div class="form-group">
                                <label for="edit_template_name">模板名稱 <span class="text-danger">*</span></label>
                                <input type="text" id="edit_template_name" name="template_name" class="form-control" value="${template.template_name}" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit_template_type">模板類型 <span class="text-danger">*</span></label>
                                <select id="edit_template_type" name="template_type" class="form-control" required>
                                    <option value="email" ${template.template_type === 'email' ? 'selected' : ''}>電子郵件邀請函</option>
                                    <option value="webpage" ${template.template_type === 'webpage' ? 'selected' : ''}>網頁邀請函</option>
                                    <option value="pdf" ${template.template_type === 'pdf' ? 'selected' : ''}>PDF 邀請函</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit_template_content">模板內容 <span class="text-danger">*</span></label>
                                <textarea id="edit_template_content" name="template_content" class="form-control" rows="8" required>${template.template_content || ''}</textarea>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit_css_styles">CSS 樣式</label>
                                <textarea id="edit_css_styles" name="css_styles" class="form-control" rows="4">${template.css_styles || ''}</textarea>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit_js_scripts">JavaScript 腳本</label>
                                <textarea id="edit_js_scripts" name="js_scripts" class="form-control" rows="4">${template.js_scripts || ''}</textarea>
                            </div>
                            
                            <div class="form-group">
                                <div class="checkbox">
                                    <label>
                                        <input type="checkbox" id="edit_is_default" name="is_default" value="1" ${template.is_default ? 'checked' : ''}>
                                        設為預設模板
                                    </label>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                        <button type="button" class="btn btn-primary" onclick="submitEditTemplate()">
                            <i class="fas fa-save"></i> 更新模板
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
            
            function submitEditTemplate() {
                const form = document.getElementById('edit-template-form');
                const formData = new FormData(form);
                const data = {};
                
                for (let [key, value] of formData.entries()) {
                    data[key] = value;
                }
                
                const templateId = data.id;
                delete data.id;
                
                $.ajax({
                    url: '/api/admin/templates/' + templateId,
                    method: 'PUT',
                    data: data,
                    success: function(response) {
                        if (response.success) {
                            showNotification('模板更新成功', 'success');
                            closeModal();
                            if (window.loadTemplates) {
                                window.loadTemplates();
                            }
                        } else {
                            showNotification(response.message || '更新失敗', 'error');
                        }
                    },
                    error: function() {
                        showNotification('更新模板時發生錯誤', 'error');
                    }
                });
            }
        </script>
        `;

        responses.html(res, modalContent);
    } catch (error) {
        console.error('Get edit template modal error:', error);
        responses.html(res, '<div class="alert alert-danger">載入編輯表單失敗</div>');
    }
});

// 新增模板模態框
router.get('/new', async (req, res) => {
    try {
        const modalContent = `
        <div class="modal active">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4>新增模板</h4>
                        <button type="button" class="close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="new-template-form">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="template_name">模板名稱 *</label>
                                        <input type="text" id="template_name" name="template_name" class="form-control" required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="category">分類 *</label>
                                        <select id="category" name="category" class="form-control" required>
                                            <option value="">請選擇分類</option>
                                            <option value="invitation">邀請函</option>
                                            <option value="notification">通知</option>
                                            <option value="email">電子郵件</option>
                                            <option value="form">表單</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="status">狀態 *</label>
                                        <select id="status" name="status" class="form-control" required>
                                            <option value="active">啟用</option>
                                            <option value="inactive">停用</option>
                                            <option value="draft">草稿</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label for="tags">標籤</label>
                                        <input type="text" id="tags" name="tags" class="form-control" placeholder="使用逗號分隔多個標籤">
                                        <small class="form-text text-muted">例如：正式,活動,邀請</small>
                                    </div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="description">描述</label>
                                <textarea id="description" name="description" class="form-control" rows="3" placeholder="模板用途說明..."></textarea>
                            </div>
                            <div class="form-group">
                                <label for="html_content">HTML 內容 *</label>
                                <textarea id="html_content" name="html_content" class="form-control" rows="10" required placeholder="輸入HTML模板內容..."></textarea>
                                <small class="form-text text-muted">支援變數：{{project_name}}, {{event_date}}, {{participant_name}} 等</small>
                            </div>
                            <div class="form-group">
                                <label for="css_styles">CSS 樣式</label>
                                <textarea id="css_styles" name="css_styles" class="form-control" rows="8" placeholder="輸入CSS樣式..."></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                        <button type="button" class="btn btn-info" onclick="previewNewTemplate()">預覽</button>
                        <button type="button" class="btn btn-primary" onclick="saveNewTemplate()">儲存模板</button>
                    </div>
                </div>
            </div>
        </div>
        <script>
            function saveNewTemplate() {
                const formData = {
                    template_name: $('#template_name').val(),
                    category: $('#category').val(),
                    status: $('#status').val(),
                    tags: $('#tags').val(),
                    description: $('#description').val(),
                    html_content: $('#html_content').val(),
                    css_styles: $('#css_styles').val()
                };

                $.ajax({
                    url: '/api/admin/templates',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    data: JSON.stringify(formData),
                    success: function(response) {
                        if (response.success) {
                            alert('模板新增成功');
                            closeModal();
                            if (typeof loadTemplates === 'function') loadTemplates();
                        } else {
                            alert('新增失敗：' + response.message);
                        }
                    },
                    error: function(xhr) {
                        alert('新增失敗：' + (xhr.responseJSON?.message || '系統錯誤'));
                    }
                });
            }

            function previewNewTemplate() {
                const htmlContent = $('#html_content').val();
                const cssStyles = $('#css_styles').val();
                
                if (!htmlContent.trim()) {
                    alert('請先輸入HTML內容');
                    return;
                }

                const previewWindow = window.open('', '_blank', 'width=800,height=600');
                previewWindow.document.write(\`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>模板預覽</title>
                        <style>\${cssStyles}</style>
                    </head>
                    <body>
                        \${htmlContent}
                    </body>
                    </html>
                \`);
                previewWindow.document.close();
            }
        </script>
        `;

        return responses.html(res, modalContent);
    } catch (error) {
        console.error('載入新增模板模態框失敗:', error);
        return responses.html(res, '<div class="alert alert-danger">載入失敗</div>');
    }
});

// 编辑模板模态框
router.get('/:id/edit', async (req, res) => {
    try {
        const templateId = req.params.id;

        const template = await database.get(`
            SELECT * FROM invitation_templates WHERE id = ?
        `, [templateId]);

        if (!template) {
            return res.status(404).send(`
                <div class="modal show" style="display: flex;">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h4 class="modal-title">错误</h4>
                                <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div class="modal-body">
                                <p>找不到指定的模板</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        }

        // 解析模板内容（如果是JSON格式）
        let templateContent = template.template_content || '';
        if (typeof templateContent === 'string') {
            try {
                const parsed = JSON.parse(templateContent);
                if (parsed.html) {
                    templateContent = parsed.html;
                }
            } catch (e) {
                // 如果不是JSON，直接使用原内容
            }
        }

        const html = `
            <div class="modal show" style="display: flex;">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h4 class="modal-title">编辑模板</h4>
                            <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="edit-template-form">
                                <div class="form-group">
                                    <label for="template_name">模板名称 <span class="text-danger">*</span></label>
                                    <input type="text" id="template_name" name="template_name" class="form-control" 
                                           value="${template.template_name || ''}" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="template_type">模板类型 <span class="text-danger">*</span></label>
                                    <select id="template_type" name="template_type" class="form-control" required>
                                        <option value="">请选择</option>
                                        <option value="email" ${template.template_type === 'email' ? 'selected' : ''}>电子邮件邀请函</option>
                                        <option value="webpage" ${template.template_type === 'webpage' ? 'selected' : ''}>网页邀请函</option>
                                        <option value="pdf" ${template.template_type === 'pdf' ? 'selected' : ''}>PDF 邀请函</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="template_content">模板内容 <span class="text-danger">*</span></label>
                                    <textarea id="template_content" name="template_content" class="form-control" rows="8" 
                                              required placeholder="请输入模板的 HTML 内容...">${templateContent}</textarea>
                                </div>
                                
                                <div class="form-group">
                                    <label for="css_styles">CSS 样式</label>
                                    <textarea id="css_styles" name="css_styles" class="form-control" rows="4" 
                                              placeholder="请输入 CSS 样式...">${template.css_styles || ''}</textarea>
                                </div>
                                
                                <div class="form-group">
                                    <label for="js_scripts">JavaScript 脚本</label>
                                    <textarea id="js_scripts" name="js_scripts" class="form-control" rows="4" 
                                              placeholder="请输入 JavaScript 代码...">${template.js_scripts || ''}</textarea>
                                </div>
                                
                                <div class="form-group">
                                    <div class="checkbox">
                                        <label>
                                            <input type="checkbox" id="is_default" name="is_default" value="1" 
                                                   ${template.is_default ? 'checked' : ''}>
                                            设为预设模板
                                        </label>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                            <button type="button" class="btn btn-primary" onclick="submitEditTemplate(${template.id})">
                                <i class="fas fa-save"></i> 保存修改
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                function submitEditTemplate(id) {
                    const form = document.getElementById('edit-template-form');
                    const formData = new FormData(form);
                    const data = {};
                    
                    for (let [key, value] of formData.entries()) {
                        data[key] = value;
                    }
                    
                    // 处理复选框
                    if (!data.is_default) {
                        data.is_default = 0;
                    }
                    
                    // 模板内容需要解析为对象
                    if (data.template_content) {
                        try {
                            // 尝试解析为 JSON，如果失败则使用原始内容
                            data.template_content = JSON.stringify({
                                html: data.template_content,
                                subject: data.template_name || '邀请函'
                            });
                        } catch (e) {
                            // 如果解析失败，保持原样
                        }
                    }
                    
                    $.ajax({
                        url: '/api/admin/templates/' + id,
                        method: 'PUT',
                        data: JSON.stringify(data),
                        contentType: 'application/json',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        success: function(response) {
                            if (response.success) {
                                closeModal();
                                showNotification('模板已更新', 'success');
                                loadTemplates();
                                loadTemplatesPagination();
                            } else {
                                showNotification(response.message || '更新失败', 'error');
                            }
                        },
                        error: function(xhr) {
                            console.error('更新模板失败:', xhr);
                            showNotification('更新模板失败', 'error');
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
            <div class="modal show" style="display: flex;">
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