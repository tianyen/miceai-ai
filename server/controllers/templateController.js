/**
 * Template Controller - 模板控制器
 *
 * @description 處理 HTTP 請求，調用 TemplateService 處理業務邏輯
 * @refactor 2025-12-05: 使用 TemplateService，移除直接 DB 訪問
 */
const { templateService } = require('../services');
const { logUserActivity } = require('../middleware/auth');
const vh = require('../utils/viewHelpers');

class TemplateController {
    // ============================================================================
    // 列表與查詢
    // ============================================================================

    /**
     * 取得模板列表
     */
    async getTemplates(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const category = req.query.category;

            const result = await templateService.getTemplatesList({ page, limit, category });

            // 檢查是否要求 HTML 格式
            if (this._isHtmlRequest(req)) {
                const html = this._renderTemplatesTable(result.templates);
                return res.send(html);
            }

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('獲取模板列表失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取模板列表失敗'
            });
        }
    }

    /**
     * 取得模板分頁
     */
    async getTemplatesPagination(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;

            const result = await templateService.getTemplatesList({ page, limit });

            const html = this._renderPagination(result.pagination, page);
            res.send(html);

        } catch (error) {
            console.error('獲取模板分頁失敗:', error);
            res.send('<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
        }
    }

    /**
     * 搜尋模板
     */
    async searchTemplates(req, res) {
        try {
            const { search, category } = req.query;

            const templates = await templateService.searchTemplates({ search, category });

            // 檢查是否要求 HTML 格式
            if (this._isHtmlRequest(req)) {
                const html = this._renderTemplatesTable(templates, true);
                return res.send(html);
            }

            res.json({
                success: true,
                data: { templates: templates || [] }
            });

        } catch (error) {
            console.error('搜索模板失敗:', error);
            res.status(500).json({
                success: false,
                message: '搜索模板失敗'
            });
        }
    }

    /**
     * 按類型取得模板
     */
    async getTemplatesByType(req, res) {
        try {
            const templateType = req.query.type;

            const templates = await templateService.getTemplatesByType(templateType);

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

    // ============================================================================
    // 詳情
    // ============================================================================

    /**
     * 取得模板詳情
     */
    async getTemplate(req, res) {
        try {
            const templateId = req.params.id;

            const template = await templateService.getTemplateDetail(templateId);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: '模板不存在'
                });
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

    /**
     * 取得模板使用情況
     */
    async getTemplateUsage(req, res) {
        try {
            const templateId = req.params.id;

            const usage = await templateService.getTemplateUsage(templateId);

            res.json({
                success: true,
                data: usage
            });

        } catch (error) {
            console.error('獲取模板使用情況失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取模板使用情況失敗'
            });
        }
    }

    // ============================================================================
    // CRUD 操作
    // ============================================================================

    /**
     * 建立模板
     */
    async createTemplate(req, res) {
        try {
            const result = await templateService.create({
                ...req.body,
                created_by: req.user.id
            });

            await logUserActivity(
                req.user.id,
                'template_created',
                'template',
                result.id,
                { template_name: result.template_name, template_type: req.body.template_type },
                req.ip
            );

            res.status(201).json({
                success: true,
                message: '模板創建成功',
                data: { id: result.id }
            });

        } catch (error) {
            console.error('創建模板失敗:', error);
            res.status(500).json({
                success: false,
                message: '創建模板失敗'
            });
        }
    }

    /**
     * 更新模板
     */
    async updateTemplate(req, res) {
        try {
            const templateId = req.params.id;

            const result = await templateService.updateTemplate(templateId, req.body, req.user);

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403,
                    'NO_FIELDS': 400
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'template_updated',
                'template',
                templateId,
                { template_name: result.template?.template_name },
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

    /**
     * 刪除模板
     */
    async deleteTemplate(req, res) {
        try {
            const templateId = req.params.id;

            const result = await templateService.deleteTemplate(templateId, req.user);

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403
                }[result.error] || 409;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'template_deleted',
                'template',
                templateId,
                { template_name: result.template.template_name },
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

    /**
     * 複製模板
     */
    async duplicateTemplate(req, res) {
        try {
            const templateId = req.params.id;
            const { new_name } = req.body;

            const result = await templateService.duplicateTemplate(templateId, new_name, req.user.id);

            if (!result.success) {
                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'template_duplicated',
                'template',
                result.id,
                { original_id: templateId, new_template: result.template_name },
                req.ip
            );

            res.status(201).json({
                success: true,
                message: '模板複製成功',
                data: { id: result.id }
            });

        } catch (error) {
            console.error('複製模板失敗:', error);
            res.status(500).json({
                success: false,
                message: '複製模板失敗'
            });
        }
    }

    /**
     * 設置預設模板
     */
    async setDefaultTemplate(req, res) {
        try {
            const templateId = req.params.id;

            const result = await templateService.setDefaultTemplate(templateId);

            if (!result.success) {
                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'default_template_changed',
                'template',
                templateId,
                { template_name: result.template.template_name },
                req.ip
            );

            res.json({
                success: true,
                message: '預設模板設置成功'
            });

        } catch (error) {
            console.error('設置預設模板失敗:', error);
            res.status(500).json({
                success: false,
                message: '設置預設模板失敗'
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
        return req.headers['x-requested-with'] === 'XMLHttpRequest' || req.query.format === 'html';
    }

    /**
     * 取得模板類型徽章 HTML
     * @private
     */
    _getTemplateBadge(type) {
        const typeMap = {
            'event': '<span class="template-category event">活動模板</span>',
            'invitation': '<span class="template-category invitation">MICE-AI</span>',
            'notification': '<span class="template-category notification">通知</span>',
            'email': '<span class="template-category email">電子郵件</span>',
            'form': '<span class="template-category form">表單</span>'
        };
        return typeMap[type] || '<span class="template-category">其他</span>';
    }

    /**
     * 渲染模板列表表格
     * @private
     */
    _renderTemplatesTable(templates, isSearch = false) {
        if (templates.length === 0) {
            const emptyMessage = isSearch ? '無符合條件的模板' : '尚無模板資料';
            const emptyHint = isSearch ? '請嘗試調整搜索條件或新增模板' : '點擊上方「新增模板」按鈕開始建立您的第一個模板';
            const emptyIcon = isSearch ? '🔍' : '📄';
            return vh.emptyTableRow(emptyMessage, 7, emptyIcon, emptyHint);
        }

        return templates.map(template => {
            const typeBadge = this._getTemplateBadge(template.template_type);
            const usageCount = template.usage_count || 0;
            const updatedAt = new Date(template.updated_at).toLocaleDateString('zh-TW');
            const isDefault = template.is_default ? '是' : '否';

            return `
                <tr>
                    <td>
                        <div class="template-preview ${template.preview_url ? '' : 'no-preview'}"
                             ${template.preview_url ? `style="background-image: url('${vh.escapeHtml(template.preview_url)}')"` : ''}>
                            ${template.preview_url ? '' : '無預覽'}
                        </div>
                    </td>
                    <td>
                        <strong>${vh.escapeHtml(template.template_name)}</strong>
                        <div class="template-description">${vh.escapeHtml(template.description || '')}</div>
                    </td>
                    <td>${typeBadge}</td>
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
        }).join('');
    }

    /**
     * 渲染分頁控制
     * @private
     */
    _renderPagination(pagination, currentPage) {
        const { total, pages } = pagination;

        let html = '<div class="pagination-info">';
        html += `<span>共 ${total} 個模板，第 ${currentPage} 頁 / 共 ${pages} 頁</span>`;
        html += '</div>';

        if (pages > 1) {
            html += '<div class="pagination-controls">';

            if (currentPage > 1) {
                html += `<button class="btn btn-sm btn-outline-primary" onclick="loadTemplatesPage(${currentPage - 1})">上一頁</button>`;
            }

            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(pages, currentPage + 2);

            for (let i = startPage; i <= endPage; i++) {
                const activeClass = i === currentPage ? 'btn-primary' : 'btn-outline-primary';
                html += `<button class="btn btn-sm ${activeClass}" onclick="loadTemplatesPage(${i})">${i}</button>`;
            }

            if (currentPage < pages) {
                html += `<button class="btn btn-sm btn-outline-primary" onclick="loadTemplatesPage(${currentPage + 1})">下一頁</button>`;
            }

            html += '</div>';
        }

        html += `
        <script>
            function loadTemplatesPage(page) {
                loadTemplates(page);
                loadTemplatesPagination(page);
            }
        </script>
        `;

        return html;
    }
}

module.exports = new TemplateController();
