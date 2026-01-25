/**
 * Submission Controller - 表單提交控制器
 *
 * @description 處理 HTTP 請求，調用 SubmissionService 處理業務邏輯
 * @refactor 2025-12-05: 使用 SubmissionService，移除直接 DB 訪問
 */
const { submissionService } = require('../services');
const { logUserActivity } = require('../middleware/auth');
const vh = require('../utils/viewHelpers');
const autoBind = require('../utils/autoBind');

class SubmissionController {
    // ============================================================================
    // 列表與查詢
    // ============================================================================

    /**
     * 取得提交記錄列表
     */
    async getSubmissions(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const projectId = req.query.project_id;

            const result = await submissionService.getSubmissionsList({
                userId: req.user.id,
                userRole: req.user.role,
                page,
                limit,
                projectId
            });

            // 檢查是否要求 HTML 格式
            if (this._isHtmlRequest(req)) {
                const html = this._renderSubmissionsTable(result.submissions);
                return res.send(html);
            }

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('獲取提交列表失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取提交列表失敗'
            });
        }
    }

    /**
     * 取得提交記錄分頁
     */
    async getSubmissionsPagination(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;

            const result = await submissionService.getSubmissionsList({
                userId: req.user.id,
                userRole: req.user.role,
                page,
                limit
            });

            const html = this._renderPagination(result.pagination, page);
            res.send(html);

        } catch (error) {
            console.error('獲取提交記錄分頁失敗:', error);
            res.send('<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
        }
    }

    /**
     * 取得最近提交記錄
     */
    async getRecentSubmissions(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;

            const submissions = await submissionService.getRecentSubmissions({
                userId: req.user.id,
                userRole: req.user.role,
                limit
            });

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

    /**
     * 搜尋提交記錄
     */
    async searchSubmissions(req, res) {
        try {
            const { search, 'project-filter': projectFilter, 'status-filter': statusFilter } = req.query;
            const submissions = await submissionService.search({
                search,
                projectId: projectFilter,
                status: statusFilter,
                limit: 50
            });

            const html = submissions.length === 0
                ? vh.emptyTableRow('無符合條件的表單提交記錄', 9)
                : submissions.map(s => vh.submissionTableRow(s)).join('');

            res.send(html);
        } catch (error) {
            console.error('Search submissions error:', error);
            res.send(vh.errorTableRow('搜尋失敗', 9));
        }
    }

    // ============================================================================
    // 詳情
    // ============================================================================

    /**
     * 取得提交記錄詳情
     */
    async getSubmission(req, res) {
        try {
            const submissionId = req.params.id;

            const result = await submissionService.getSubmissionDetail(
                submissionId,
                req.user.id,
                req.user.role
            );

            if (!result.success) {
                const statusCode = result.error === 'NOT_FOUND' ? 404 : 403;
                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('獲取提交詳情失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取提交詳情失敗'
            });
        }
    }

    // ============================================================================
    // 更新操作
    // ============================================================================

    /**
     * 更新提交記錄狀態
     */
    async updateSubmissionStatus(req, res) {
        try {
            const submissionId = req.params.id;
            const { status } = req.body;

            const result = await submissionService.updateStatus(
                submissionId,
                status,
                req.user.id,
                req.user.role
            );

            if (!result.success) {
                const statusCode = result.error === 'NOT_FOUND' ? 404 : 403;
                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'submission_status_updated',
                'submission',
                submissionId,
                { status, submission_name: result.submission.submitter_name },
                req.ip
            );

            res.json({
                success: true,
                message: result.message
            });

        } catch (error) {
            console.error('更新提交狀態失敗:', error);
            res.status(500).json({
                success: false,
                message: '更新提交狀態失敗'
            });
        }
    }

    /**
     * 更新提交記錄
     */
    async updateSubmission(req, res) {
        try {
            const submissionId = req.params.id;
            const updates = req.body;

            const result = await submissionService.updateSubmission(
                submissionId,
                updates,
                req.user.id,
                req.user.role
            );

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
                'submission_updated',
                'submission',
                submissionId,
                { updated_fields: result.updatedFields, submission_name: result.submission.submitter_name },
                req.ip
            );

            res.json({
                success: true,
                message: result.message
            });

        } catch (error) {
            console.error('更新提交記錄失敗:', error);
            res.status(500).json({
                success: false,
                message: '更新提交記錄失敗'
            });
        }
    }

    // ============================================================================
    // 刪除操作
    // ============================================================================

    /**
     * 刪除提交記錄
     */
    async deleteSubmission(req, res) {
        try {
            const submissionId = req.params.id;

            const result = await submissionService.deleteSubmission(
                submissionId,
                req.user.role
            );

            if (!result.success) {
                const statusCode = result.error === 'NOT_FOUND' ? 404 : 403;
                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'submission_deleted',
                'submission',
                submissionId,
                { submission_name: result.submission.submitter_name },
                req.ip
            );

            res.json({
                success: true,
                message: result.message
            });

        } catch (error) {
            console.error('刪除提交記錄失敗:', error);
            res.status(500).json({
                success: false,
                message: '刪除提交記錄失敗'
            });
        }
    }

    // ============================================================================
    // 統計與匯出
    // ============================================================================

    /**
     * 取得提交記錄統計
     */
    async getSubmissionStats(req, res) {
        try {
            const projectId = req.query.project_id;

            const stats = await submissionService.getStats({
                userId: req.user.id,
                userRole: req.user.role,
                projectId
            });

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

    /**
     * 匯出提交記錄
     */
    async exportSubmissions(req, res) {
        try {
            const result = await submissionService.exportSubmissions({
                userId: req.user.id,
                userRole: req.user.role,
                projectId: req.query.project_id,
                status: req.query.status,
                startDate: req.query.start_date,
                endDate: req.query.end_date
            });

            // 轉換為 CSV 格式
            const csvHeader = 'ID,姓名,郵箱,電話,公司名稱,職位,項目名稱,狀態,提交時間';
            const csvRows = result.submissions.map(s => {
                return [
                    s.id,
                    s.submitter_name,
                    s.submitter_email,
                    s.submitter_phone || '',
                    s.company_name || '',
                    s.position || '',
                    s.project_name,
                    submissionService.formatStatusText(s.status),
                    new Date(s.created_at).toLocaleString('zh-TW')
                ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
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
                { count: result.count },
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
     * 渲染提交記錄表格
     * @private
     */
    _renderSubmissionsTable(submissions) {
        if (submissions.length === 0) {
            return vh.emptyTableRow('尚無表單數據', 6, '📝', '還沒有任何表單提交記錄');
        }

        return submissions.map(submission => {
            const statusBadge = vh.statusBadge(submission.status);
            const submittedAt = new Date(submission.created_at).toLocaleString('zh-TW');

            return `
                <tr>
                    <td>
                        <div class="submission-info">
                            <strong>${vh.escapeHtml(submission.submitter_name)}</strong>
                            <div class="submission-email">${vh.escapeHtml(submission.submitter_email)}</div>
                        </div>
                    </td>
                    <td>${vh.escapeHtml(submission.submitter_phone || '-')}</td>
                    <td>${vh.escapeHtml(submission.project_name || '-')}</td>
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
        }).join('');
    }

    /**
     * 渲染分頁控制
     * @private
     */
    _renderPagination(pagination, currentPage) {
        const { total, pages } = pagination;

        let html = '<div class="pagination-info">';
        html += `<span>共 ${total} 筆提交記錄，第 ${currentPage} 頁 / 共 ${pages} 頁</span>`;
        html += '</div>';

        if (pages > 1) {
            html += '<div class="pagination-controls">';

            if (currentPage > 1) {
                html += `<button class="btn btn-sm btn-outline-primary" onclick="loadSubmissionsPage(${currentPage - 1})">上一頁</button>`;
            }

            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(pages, currentPage + 2);

            for (let i = startPage; i <= endPage; i++) {
                const activeClass = i === currentPage ? 'btn-primary' : 'btn-outline-primary';
                html += `<button class="btn btn-sm ${activeClass}" onclick="loadSubmissionsPage(${i})">${i}</button>`;
            }

            if (currentPage < pages) {
                html += `<button class="btn btn-sm btn-outline-primary" onclick="loadSubmissionsPage(${currentPage + 1})">下一頁</button>`;
            }

            html += '</div>';
        }

        html += `
        <script>
            function loadSubmissionsPage(page) {
                if (typeof loadSubmissions === 'function') loadSubmissions(page);
                if (typeof loadSubmissionsPagination === 'function') loadSubmissionsPagination(page);
            }
        </script>
        `;

        return html;
    }
}

module.exports = autoBind(new SubmissionController());
