const database = require('../config/database');
const { logUserActivity } = require('../middleware/auth');

class SubmissionController {
    async getSubmissions(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            const projectId = req.query.project_id;
            const userId = req.user.id;
            const userRole = req.user.role;

            let submissionsQuery = `
                SELECT s.*, p.project_name
                FROM form_submissions s
                LEFT JOIN event_projects p ON s.project_id = p.id
            `;
            let countQuery = `
                SELECT COUNT(*) as count
                FROM form_submissions s
                LEFT JOIN event_projects p ON s.project_id = p.id
            `;

            let whereClause = '';
            let queryParams = [];

            // 權限過濾
            if (userRole !== 'super_admin') {
                whereClause += `
                    WHERE (p.created_by = ? OR p.id IN (
                        SELECT project_id FROM user_project_permissions WHERE user_id = ?
                    ))
                `;
                queryParams.push(userId, userId);
            }

            // 項目過濾
            if (projectId) {
                if (whereClause) {
                    whereClause += ' AND p.id = ?';
                } else {
                    whereClause = ' WHERE p.id = ?';
                }
                queryParams.push(projectId);
            }

            submissionsQuery += whereClause + ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
            countQuery += whereClause;

            const submissions = await database.query(submissionsQuery, [...queryParams, limit, offset]);
            const totalResult = await database.get(countQuery, queryParams);
            const total = totalResult.count;

            // Check if HTML response is requested
            if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.query.format === 'html') {
                let html = '';

                if (submissions.length === 0) {
                    html = `
                        <tr>
                            <td colspan="7" class="empty-state">
                                <div class="empty-icon">📝</div>
                                <div class="empty-text">
                                    <h4>尚無表單數據</h4>
                                    <p>還沒有任何表單提交記錄</p>
                                </div>
                            </td>
                        </tr>
                    `;
                } else {
                    // Define getStatusBadge function locally
                    const getStatusBadge = (status) => {
                        const statusMap = {
                            'pending': '<span class="badge badge-warning">待處理</span>',
                            'approved': '<span class="badge badge-success">已批准</span>',
                            'rejected': '<span class="badge badge-danger">已拒絕</span>',
                            'confirmed': '<span class="badge badge-success">已確認</span>',
                            'cancelled': '<span class="badge badge-secondary">已取消</span>'
                        };
                        return statusMap[status] || '<span class="badge badge-secondary">未知</span>';
                    };

                    submissions.forEach(submission => {
                        const statusBadge = getStatusBadge(submission.status);
                        const submittedAt = new Date(submission.created_at).toLocaleString('zh-TW');

                        html += `
                            <tr>
                                <td>
                                    <div class="submission-info">
                                        <strong>${submission.submitter_name}</strong>
                                        <div class="submission-email">${submission.submitter_email}</div>
                                    </div>
                                </td>
                                <td>${submission.submitter_phone || '-'}</td>
                                <td>${submission.project_name || '-'}</td>
                                <td>${statusBadge}</td>
                                <td>${submittedAt}</td>
                                <td>
                                    <div class="submission-actions">
                                        <button class="btn btn-sm btn-primary" onclick="viewSubmission(${submission.id})" title="查看詳情">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="btn btn-sm btn-success" onclick="editSubmission(${submission.id})" title="編輯">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="deleteSubmission(${submission.id})" title="刪除">
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
                    data: {
                        submissions,
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
            console.error('獲取提交列表失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取提交列表失敗'
            });
        }
    }

    // 提交記錄分頁
    async getSubmissionsPagination(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const userId = req.user.id;
            const userRole = req.user.role;

            let countQuery = 'SELECT COUNT(*) as count FROM form_submissions fs';
            let queryParams = [];

            // 權限過濾
            if (userRole !== 'super_admin') {
                countQuery += ` LEFT JOIN event_projects p ON fs.project_id = p.id
                              WHERE (p.created_by = ? OR p.id IN (
                                  SELECT project_id FROM user_project_permissions WHERE user_id = ?
                              ))`;
                queryParams = [userId, userId];
            }

            const totalResult = await database.get(countQuery, queryParams);
            const total = totalResult.count;
            const pages = Math.ceil(total / limit);

            let paginationHtml = '<div class="pagination-info">';
            paginationHtml += `<span>共 ${total} 筆提交記錄，第 ${page} 頁 / 共 ${pages} 頁</span>`;
            paginationHtml += '</div>';

            if (pages > 1) {
                paginationHtml += '<div class="pagination-controls">';

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
                    if (typeof loadSubmissions === 'function') loadSubmissions(page);
                    if (typeof loadSubmissionsPagination === 'function') loadSubmissionsPagination(page);
                }
            </script>
            `;

            res.send(paginationHtml);

        } catch (error) {
            console.error('獲取提交記錄分頁失敗:', error);
            res.send('<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
        }
    }

    async getRecentSubmissions(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const userId = req.user.id;
            const userRole = req.user.role;

            let query = `
                SELECT s.*, p.project_name
                FROM form_submissions s
                LEFT JOIN event_projects p ON s.project_id = p.id
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

            query += ' ORDER BY s.created_at DESC LIMIT ?';
            const submissions = await database.query(query, [...queryParams, limit]);

            res.json({
                success: true,
                data: submissions
            });

        } catch (error) {
            console.error('獲取最新提交失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取最新提交失敗'
            });
        }
    }

    async getSubmission(req, res) {
        try {
            const submissionId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            let query = `
                SELECT s.*, p.project_name, p.created_by as project_creator
                FROM form_submissions s
                LEFT JOIN event_projects p ON s.project_id = p.id
                WHERE s.id = ?
            `;
            let queryParams = [submissionId];

            const submission = await database.get(query, queryParams);

            if (!submission) {
                return res.status(404).json({
                    success: false,
                    message: '提交記錄不存在'
                });
            }

            // 檢查權限
            if (userRole !== 'super_admin') {
                const hasPermission = submission.project_creator === userId ||
                    await database.get(`
                        SELECT 1 FROM user_project_permissions 
                        WHERE user_id = ? AND project_id = ?
                    `, [userId, submission.project_id]);

                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '權限不足'
                    });
                }
            }

            // 解析 submission_data
            if (submission.submission_data) {
                try {
                    submission.submission_data = JSON.parse(submission.submission_data);
                } catch (e) {
                    // 如果解析失敗，保留原始字符串
                }
            }

            res.json({
                success: true,
                data: submission
            });

        } catch (error) {
            console.error('獲取提交詳情失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取提交詳情失敗'
            });
        }
    }

    async updateSubmissionStatus(req, res) {
        try {
            const submissionId = req.params.id;
            const { status } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 獲取提交信息以檢查權限
            const submission = await database.get(`
                SELECT s.*, p.created_by as project_creator
                FROM form_submissions s
                LEFT JOIN event_projects p ON s.project_id = p.id
                WHERE s.id = ?
            `, [submissionId]);

            if (!submission) {
                return res.status(404).json({
                    success: false,
                    message: '提交記錄不存在'
                });
            }

            // 檢查權限 - 只有項目創建者或有寫入權限的用戶可以更新狀態
            if (userRole !== 'super_admin') {
                const hasPermission = submission.project_creator === userId ||
                    await database.get(`
                        SELECT 1 FROM user_project_permissions 
                        WHERE user_id = ? AND project_id = ? AND permission_level IN ('write', 'admin')
                    `, [userId, submission.project_id]);

                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '權限不足'
                    });
                }
            }

            const result = await database.run(`
                UPDATE form_submissions 
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [status, submissionId]);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: '提交記錄不存在'
                });
            }

