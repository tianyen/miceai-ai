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
        const questionnaire = await this.db.get(`
            SELECT q.*, u.full_name as creator_name, p.project_name
            FROM questionnaires q
            LEFT JOIN users u ON q.created_by = u.id
            LEFT JOIN event_projects p ON q.project_id = p.id
            WHERE q.id = ?
        `, [questionnaireId]);

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
        const questions = await this.db.query(`
            SELECT * FROM questionnaire_questions
            WHERE questionnaire_id = ?
            ORDER BY display_order ASC, id ASC
        `, [questionnaireId]);

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

        await this.db.beginTransaction();

        try {
            // 創建問卷
            const result = await this.db.run(`
                INSERT INTO questionnaires (
                    project_id, title, description, instructions,
                    start_time, end_time, allow_multiple_submissions,
                    is_active, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                project_id,
                title,
                description || null,
                instructions || null,
                start_time || null,
                end_time || null,
                allow_multiple_submissions ? 1 : 0,
                is_active !== undefined ? (is_active ? 1 : 0) : 1,
                user.id
            ]);

            const questionnaireId = result.lastID;

            // 創建問題
            if (questions && questions.length > 0) {
                for (let i = 0; i < questions.length; i++) {
                    const question = questions[i];
                    await this.db.run(`
                        INSERT INTO questionnaire_questions (
                            questionnaire_id, question_text, question_type,
                            is_required, options, display_order
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                        questionnaireId,
                        question.question_text,
                        question.question_type,
                        question.is_required || 1,
                        question.options ? JSON.stringify(question.options) : null,
                        i + 1
                    ]);
                }
            }

            await this.db.commit();

            this.log('createQuestionnaire', { questionnaireId, title, project_id });

            return {
                success: true,
                id: questionnaireId,
                title
            };

        } catch (error) {
            await this.db.rollback();
            throw error;
        }
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

        await this.db.beginTransaction();

        try {
            // 更新問卷基本信息
            await this.db.run(`
                UPDATE questionnaires
                SET title = ?, description = ?, instructions = ?,
                    is_active = ?, start_time = ?, end_time = ?,
                    allow_multiple_submissions = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                title,
                description,
                instructions,
                is_active,
                start_time,
                end_time,
                allow_multiple_submissions,
                questionnaireId
            ]);

            // 更新問題（先刪除後重建）
            if (questions) {
                await this.db.run(
                    'DELETE FROM questionnaire_questions WHERE questionnaire_id = ?',
                    [questionnaireId]
                );

                for (let i = 0; i < questions.length; i++) {
                    const question = questions[i];
                    await this.db.run(`
                        INSERT INTO questionnaire_questions (
                            questionnaire_id, question_text, question_type,
                            is_required, options, display_order
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                        questionnaireId,
                        question.question_text,
                        question.question_type,
                        question.is_required || 1,
                        question.options ? JSON.stringify(question.options) : null,
                        i + 1
                    ]);
                }
            }

            await this.db.commit();

            this.log('updateQuestionnaire', { questionnaireId, title });

            return { success: true, questionnaire: { id: questionnaireId, title } };

        } catch (error) {
            await this.db.rollback();
            throw error;
        }
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

        await this.db.beginTransaction();

        try {
            await this.db.run('DELETE FROM questionnaire_responses WHERE questionnaire_id = ?', [questionnaireId]);
            await this.db.run('DELETE FROM questionnaire_views WHERE questionnaire_id = ?', [questionnaireId]);
            await this.db.run('DELETE FROM questionnaire_questions WHERE questionnaire_id = ?', [questionnaireId]);
            await this.db.run('DELETE FROM questionnaires WHERE id = ?', [questionnaireId]);

            await this.db.commit();

            this.log('deleteQuestionnaire', { questionnaireId, title: questionnaire.title });

            return { success: true, questionnaire: { id: questionnaireId, title: questionnaire.title } };

        } catch (error) {
            await this.db.rollback();
            throw error;
        }
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

        await this.db.beginTransaction();

        try {
            const newTitle = `${source.title} (複製)`;
            const result = await this.db.run(`
                INSERT INTO questionnaires (
                    project_id, title, description, instructions,
                    allow_multiple_submissions, is_active, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                source.project_id,
                newTitle,
                source.description,
                source.instructions,
                source.allow_multiple_submissions,
                0, // 預設停用
                user.id
            ]);

            const newId = result.lastID;

            // 複製問題
            const questions = await this.db.query(`
                SELECT * FROM questionnaire_questions
                WHERE questionnaire_id = ?
                ORDER BY display_order ASC
            `, [questionnaireId]);

            for (const question of questions) {
                await this.db.run(`
                    INSERT INTO questionnaire_questions (
                        questionnaire_id, question_text, question_type,
                        is_required, options, display_order
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    newId,
                    question.question_text,
                    question.question_type,
                    question.is_required,
                    question.options,
                    question.display_order
                ]);
            }

            await this.db.commit();

            this.log('duplicateQuestionnaire', { sourceId: questionnaireId, newId, newTitle });

            return {
                success: true,
                id: newId,
                title: newTitle,
                source_title: source.title
            };

        } catch (error) {
            await this.db.rollback();
            throw error;
        }
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

        await this.db.run(`
            UPDATE questionnaires
            SET is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [isActive, questionnaireId]);

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

        // 基本統計
        const basicStats = await this.db.get(`
            SELECT
                COUNT(DISTINCT qv.trace_id) as view_count,
                COUNT(DISTINCT qr.trace_id) as response_count,
                COUNT(DISTINCT CASE WHEN qr.is_completed = 1 THEN qr.trace_id END) as completed_count,
                AVG(qr.completion_time) as avg_completion_time
            FROM questionnaire_views qv
            LEFT JOIN questionnaire_responses qr ON qv.questionnaire_id = qr.questionnaire_id
                AND qv.trace_id = qr.trace_id
            WHERE qv.questionnaire_id = ?
        `, [questionnaireId]);

        // 每日統計
        const dailyStats = await this.db.query(`
            SELECT
                DATE(qv.view_time) as date,
                COUNT(DISTINCT qv.trace_id) as views,
                COUNT(DISTINCT qr.trace_id) as responses,
                COUNT(DISTINCT CASE WHEN qr.is_completed = 1 THEN qr.trace_id END) as completions
            FROM questionnaire_views qv
            LEFT JOIN questionnaire_responses qr ON qv.questionnaire_id = qr.questionnaire_id
                AND qv.trace_id = qr.trace_id
            WHERE qv.questionnaire_id = ?
                AND qv.view_time >= DATE('now', '-30 days')
            GROUP BY DATE(qv.view_time)
            ORDER BY date DESC
        `, [questionnaireId]);

        // 每小時統計（今日）
        const hourlyStats = await this.db.query(`
            SELECT
                strftime('%H', qv.view_time) as hour,
                COUNT(DISTINCT qv.trace_id) as views,
                COUNT(DISTINCT qr.trace_id) as responses
            FROM questionnaire_views qv
            LEFT JOIN questionnaire_responses qr ON qv.questionnaire_id = qr.questionnaire_id
                AND qv.trace_id = qr.trace_id
            WHERE qv.questionnaire_id = ?
                AND DATE(qv.view_time) = DATE('now')
            GROUP BY strftime('%H', qv.view_time)
            ORDER BY hour
        `, [questionnaireId]);

        const completionRate = basicStats.view_count > 0
            ? Math.round((basicStats.completed_count / basicStats.view_count) * 100)
            : 0;

        const interactionRate = basicStats.view_count > 0
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
                    avg_completion_time: basicStats.avg_completion_time ? Math.round(basicStats.avg_completion_time) : null
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

        // 獲取問題
        const questions = await this.db.query(`
            SELECT id, question_text, question_type, options
            FROM questionnaire_questions
            WHERE questionnaire_id = ?
            ORDER BY display_order ASC, id ASC
        `, [questionnaireId]);

        // 解析選項
        questions.forEach(q => {
            if (q.options) {
                try { q.options = JSON.parse(q.options); } catch (e) { q.options = []; }
            }
        });

        // 獲取所有回答
        const responses = await this.db.query(`
            SELECT response_data, completed_at, completion_time
            FROM questionnaire_responses
            WHERE questionnaire_id = ? AND is_completed = 1
        `, [questionnaireId]);

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
        const questionnaire = await this.db.get(`
            SELECT q.*, p.project_name
            FROM questionnaires q
            LEFT JOIN event_projects p ON q.project_id = p.id
            WHERE q.id = ?
        `, [questionnaireId]);

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
        const existingQR = await this.db.get(`
            SELECT * FROM qr_codes WHERE project_id = ? AND qr_data LIKE ?
        `, [questionnaire.project_id, `%questionnaire/${questionnaireId}%`]);

        if (existingQR) {
            await this.db.run(`
                UPDATE qr_codes SET qr_code = ?, qr_data = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?
            `, [qrCodeDataURL, JSON.stringify(qrData), existingQR.id]);
        } else {
            await this.db.run(`
                INSERT INTO qr_codes (project_id, qr_code, qr_data, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `, [questionnaire.project_id, qrCodeDataURL, JSON.stringify(qrData)]);
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

        const qrRecord = await this.db.get(`
            SELECT * FROM qr_codes WHERE project_id = ? AND qr_data LIKE ? ORDER BY created_at DESC LIMIT 1
        `, [questionnaire.project_id, `%questionnaire/${questionnaireId}%`]);

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

        await this.db.run(`
            UPDATE qr_codes SET scan_count = scan_count + 1, last_scanned = CURRENT_TIMESTAMP
            WHERE project_id = ? AND qr_data LIKE ?
        `, [questionnaire.project_id, `%questionnaire/${questionnaireId}%`]);

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
        const questionnaire = await this.db.get(`
            SELECT q.*, p.project_name
            FROM questionnaires q
            LEFT JOIN event_projects p ON q.project_id = p.id
            WHERE q.id = ? AND q.is_active = 1
        `, [questionnaireId]);

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
        const questions = await this.db.query(`
            SELECT id, question_text, question_type, is_required, options, display_order
            FROM questionnaire_questions
            WHERE questionnaire_id = ?
            ORDER BY display_order ASC, id ASC
        `, [questionnaireId]);

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

        const questionnaire = await this.db.get(`
            SELECT * FROM questionnaires WHERE id = ? AND is_active = 1
        `, [questionnaireId]);

        if (!questionnaire) {
            return { success: false, error: 'NOT_FOUND', message: '問卷不存在或已關閉' };
        }

        // 檢查是否允許多次提交
        if (!questionnaire.allow_multiple_submissions) {
            const existing = await this.db.get(`
                SELECT id FROM questionnaire_responses
                WHERE questionnaire_id = ? AND trace_id = ? AND is_completed = 1
            `, [questionnaireId, trace_id]);

            if (existing) {
                return { success: false, error: 'DUPLICATE', message: '您已經填寫過此問卷' };
            }
        }

        // 驗證必填題目
        const questions = await this.db.query(`
            SELECT id, question_text, question_type, is_required
            FROM questionnaire_questions WHERE questionnaire_id = ?
        `, [questionnaireId]);

        for (const question of questions) {
            if (question.is_required && (!responses[question.id] || responses[question.id] === '')) {
                return { success: false, error: 'VALIDATION', message: `請回答必填題目：${question.question_text}` };
            }
        }

        // 獲取關聯的 submission_id
        let submission_id = null;
        const submission = await this.db.get(`SELECT id FROM form_submissions WHERE trace_id = ?`, [trace_id]);
        if (submission) submission_id = submission.id;

        // 儲存回答
        const result = await this.db.run(`
            INSERT INTO questionnaire_responses (
                questionnaire_id, trace_id, submission_id, respondent_name,
                respondent_email, response_data, completion_time,
                ip_address, user_agent, is_completed, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            questionnaireId, trace_id, submission_id, respondent_name,
            respondent_email, JSON.stringify(responses), completion_time || null,
            reqInfo.ip, reqInfo.userAgent, 1, new Date().toISOString()
        ]);

        // 記錄互動
        await this.db.run(`
            INSERT INTO participant_interactions (
                trace_id, project_id, submission_id, interaction_type,
                interaction_target, interaction_data, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            trace_id, questionnaire.project_id, submission_id,
            'questionnaire_completed', `questionnaire_${questionnaireId}`,
            JSON.stringify({ questionnaire_title: questionnaire.title, response_count: Object.keys(responses).length }),
            reqInfo.ip, reqInfo.userAgent
        ]);

        this.log('submitResponse', { questionnaireId, trace_id, response_id: result.lastID });

        return {
            success: true,
            message: '問卷提交成功！感謝您的參與。',
            response_id: result.lastID
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

        await this.db.run(`
            INSERT INTO questionnaire_views (
                questionnaire_id, trace_id, ip_address, user_agent, referrer
            ) VALUES (?, ?, ?, ?, ?)
        `, [
            questionnaireId, traceId,
            reqInfo.ip, reqInfo.userAgent, reqInfo.referrer || null
        ]);

        return { success: true };
    }
}

// Singleton pattern
module.exports = new QuestionnaireService();
