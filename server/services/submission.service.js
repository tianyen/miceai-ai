/**
 * Submission Service - 表單提交相關業務邏輯
 *
 * 職責：
 * - 表單提交 CRUD 操作
 * - 表單提交搜尋與分頁
 * - 權限檢查
 * - 統計與匯出
 * - 狀態管理
 *
 * @description 從 admin-extended.js 抽取的業務邏輯
 * @refactor 2025-12-01: 使用 Repository 層
 * @refactor 2025-12-05: 從 submissionController 抽取業務邏輯
 */
const BaseService = require('./base.service');
const submissionRepository = require('../repositories/submission.repository');

class SubmissionService extends BaseService {
    constructor() {
        super('SubmissionService');
        this.repository = submissionRepository;
    }

    // ============================================================================
    // 權限檢查
    // ============================================================================

    /**
     * 構建提交記錄權限過濾條件
     * @param {string} userRole - 用戶角色
     * @param {number} userId - 用戶 ID
     * @returns {{ filter: string, params: number[] }}
     */
    buildSubmissionFilter(userRole, userId) {
        if (userRole === 'super_admin') {
            return { filter: '', params: [] };
        }

        return {
            filter: `
                WHERE (p.created_by = ? OR p.id IN (
                    SELECT project_id FROM user_project_permissions WHERE user_id = ?
                ))
            `,
            params: [userId, userId]
        };
    }

    /**
     * 檢查用戶對提交記錄的讀取權限
     * @param {number} userId - 用戶 ID
     * @param {string} userRole - 用戶角色
     * @param {Object} submission - 提交記錄（需含 project_creator 和 project_id）
     * @returns {Promise<boolean>}
     */
    async checkReadPermission(userId, userRole, submission) {
        if (userRole === 'super_admin') return true;

        if (submission.project_creator === userId) return true;

        const permission = await this.db.get(`
            SELECT 1 FROM user_project_permissions
            WHERE user_id = ? AND project_id = ?
        `, [userId, submission.project_id]);

        return !!permission;
    }

    /**
     * 檢查用戶對提交記錄的寫入權限
     * @param {number} userId - 用戶 ID
     * @param {string} userRole - 用戶角色
     * @param {Object} submission - 提交記錄（需含 project_creator 和 project_id）
     * @returns {Promise<boolean>}
     */
    async checkWritePermission(userId, userRole, submission) {
        if (userRole === 'super_admin') return true;

        if (submission.project_creator === userId) return true;

        const permission = await this.db.get(`
            SELECT 1 FROM user_project_permissions
            WHERE user_id = ? AND project_id = ? AND permission_level IN ('write', 'admin')
        `, [userId, submission.project_id]);

        return !!permission;
    }

    /**
     * 檢查用戶是否有刪除權限
     * @param {string} userRole - 用戶角色
     * @returns {boolean}
     */
    checkDeletePermission(userRole) {
        return ['super_admin', 'project_manager'].includes(userRole);
    }

    // ============================================================================
    // 列表查詢
    // ============================================================================

    /**
     * 取得提交記錄列表（含分頁）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getSubmissionsList({ userId, userRole, page = 1, limit = 20, projectId = null }) {
        const offset = (page - 1) * limit;
        const { filter, params } = this.buildSubmissionFilter(userRole, userId);

        let submissionsQuery = `
            SELECT s.*, p.project_name
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
            ${filter}
        `;

        let countQuery = `
            SELECT COUNT(*) as count
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
            ${filter}
        `;

        const queryParams = [...params];

        // 項目過濾
        if (projectId) {
            const projectFilter = filter ? ' AND p.id = ?' : ' WHERE p.id = ?';
            submissionsQuery += projectFilter;
            countQuery += projectFilter;
            queryParams.push(projectId);
        }

        submissionsQuery += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';

        const submissions = await this.db.query(submissionsQuery, [...queryParams, limit, offset]);
        const totalResult = await this.db.get(countQuery, queryParams);

        return {
            submissions,
            pagination: {
                page,
                limit,
                total: totalResult.count,
                pages: Math.ceil(totalResult.count / limit)
            }
        };
    }

    /**
     * 取得最近提交記錄
     * @param {Object} params - 查詢參數
     * @returns {Promise<Array>}
     */
    async getRecentSubmissions({ userId, userRole, limit = 10 }) {
        const { filter, params } = this.buildSubmissionFilter(userRole, userId);

        const query = `
            SELECT s.*, p.project_name
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
            ${filter}
            ORDER BY s.created_at DESC LIMIT ?
        `;

        return this.db.query(query, [...params, limit]);
    }

    // ============================================================================
    // 詳情查詢
    // ============================================================================

