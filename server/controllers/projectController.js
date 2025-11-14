const database = require('../config/database');
const { logUserActivity } = require('../middleware/auth');

class ProjectController {
    async getProjects(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            const userId = req.user.id;
            const userRole = req.user.role;

            let projectsQuery = `
                SELECT
                    p.*,
                    u.full_name as creator_name,
                    t.template_name as template_name,
                    COUNT(fs.id) as participant_count
                FROM event_projects p
                LEFT JOIN users u ON p.created_by = u.id
                LEFT JOIN invitation_templates t ON p.template_id = t.id
                LEFT JOIN form_submissions fs ON p.id = fs.project_id
            `;
            let countQuery = 'SELECT COUNT(*) as count FROM event_projects p';
            let queryParams = [];

            if (userRole !== 'super_admin') {
                const whereClause = `
                    WHERE (p.created_by = ? OR p.id IN (
                        SELECT project_id FROM user_project_permissions WHERE user_id = ?
                    ))
                `;
                projectsQuery += whereClause;
                countQuery += whereClause;
                queryParams = [userId, userId];
            }

            projectsQuery += ' GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
            const projects = await database.query(projectsQuery, [...queryParams, limit, offset]);

            const totalResult = await database.get(countQuery, queryParams);
            const total = totalResult.count;

            // 檢查是否明確要求 HTML 格式
            if (req.query.format === 'html') {
                // 為 HTMX 請求返回 HTML
                let html = '';

                if (projects.length === 0) {
                    html = `
                        <tr>
                            <td colspan="7" class="empty-state">
                                <div class="empty-icon">📋</div>
                                <div class="empty-text">
                                    <h4>尚無專案資料</h4>
                                    <p>點擊上方「新增專案」按鈕開始建立您的第一個專案</p>
                                </div>
                            </td>
                        </tr>
                    `;
                } else {
                    // Define getStatusBadge function locally
                    const getStatusBadge = (status) => {
                        const statusMap = {
                            'draft': '<span class="badge badge-secondary">草稿</span>',
                            'active': '<span class="badge badge-success">進行中</span>',
                            'completed': '<span class="badge badge-primary">已完成</span>',
                            'cancelled': '<span class="badge badge-danger">已取消</span>'
                        };
                        return statusMap[status] || '<span class="badge badge-secondary">未知</span>';
                    };

                    projects.forEach(project => {
                        const statusBadge = getStatusBadge(project.status);
                        // 優先使用 event_date，如果沒有則使用 event_start_date - event_end_date
                        let eventDate = '-';
                        if (project.event_date) {
                            eventDate = new Date(project.event_date).toLocaleDateString('zh-TW');
                        } else if (project.event_start_date && project.event_end_date) {
                            const startDate = new Date(project.event_start_date).toLocaleDateString('zh-TW');
                            const endDate = new Date(project.event_end_date).toLocaleDateString('zh-TW');
                            eventDate = `${startDate} - ${endDate}`;
                        } else if (project.event_start_date) {
                            eventDate = new Date(project.event_start_date).toLocaleDateString('zh-TW');
                        }
                        const createdAt = new Date(project.created_at).toLocaleDateString('zh-TW');

                        html += `
                            <tr>
                                <td>
                                    <div class="project-name">
                                        <strong>${project.project_name}</strong>
                                        <div class="project-description">${project.description || ''}</div>
                                    </div>
                                </td>
                                <td><code>${project.project_code}</code></td>
                                <td>${eventDate}</td>
                                <td>${project.event_location || '-'}</td>
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
                    });
                }

                res.send(html);
            } else {
                // 返回 JSON
                res.json({
                    success: true,
                    data: {
                        projects,
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
            console.error('獲取項目列表失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取項目列表失敗'
            });
        }
    }

    async getRecentProjects(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 5;
            const userId = req.user.id;
            const userRole = req.user.role;

            let query = `
                SELECT p.*, u.full_name as creator_name
                FROM event_projects p
                LEFT JOIN users u ON p.created_by = u.id
            `;
            let queryParams = [];

            if (userRole !== 'super_admin') {
                query += `
                    WHERE (p.created_by = ? OR p.id IN (
                        SELECT project_id FROM user_project_permissions WHERE user_id = ?
                    ))
                `;
                queryParams = [userId, userId];
            }

            query += ' ORDER BY p.created_at DESC LIMIT ?';
            const projects = await database.query(query, [...queryParams, limit]);

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

    async getProject(req, res) {
        try {
            const projectId = req.params.id;

            const project = await database.get(`
                SELECT p.*, u.full_name as creator_name, a.full_name as assignee_name
                FROM event_projects p
                LEFT JOIN users u ON p.created_by = u.id
                LEFT JOIN users a ON p.assigned_to = a.id
                WHERE p.id = ?
            `, [projectId]);

            if (!project) {
                // AJAX/HTML 或 JSON 的一致錯誤返回
                if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.query.format === 'html') {
                    return res.status(404).send('<div class="modal"><div class="modal-content"><div class="modal-header"><h3>項目不存在</h3></div><div class="modal-body">找不到指定的專案</div></div></div>');
                }
                return res.status(404).json({ success: false, message: '項目不存在' });
            }

            // 獲取項目權限
            const permissions = await database.query(`
                SELECT pp.*, u.full_name as user_name
                FROM user_project_permissions pp
                LEFT JOIN users u ON pp.user_id = u.id
                WHERE pp.project_id = ?
            `, [projectId]);

            // 獲取表單提交統計
            const submissionStats = await database.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
                FROM form_submissions
                WHERE project_id = ?
            `, [projectId]);

            // 若為 AJAX/需要 HTML，返回簡單的模態框 HTML
            if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.query.format === 'html') {
                const eventDate = project.event_date ? new Date(project.event_date).toLocaleDateString('zh-TW') : '-';
                const createdAt = new Date(project.created_at).toLocaleString('zh-TW');

                // 定義本地的 getStatusBadge 函數
                const getStatusBadge = (status) => {
                    const statusMap = {
                        'draft': '<span class="badge badge-secondary">草稿</span>',
                        'active': '<span class="badge badge-success">進行中</span>',
                        'completed': '<span class="badge badge-primary">已完成</span>',
                        'cancelled': '<span class="badge badge-danger">已取消</span>'
                    };
                    return statusMap[status] || '<span class="badge badge-secondary">未知</span>';
                };

                const statusBadge = getStatusBadge(project.status);
                const html = `
                    <div class="modal show" style="display: flex;">
                        <div class="modal-dialog">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h4 class="modal-title">專案詳情 - ${project.project_name}</h4>
                                    <button type="button" class="close" onclick="closeModal()" aria-label="Close">
                                        <span aria-hidden="true">&times;</span>
                                    </button>
                                </div>
                            <div class="modal-body">
                                <div class="project-summary">
                                    <p><strong>專案代碼：</strong><code>${project.project_code}</code></p>
                                    <p><strong>狀態：</strong>${statusBadge}</p>
                                    <p><strong>活動日期：</strong>${eventDate}</p>
                                    <p><strong>地點：</strong>${project.event_location || '-'}</p>
                                    <p><strong>建立者：</strong>${project.creator_name || '-'}</p>
                                    <p><strong>建立時間：</strong>${createdAt}</p>
                                </div>
                                <div class="project-description">${project.description || ''}</div>
                                <h4>權限成員</h4>
                                <ul>
                                    ${permissions.map(p => `<li>${p.user_name || '未知用戶'}（${p.permission_level}）</li>`).join('')}
                                </ul>
                                <h4>提交統計</h4>
                                <ul>
                                    <li>總計：${submissionStats.total}</li>
                                    <li>待審核：${submissionStats.pending}</li>
                                    <li>已批准：${submissionStats.approved}</li>
                                    <li>已拒絕：${submissionStats.rejected}</li>
                                </ul>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="closeModal()">關閉</button>
                                <button type="button" class="btn btn-primary" onclick="editProject(${project.id})">編輯專案</button>
                            </div>
                        </div>
                    </div>
                    </div>
                `;
                return res.send(html);
            }

            // JSON 返回
            res.json({ success: true, data: { ...project, permissions, submission_stats: submissionStats } });

        } catch (error) {
            console.error('獲取項目詳情失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取項目詳情失敗'
            });
        }
    }