            await logUserActivity(
                req.user.id,
                'submission_status_updated',
                'submission',
                submissionId,
                { status, submission_name: submission.submitter_name },
                req.ip
            );

            res.json({
                success: true,
                message: '狀態更新成功'
            });

        } catch (error) {
            console.error('更新提交狀態失敗:', error);
            res.status(500).json({
                success: false,
                message: '更新提交狀態失敗'
            });
        }
    }

    async updateSubmission(req, res) {
        try {
            const submissionId = req.params.id;
            const updates = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 獲取提交信息以檢查權限
            const submission = await database.get(`
                SELECT s.*, p.created_by as project_creator
                FROM form_submissions s
                LEFT JOIN event_projects p ON s.project_id = p.id
                WHERE s.id = ?
            `, [submissionId]);

            if (!submission) {
                return res.status(404).json({
                    success: false,
                    message: '提交記錄不存在'
                });
            }

            // 檢查權限 - 只有項目創建者或有寫入權限的用戶可以更新
            if (userRole !== 'super_admin') {
                const hasPermission = submission.project_creator === userId ||
                    await database.get(`
                        SELECT 1 FROM user_project_permissions 
                        WHERE user_id = ? AND project_id = ? AND permission_level IN ('write', 'admin')
                    `, [userId, submission.project_id]);

                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '權限不足'
                    });
                }
            }

            // 構建更新查詢
            const allowedFields = ['status', 'notes', 'admin_notes'];
            const updateFields = [];
            const updateValues = [];

            Object.keys(updates).forEach(field => {
                if (allowedFields.includes(field) && updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(updates[field]);
                }
            });

            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '沒有有效的更新字段'
                });
            }

            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            updateValues.push(submissionId);

            const query = `UPDATE form_submissions SET ${updateFields.join(', ')} WHERE id = ?`;
            const result = await database.run(query, updateValues);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: '提交記錄不存在'
                });
            }

            await logUserActivity(
                req.user.id,
                'submission_updated',
                'submission',
                submissionId,
                { updated_fields: Object.keys(updates), submission_name: submission.submitter_name },
                req.ip
            );

            res.json({
                success: true,
                message: '提交記錄更新成功'
            });

        } catch (error) {
            console.error('更新提交記錄失敗:', error);
            res.status(500).json({
                success: false,
                message: '更新提交記錄失敗'
            });
        }
    }

    async deleteSubmission(req, res) {
        try {
            const submissionId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 獲取提交信息以檢查權限
            const submission = await database.get(`
                SELECT s.*, p.created_by as project_creator
                FROM form_submissions s
                LEFT JOIN event_projects p ON s.project_id = p.id
                WHERE s.id = ?
            `, [submissionId]);

            if (!submission) {
                return res.status(404).json({
                    success: false,
                    message: '提交記錄不存在'
                });
            }

            // 檢查權限 - 只有超級管理員或項目管理員可以刪除
            if (!['super_admin', 'project_manager'].includes(userRole)) {
                return res.status(403).json({
                    success: false,
                    message: '權限不足'
                });
            }

            // 開始事務
            await database.beginTransaction();

            try {
                // 刪除相關 QR 碼記錄
                await database.run('DELETE FROM qr_codes WHERE submission_id = ?', [submissionId]);

                // 刪除提交記錄
                await database.run('DELETE FROM form_submissions WHERE id = ?', [submissionId]);

                await database.commit();

                await logUserActivity(
                    req.user.id,
                    'submission_deleted',
                    'submission',
                    submissionId,
                    { submission_name: submission.submitter_name },
                    req.ip
                );

                res.json({
                    success: true,
                    message: '提交記錄刪除成功'
                });

            } catch (error) {
                await database.rollback();
                throw error;
            }

        } catch (error) {
            console.error('刪除提交記錄失敗:', error);
            res.status(500).json({
                success: false,
                message: '刪除提交記錄失敗'
            });
        }
    }

    async getSubmissionStats(req, res) {
        try {
            const projectId = req.query.project_id;
            const userId = req.user.id;
            const userRole = req.user.role;

            let whereClause = '';
            let queryParams = [];

            // 權限過濾
            if (userRole !== 'super_admin') {
                whereClause = `
                    WHERE s.project_id IN (
                        SELECT id FROM event_projects 
                        WHERE created_by = ? 
                        UNION 
                        SELECT project_id FROM user_project_permissions WHERE user_id = ?
                    )
                `;
                queryParams = [userId, userId];
            }

            // 項目過濾
            if (projectId) {
                if (whereClause) {
                    whereClause += ' AND s.project_id = ?';
                } else {
                    whereClause = ' WHERE s.project_id = ?';
                }
                queryParams.push(projectId);
            }

            const stats = await database.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                    COUNT(CASE WHEN date(created_at) = date('now') THEN 1 END) as today,
                    COUNT(CASE WHEN date(created_at) >= date('now', '-7 days') THEN 1 END) as this_week,
                    COUNT(CASE WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') THEN 1 END) as this_month
                FROM form_submissions s
                ${whereClause}
            `, queryParams);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('獲取提交統計失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取提交統計失敗'
            });
        }
    }

    async exportSubmissions(req, res) {
        try {
            const projectId = req.query.project_id;
            const status = req.query.status;
            const startDate = req.query.start_date;
            const endDate = req.query.end_date;
            const userId = req.user.id;
            const userRole = req.user.role;

            let query = `
                SELECT s.*, p.project_name
                FROM form_submissions s
                LEFT JOIN event_projects p ON s.project_id = p.id
            `;
            let whereConditions = [];
            let queryParams = [];

            // 權限過濾
            if (userRole !== 'super_admin') {
                whereConditions.push(`
                    (p.created_by = ? OR p.id IN (
                        SELECT project_id FROM user_project_permissions WHERE user_id = ?
                    ))
                `);
                queryParams.push(userId, userId);
            }

            // 其他過濾條件
            if (projectId) {
                whereConditions.push('s.project_id = ?');
                queryParams.push(projectId);
            }

            if (status) {
                whereConditions.push('s.status = ?');
                queryParams.push(status);
            }

            if (startDate) {
                whereConditions.push('date(s.created_at) >= ?');
                queryParams.push(startDate);
            }

            if (endDate) {
                whereConditions.push('date(s.created_at) <= ?');
                queryParams.push(endDate);
            }

            if (whereConditions.length > 0) {
                query += ' WHERE ' + whereConditions.join(' AND ');
            }

            query += ' ORDER BY s.created_at DESC';

            const submissions = await database.query(query, queryParams);

            // 轉換為 CSV 格式
            const csvHeader = 'ID,姓名,郵箱,電話,公司名稱,職位,項目名稱,狀態,提交時間';
            const csvRows = submissions.map(s => {
                return [
                    s.id,
                    s.submitter_name,
                    s.submitter_email,
                    s.submitter_phone || '',
                    s.company_name || '',
                    s.position || '',
                    s.project_name,
                    s.status === 'pending' ? '待審核' : s.status === 'approved' ? '已批准' : '已拒絕',
                    new Date(s.created_at).toLocaleString('zh-TW')
                ].map(field => `"${field}"`).join(',');
            });

            const csv = [csvHeader, ...csvRows].join('\n');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="submissions_${new Date().toISOString().split('T')[0]}.csv"`);
            res.send('\ufeff' + csv); // BOM for UTF-8

            await logUserActivity(
                req.user.id,
                'submissions_exported',
                'submission',
                null,
                { count: submissions.length },
                req.ip
            );

        } catch (error) {
            console.error('導出提交數據失敗:', error);
            res.status(500).json({
                success: false,
                message: '導出提交數據失敗'
            });
        }
    }
}

module.exports = new SubmissionController();