    /**
     * 取得提交記錄詳情（含權限檢查）
     * @param {number} submissionId - 提交 ID
     * @param {number} userId - 用戶 ID
     * @param {string} userRole - 用戶角色
     * @returns {Promise<Object>}
     */
    async getSubmissionDetail(submissionId, userId, userRole) {
        const submission = await this.db.get(`
            SELECT s.*, p.project_name, p.created_by as project_creator
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
            WHERE s.id = ?
        `, [submissionId]);

        if (!submission) {
            return { success: false, error: 'NOT_FOUND', message: '提交記錄不存在' };
        }

        // 檢查權限
        const hasPermission = await this.checkReadPermission(userId, userRole, submission);
        if (!hasPermission) {
            return { success: false, error: 'FORBIDDEN', message: '權限不足' };
        }

        // 解析 submission_data
        if (submission.submission_data) {
            try {
                submission.submission_data = JSON.parse(submission.submission_data);
            } catch (e) {
                // 解析失敗保留原始字符串
            }
        }

        return { success: true, data: submission };
    }

    // ============================================================================
    // 更新操作
    // ============================================================================

    /**
     * 更新提交記錄狀態
     * @param {number} submissionId - 提交 ID
     * @param {string} status - 新狀態
     * @param {number} userId - 用戶 ID
     * @param {string} userRole - 用戶角色
     * @returns {Promise<Object>}
     */
    async updateStatus(submissionId, status, userId, userRole) {
        const submission = await this.db.get(`
            SELECT s.*, p.created_by as project_creator
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
            WHERE s.id = ?
        `, [submissionId]);

        if (!submission) {
            return { success: false, error: 'NOT_FOUND', message: '提交記錄不存在' };
        }

        // 檢查權限
        const hasPermission = await this.checkWritePermission(userId, userRole, submission);
        if (!hasPermission) {
            return { success: false, error: 'FORBIDDEN', message: '權限不足' };
        }

        const result = await this.db.run(`
            UPDATE form_submissions
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, submissionId]);

        if (result.changes === 0) {
            return { success: false, error: 'NOT_FOUND', message: '提交記錄不存在' };
        }

        this.log('updateStatus', { submissionId, status });

        return {
            success: true,
            message: '狀態更新成功',
            submission: { id: submissionId, submitter_name: submission.submitter_name }
        };
    }

    /**
     * 更新提交記錄
     * @param {number} submissionId - 提交 ID
     * @param {Object} updates - 更新資料
     * @param {number} userId - 用戶 ID
     * @param {string} userRole - 用戶角色
     * @returns {Promise<Object>}
     */
    async updateSubmission(submissionId, updates, userId, userRole) {
        const submission = await this.db.get(`
            SELECT s.*, p.created_by as project_creator
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
            WHERE s.id = ?
        `, [submissionId]);

        if (!submission) {
            return { success: false, error: 'NOT_FOUND', message: '提交記錄不存在' };
        }

        // 檢查權限
        const hasPermission = await this.checkWritePermission(userId, userRole, submission);
        if (!hasPermission) {
            return { success: false, error: 'FORBIDDEN', message: '權限不足' };
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
            return { success: false, error: 'NO_FIELDS', message: '沒有有效的更新字段' };
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(submissionId);

        const query = `UPDATE form_submissions SET ${updateFields.join(', ')} WHERE id = ?`;
        const result = await this.db.run(query, updateValues);

        if (result.changes === 0) {
            return { success: false, error: 'NOT_FOUND', message: '提交記錄不存在' };
        }

        this.log('updateSubmission', { submissionId, fields: Object.keys(updates) });

        return {
            success: true,
            message: '提交記錄更新成功',
            submission: { id: submissionId, submitter_name: submission.submitter_name },
            updatedFields: Object.keys(updates)
        };
    }

    // ============================================================================
    // 刪除操作
    // ============================================================================

    /**
     * 刪除提交記錄（含相關資料）
     * @param {number} submissionId - 提交 ID
     * @param {string} userRole - 用戶角色
     * @returns {Promise<Object>}
     */
    async deleteSubmission(submissionId, userRole) {
        // 檢查權限
        if (!this.checkDeletePermission(userRole)) {
            return { success: false, error: 'FORBIDDEN', message: '權限不足' };
        }

        const submission = await this.db.get(`
            SELECT * FROM form_submissions WHERE id = ?
        `, [submissionId]);

        if (!submission) {
            return { success: false, error: 'NOT_FOUND', message: '提交記錄不存在' };
        }

        await this.db.beginTransaction();

        try {
            // 刪除相關 QR 碼記錄
            await this.db.run('DELETE FROM qr_codes WHERE submission_id = ?', [submissionId]);

            // 刪除提交記錄
            await this.db.run('DELETE FROM form_submissions WHERE id = ?', [submissionId]);

            await this.db.commit();

            this.log('deleteSubmission', { submissionId, submitter_name: submission.submitter_name });

            return {
                success: true,
                message: '提交記錄刪除成功',
                submission: { id: submissionId, submitter_name: submission.submitter_name }
            };
        } catch (error) {
            await this.db.rollback();
            throw error;
        }
    }

    // ============================================================================
    // 統計與匯出
    // ============================================================================

    /**
     * 取得提交記錄統計
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getStats({ userId, userRole, projectId = null }) {
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

        const stats = await this.db.get(`
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

        return stats;
    }

    /**
     * 匯出提交記錄
     * @param {Object} params - 匯出參數
     * @returns {Promise<Object>}
     */
    async exportSubmissions({ userId, userRole, projectId, status, startDate, endDate }) {
        let query = `
            SELECT s.*, p.project_name
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
        `;
        const whereConditions = [];
        const queryParams = [];

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

        const submissions = await this.db.query(query, queryParams);

        this.log('exportSubmissions', { count: submissions.length, projectId });

        return {
            success: true,
            submissions,
            count: submissions.length
        };
    }

    /**
     * 格式化狀態為中文
     * @param {string} status - 狀態
     * @returns {string}
     */
    formatStatusText(status) {
        const statusMap = {
            'pending': '待審核',
            'approved': '已批准',
            'rejected': '已拒絕',
            'confirmed': '已確認',
            'cancelled': '已取消'
        };
        return statusMap[status] || status;
    }

    /**
     * 搜尋表單提交記錄
     * @param {Object} params - 搜尋參數
     * @param {string} params.search - 搜尋關鍵字
     * @param {number} params.projectId - 專案 ID
     * @param {string} params.status - 狀態篩選
     * @param {number} params.limit - 限制筆數
     * @returns {Promise<Array>} 提交記錄列表
     */
    async search({ search, projectId, status, limit = 50 } = {}) {
        return this.repository.search({ search, projectId, status, limit });
    }

    /**
     * 取得分頁資訊
     * @param {number} page - 頁碼
     * @param {number} limit - 每頁筆數
     * @returns {Promise<Object>} 分頁資訊
     */
    async getPagination(page = 1, limit = 20) {
        const total = await this.repository.count();
        const pages = Math.ceil(total / limit);

        return {
            total,
            pages,
            currentPage: page,
            limit,
            hasNext: page < pages,
            hasPrev: page > 1
        };
    }

    /**
     * 取得提交記錄詳情
     * @param {number} submissionId - 提交 ID
     * @returns {Promise<Object|null>} 提交記錄
     */
    async getById(submissionId) {
        return this.repository.findByIdWithProject(submissionId);
    }

    /**
     * 更新提交記錄
     * @param {number} submissionId - 提交 ID
     * @param {Object} data - 更新數據
     * @returns {Promise<Object>} 更新結果
     */
    async update(submissionId, {
        submitter_name,
        submitter_email,
        submitter_phone,
        company_name,
        position,
        project_id,
        status
    }) {
        // 驗證必要欄位
        if (!submitter_name || !submitter_email) {
            this.throwError(this.ErrorCodes.MISSING_REQUIRED_FIELD, '姓名和電子郵件為必填欄位');
        }

        // 驗證電子郵件格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(submitter_email)) {
            this.throwError(this.ErrorCodes.INVALID_EMAIL);
        }

        // 檢查提交記錄是否存在
        const submission = await this.repository.findById(submissionId);

        if (!submission) {
            this.throwError(this.ErrorCodes.SUBMISSION_NOT_FOUND);
        }

        // 更新提交記錄
        await this.repository.updateSubmission(submissionId, {
            submitter_name,
            submitter_email,
            submitter_phone: submitter_phone || null,
            company_name: company_name || null,
            position: position || null,
            project_id: project_id || null,
            status: status || 'pending'
        });

        this.log('update', { submissionId });

        return {
            success: true,
            message: '提交記錄已更新',
            data: { id: submissionId }
        };
    }

