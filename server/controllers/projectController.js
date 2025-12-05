/**
 * Project Controller - 專案控制器
 *
 * @description 處理 HTTP 請求，調用 ProjectService 處理業務邏輯
 * @refactor 2025-12-05: 使用 ProjectService，移除直接 DB 訪問
 */
const { projectService } = require('../services');
const { logUserActivity } = require('../middleware/auth');
const vh = require('../utils/viewHelpers');

class ProjectController {
    // ============================================================================
    // 列表與查詢
    // ============================================================================

    /**
     * 取得專案列表
     */
    async getProjects(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;

            const result = await projectService.getProjectsList({
                userId: req.user.id,
                userRole: req.user.role,
                page,
                limit
            });

            // 檢查是否要求 HTML 格式
            if (req.query.format === 'html') {
                const html = this._renderProjectsTable(result.projects);
                return res.send(html);
            }

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('獲取項目列表失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取項目列表失敗'
            });
        }
    }

    /**
     * 取得最近專案
     */
    async getRecentProjects(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 5;

            const projects = await projectService.getRecentProjects({
                userId: req.user.id,
                userRole: req.user.role,
                limit
            });

            res.json({
                success: true,
                data: projects
            });

        } catch (error) {
            console.error('獲取最新項目失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取最新項目失敗'
            });
        }
    }

    /**
     * 搜尋專案
     */
    async searchProjects(req, res) {
        try {
            const { search, status } = req.query;

            const projects = await projectService.searchProjectsAdmin({
                userId: req.user.id,
                userRole: req.user.role,
                search,
                status
            });

            const html = this._renderSearchResults(projects);
            res.send(html);

        } catch (error) {
            console.error('搜索項目失敗:', error);
            res.status(500).send('<tr><td colspan="7" class="text-center text-danger">搜索項目失敗</td></tr>');
        }
    }

    /**
     * 取得專案分頁資訊
     */
    async getProjectsPagination(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;

            const result = await projectService.getProjectsList({
                userId: req.user.id,
                userRole: req.user.role,
                page,
                limit
            });

            const html = this._renderPagination(result.pagination, page);
            res.send(html);

        } catch (error) {
            console.error('獲取專案分頁失敗:', error);
            res.send('<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
        }
    }

    // ============================================================================
    // 專案詳情
    // ============================================================================

    /**
     * 取得專案詳情
     */
    async getProject(req, res) {
        try {
            const projectId = req.params.id;
            const data = await projectService.getProjectFullDetail(projectId);

            if (!data) {
                if (this._isHtmlRequest(req)) {
                    return res.status(404).send('<div class="modal"><div class="modal-content"><div class="modal-header"><h3>項目不存在</h3></div><div class="modal-body">找不到指定的專案</div></div></div>');
                }
                return res.status(404).json({ success: false, message: '項目不存在' });
            }

            if (this._isHtmlRequest(req)) {
                const html = this._renderProjectDetailModal(data);
                return res.send(html);
            }

            res.json({ success: true, data });

        } catch (error) {
            console.error('獲取項目詳情失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取項目詳情失敗'
            });
        }
    }

    // ============================================================================
    // CRUD 操作
    // ============================================================================

    /**
     * 建立專案
     */
    async createProject(req, res) {
        try {
            const result = await projectService.createProject(req.body, req.user.id);

            await logUserActivity(
                req.user.id,
                'project_created',
                'project',
                result.id,
                { project_name: req.body.project_name, project_code: req.body.project_code },
                req.ip
            );

            res.status(201).json({
                success: true,
                message: '項目創建成功',
                data: { id: result.id }
            });

        } catch (error) {
            console.error('創建項目失敗:', error);

            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return res.status(409).json({
                    success: false,
                    message: '項目代碼已存在'
                });
            }

            res.status(500).json({
                success: false,
                message: '創建項目失敗'
            });
        }
    }

    /**
     * 更新專案
     */
    async updateProject(req, res) {
        try {
            const projectId = req.params.id;
            const result = await projectService.updateProject(projectId, req.body);

            if (!result.success) {
                const statusCode = result.error === 'NOT_FOUND' ? 404 : 400;
                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'project_updated',
                'project',
                projectId,
                req.body,
                req.ip
            );

            res.json({
                success: true,
                message: '項目更新成功'
            });

        } catch (error) {
            console.error('更新項目失敗:', error);
            res.status(500).json({
                success: false,
                message: '更新項目失敗'
            });
        }
    }

    /**
     * 刪除專案
     */
    async deleteProject(req, res) {
        try {
            const projectId = req.params.id;
            const result = await projectService.deleteProject(projectId);

            if (!result.success) {
                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'project_deleted',
                'project',
                projectId,
                { project_name: result.project.project_name },
                req.ip
            );

            res.json({
                success: true,
                message: '項目刪除成功'
            });

        } catch (error) {
            console.error('刪除項目失敗:', error);
            res.status(500).json({
                success: false,
                message: '刪除項目失敗'
            });
        }
    }

    /**
     * 複製專案
     */
    async duplicateProject(req, res) {
        try {
            const projectId = req.params.id;
            const result = await projectService.duplicateProject(projectId, req.user.id);

            if (!result.success) {
                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'project_duplicated',
                'project',
                result.id,
                { from_project_id: projectId, new_project_id: result.id },
                req.ip
            );

            res.json({
                success: true,
                message: '專案複製成功',
                data: { id: result.id }
            });

        } catch (error) {
            console.error('複製專案失敗:', error);
            res.status(500).json({
                success: false,
                message: '複製專案失敗'
            });
        }
    }

    /**
     * 更新專案狀態
     */
    async updateProjectStatus(req, res) {
        try {
            const projectId = req.params.id;
            const { status } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 權限檢查
            const hasPermission = await projectService.checkAdminPermission(userId, projectId, userRole);
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: '無權限修改專案狀態'
                });
            }

            const result = await projectService.updateStatus(projectId, status);

            if (!result.success) {
                const statusCode = result.error === 'NOT_FOUND' ? 404 : 400;
                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                userId,
                'project_status_changed',
                'project',
                projectId,
                { old_status: result.oldStatus, new_status: result.newStatus },
                req.ip
            );

            res.json({
                success: true,
                message: `專案狀態已更新為: ${result.statusText}`,
                data: { status: result.newStatus }
            });

        } catch (error) {
            console.error('更新專案狀態失敗:', error);
            res.status(500).json({
                success: false,
                message: '更新專案狀態失敗'
            });
        }
    }

    // ============================================================================
    // 匯出功能
    // ============================================================================

    /**
     * 匯出專案資料
     */
    async exportProject(req, res) {
        try {
            const projectId = req.params.id;
            const result = await projectService.exportProjectSubmissions(projectId);

            if (!result.success) {
                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }

            const csvHeader = 'ID,姓名,郵箱,電話,公司名稱,職位,項目名稱,狀態,提交時間';
            const csvRows = result.submissions.map(s => [
                s.id,
                s.submitter_name,
                s.submitter_email,
                s.submitter_phone || '',
                s.company_name || '',
                s.position || '',
                s.project_name,
                s.status,
                new Date(s.created_at).toLocaleString('zh-TW')
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));

            const csv = [csvHeader, ...csvRows].join('\n');
            const filename = `${result.project.project_name || 'project'}_submissions_${new Date().toISOString().split('T')[0]}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.send('\ufeff' + csv);

        } catch (error) {
            console.error('匯出專案失敗:', error);
            res.status(500).json({
                success: false,
                message: '匯出專案失敗'
            });
        }
    }

    // ============================================================================
    // 權限管理
    // ============================================================================

    /**
     * 取得專案權限
     */
    async getProjectPermissions(req, res) {
        try {
            const permissions = await projectService.getProjectPermissions(req.params.id);

            res.json({
                success: true,
                data: permissions
            });

        } catch (error) {
            console.error('獲取項目權限失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取項目權限失敗'
            });
        }
    }

    /**
     * 新增專案權限
     */
    async addProjectPermission(req, res) {
        try {
            const projectId = req.params.id;
            const { user_id, permission_level } = req.body;

            await projectService.addPermission(projectId, user_id, permission_level, req.user.id);

            await logUserActivity(
                req.user.id,
                'project_permission_added',
                'project',
                projectId,
                { user_id, permission_level },
                req.ip
            );

            res.json({
                success: true,
                message: '權限添加成功'
            });

        } catch (error) {
            console.error('添加項目權限失敗:', error);
            res.status(500).json({
                success: false,
                message: '添加項目權限失敗'
            });
        }
    }

    /**
     * 更新專案權限
     */
    async updateProjectPermission(req, res) {
        try {
            const { projectId, userId } = req.params;
            const { permission_level } = req.body;

            const result = await projectService.updatePermission(projectId, userId, permission_level, req.user.id);

            if (!result.success) {
                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'project_permission_updated',
                'project',
                projectId,
                { user_id: userId, permission_level },
                req.ip
            );

            res.json({
                success: true,
                message: '權限更新成功'
            });

        } catch (error) {
            console.error('更新項目權限失敗:', error);
            res.status(500).json({
                success: false,
                message: '更新項目權限失敗'
            });
        }
    }

    /**
     * 移除專案權限
     */
    async removeProjectPermission(req, res) {
        try {
            const { projectId, userId } = req.params;

            const result = await projectService.removePermission(projectId, userId);

            if (!result.success) {
                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'project_permission_removed',
                'project',
                projectId,
                { user_id: userId },
                req.ip
            );

            res.json({
                success: true,
                message: '權限移除成功'
            });

        } catch (error) {
            console.error('移除項目權限失敗:', error);
            res.status(500).json({
                success: false,
                message: '移除項目權限失敗'
            });
        }
    }

    // ============================================================================
    // URL 生成
    // ============================================================================

    /**
     * 取得專案掃描器 URL
     */
    async getProjectScannerUrl(req, res) {
        try {
            const projectId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            if (userRole !== 'super_admin') {
                const hasPermission = await projectService.checkProjectPermission(userId, projectId);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限訪問此專案掃描器'
                    });
                }
            }

            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const data = await projectService.getScannerUrl(projectId, baseUrl);

            if (!data) {
                return res.status(404).json({
                    success: false,
                    message: '專案不存在'
                });
            }

            res.json({ success: true, data });

        } catch (error) {
            console.error('獲取掃描器 URL 失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取掃描器 URL 失敗'
            });
        }
    }

    /**
     * 取得專案報名連結
     */
    async getProjectRegistrationUrls(req, res) {
        try {
            const projectId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            if (userRole !== 'super_admin') {
                const hasPermission = await projectService.checkProjectPermission(userId, projectId);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限查看此專案報名連結'
                    });
                }
            }

            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const data = await projectService.getRegistrationUrls(projectId, req.user, baseUrl);

            if (!data) {
                return res.status(404).json({
                    success: false,
                    message: '專案不存在'
                });
            }

            res.json({ success: true, data });

        } catch (error) {
            console.error('獲取專案報名連結失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取專案報名連結失敗'
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
     * 渲染專案列表表格
     * @private
     */
    _renderProjectsTable(projects) {
        if (projects.length === 0) {
            return vh.emptyTableRow('尚無專案資料', 8, '📋', '點擊上方「新增專案」按鈕開始建立您的第一個專案');
        }

        return projects.map(project => {
            const statusBadge = vh.statusBadge(project.status);
            const eventDate = this._formatEventDate(project);
            const createdAt = new Date(project.created_at).toLocaleDateString('zh-TW');

            return `
                <tr>
                    <td><span class="badge badge-secondary">#${project.id}</span></td>
                    <td>
                        <div class="project-name">
                            <strong>${vh.escapeHtml(project.project_name)}</strong>
                            <div class="project-description">${vh.escapeHtml(project.description || '')}</div>
                        </div>
                    </td>
                    <td><code>${vh.escapeHtml(project.project_code)}</code></td>
                    <td>${eventDate}</td>
                    <td>${statusBadge}</td>
                    <td><span class="participant-count">${project.participant_count || 0}</span></td>
                    <td>${createdAt}</td>
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
        }).join('');
    }

    /**
     * 渲染搜尋結果
     * @private
     */
    _renderSearchResults(projects) {
        if (projects.length === 0) {
            return vh.emptyTableRow('未找到符合條件的專案', 7, '🔍', '請調整搜尋條件或新增專案');
        }

        return projects.map(project => {
            const statusBadge = vh.statusBadge(project.status);
            const eventDate = project.event_date ? new Date(project.event_date).toLocaleDateString('zh-TW') : '-';
            const createdAt = new Date(project.created_at).toLocaleDateString('zh-TW');

            return `
                <tr>
                    <td>
                        <div class="project-name">
                            <strong>${vh.escapeHtml(project.project_name)}</strong>
                            <div class="project-description">${vh.escapeHtml(project.description || '')}</div>
                        </div>
                    </td>
                    <td class="project-code">${vh.escapeHtml(project.project_code)}</td>
                    <td class="event-date">${eventDate}</td>
                    <td class="project-status">${statusBadge}</td>
                    <td class="participant-count">
                        <span class="count-badge">${project.participant_count || 0}</span>
                        <small>位參加者</small>
                    </td>
                    <td class="created-date">${createdAt}</td>
                    <td class="project-actions">
                        <button class="btn btn-sm btn-outline-primary" onclick="viewProject(${project.id})" title="查看詳情">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success" onclick="editProject(${project.id})" title="編輯">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-info" onclick="manageInvitations(${project.id})" title="管理MICE-AI ">
                            <i class="fas fa-envelope"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteProject(${project.id})" title="刪除">
                            <i class="fas fa-trash"></i>
                        </button>
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
        html += `<span>共 ${total} 個專案，第 ${currentPage} 頁 / 共 ${pages} 頁</span>`;
        html += '</div>';

        if (pages > 1) {
            html += '<div class="pagination-controls">';

            if (currentPage > 1) {
                html += `<button class="btn btn-sm btn-outline-primary pagination-btn" onclick="loadProjectsPage(${currentPage - 1})">上一頁</button>`;
            }

            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(pages, currentPage + 2);

            for (let i = startPage; i <= endPage; i++) {
                const activeClass = i === currentPage ? 'btn-primary' : 'btn-outline-primary';
                html += `<button class="btn btn-sm ${activeClass} pagination-btn" onclick="loadProjectsPage(${i})">${i}</button>`;
            }

            if (currentPage < pages) {
                html += `<button class="btn btn-sm btn-outline-primary pagination-btn" onclick="loadProjectsPage(${currentPage + 1})">下一頁</button>`;
            }

            html += '</div>';
        }

        html += `
        <script>
            function loadProjectsPage(page) {
                loadProjects(page);
                loadProjectsPagination(page);
            }
        </script>
        `;

        return html;
    }

    /**
     * 渲染專案詳情模態框
     * @private
     */
    _renderProjectDetailModal(data) {
        const eventDate = data.event_date ? new Date(data.event_date).toLocaleDateString('zh-TW') : '-';
        const createdAt = new Date(data.created_at).toLocaleString('zh-TW');
        const statusBadge = vh.statusBadge(data.status);

        return `
            <div class="modal show" style="display: flex;">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h4 class="modal-title">專案詳情 - ${vh.escapeHtml(data.project_name)}</h4>
                            <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="project-summary">
                                <p><strong>專案代碼：</strong><code>${vh.escapeHtml(data.project_code)}</code></p>
                                <p><strong>狀態：</strong>${statusBadge}</p>
                                <p><strong>活動日期：</strong>${eventDate}</p>
                                <p><strong>地點：</strong>${vh.escapeHtml(data.event_location || '-')}</p>
                                <p><strong>建立者：</strong>${vh.escapeHtml(data.creator_name || '-')}</p>
                                <p><strong>建立時間：</strong>${createdAt}</p>
                            </div>
                            <div class="project-description">${vh.escapeHtml(data.description || '')}</div>
                            <h4>權限成員</h4>
                            <ul>
                                ${data.permissions.map(p => `<li>${vh.escapeHtml(p.user_name || '未知用戶')}（${p.permission_level}）</li>`).join('')}
                            </ul>
                            <h4>提交統計</h4>
                            <ul>
                                <li>總計：${data.submission_stats.total}</li>
                                <li>待審核：${data.submission_stats.pending}</li>
                                <li>已批准：${data.submission_stats.approved}</li>
                                <li>已拒絕：${data.submission_stats.rejected}</li>
                            </ul>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">關閉</button>
                            <button type="button" class="btn btn-primary" onclick="editProject(${data.id})">編輯專案</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 格式化活動日期
     * @private
     */
    _formatEventDate(project) {
        if (project.event_date) {
            return new Date(project.event_date).toLocaleDateString('zh-TW');
        }
        if (project.event_start_date && project.event_end_date) {
            const startDate = new Date(project.event_start_date).toLocaleDateString('zh-TW');
            const endDate = new Date(project.event_end_date).toLocaleDateString('zh-TW');
            return `${startDate} - ${endDate}`;
        }
        if (project.event_start_date) {
            return new Date(project.event_start_date).toLocaleDateString('zh-TW');
        }
        return '-';
    }
}

module.exports = new ProjectController();
