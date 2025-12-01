/**
 * Questionnaire Service - 問卷相關業務邏輯
 *
 * 職責：
 * - 問卷統計
 * - 問卷匯出
 * - 問卷 QR Code
 *
 * @description 從 admin-extended.js 抽取的業務邏輯
 * @refactor 2025-12-01: 使用 Repository 層
 */
const BaseService = require('./base.service');
const questionnaireRepository = require('../repositories/questionnaire.repository');

class QuestionnaireService extends BaseService {
    constructor() {
        super('QuestionnaireService');
        this.repository = questionnaireRepository;
    }

    /**
     * 取得問卷概覽統計
     * @returns {Promise<Object>} 概覽統計
     */
    async getOverviewStats() {
        const stats = await this.repository.getOverviewStats();

        return {
            totalSubmissions: stats.totalResponses,
            totalQuestionnaires: stats.totalQuestionnaires
        };
    }

    /**
     * 取得特定問卷統計
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object|null>} 問卷統計
     */
    async getQuestionnaireStats(questionnaireId) {
        const result = await this.repository.getQuestionnaireWithResponses(questionnaireId);

        if (!result) {
            return null;
        }

        return {
            questionnaire: result.questionnaire,
            responses: result.responses,
            responseCount: result.responseCount
        };
    }

    /**
     * 匯出問卷回應為 CSV
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object>} CSV 數據
     */
    async exportResponses(questionnaireId) {
        const questionnaire = await this.repository.findById(questionnaireId);

        if (!questionnaire) {
            this.throwError(this.ErrorCodes.NOT_FOUND, '問卷不存在');
        }

        const responses = await this.repository.getResponses(questionnaireId);

        // 生成 CSV 內容
        let csvContent = '提交時間,回應數據\n';
        responses.forEach(response => {
            const submittedAt = new Date(response.submitted_at).toLocaleString('zh-TW');
            const responseData = JSON.stringify(response.response_data).replace(/"/g, '""');
            csvContent += `"${submittedAt}","${responseData}"\n`;
        });

        return {
            questionnaire,
            csvContent,
            fileName: `questionnaire-${questionnaireId}-export.csv`
        };
    }

    /**
     * 取得問卷 QR Code 資訊
     * @param {number} questionnaireId - 問卷 ID
     * @param {string} baseUrl - 基礎 URL
     * @returns {Promise<Object|null>} QR Code 資訊
     */
    async getQrCodeInfo(questionnaireId, baseUrl = 'http://localhost:3000') {
        const questionnaire = await this.repository.findById(questionnaireId);

        if (!questionnaire) {
            return null;
        }

        return {
            questionnaire,
            url: `${baseUrl}/questionnaire/${questionnaire.id}`
        };
    }

    /**
     * 取得問卷詳情
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object|null>} 問卷詳情
     */
    async getById(questionnaireId) {
        return this.repository.findById(questionnaireId);
    }

    // ============================================================================
    // 管理後台 - 統計相關
    // ============================================================================

    /**
     * 取得問卷統計資料（用於 /api/stats）
     * @param {number} questionnaireId - 問卷 ID
     * @param {Object} user - 當前用戶
     * @returns {Promise<Object|null>}
     */
    async getStatsData(questionnaireId, user) {
        // 獲取問卷基本資料
        const questionnaire = await this.repository.findById(questionnaireId);
        if (!questionnaire) {
            return { error: 'not_found' };
        }

        // 檢查權限
        if (user.role !== 'super_admin') {
            const hasPermission = await this.repository.checkProjectPermission(
                user.id,
                questionnaire.project_id
            );
            if (!hasPermission) {
                return { error: 'no_permission' };
            }
        }

        // 獲取統計資料
        const basicStats = await this.repository.getBasicStats(questionnaireId);
        const recentResponses = await this.repository.getRecentResponses(questionnaireId, 10);

        return {
            questionnaire,
            basicStats: basicStats || { view_count: 0, response_count: 0, completed_count: 0 },
            recentResponses
        };
    }

    // ============================================================================
    // 管理後台 - 列表與分頁
    // ============================================================================

    /**
     * 取得問卷列表（含統計）
     * @param {Object} options - 查詢選項
     * @param {Object} user - 當前用戶
     * @returns {Promise<Object>}
     */
    async getList({ page = 1, limit = 20, projectId, search }, user) {
        const offset = (page - 1) * limit;

        const questionnaires = await this.repository.getListWithStats({
            userId: user.id,
            userRole: user.role,
            projectId,
            search,
            limit,
            offset
        });

        const total = await this.repository.getCountWithFilters({
            userId: user.id,
            userRole: user.role,
            projectId,
            search
        });

        return {
            questionnaires,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * 取得分頁資訊
     * @param {Object} options - 查詢選項
     * @param {Object} user - 當前用戶
     * @returns {Promise<Object>}
     */
    async getPaginationInfo({ page = 1, limit = 20, projectId, search }, user) {
        const total = await this.repository.getCountWithFilters({
            userId: user.id,
            userRole: user.role,
            projectId,
            search
        });

        return {
            total,
            pages: Math.ceil(total / limit),
            currentPage: page
        };
    }

    /**
     * 取得用戶可訪問的專案
     * @param {Object} user - 當前用戶
     * @returns {Promise<Array>}
     */
    async getUserProjects(user) {
        return this.repository.getUserAccessibleProjects(user.id, user.role);
    }

    /**
     * 取得問卷（含專案資訊）
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object|null>}
     */
    async getQuestionnaireWithProject(questionnaireId) {
        return this.repository.getQuestionnaireWithProject(questionnaireId);
    }

    /**
     * 檢查用戶是否有問卷存取權限
     * @param {number} questionnaireId - 問卷 ID
     * @param {Object} user - 當前用戶
     * @returns {Promise<Object>} { hasAccess, questionnaire }
     */
    async checkUserAccess(questionnaireId, user) {
        const questionnaire = await this.repository.getQuestionnaireWithProject(questionnaireId);

        if (!questionnaire) {
            return { hasAccess: false, error: 'not_found' };
        }

        if (user.role === 'super_admin') {
            return { hasAccess: true, questionnaire };
        }

        const hasPermission = await this.repository.checkProjectPermission(
            user.id,
            questionnaire.project_id
        );

        return {
            hasAccess: hasPermission,
            questionnaire,
            error: hasPermission ? null : 'no_permission'
        };
    }
}

// Singleton pattern
module.exports = new QuestionnaireService();