    /**
     * 刪除提交記錄
     * @param {number} submissionId - 提交 ID
     * @returns {Promise<Object>} 刪除結果
     */
    async delete(submissionId) {
        // 檢查提交記錄是否存在
        const submission = await this.repository.findById(submissionId);

        if (!submission) {
            this.throwError(this.ErrorCodes.SUBMISSION_NOT_FOUND);
        }

        // 刪除相關記錄
        await this.repository.deleteWithRelated(submissionId);

        this.log('delete', { submissionId });

        return { success: true, message: '提交記錄已刪除' };
    }

    /**
     * 取得簽到統計
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>} 統計資料
     */
    async getCheckinStats(projectId) {
        return this.repository.getCheckinStats(projectId);
    }

    /**
     * 取得今日統計
     * @returns {Promise<Object>} 統計資料
     */
    async getTodayStats() {
        return this.repository.getTodayStats();
    }

    /**
     * 格式化狀態顯示
     * @param {string} status - 狀態
     * @returns {Object} 狀態顯示資訊
     */
    formatStatus(status) {
        const statusMap = {
            pending: { class: 'warning', label: '待處理' },
            confirmed: { class: 'success', label: '已確認' },
            cancelled: { class: 'danger', label: '已取消' },
            approved: { class: 'info', label: '已核准' },
            rejected: { class: 'secondary', label: '已拒絕' }
        };

        return statusMap[status] || { class: 'secondary', label: status || 'pending' };
    }
}

// Singleton pattern
module.exports = new SubmissionService();
