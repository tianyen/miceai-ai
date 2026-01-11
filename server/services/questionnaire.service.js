/**
 * Questionnaire Service - 問卷相關業務邏輯
 *
 * 職責：
 * - 問卷 CRUD（含權限檢查）
 * - 問卷統計與分析
 * - 問卷匯出
 * - 問卷 QR Code
 * - 公開 API 邏輯
 *
 * @description 從 admin-extended.js 抽取的業務邏輯
 * @refactor 2025-12-01: 使用 Repository 層
 * @refactor 2025-12-05: 從 questionnaireController 抽取業務邏輯
 */
const BaseService = require('./base.service');
const questionnaireRepository = require('../repositories/questionnaire.repository');
const QRCode = require('qrcode');

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

    // ============================================================================
    // 問卷詳情查詢
    // ============================================================================

    /**
     * 取得問卷詳情（含問題和統計）
     * @param {number} questionnaireId - 問卷 ID
     * @param {Object} user - 當前用戶
     * @returns {Promise<Object>}
     */
    async getQuestionnaireDetail(questionnaireId, user) {
        const questionnaire = await this.repository.getDetail(questionnaireId);

        if (!questionnaire) {
            return { success: false, error: 'NOT_FOUND', message: '問卷不存在' };
        }

        // 權限檢查
        if (user.role !== 'super_admin') {
            const hasPermission = await this.repository.checkProjectPermission(user.id, questionnaire.project_id);
            if (!hasPermission) {
                return { success: false, error: 'FORBIDDEN', message: '無權限查看此問卷' };
            }
        }

        // 獲取問題
        const questions = await this.repository.getQuestions(questionnaireId);

        // 解析選項
        questions.forEach(question => {
            if (question.options) {
                try {
                    question.options = JSON.parse(question.options);
                } catch (e) {
                    question.options = [];
                }
            }
        });

        // 獲取統計
        const stats = await this.repository.getBasicStats(questionnaireId);

        return {
            success: true,
            data: {
                ...questionnaire,
                questions,
                statistics: stats || { view_count: 0, response_count: 0, completed_count: 0 }
            }
        };
    }

    // ============================================================================
    // CRUD 操作
    // ============================================================================

    /**
     * 創建問卷（含問題）
     * @param {Object} data - 問卷資料
     * @param {Object} user - 當前用戶
     * @returns {Promise<Object>}
     */
    async createQuestionnaire(data, user) {
        const {
            project_id,
            title,
            description,
            instructions,
            start_time,
            end_time,
            allow_multiple_submissions,
            is_active,
            questions
        } = data;

        // 權限檢查
        if (user.role !== 'super_admin' && user.role !== 'project_manager') {
            return { success: false, error: 'FORBIDDEN', message: '沒有建立問卷的權限' };
        }

        if (!project_id || !title) {
            return { success: false, error: 'BAD_REQUEST', message: '專案和標題為必填項目' };
        }

        // 檢查專案權限
        if (user.role !== 'super_admin') {
            const hasPermission = await this.repository.checkProjectPermission(user.id, project_id);
            if (!hasPermission) {
                return { success: false, error: 'FORBIDDEN', message: '無權限在此專案建立問卷' };
            }
        }

        const result = await this.repository.createWithQuestions({
            project_id,
            title,
            description,
            instructions,
            start_time,
            end_time,
            allow_multiple_submissions,
            is_active,
            created_by: user.id,
            questions
        });

        this.log('createQuestionnaire', { questionnaireId: result.id, title, project_id });

        return {
            success: true,
            id: result.id,
            title
        };
    }

    /**
     * 更新問卷
     * @param {number} questionnaireId - 問卷 ID
     * @param {Object} updates - 更新資料
     * @param {Object} user - 當前用戶
     * @returns {Promise<Object>}
     */
    async updateQuestionnaire(questionnaireId, updates, user) {
        const questionnaire = await this.repository.findById(questionnaireId);
        if (!questionnaire) {
            return { success: false, error: 'NOT_FOUND', message: '問卷不存在' };
        }

        // 權限檢查
        if (user.role !== 'super_admin' && questionnaire.created_by !== user.id) {
            const hasPermission = await this.repository.checkProjectPermission(user.id, questionnaire.project_id);
            if (!hasPermission) {
                return { success: false, error: 'FORBIDDEN', message: '無權限修改此問卷' };
            }
        }

        const {
            title,
            description,
            instructions,
            is_active,
            start_time,
            end_time,
            allow_multiple_submissions,
            questions
        } = updates;

        await this.repository.updateWithQuestions(questionnaireId, {
            title,
            description,
            instructions,
            is_active,
            start_time,
            end_time,
            allow_multiple_submissions,
            questions
        });

        this.log('updateQuestionnaire', { questionnaireId, title });

        return { success: true, questionnaire: { id: questionnaireId, title } };
    }

    /**
     * 刪除問卷
     * @param {number} questionnaireId - 問卷 ID
     * @param {Object} user - 當前用戶
     * @param {boolean} forceDelete - 是否強制刪除（即使有回應）
     * @returns {Promise<Object>}
     */
    async deleteQuestionnaire(questionnaireId, user, forceDelete = false) {
        // 權限檢查
        if (user.role !== 'super_admin' && user.role !== 'project_manager') {
            return { success: false, error: 'FORBIDDEN', message: '沒有刪除問卷的權限' };
        }

        const questionnaire = await this.repository.findById(questionnaireId);
        if (!questionnaire) {
            return { success: false, error: 'NOT_FOUND', message: '問卷不存在' };
        }

        // 檢查專案權限
        if (user.role !== 'super_admin') {
            const hasPermission = await this.repository.checkProjectPermission(user.id, questionnaire.project_id);
            if (!hasPermission) {
                return { success: false, error: 'FORBIDDEN', message: '無權限刪除此問卷' };
            }
        }

        // 檢查是否有回應（除非強制刪除）
        if (!forceDelete) {
            const responseCount = await this.repository.countResponses(questionnaireId);
            if (responseCount > 0) {
                return { success: false, error: 'CONFLICT', message: '無法刪除已有回應的問卷' };
            }
        }

        await this.repository.deleteCascadeFull(questionnaireId);

        this.log('deleteQuestionnaire', { questionnaireId, title: questionnaire.title });

        return { success: true, questionnaire: { id: questionnaireId, title: questionnaire.title } };
    }

    /**
     * 複製問卷
     * @param {number} questionnaireId - 問卷 ID
     * @param {Object} user - 當前用戶
     * @returns {Promise<Object>}
     */
    async duplicateQuestionnaire(questionnaireId, user) {
        if (user.role !== 'super_admin' && user.role !== 'project_manager') {
            return { success: false, error: 'FORBIDDEN', message: '沒有複製問卷的權限' };
        }

        const source = await this.repository.findById(questionnaireId);
        if (!source) {
            return { success: false, error: 'NOT_FOUND', message: '源問卷不存在' };
        }

        // 檢查專案權限
        if (user.role !== 'super_admin') {
            const hasPermission = await this.repository.checkProjectPermission(user.id, source.project_id);
            if (!hasPermission) {
                return { success: false, error: 'FORBIDDEN', message: '無權限複製此問卷' };
            }
        }

        const newTitle = `${source.title} (複製)`;

        const result = await this.repository.duplicateWithQuestions(questionnaireId, {
            newTitle,
            projectId: null, // 使用原始專案
            createdBy: user.id
        });

        if (!result.success) {
            return result;
        }

        this.log('duplicateQuestionnaire', { sourceId: questionnaireId, newId: result.id, newTitle });

        return {
            success: true,
            id: result.id,
            title: result.title,
            source_title: source.title
        };
    }

    /**
     * 切換問卷狀態
     * @param {number} questionnaireId - 問卷 ID
     * @param {string} status - 新狀態 (active/inactive)
     * @param {Object} user - 當前用戶
     * @returns {Promise<Object>}
     */
    async toggleStatus(questionnaireId, status, user) {
        if (user.role !== 'super_admin' && user.role !== 'project_manager') {
            return { success: false, error: 'FORBIDDEN', message: '沒有修改問卷狀態的權限' };
        }

        if (!['active', 'inactive'].includes(status)) {
            return { success: false, error: 'BAD_REQUEST', message: '無效的狀態值' };
        }

        const questionnaire = await this.repository.findById(questionnaireId);
        if (!questionnaire) {
            return { success: false, error: 'NOT_FOUND', message: '問卷不存在' };
        }

        // 檢查專案權限
        if (user.role !== 'super_admin') {
            const hasPermission = await this.repository.checkProjectPermission(user.id, questionnaire.project_id);
            if (!hasPermission) {
                return { success: false, error: 'FORBIDDEN', message: '無權限修改此問卷狀態' };
            }
        }

        const isActive = status === 'active' ? 1 : 0;
        const oldStatus = questionnaire.is_active ? 'active' : 'inactive';

        await this.repository.toggleActive(questionnaireId, isActive === 1);

        this.log('toggleStatus', { questionnaireId, oldStatus, newStatus: status });

        return {
            success: true,
            questionnaire: { id: questionnaireId, title: questionnaire.title },
            oldStatus,
            newStatus: status
        };
    }

    // ============================================================================
    // 統計與分析
    // ============================================================================

    /**
     * 取得詳細統計
     * @param {number} questionnaireId - 問卷 ID
     * @param {Object} user - 當前用戶
     * @returns {Promise<Object>}
     */
    async getDetailedStats(questionnaireId, user) {
        const questionnaire = await this.repository.findById(questionnaireId);
        if (!questionnaire) {
            return { success: false, error: 'NOT_FOUND', message: '問卷不存在' };
        }

        // 權限檢查
        if (user.role !== 'super_admin') {
            const hasPermission = await this.repository.checkProjectPermission(user.id, questionnaire.project_id);
            if (!hasPermission) {
                return { success: false, error: 'FORBIDDEN', message: '無權限查看此問卷統計' };
            }
        }

        // 從 Repository 獲取統計數據
        const { basicStats, dailyStats, hourlyStats } = await this.repository.getDetailedStats(questionnaireId);

        const completionRate = basicStats?.view_count > 0
            ? Math.round((basicStats.completed_count / basicStats.view_count) * 100)
            : 0;

        const interactionRate = basicStats?.view_count > 0
            ? Math.round((basicStats.response_count / basicStats.view_count) * 100)
            : 0;

        return {
            success: true,
            data: {
                questionnaire_title: questionnaire.title,
                basic_stats: {
                    ...basicStats,
                    completion_rate: completionRate,
                    interaction_rate: interactionRate,
                    avg_completion_time: basicStats?.avg_completion_time ? Math.round(basicStats.avg_completion_time) : null
                },
                daily_stats: dailyStats,
                hourly_stats: hourlyStats
            }
        };
    }

    /**
     * 取得問卷回答分析
     * @param {number} questionnaireId - 問卷 ID
     * @param {Object} user - 當前用戶
     * @returns {Promise<Object>}
     */
    async getAnalysis(questionnaireId, user) {
        const questionnaire = await this.repository.findById(questionnaireId);
        if (!questionnaire) {
            return { success: false, error: 'NOT_FOUND', message: '問卷不存在' };
        }

        // 權限檢查
        if (user.role !== 'super_admin') {
            const hasPermission = await this.repository.checkProjectPermission(user.id, questionnaire.project_id);
            if (!hasPermission) {
                return { success: false, error: 'FORBIDDEN', message: '無權限查看此問卷分析' };
            }
        }

        // 從 Repository 獲取問題和回答數據
        const { questions, responses } = await this.repository.getQuestionAnalysisData(questionnaireId);

        // 解析選項
        questions.forEach(q => {
            if (q.options) {
                try { q.options = JSON.parse(q.options); } catch (e) { q.options = []; }
            }
        });

        // 分析每個問題
        const questionAnalysis = {};
        questions.forEach(question => {
            questionAnalysis[question.id] = {
                question_text: question.question_text,
                question_type: question.question_type,
                options: question.options || [],
                total_responses: 0,
                answer_distribution: {},
                response_rate: 0
            };

            if (['single_choice', 'multiple_choice'].includes(question.question_type) && question.options) {
                question.options.forEach(option => {
                    questionAnalysis[question.id].answer_distribution[option] = 0;
                });
            }
        });

        // 統計回答
        responses.forEach(response => {
            try {
                const responseData = JSON.parse(response.response_data);
                Object.keys(responseData).forEach(questionId => {
                    if (questionAnalysis[questionId]) {
                        const answer = responseData[questionId];
                        questionAnalysis[questionId].total_responses++;

                        if (Array.isArray(answer)) {
                            answer.forEach(option => {
                                if (questionAnalysis[questionId].answer_distribution[option] !== undefined) {
                                    questionAnalysis[questionId].answer_distribution[option]++;
                                }
                            });
                        } else if (answer !== null && answer !== '') {
                            if (questionAnalysis[questionId].question_type === 'single_choice') {
                                if (questionAnalysis[questionId].answer_distribution[answer] !== undefined) {
                                    questionAnalysis[questionId].answer_distribution[answer]++;
                                }
                            } else {
                                const length = String(answer).length;
                                const lengthRange = length <= 10 ? '短(≤10字)' :
                                    length <= 50 ? '中(11-50字)' : '長(>50字)';
                                if (!questionAnalysis[questionId].answer_distribution[lengthRange]) {
                                    questionAnalysis[questionId].answer_distribution[lengthRange] = 0;
                                }
                                questionAnalysis[questionId].answer_distribution[lengthRange]++;
                            }
                        }
                    }
                });
            } catch (e) {
                // 解析失敗忽略
            }
        });

        // 計算回答率
        const totalResponses = responses.length;
        Object.keys(questionAnalysis).forEach(qId => {
            questionAnalysis[qId].response_rate = totalResponses > 0
                ? Math.round((questionAnalysis[qId].total_responses / totalResponses) * 100)
                : 0;
        });

        return {
            success: true,
            data: {
                questionnaire_title: questionnaire.title,
                total_responses: totalResponses,
                question_analysis: questionAnalysis
            }
        };
    }

    // ============================================================================
    // QR Code 相關
    // ============================================================================

    /**
     * 生成問卷 QR Code
     * @param {number} questionnaireId - 問卷 ID
     * @param {Object} user - 當前用戶
     * @param {string} baseUrl - 基礎 URL
     * @param {string} traceId - 追蹤 ID（可選）
     * @returns {Promise<Object>}
     */
    async generateQRCode(questionnaireId, user, baseUrl, traceId = null) {
        const questionnaire = await this.repository.getQuestionnaireWithProject(questionnaireId);

        if (!questionnaire) {
            return { success: false, error: 'NOT_FOUND', message: '問卷不存在' };
        }

        // 權限檢查
        if (user.role !== 'super_admin') {
            const hasPermission = await this.repository.checkProjectPermission(user.id, questionnaire.project_id);
            if (!hasPermission) {
                return { success: false, error: 'FORBIDDEN', message: '無權限生成此問卷的 QR Code' };
            }
        }

        // 生成 URL
        let questionnaireUrl = `${baseUrl}/questionnaire/${questionnaireId}`;
        if (traceId) {
            questionnaireUrl += `?trace_id=${encodeURIComponent(traceId)}`;
        }

        // 生成 QR Code
        const qrCodeDataURL = await QRCode.toDataURL(questionnaireUrl, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' },
            width: 256
        });

        // 準備 QR Code 數據
        const qrData = {
            type: 'questionnaire',
            questionnaire_id: questionnaireId,
            questionnaire_title: questionnaire.title,
            project_name: questionnaire.project_name,
            url: questionnaireUrl
        };
        if (traceId) qrData.trace_id = traceId;

        // 儲存或更新 QR Code 記錄
        const qrDataPattern = `%questionnaire/${questionnaireId}%`;
        const existingQR = await this.repository.getQRCode(questionnaire.project_id, qrDataPattern);

        if (existingQR) {
            await this.repository.updateQRCode(existingQR.id, qrCodeDataURL, JSON.stringify(qrData));
        } else {
            await this.repository.createQRCode({
                project_id: questionnaire.project_id,
                qr_code: qrCodeDataURL,
                qr_data: JSON.stringify(qrData)
            });
        }

        this.log('generateQRCode', { questionnaireId, title: questionnaire.title });

        return {
            success: true,
            data: {
                qr_code: qrCodeDataURL,
                questionnaire_url: questionnaireUrl,
                questionnaire_title: questionnaire.title,
                project_name: questionnaire.project_name
            }
        };
    }

    /**
     * 取得問卷 QR Code
     * @param {number} questionnaireId - 問卷 ID
     * @param {Object} user - 當前用戶
     * @returns {Promise<Object>}
     */
    async getQRCode(questionnaireId, user) {
        const questionnaire = await this.repository.findById(questionnaireId);
        if (!questionnaire) {
            return { success: false, error: 'NOT_FOUND', message: '問卷不存在' };
        }

        // 權限檢查
        if (user.role !== 'super_admin') {
            const hasPermission = await this.repository.checkProjectPermission(user.id, questionnaire.project_id);
            if (!hasPermission) {
                return { success: false, error: 'FORBIDDEN', message: '無權限查看此問卷的 QR Code' };
            }
        }

        const qrDataPattern = `%questionnaire/${questionnaireId}%`;
        const qrRecord = await this.repository.getQRCode(questionnaire.project_id, qrDataPattern);

        if (!qrRecord) {
            return { success: false, error: 'NOT_FOUND', message: '尚未生成 QR Code，請先生成' };
        }

        let qrData = {};
        try { qrData = JSON.parse(qrRecord.qr_data); } catch (e) { }

        return {
            success: true,
            data: {
                qr_code: qrRecord.qr_code,
                qr_data: qrData,
                scan_count: qrRecord.scan_count || 0,
                last_scanned: qrRecord.last_scanned,
                created_at: qrRecord.created_at
            }
        };
    }

    /**
     * 記錄 QR Code 掃描
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object>}
     */
    async recordQRScan(questionnaireId) {
        const questionnaire = await this.repository.findById(questionnaireId);
        if (!questionnaire) {
            return { success: false, error: 'NOT_FOUND', message: '問卷不存在' };
        }

        const qrDataPattern = `%questionnaire/${questionnaireId}%`;
        await this.repository.incrementQRScanCount(questionnaire.project_id, qrDataPattern);

        return { success: true };
    }

    // ============================================================================
    // 公開 API
    // ============================================================================

    /**
     * 取得公開問卷（用於填寫）
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object>}
     */
    async getPublicQuestionnaire(questionnaireId) {
        const questionnaire = await this.repository.getPublicQuestionnaire(questionnaireId);

        if (!questionnaire) {
            return { success: false, error: 'NOT_FOUND', message: '問卷不存在或已關閉' };
        }

        // 檢查時間限制
        const now = new Date();
        if (questionnaire.start_time && new Date(questionnaire.start_time) > now) {
            return { success: false, error: 'NOT_STARTED', message: '問卷尚未開始' };
        }
        if (questionnaire.end_time && new Date(questionnaire.end_time) < now) {
            return { success: false, error: 'ENDED', message: '問卷已結束' };
        }

        // 獲取問題
        const questions = await this.repository.getQuestions(questionnaireId);

        questions.forEach(q => {
            if (q.options) {
                try { q.options = JSON.parse(q.options); } catch (e) { q.options = []; }
            }
        });

        return {
            success: true,
            data: { ...questionnaire, questions }
        };
    }

    /**
     * 提交問卷回答
     * @param {number} questionnaireId - 問卷 ID
     * @param {Object} data - 回答資料
     * @param {Object} reqInfo - 請求資訊 (ip, userAgent)
     * @returns {Promise<Object>}
     */
    async submitResponse(questionnaireId, data, reqInfo) {
        const { trace_id, respondent_name, respondent_email, responses, completion_time } = data;

        if (!trace_id || !responses) {
            return { success: false, error: 'BAD_REQUEST', message: '缺少必要資料' };
        }

        const questionnaire = await this.repository.getPublicQuestionnaire(questionnaireId);

        if (!questionnaire) {
            return { success: false, error: 'NOT_FOUND', message: '問卷不存在或已關閉' };
        }

        // 檢查是否允許多次提交
        if (!questionnaire.allow_multiple_submissions) {
            const existing = await this.repository.checkExistingSubmission(questionnaireId, trace_id);

            if (existing) {
                return { success: false, error: 'DUPLICATE', message: '您已經填寫過此問卷' };
            }
        }

        // 驗證必填題目
        const questions = await this.repository.getQuestions(questionnaireId);

        for (const question of questions) {
            if (question.is_required && (!responses[question.id] || responses[question.id] === '')) {
                return { success: false, error: 'VALIDATION', message: `請回答必填題目：${question.question_text}` };
            }
        }

        // 獲取關聯的 submission_id
        let submission_id = null;
        const submission = await this.repository.findSubmissionByTraceId(trace_id);
        if (submission) submission_id = submission.id;

        // 儲存回答
        const result = await this.repository.submitResponse({
            questionnaire_id: questionnaireId,
            trace_id,
            submission_id,
            respondent_name,
            respondent_email,
            response_data: responses,
            is_completed: true
        });

        // 記錄互動
        await this.repository.logInteraction({
            trace_id,
            project_id: questionnaire.project_id,
            submission_id,
            interaction_type: 'questionnaire_completed',
            interaction_data: { questionnaire_title: questionnaire.title, response_count: Object.keys(responses).length },
            ip_address: reqInfo.ip,
            user_agent: reqInfo.userAgent
        });

        this.log('submitResponse', { questionnaireId, trace_id, response_id: result.id });

        return {
            success: true,
            message: '問卷提交成功！感謝您的參與。',
            response_id: result.id
        };
    }

    /**
     * 記錄問卷查看
     * @param {number} questionnaireId - 問卷 ID
     * @param {string} traceId - 追蹤 ID
     * @param {Object} reqInfo - 請求資訊
     * @returns {Promise<Object>}
     */
    async recordView(questionnaireId, traceId, reqInfo) {
        if (!traceId) {
            return { success: false, error: 'BAD_REQUEST', message: '缺少追蹤ID' };
        }

        await this.repository.logView({
            questionnaire_id: questionnaireId,
            trace_id: traceId,
            ip_address: reqInfo.ip,
            user_agent: reqInfo.userAgent,
            referrer: reqInfo.referrer
        });

        return { success: true };
    }
}

// Singleton pattern
module.exports = new QuestionnaireService();