    // 複製專案
    async duplicateProject(req, res) {
        try {
            const projectId = req.params.id;
            const original = await database.get('SELECT * FROM event_projects WHERE id = ?', [projectId]);
            if (!original) {
                return res.status(404).json({ success: false, message: '專案不存在' });
            }

            // 生成新代碼與名稱
            const timestamp = Date.now().toString().slice(-5);
            const newCode = `${original.project_code}_copy_${timestamp}`.slice(0, 50);
            const newName = `${original.project_name} - 複本`;

            const result = await database.run(`
                INSERT INTO event_projects (
                    project_name, project_code, description, event_date, event_location,
                    event_type, created_by, template_config, brand_config, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                newName,
                newCode,
                original.description,
                original.event_date,
                original.event_location,
                original.event_type,
                req.user.id,
                original.template_config,
                original.brand_config,
                'draft'
            ]);

            await logUserActivity(
                req.user.id,
                'project_duplicated',
                'project',
                result.lastID,
                { from_project_id: projectId, new_project_id: result.lastID },
                req.ip
            );

            res.json({ success: true, message: '專案複製成功', data: { id: result.lastID } });
        } catch (error) {
            console.error('複製專案失敗:', error);
            res.status(500).json({ success: false, message: '複製專案失敗' });
        }
    }

    // 匯出專案相關表單提交 CSV
    async exportProject(req, res) {
        try {
            const projectId = req.params.id;
            // 確認專案存在
            const project = await database.get('SELECT * FROM event_projects WHERE id = ?', [projectId]);
            if (!project) {
                return res.status(404).json({ success: false, message: '專案不存在' });
            }

            const submissions = await database.query(`
                SELECT s.*, p.project_name
                FROM form_submissions s
                LEFT JOIN event_projects p ON s.project_id = p.id
                WHERE s.project_id = ?
                ORDER BY s.created_at DESC
            `, [projectId]);

            const csvHeader = 'ID,姓名,郵箱,電話,公司名稱,職位,項目名稱,狀態,提交時間';
            const csvRows = submissions.map(s => [
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
            const filename = `${project.project_name || 'project'}_submissions_${new Date().toISOString().split('T')[0]}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.send('\ufeff' + csv);
        } catch (error) {
            console.error('匯出專案失敗:', error);
            res.status(500).json({ success: false, message: '匯出專案失敗' });
        }
    }

    async createProject(req, res) {
        try {
            const {
                project_name,
                project_code,
                description,
                event_date,
                event_location,
                event_type,
                template_config,
                brand_config
            } = req.body;

            const result = await database.run(`
                INSERT INTO event_projects (
                    project_name, project_code, description, event_date, event_location,
                    event_type, created_by, template_config, brand_config, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                project_name,
                project_code,
                description,
                event_date,
                event_location,
                event_type || 'standard',
                req.user.id,
                template_config ? JSON.stringify(template_config) : null,
                brand_config ? JSON.stringify(brand_config) : null,
                'draft'
            ]);

            await logUserActivity(
                req.user.id,
                'project_created',
                'project',
                result.lastID,
                { project_name, project_code },
                req.ip
            );

            res.status(201).json({
                success: true,
                message: '項目創建成功',
                data: { id: result.lastID }
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

    async updateProject(req, res) {
        try {
            const projectId = req.params.id;
            const updates = req.body;

            // 構建更新查詢
            const allowedFields = [
                'project_name', 'project_code', 'description', 'event_date',
                'event_location', 'event_type', 'status', 'assigned_to',
                'template_config', 'brand_config'
            ];

            const updateFields = [];
            const updateValues = [];

            Object.keys(updates).forEach(field => {
                if (allowedFields.includes(field) && updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    if (field === 'template_config' || field === 'brand_config') {
                        updateValues.push(JSON.stringify(updates[field]));
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

            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            updateValues.push(projectId);

            const query = `UPDATE event_projects SET ${updateFields.join(', ')} WHERE id = ?`;
            const result = await database.run(query, updateValues);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: '項目不存在'
                });
            }

            await logUserActivity(
                req.user.id,
                'project_updated',
                'project',
                projectId,
                updates,
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

    async deleteProject(req, res) {
        try {
            const projectId = req.params.id;

            // 檢查項目是否存在
            const project = await database.get('SELECT * FROM event_projects WHERE id = ?', [projectId]);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: '項目不存在'
                });
            }

            // 開始事務
            await database.beginTransaction();

            try {
                // 刪除相關數據
                await database.run('DELETE FROM user_project_permissions WHERE project_id = ?', [projectId]);
                await database.run('DELETE FROM form_submissions WHERE project_id = ?', [projectId]);
                await database.run('DELETE FROM qr_codes WHERE project_id = ?', [projectId]);
                await database.run('DELETE FROM event_projects WHERE id = ?', [projectId]);

                await database.commit();

                await logUserActivity(
                    req.user.id,
                    'project_deleted',
                    'project',
                    projectId,
                    { project_name: project.project_name },
                    req.ip
                );

                res.json({
                    success: true,
                    message: '項目刪除成功'
                });

            } catch (error) {
                await database.rollback();
                throw error;
            }

        } catch (error) {
            console.error('刪除項目失敗:', error);
            res.status(500).json({
                success: false,
                message: '刪除項目失敗'
            });
        }
    }

    // 項目權限管理方法
    async getProjectPermissions(req, res) {
        try {
            const projectId = req.params.id;

            const permissions = await database.query(`
                SELECT pp.*, u.full_name as user_name, u.email as user_email,
                       ab.full_name as assigned_by_name
                FROM user_project_permissions pp
                LEFT JOIN users u ON pp.user_id = u.id
                LEFT JOIN users ab ON pp.assigned_by = ab.id
                WHERE pp.project_id = ?
                ORDER BY pp.created_at DESC
            `, [projectId]);

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

    async addProjectPermission(req, res) {
        try {
            const projectId = req.params.id;
            const { user_id, permission_level } = req.body;

            const result = await database.run(`
                INSERT OR REPLACE INTO user_project_permissions (
                    user_id, project_id, permission_level, assigned_by
                ) VALUES (?, ?, ?, ?)
            `, [user_id, projectId, permission_level, req.user.id]);

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

    async updateProjectPermission(req, res) {
        try {
            const { projectId, userId } = req.params;
            const { permission_level } = req.body;

            const result = await database.run(`
                UPDATE user_project_permissions 
                SET permission_level = ?, assigned_by = ?
                WHERE user_id = ? AND project_id = ?
            `, [permission_level, req.user.id, userId, projectId]);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: '權限記錄不存在'
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

    async removeProjectPermission(req, res) {
        try {
            const { projectId, userId } = req.params;

            const result = await database.run(`
                DELETE FROM user_project_permissions 
                WHERE user_id = ? AND project_id = ?
            `, [userId, projectId]);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: '權限記錄不存在'
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

    // 專案狀態控制
    async updateProjectStatus(req, res) {
        try {
            const projectId = req.params.id;
            const { status } = req.body;

            // 驗證狀態值
            const validStatuses = ['draft', 'active', 'completed', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: '無效的專案狀態'
                });
            }

            // 檢查項目是否存在和權限
            const project = await database.get('SELECT * FROM event_projects WHERE id = ?', [projectId]);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: '專案不存在'
                });
            }

            // 權限檢查 - 只有專案創建者、專案管理員或超級管理員可以修改狀態
            const userRole = req.user.role;
            const userId = req.user.id;

            if (userRole !== 'super_admin' &&
                userRole !== 'project_manager' &&
                userRole !== 'vendor' &&
                project.created_by !== userId) {

                // 檢查是否有專案管理權限
                const hasAdminPermission = await database.get(
                    'SELECT * FROM user_project_permissions WHERE user_id = ? AND project_id = ? AND permission_level = ?',
                    [userId, projectId, 'admin']
                );

                if (!hasAdminPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限修改專案狀態'
                    });
                }
            }

            // 更新狀態
            const result = await database.run(
                'UPDATE event_projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [status, projectId]
            );

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: '專案不存在'
                });
            }

            await logUserActivity(
                req.user.id,
                'project_status_changed',
                'project',
                projectId,
                { old_status: project.status, new_status: status },
                req.ip
            );

            // 本地定義 getStatusText 函數
            const getStatusText = (status) => {
                const statusMap = {
                    'draft': '草稿',
                    'active': '進行中',
                    'completed': '已完成',
                    'cancelled': '已取消'
                };
                return statusMap[status] || status;
            };

            res.json({
                success: true,
                message: `專案狀態已更新為: ${getStatusText(status)}`,
                data: { status }
            });

        } catch (error) {
            console.error('更新專案狀態失敗:', error);
            res.status(500).json({
                success: false,
                message: '更新專案狀態失敗'
            });
        }
    }

    // 獲取專案 QR Code 掃描器 URL
    async getProjectScannerUrl(req, res) {
        try {
            const projectId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 檢查專案權限
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, projectId);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限訪問此專案掃描器'
                    });
                }
            }

            const project = await database.get('SELECT * FROM event_projects WHERE id = ?', [projectId]);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: '專案不存在'
                });
            }

            const scannerUrl = `${req.protocol}://${req.get('host')}/admin/qr-scanner?project=${projectId}`;

            res.json({
                success: true,
                data: {
                    project_id: projectId,
                    project_name: project.project_name,
                    project_status: project.status,
                    scanner_url: scannerUrl,
                    is_active: project.status === 'active'
                }
            });

        } catch (error) {
            console.error('獲取掃描器 URL 失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取掃描器 URL 失敗'
            });
        }
    }

    // 獲取專案報名連結
    async getProjectRegistrationUrls(req, res) {
        try {
            const projectId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 檢查專案權限
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, projectId);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限查看此專案報名連結'
                    });
                }
            }

            const project = await database.get(
                'SELECT id, project_name, project_code, status, description, event_date, event_location FROM event_projects WHERE id = ?',
                [projectId]
            );

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: '專案不存在'
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

            res.json({
                success: true,
                data: {
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
                    statistics: stats,
                    is_open_for_registration: project.status === 'active'
                }
            });

        } catch (error) {
            console.error('獲取專案報名連結失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取專案報名連結失敗'
            });
        }
    }

    // 檢查項目權限的輔助方法
    async checkProjectPermission(userId, projectId) {
        const project = await database.get(
            'SELECT * FROM event_projects WHERE id = ? AND created_by = ?',
            [projectId, userId]
        );

        if (project) return true;

        const permission = await database.get(
            'SELECT * FROM user_project_permissions WHERE user_id = ? AND project_id = ?',
            [userId, projectId]
        );

        return !!permission;
    }

    // 分页信息
    async getProjectsPagination(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const userId = req.user.id;
            const userRole = req.user.role;

            let countQuery = 'SELECT COUNT(*) as count FROM event_projects p';
            let queryParams = [];

            if (userRole !== 'super_admin') {
                const whereClause = `
                    WHERE (p.created_by = ? OR p.id IN (
                        SELECT project_id FROM user_project_permissions WHERE user_id = ?
                    ))
                `;
                countQuery += whereClause;
                queryParams = [userId, userId];
            }

            const totalResult = await database.get(countQuery, queryParams);
            const total = totalResult.count;
            const pages = Math.ceil(total / limit);

            let paginationHtml = '<div class="pagination-info">';
            paginationHtml += `<span>共 ${total} 個專案，第 ${page} 頁 / 共 ${pages} 頁</span>`;
            paginationHtml += '</div>';

            if (pages > 1) {
                paginationHtml += '<div class="pagination-controls">';

                if (page > 1) {
                    paginationHtml += `<button class="btn btn-sm btn-outline-primary pagination-btn" onclick="loadProjectsPage(${page - 1})">上一頁</button>`;
                }

                const startPage = Math.max(1, page - 2);
                const endPage = Math.min(pages, page + 2);

                for (let i = startPage; i <= endPage; i++) {
                    const activeClass = i === page ? 'btn-primary' : 'btn-outline-primary';
                    paginationHtml += `<button class="btn btn-sm ${activeClass} pagination-btn" onclick="loadProjectsPage(${i})">${i}</button>`;
                }

                if (page < pages) {
                    paginationHtml += `<button class="btn btn-sm btn-outline-primary pagination-btn" onclick="loadProjectsPage(${page + 1})">下一頁</button>`;
                }

                paginationHtml += '</div>';
            }

            paginationHtml += `
            <script>
                function loadProjectsPage(page) {
                    loadProjects(page);
                    loadProjectsPagination(page);
                }
            </script>
            `;

            res.send(paginationHtml);

        } catch (error) {
            console.error('獲取專案分頁失敗:', error);
            res.send('<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
        }
    }

    // 搜索項目
    async searchProjects(req, res) {
        try {
            const { search, status } = req.query;
            const userId = req.user.id;
            const userRole = req.user.role;

            let searchQuery = `
                SELECT
                    p.*,
                    u.full_name as creator_name,
                    COUNT(fs.id) as participant_count
                FROM event_projects p
                LEFT JOIN users u ON p.created_by = u.id
                LEFT JOIN form_submissions fs ON p.id = fs.project_id
                WHERE 1=1
            `;
            let queryParams = [];

            // 權限限制
            if (userRole !== 'super_admin') {
                searchQuery += ` AND (p.created_by = ? OR p.id IN (
                    SELECT project_id FROM user_project_permissions WHERE user_id = ?
                ))`;
                queryParams.push(userId, userId);
            }

            // 搜索條件
            if (search && search.trim()) {
                searchQuery += ` AND (p.project_name LIKE ? OR p.project_code LIKE ? OR p.description LIKE ?)`;
                const searchTerm = `%${search.trim()}%`;
                queryParams.push(searchTerm, searchTerm, searchTerm);
            }

            // 狀態篩選
            if (status && status.trim() && status !== 'all') {
                searchQuery += ` AND p.status = ?`;
                queryParams.push(status.trim());
            }

            searchQuery += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT 50`;

            const projects = await database.query(searchQuery, queryParams);

            // Return HTML table rows like getProjects method
            const getStatusBadge = (status) => {
                const statusMap = {
                    'draft': '<span class="badge badge-secondary">草稿</span>',
                    'active': '<span class="badge badge-success">進行中</span>',
                    'completed': '<span class="badge badge-primary">已完成</span>',
                    'cancelled': '<span class="badge badge-danger">已取消</span>'
                };
                return statusMap[status] || '<span class="badge badge-secondary">未知</span>';
            };

            let html = '';
            if (projects.length === 0) {
                html = `
                    <tr>
                        <td colspan="7" class="empty-state">
                            <div class="empty-icon">🔍</div>
                            <div class="empty-text">
                                <h4>未找到符合條件的專案</h4>
                                <p>請調整搜尋條件或新增專案</p>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                projects.forEach(project => {
                    const statusBadge = getStatusBadge(project.status);
                    const eventDate = project.event_date ? new Date(project.event_date).toLocaleDateString('zh-TW') : '-';
                    const createdAt = new Date(project.created_at).toLocaleDateString('zh-TW');

                    html += `
                        <tr>
                            <td>
                                <div class="project-name">
                                    <strong>${project.project_name}</strong>
                                    <div class="project-description">${project.description || ''}</div>
                                </div>
                            </td>
                            <td class="project-code">${project.project_code}</td>
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
                });
            }

            res.send(html);

        } catch (error) {
            console.error('搜索項目失敗:', error);
            res.status(500).send('<tr><td colspan="7" class="text-center text-danger">搜索項目失敗</td></tr>');
        }
    }

    // 狀態文本映射
    getStatusText(status) {
        const statusMap = {
            'draft': '草稿',
            'active': '進行中',
            'completed': '已完成',
            'cancelled': '已取消'
        };
        return statusMap[status] || status;
    }

    getStatusBadge(status) {
        const statusMap = {
            'draft': '<span class="badge badge-secondary">草稿</span>',
            'active': '<span class="badge badge-success">進行中</span>',
            'completed': '<span class="badge badge-primary">已完成</span>',
            'cancelled': '<span class="badge badge-danger">已取消</span>'
        };
        return statusMap[status] || '<span class="badge badge-secondary">未知</span>';
    }
}

module.exports = new ProjectController();