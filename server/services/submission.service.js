/**
 * Submission Service - 表單提交相關業務邏輯
 *
 * 職責：
 * - 表單提交搜尋
 * - 表單提交更新
 * - 表單提交分頁
 *
 * @description 從 admin-extended.js 抽取的業務邏輯
 * @refactor 2025-12-01: 使用 Repository 層
 */
const BaseService = require('./base.service');
const submissionRepository = require('../repositories/submission.repository');

class SubmissionService extends BaseService {
    constructor() {
        super('SubmissionService');
        this.repository = submissionRepository;
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
