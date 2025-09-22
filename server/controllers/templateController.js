const database = require('../config/database');
const { logUserActivity } = require('../middleware/auth');

class TemplateController {
    async getTemplates(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            const category = req.query.category;

            let query = `
                SELECT t.*, u.full_name as creator_name
                FROM invitation_templates t
                LEFT JOIN users u ON t.created_by = u.id
            `;
            let countQuery = 'SELECT COUNT(*) as count FROM invitation_templates t';
            let queryParams = [];

            if (category && category.trim()) {
                const whereClause = ' WHERE t.template_type = ?';
                query += whereClause;
                countQuery += whereClause;
                queryParams.push(category.trim());
            }

            query += ' ORDER BY t.is_default DESC, t.created_at DESC LIMIT ? OFFSET ?';
            const templates = await database.query(query, [...queryParams, limit, offset]);

            const totalResult = await database.get(countQuery, queryParams);
            const total = totalResult.count;

            // 檢查是否需要返回 HTML
            if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.query.format === 'html') {
                let html = '';

                if (templates.length === 0) {
                    html = `
                        <tr>
                            <td colspan="7" class="empty-state">
                                <div class="empty-icon">📄</div>
                                <div class="empty-text">
                                    <h4>尚無模板資料</h4>
                                    <p>點擊上方「新增模板」按鈕開始建立您的第一個模板</p>
                                </div>
                            </td>
                        </tr>
                    `;
                } else {
                    // Define getTemplateBadge function locally
                    const getTemplateBadge = (type) => {
                        const typeMap = {
                            'invitation': '<span class="template-category invitation">邀請函</span>',
                            'notification': '<span class="template-category notification">通知</span>',
                            'email': '<span class="template-category email">電子郵件</span>',
                            'form': '<span class="template-category form">表單</span>'
                        };
                        return typeMap[type] || '<span class="template-category">其他</span>';
                    };

                    templates.forEach(template => {
                        const statusBadge = getTemplateBadge(template.template_type);
                        const usageCount = template.usage_count || 0;
                        const updatedAt = new Date(template.updated_at).toLocaleDateString('zh-TW');
                        const isDefault = template.is_default ? '是' : '否';

                        html += `
                            <tr>
                                <td>
                                    <div class="template-preview ${template.preview_url ? '' : 'no-preview'}"
                                         ${template.preview_url ? `style="background-image: url('${template.preview_url}')"` : ''}>
                                        ${template.preview_url ? '' : '無預覽'}
                                    </div>
                                </td>
                                <td>
                                    <strong>${template.template_name}</strong>
                                    <div class="template-description">${template.description || ''}</div>
                                </td>
                                <td>${statusBadge}</td>
                                <td>
                                    <div class="usage-count">
                                        <i class="fas fa-chart-line"></i>
                                        <span>${usageCount}</span>
                                    </div>
                                </td>
                                <td>
                                    <div class="template-status ${template.is_default ? 'active' : 'inactive'}">
                                        <i class="fas fa-${template.is_default ? 'star' : 'star-o'}"></i>
                                        ${isDefault}
                                    </div>
                                </td>
                                <td>${updatedAt}</td>
                                <td>
                                    <div class="template-actions">
                                        <button class="btn btn-sm btn-primary" onclick="previewTemplate(${template.id})" title="預覽模板">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="btn btn-sm btn-success" onclick="editTemplate(${template.id})" title="編輯模板">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn btn-sm btn-warning" onclick="duplicateTemplate(${template.id})" title="複製模板">
                                            <i class="fas fa-copy"></i>
                                        </button>
                                        <button class="btn btn-sm btn-info" onclick="toggleTemplateStatus(${template.id})" title="切換預設狀態">
                                            <i class="fas fa-star"></i>
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="exportTemplate(${template.id})" title="匯出模板">
                                            <i class="fas fa-download"></i>
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="deleteTemplate(${template.id})" title="刪除模板">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    });
                }

                res.send(html);
            } else {
                // 返回 JSON
                res.json({
                    success: true,
                    data: {
                        templates,
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
            console.error('獲取模板列表失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取模板列表失敗'
            });
        }
    }

    async getTemplate(req, res) {
        try {
            const templateId = req.params.id;

            const template = await database.get(`
                SELECT t.*, u.full_name as creator_name
                FROM invitation_templates t
                LEFT JOIN users u ON t.created_by = u.id
                WHERE t.id = ?
            `, [templateId]);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: '模板不存在'
                });
            }

            // 解析 template_content 如果是 JSON 字符串
            if (template.template_content) {
                try {
                    template.template_content = JSON.parse(template.template_content);
                } catch (e) {
                    // 如果解析失敗，保留原始字符串
                }
            }

            res.json({
                success: true,
                data: template
            });

        } catch (error) {
            console.error('獲取模板詳情失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取模板詳情失敗'
            });
        }
    }

    async createTemplate(req, res) {
        try {
            const {
                template_name,
                template_type,
                template_content,
                css_styles,
                js_scripts,
                is_default
            } = req.body;

            // 如果設置為預設模板，先將其他預設模板設為非預設
            if (is_default) {
                await database.run('UPDATE invitation_templates SET is_default = 0');
            }

            const result = await database.run(`
                INSERT INTO invitation_templates (
                    template_name, template_type, template_content, css_styles, 
                    js_scripts, is_default, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                template_name,
                template_type,
                JSON.stringify(template_content),
                css_styles || null,
                js_scripts || null,
                is_default ? 1 : 0,
                req.user.id
            ]);

            await logUserActivity(
                req.user.id,
                'template_created',
                'template',
                result.lastID,
                { template_name, template_type },
                req.ip
            );

            res.status(201).json({
                success: true,
                message: '模板創建成功',
                data: { id: result.lastID }
            });

        } catch (error) {
            console.error('創建模板失敗:', error);
            res.status(500).json({
                success: false,
                message: '創建模板失敗'
            });
        }
    }

    async updateTemplate(req, res) {
        try {
            const templateId = req.params.id;
            const updates = req.body;

            // 檢查模板是否存在
            const existingTemplate = await database.get(
                'SELECT * FROM invitation_templates WHERE id = ?',
                [templateId]
            );

            if (!existingTemplate) {
                return res.status(404).json({
                    success: false,
                    message: '模板不存在'
                });
            }

            // 檢查權限：只有創建者或超級管理員可以修改
            if (req.user.role !== 'super_admin' && existingTemplate.created_by !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: '權限不足'
                });
            }

            // 構建更新查詢
            const allowedFields = [
                'template_name', 'template_type', 'template_content',
                'css_styles', 'js_scripts', 'is_default'
            ];

            const updateFields = [];
            const updateValues = [];

            Object.keys(updates).forEach(field => {
                if (allowedFields.includes(field) && updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    if (field === 'template_content') {
                        updateValues.push(JSON.stringify(updates[field]));
                    } else if (field === 'is_default') {
                        updateValues.push(updates[field] ? 1 : 0);
                    } else {
                        updateValues.push(updates[field]);
                    }
                }
            });

            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '沒有有效的更新字段'
                });
            }

            // 如果設置為預設模板，先將其他預設模板設為非預設
            if (updates.is_default) {
                await database.run('UPDATE invitation_templates SET is_default = 0 WHERE id != ?', [templateId]);
            }

            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            updateValues.push(templateId);

            const query = `UPDATE invitation_templates SET ${updateFields.join(', ')} WHERE id = ?`;
            await database.run(query, updateValues);

            await logUserActivity(
                req.user.id,
                'template_updated',
                'template',
                templateId,
                { template_name: existingTemplate.template_name },
                req.ip
            );

            res.json({
                success: true,
                message: '模板更新成功'
            });

        } catch (error) {
            console.error('更新模板失敗:', error);
            res.status(500).json({
                success: false,
                message: '更新模板失敗'
            });
        }
    }

    async deleteTemplate(req, res) {
        try {
            const templateId = req.params.id;

            // 檢查模板是否存在
            const template = await database.get(
                'SELECT * FROM invitation_templates WHERE id = ?',
                [templateId]
            );

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: '模板不存在'
                });
            }

            // 檢查權限：只有創建者或超級管理員可以刪除
            if (req.user.role !== 'super_admin' && template.created_by !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: '權限不足'
                });
            }

            // 防止刪除預設模板
            if (template.is_default) {
                return res.status(409).json({
                    success: false,
                    message: '無法刪除預設模板'
                });
            }

            // 檢查是否有項目使用此模板
            const projectsUsingTemplate = await database.get(`
                SELECT COUNT(*) as count
                FROM invitation_projects
                WHERE template_config LIKE ?
            `, [`%"template_id":${templateId}%`]);

            if (projectsUsingTemplate.count > 0) {
                return res.status(409).json({
                    success: false,
                    message: '有項目正在使用此模板，無法刪除'
                });
            }

            await database.run('DELETE FROM invitation_templates WHERE id = ?', [templateId]);

            await logUserActivity(
                req.user.id,
                'template_deleted',
                'template',
                templateId,
                { template_name: template.template_name },
                req.ip
            );

            res.json({
                success: true,
                message: '模板刪除成功'
            });

        } catch (error) {
            console.error('刪除模板失敗:', error);
            res.status(500).json({
                success: false,
                message: '刪除模板失敗'
            });
        }
    }

    async duplicateTemplate(req, res) {
        try {
            const templateId = req.params.id;
            const { new_name } = req.body;

            // 獲取原模板
            const originalTemplate = await database.get(
                'SELECT * FROM invitation_templates WHERE id = ?',
                [templateId]
            );

            if (!originalTemplate) {
                return res.status(404).json({
                    success: false,
                    message: '模板不存在'
                });
            }

            // 創建副本
            const result = await database.run(`
                INSERT INTO invitation_templates (
                    template_name, template_type, template_content, css_styles, 
                    js_scripts, is_default, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                new_name || `${originalTemplate.template_name} (副本)`,
                originalTemplate.template_type,
                originalTemplate.template_content,
                originalTemplate.css_styles,
                originalTemplate.js_scripts,
                0, // 副本不設為預設
                req.user.id
            ]);

            await logUserActivity(
                req.user.id,
                'template_duplicated',
                'template',
                result.lastID,
                {
                    original_template: originalTemplate.template_name,
                    new_template: new_name || `${originalTemplate.template_name} (副本)`
                },
                req.ip
            );

            res.status(201).json({
                success: true,
                message: '模板複製成功',
                data: { id: result.lastID }
            });

        } catch (error) {
            console.error('複製模板失敗:', error);
            res.status(500).json({
                success: false,
                message: '複製模板失敗'
            });
        }
    }

    async setDefaultTemplate(req, res) {
        try {
            const templateId = req.params.id;

            // 檢查模板是否存在
            const template = await database.get(
                'SELECT * FROM invitation_templates WHERE id = ?',
                [templateId]
            );

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: '模板不存在'
                });
            }

            // 開始事務
            await database.beginTransaction();

            try {
                // 將所有模板設為非預設
                await database.run('UPDATE invitation_templates SET is_default = 0');

                // 設置指定模板為預設
                await database.run(
                    'UPDATE invitation_templates SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [templateId]
                );

                await database.commit();

                await logUserActivity(
                    req.user.id,
                    'default_template_changed',
                    'template',
                    templateId,
                    { template_name: template.template_name },
                    req.ip
                );

                res.json({
                    success: true,
                    message: '預設模板設置成功'
                });

            } catch (error) {
                await database.rollback();
                throw error;
            }

        } catch (error) {
            console.error('設置預設模板失敗:', error);
            res.status(500).json({
                success: false,
                message: '設置預設模板失敗'
            });
        }
    }

    async getTemplatesByType(req, res) {
        try {
            const templateType = req.query.type;

            let query = `
                SELECT t.*, u.full_name as creator_name
                FROM invitation_templates t
                LEFT JOIN users u ON t.created_by = u.id
            `;
            let queryParams = [];

            if (templateType) {
                query += ' WHERE t.template_type = ?';
                queryParams.push(templateType);
            }

            query += ' ORDER BY t.is_default DESC, t.created_at DESC';

            const templates = await database.query(query, queryParams);

            res.json({
                success: true,
                data: templates
            });

        } catch (error) {
            console.error('獲取模板列表失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取模板列表失敗'
            });
        }
    }

    async getTemplateUsage(req, res) {
        try {
            const templateId = req.params.id;

            // 獲取使用此模板的項目
            const projects = await database.query(`
                SELECT id, project_name, project_code, status, created_at
                FROM invitation_projects
                WHERE template_config LIKE ?
                ORDER BY created_at DESC
            `, [`%"template_id":${templateId}%`]);

            res.json({
                success: true,
                data: {
                    usage_count: projects.length,
                    projects: projects
                }
            });

        } catch (error) {
            console.error('獲取模板使用情況失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取模板使用情況失敗'
            });
        }
    }

    // 模板分页
    async getTemplatesPagination(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;

            const totalResult = await database.get('SELECT COUNT(*) as count FROM invitation_templates');
            const total = totalResult.count;
            const pages = Math.ceil(total / limit);

            let paginationHtml = '<div class="pagination-info">';
            paginationHtml += `<span>共 ${total} 個模板，第 ${page} 頁 / 共 ${pages} 頁</span>`;
            paginationHtml += '</div>';

            if (pages > 1) {
                paginationHtml += '<div class="pagination-controls">';

                if (page > 1) {
                    paginationHtml += `<button class="btn btn-sm btn-outline-primary" onclick="loadTemplatesPage(${page - 1})">上一頁</button>`;
                }

                const startPage = Math.max(1, page - 2);
                const endPage = Math.min(pages, page + 2);

                for (let i = startPage; i <= endPage; i++) {
                    const activeClass = i === page ? 'btn-primary' : 'btn-outline-primary';
                    paginationHtml += `<button class="btn btn-sm ${activeClass}" onclick="loadTemplatesPage(${i})">${i}</button>`;
                }

                if (page < pages) {
                    paginationHtml += `<button class="btn btn-sm btn-outline-primary" onclick="loadTemplatesPage(${page + 1})">下一頁</button>`;
                }

                paginationHtml += '</div>';
            }

            paginationHtml += `
            <script>
                function loadTemplatesPage(page) {
                    loadTemplates(page);
                    loadTemplatesPagination(page);
                }
            </script>
            `;

            res.send(paginationHtml);

        } catch (error) {
            console.error('獲取模板分頁失敗:', error);
            res.send('<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
        }
    }

    // 搜索模板
    async searchTemplates(req, res) {
        try {
            const { search, category } = req.query;

            let searchQuery = `
                SELECT t.*, u.full_name as creator_name
                FROM invitation_templates t
                LEFT JOIN users u ON t.created_by = u.id
                WHERE 1=1
            `;
            let queryParams = [];

            // 搜索條件
            if (search && search.trim()) {
                searchQuery += ` AND (t.template_name LIKE ? OR t.description LIKE ?)`;
                const searchTerm = `%${search.trim()}%`;
                queryParams.push(searchTerm, searchTerm);
            }

            // 分類篩選
            if (category && category.trim() && category !== 'all') {
                searchQuery += ` AND t.template_type = ?`;
                queryParams.push(category.trim());
            }

            searchQuery += ` ORDER BY t.is_default DESC, t.created_at DESC LIMIT 50`;

            const templates = await database.query(searchQuery, queryParams);

            // 檢查是否需要返回 HTML
            if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
                let html = '';

                if (templates.length === 0) {
                    html = `
                        <tr>
                            <td colspan="7" class="empty-state">
                                <div class="empty-icon">🔍</div>
                                <div class="empty-text">
                                    <h4>無符合條件的模板</h4>
                                    <p>請嘗試調整搜索條件或新增模板</p>
                                </div>
                            </td>
                        </tr>
                    `;
                } else {
                    // Define getTemplateBadge function locally
                    const getTemplateBadge = (type) => {
                        const typeMap = {
                            'invitation': '<span class="template-category invitation">邀請函</span>',
                            'notification': '<span class="template-category notification">通知</span>',
                            'email': '<span class="template-category email">電子郵件</span>',
                            'form': '<span class="template-category form">表單</span>'
                        };
                        return typeMap[type] || '<span class="template-category">其他</span>';
                    };

                    templates.forEach(template => {
                        const statusBadge = getTemplateBadge(template.template_type);
                        const usageCount = template.usage_count || 0;
                        const updatedAt = new Date(template.updated_at).toLocaleDateString('zh-TW');
                        const isDefault = template.is_default ? '是' : '否';

                        html += `
                            <tr>
                                <td>
                                    <div class="template-preview ${template.preview_url ? '' : 'no-preview'}"
                                         ${template.preview_url ? `style="background-image: url('${template.preview_url}')"` : ''}>
                                        ${template.preview_url ? '' : '無預覽'}
                                    </div>
                                </td>
                                <td>
                                    <strong>${template.template_name}</strong>
                                    <div class="template-description">${template.description || ''}</div>
                                </td>
                                <td>${statusBadge}</td>
                                <td>
                                    <div class="usage-count">
                                        <i class="fas fa-chart-line"></i>
                                        <span>${usageCount}</span>
                                    </div>
                                </td>
                                <td>
                                    <div class="template-status ${template.is_default ? 'active' : 'inactive'}">
                                        <i class="fas fa-${template.is_default ? 'star' : 'star-o'}"></i>
                                        ${isDefault}
                                    </div>
                                </td>
                                <td>${updatedAt}</td>
                                <td>
                                    <div class="template-actions">
                                        <button class="btn btn-sm btn-primary" onclick="previewTemplate(${template.id})" title="預覽模板">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="btn btn-sm btn-success" onclick="editTemplate(${template.id})" title="編輯模板">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn btn-sm btn-warning" onclick="duplicateTemplate(${template.id})" title="複製模板">
                                            <i class="fas fa-copy"></i>
                                        </button>
                                        <button class="btn btn-sm btn-info" onclick="toggleTemplateStatus(${template.id})" title="切換預設狀態">
                                            <i class="fas fa-star"></i>
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="exportTemplate(${template.id})" title="匯出模板">
                                            <i class="fas fa-download"></i>
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="deleteTemplate(${template.id})" title="刪除模板">
                                            <i class="fas fa-trash"></i>
                                        </button>
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
                    data: { templates: templates || [] }
                });
            }

        } catch (error) {
            console.error('搜索模板失敗:', error);
            res.status(500).json({
                success: false,
                message: '搜索模板失敗'
            });
        }
    }

    // 模板類型徽章映射
    getTemplateBadge(type) {
        const typeMap = {
            'invitation': '<span class="template-category invitation">邀請函</span>',
            'notification': '<span class="template-category notification">通知</span>',
            'email': '<span class="template-category email">電子郵件</span>',
            'form': '<span class="template-category form">表單</span>'
        };
        return typeMap[type] || '<span class="template-category">其他</span>';
    }
}

module.exports = new TemplateController();