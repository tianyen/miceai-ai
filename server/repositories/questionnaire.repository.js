/**
 * Questionnaire Repository - 問卷資料存取
 *
 * 職責：
 * - 封裝 questionnaires 表的所有 SQL 查詢
 * - 封裝 questionnaire_responses 表的查詢
 * - 管理問卷記錄相關操作
 *
 * @extends BaseRepository
 */

const BaseRepository = require('./base.repository');

class QuestionnaireRepository extends BaseRepository {
    constructor() {
        super('questionnaires', 'id');
    }

    // ============================================================================
    // 統計查詢
    // ============================================================================

    /**
     * 取得概覽統計
     * @returns {Promise<Object>}
     */
    async getOverviewStats() {
        const [totalResponses, totalQuestionnaires] = await Promise.all([
            this.rawGet('SELECT COUNT(*) as count FROM questionnaire_responses'),
            this.rawGet('SELECT COUNT(*) as count FROM questionnaires')
        ]);

        return {
            totalResponses: totalResponses?.count || 0,
            totalQuestionnaires: totalQuestionnaires?.count || 0
        };
    }

    /**
     * 取得問卷回應統計
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object>}
     */
    async getResponseStats(questionnaireId) {
        const sql = `
            SELECT
                COUNT(*) as total_responses,
                MIN(submitted_at) as first_response,
                MAX(submitted_at) as last_response
            FROM questionnaire_responses
            WHERE questionnaire_id = ?
        `;
        return this.rawGet(sql, [questionnaireId]);
    }

    // ============================================================================
    // 問卷查詢
    // ============================================================================

    /**
     * 根據 ID 取得問卷
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object|null>}
     */
    async findById(questionnaireId) {
        return this.rawGet(
            'SELECT * FROM questionnaires WHERE id = ?',
            [questionnaireId]
        );
    }

    /**
     * 取得所有問卷
     * @returns {Promise<Array>}
     */
    async findAll() {
        return this.rawAll(
            'SELECT * FROM questionnaires ORDER BY created_at DESC'
        );
    }

    /**
     * 根據專案 ID 取得問卷
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async findByProjectId(projectId) {
        return this.rawAll(
            'SELECT * FROM questionnaires WHERE project_id = ? ORDER BY created_at DESC',
            [projectId]
        );
    }

    // ============================================================================
    // 回應查詢
    // ============================================================================

    /**
     * 取得問卷的所有回應
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Array>}
     */
    async getResponses(questionnaireId) {
        return this.rawAll(
            'SELECT * FROM questionnaire_responses WHERE questionnaire_id = ? ORDER BY submitted_at DESC',
            [questionnaireId]
        );
    }

    /**
     * 取得問卷回應數量
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<number>}
     */
    async countResponses(questionnaireId) {
        const result = await this.rawGet(
            'SELECT COUNT(*) as count FROM questionnaire_responses WHERE questionnaire_id = ?',
            [questionnaireId]
        );
        return result?.count || 0;
    }

    /**
     * 根據提交 ID 取得回應
     * @param {number} responseId - 回應 ID
     * @returns {Promise<Object|null>}
     */
    async getResponseById(responseId) {
        return this.rawGet(
            'SELECT * FROM questionnaire_responses WHERE id = ?',
            [responseId]
        );
    }

    /**
     * 創建問卷回應
     * @param {Object} data - 回應資料
     * @returns {Promise<Object>}
     */
    async createResponse({ questionnaireId, responseData, submittedAt }) {
        const sql = `
            INSERT INTO questionnaire_responses (questionnaire_id, response_data, submitted_at)
            VALUES (?, ?, ?)
        `;
        return this.rawRun(sql, [
            questionnaireId,
            JSON.stringify(responseData),
            submittedAt || new Date().toISOString()
        ]);
    }

    // ============================================================================
    // 匯出
    // ============================================================================

    /**
     * 取得問卷與所有回應（用於匯出）
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object>}
     */
    async getQuestionnaireWithResponses(questionnaireId) {
        const questionnaire = await this.findById(questionnaireId);
        if (!questionnaire) {
            return null;
        }

        const responses = await this.getResponses(questionnaireId);

        return {
            questionnaire,
            responses,
            responseCount: responses.length
        };
    }

    // ============================================================================
    // 管理後台 - 統計相關
    // ============================================================================

    /**
     * 取得問卷基本統計（含瀏覽數和回應數）
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object>}
     */
    async getBasicStats(questionnaireId) {
        const sql = `
            SELECT
                COUNT(DISTINCT qv.trace_id) as view_count,
                COUNT(DISTINCT qr.trace_id) as response_count,
                COUNT(DISTINCT CASE WHEN qr.is_completed = 1 THEN qr.trace_id END) as completed_count
            FROM questionnaire_views qv
            LEFT JOIN questionnaire_responses qr ON qv.questionnaire_id = qr.questionnaire_id
                AND qv.trace_id = qr.trace_id
            WHERE qv.questionnaire_id = ?
        `;
        return this.rawGet(sql, [questionnaireId]);
    }

    /**
     * 取得最近的問卷回應
     * @param {number} questionnaireId - 問卷 ID
     * @param {number} limit - 限制數量
     * @returns {Promise<Array>}
     */
    async getRecentResponses(questionnaireId, limit = 10) {
        const sql = `
            SELECT
                qr.response_data,
                qr.completed_at,
                qr.respondent_name,
                qr.respondent_email
            FROM questionnaire_responses qr
            WHERE qr.questionnaire_id = ? AND qr.is_completed = 1
            ORDER BY qr.completed_at DESC
            LIMIT ?
        `;
        return this.rawAll(sql, [questionnaireId, limit]);
    }

    /**
     * 取得問卷及其專案資訊
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object|null>}
     */
    async getQuestionnaireWithProject(questionnaireId) {
        const sql = `
            SELECT q.*, p.project_name
            FROM questionnaires q
            LEFT JOIN event_projects p ON q.project_id = p.id
            WHERE q.id = ?
        `;
        return this.rawGet(sql, [questionnaireId]);
    }

    // ============================================================================
    // 管理後台 - 列表與分頁
    // ============================================================================

    /**
     * 取得問卷列表（含統計與分頁）
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async getListWithStats({ userId, userRole, projectId, search, limit = 20, offset = 0 }) {
        let sql = `
            SELECT
                q.*,
                p.project_name,
                u.full_name as creator_name,
                COUNT(DISTINCT qq.id) as question_count,
                COUNT(DISTINCT CASE WHEN qr.is_completed = 1 THEN qr.id END) as response_count
            FROM questionnaires q
            LEFT JOIN event_projects p ON q.project_id = p.id
            LEFT JOIN users u ON q.created_by = u.id
            LEFT JOIN questionnaire_questions qq ON q.id = qq.questionnaire_id
            LEFT JOIN questionnaire_responses qr ON q.id = qr.questionnaire_id
            WHERE 1=1
        `;
        const params = [];

        // 權限過濾
        if (userRole !== 'super_admin') {
            sql += ` AND (p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            ))`;
            params.push(userId, userId);
        }

        // 專案過濾
        if (projectId) {
            sql += ` AND q.project_id = ?`;
            params.push(projectId);
        }

        // 搜索過濾
        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            sql += ` AND (q.title LIKE ? OR q.description LIKE ?)`;
            params.push(searchTerm, searchTerm);
        }

        sql += ` GROUP BY q.id ORDER BY q.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        return this.rawAll(sql, params);
    }

    /**
     * 取得問卷數量（含過濾條件）
     * @param {Object} options - 查詢選項
     * @returns {Promise<number>}
     */
    async getCountWithFilters({ userId, userRole, projectId, search }) {
        let sql = `
            SELECT COUNT(DISTINCT q.id) as count
            FROM questionnaires q
            LEFT JOIN event_projects p ON q.project_id = p.id
            WHERE 1=1
        `;
        const params = [];

        // 權限過濾
        if (userRole !== 'super_admin') {
            sql += ` AND (p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            ))`;
            params.push(userId, userId);
        }

        // 專案過濾
        if (projectId) {
            sql += ` AND q.project_id = ?`;
            params.push(projectId);
        }

        // 搜索過濾
        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            sql += ` AND (q.title LIKE ? OR q.description LIKE ?)`;
            params.push(searchTerm, searchTerm);
        }

        const result = await this.rawGet(sql, params);
        return result?.count || 0;
    }

    /**
     * 取得用戶可訪問的專案
     * @param {number} userId - 用戶 ID
     * @param {string} userRole - 用戶角色
     * @returns {Promise<Array>}
     */
    async getUserAccessibleProjects(userId, userRole) {
        if (userRole === 'super_admin') {
            return this.rawAll('SELECT id, project_name FROM event_projects ORDER BY project_name');
        }

        return this.rawAll(`
            SELECT DISTINCT p.id, p.project_name
            FROM event_projects p
            WHERE p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            )
            ORDER BY p.project_name
        `, [userId, userId]);
    }

    /**
     * 檢查用戶是否有專案權限
     * @param {number} userId - 用戶 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<boolean>}
     */
    async checkProjectPermission(userId, projectId) {
        const result = await this.rawGet(`
            SELECT 1 FROM event_projects p
            WHERE p.id = ? AND (p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            ))
        `, [projectId, userId, userId]);
        return !!result;
    }

    // ============================================================================
    // 問卷詳情相關
    // ============================================================================

    /**
     * 取得問卷詳情（含創建者和專案資訊）
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object|null>}
     */
    async getDetail(questionnaireId) {
        const sql = `
            SELECT q.*, u.full_name as creator_name, p.project_name
            FROM questionnaires q
            LEFT JOIN users u ON q.created_by = u.id
            LEFT JOIN event_projects p ON q.project_id = p.id
            WHERE q.id = ?
        `;
        return this.rawGet(sql, [questionnaireId]);
    }

    /**
     * 取得問卷問題
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Array>}
     */
    async getQuestions(questionnaireId) {
        return this.rawAll(
            'SELECT * FROM questionnaire_questions WHERE questionnaire_id = ? ORDER BY question_order',
            [questionnaireId]
        );
    }

    // ============================================================================
    // 問卷操作 (CRUD)
    // ============================================================================

    /**
     * 創建問卷
     * @param {Object} data - 問卷資料
     * @returns {Promise<Object>}
     */
    async createQuestionnaire(data) {
        const {
            project_id,
            title,
            description,
            instructions,
            is_active,
            created_by
        } = data;

        const sql = `
            INSERT INTO questionnaires (
                project_id, title, description, instructions,
                is_active, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        const result = await this.rawRun(sql, [
            project_id,
            title,
            description || null,
            instructions || null,
            is_active ? 1 : 0,
            created_by
        ]);

        return { id: result.lastID, title };
    }

    /**
     * 創建問卷問題
     * @param {Object} data - 問題資料
     * @returns {Promise<Object>}
     */
    async createQuestion(data) {
        const {
            questionnaire_id,
            question_text,
            question_type,
            options,
            is_required,
            question_order
        } = data;

        const sql = `
            INSERT INTO questionnaire_questions (
                questionnaire_id, question_text, question_type,
                options, is_required, question_order
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;

        return this.rawRun(sql, [
            questionnaire_id,
            question_text,
            question_type,
            options ? JSON.stringify(options) : null,
            is_required ? 1 : 0,
            question_order
        ]);
    }

    /**
     * 批量創建問題
     * @param {number} questionnaireId - 問卷 ID
     * @param {Array} questions - 問題陣列
     * @returns {Promise<void>}
     */
    async createQuestionsBulk(questionnaireId, questions) {
        for (let i = 0; i < questions.length; i++) {
            await this.createQuestion({
                questionnaire_id: questionnaireId,
                ...questions[i],
                question_order: i + 1
            });
        }
    }

    /**
     * 更新問卷
     * @param {number} questionnaireId - 問卷 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async updateQuestionnaire(questionnaireId, data) {
        const { title, description, instructions, is_active } = data;

        const sql = `
            UPDATE questionnaires
            SET title = ?, description = ?, instructions = ?,
                is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        return this.rawRun(sql, [
            title,
            description || null,
            instructions || null,
            is_active ? 1 : 0,
            questionnaireId
        ]);
    }

    /**
     * 刪除問卷問題
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object>}
     */
    async deleteQuestions(questionnaireId) {
        return this.rawRun(
            'DELETE FROM questionnaire_questions WHERE questionnaire_id = ?',
            [questionnaireId]
        );
    }

    /**
     * 刪除問卷回應
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object>}
     */
    async deleteResponses(questionnaireId) {
        return this.rawRun(
            'DELETE FROM questionnaire_responses WHERE questionnaire_id = ?',
            [questionnaireId]
        );
    }

    /**
     * 刪除問卷瀏覽記錄
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object>}
     */
    async deleteViews(questionnaireId) {
        return this.rawRun(
            'DELETE FROM questionnaire_views WHERE questionnaire_id = ?',
            [questionnaireId]
        );
    }

    /**
     * 徹底刪除問卷（ cascade delete）
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object>}
     */
    async deleteCascade(questionnaireId) {
        await this.deleteResponses(questionnaireId);
        await this.deleteViews(questionnaireId);
        await this.deleteQuestions(questionnaireId);
        return this.rawRun('DELETE FROM questionnaires WHERE id = ?', [questionnaireId]);
    }

    /**
     * 切換問卷狀態
     * @param {number} questionnaireId - 問卷 ID
     * @param {boolean} isActive - 是否啟用
     * @returns {Promise<Object>}
     */
    async toggleActive(questionnaireId, isActive) {
        return this.rawRun(
            'UPDATE questionnaires SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [isActive ? 1 : 0, questionnaireId]
        );
    }

    // ============================================================================
    // 問卷複製
    // ============================================================================

    /**
     * 複製問卷
     * @param {number} questionnaireId - 原始問卷 ID
     * @param {Object} data - 新問卷資料
     * @returns {Promise<Object>}
     */
    async duplicate(questionnaireId, { newTitle, projectId, createdBy }) {
        const original = await this.findById(questionnaireId);
        if (!original) {
            return { success: false, error: 'NOT_FOUND', message: '問卷不存在' };
        }

        // 創建新問卷
        const result = await this.createQuestionnaire({
            project_id: projectId || original.project_id,
            title: newTitle || `${original.title} (複製)`,
            description: original.description,
            instructions: original.instructions,
            is_active: 0,
            created_by: createdBy
        });

        // 複製問題
        const questions = await this.getQuestions(questionnaireId);
        if (questions.length > 0) {
            await this.createQuestionsBulk(result.id, questions.map(q => ({
                question_text: q.question_text,
                question_type: q.question_type,
                options: q.options,
                is_required: q.is_required
            })));
        }

        return { success: true, id: result.id, title: newTitle || `${original.title} (複製)` };
    }

    // ============================================================================
    // 公開問卷相關
    // ============================================================================

    /**
     * 取得公開問卷
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object|null>}
     */
    async getPublicQuestionnaire(questionnaireId) {
        return this.rawGet(
            'SELECT * FROM questionnaires WHERE id = ? AND is_active = 1',
            [questionnaireId]
        );
    }

    /**
     * 檢查是否允許重複提交
     * @param {number} questionnaireId - 問卷 ID
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object|null>}
     */
    async checkExistingSubmission(questionnaireId, traceId) {
        return this.rawGet(`
            SELECT id FROM questionnaire_responses
            WHERE questionnaire_id = ? AND trace_id = ? AND is_completed = 1
        `, [questionnaireId, traceId]);
    }

    // ============================================================================
    // 問卷回應提交
    // ============================================================================

    /**
     * 創建問卷回應
     * @param {Object} data - 回應資料
     * @returns {Promise<Object>}
     */
    async submitResponse(data) {
        const {
            questionnaire_id,
            trace_id,
            submission_id,
            respondent_name,
            respondent_email,
            response_data,
            is_completed
        } = data;

        const sql = `
            INSERT INTO questionnaire_responses (
                questionnaire_id, trace_id, submission_id,
                respondent_name, respondent_email, response_data,
                is_completed, submitted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        const result = await this.rawRun(sql, [
            questionnaire_id,
            trace_id,
            submission_id,
            respondent_name || null,
            respondent_email || null,
            JSON.stringify(response_data),
            is_completed ? 1 : 0
        ]);

        return { id: result.lastID };
    }

    /**
     * 記錄互動
     * @param {Object} data - 互動資料
     * @returns {Promise<Object>}
     */
    async logInteraction(data) {
        const {
            trace_id,
            project_id,
            submission_id,
            interaction_type,
            interaction_data
        } = data;

        return this.rawRun(`
            INSERT INTO participant_interactions (
                trace_id, project_id, submission_id, interaction_type,
                interaction_data, created_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [trace_id, project_id, submission_id, interaction_type, JSON.stringify(interaction_data)]);
    }

    // ============================================================================
    // 瀏覽追蹤
    // ============================================================================

    /**
     * 記錄問卷瀏覽
     * @param {Object} data - 瀏覽資料
     * @returns {Promise<Object>}
     */
    async logView(data) {
        const {
            questionnaire_id,
            trace_id,
            ip_address,
            user_agent,
            referrer
        } = data;

        return this.rawRun(`
            INSERT INTO questionnaire_views (
                questionnaire_id, trace_id, ip_address, user_agent, referrer, created_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [questionnaire_id, trace_id, ip_address, user_agent || null, referrer || null]);
    }

    // ============================================================================
    // QR Code 相關
    // ============================================================================

    /**
     * 取得專案的問卷 QR Code
     * @param {number} projectId - 專案 ID
     * @param {string} qrDataPattern - QR 資料 pattern
     * @returns {Promise<Object|null>}
     */
    async getQRCode(projectId, qrDataPattern) {
        return this.rawGet(`
            SELECT * FROM qr_codes WHERE project_id = ? AND qr_data LIKE ?
            ORDER BY created_at DESC LIMIT 1
        `, [projectId, qrDataPattern]);
    }

    /**
     * 更新 QR Code
     * @param {number} qrId - QR Code ID
     * @param {string} qrCode - QR Code 圖片
     * @param {string} qrData - QR 資料
     * @returns {Promise<Object>}
     */
    async updateQRCode(qrId, qrCode, qrData) {
        return this.rawRun(`
            UPDATE qr_codes SET qr_code = ?, qr_data = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?
        `, [qrCode, qrData, qrId]);
    }

    /**
     * 創建 QR Code
     * @param {Object} data - QR Code 資料
     * @returns {Promise<Object>}
     */
    async createQRCode(data) {
        const { project_id, qr_code, qr_data } = data;

        return this.rawRun(`
            INSERT INTO qr_codes (project_id, qr_code, qr_data, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [project_id, qr_code, qr_data]);
    }

    /**
     * 增加 QR Code 掃描次數
     * @param {number} projectId - 專案 ID
     * @param {string} qrDataPattern - QR 資料 pattern
     * @returns {Promise<Object>}
     */
    async incrementQRScanCount(projectId, qrDataPattern) {
        return this.rawRun(`
            UPDATE qr_codes SET scan_count = scan_count + 1, last_scanned = CURRENT_TIMESTAMP
            WHERE project_id = ? AND qr_data LIKE ?
        `, [projectId, qrDataPattern]);
    }

    // ============================================================================
    // 進階統計
    // ============================================================================

    /**
     * 取得問卷基本統計（含瀏覽和回應）
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object>}
     */
    async getBasicStats(questionnaireId) {
        return this.rawGet(`
            SELECT
                COUNT(DISTINCT qv.trace_id) as view_count,
                COUNT(DISTINCT qr.trace_id) as response_count,
                COUNT(DISTINCT CASE WHEN qr.is_completed = 1 THEN qr.trace_id END) as completed_count
            FROM questionnaire_views qv
            LEFT JOIN questionnaire_responses qr ON qv.questionnaire_id = qr.questionnaire_id
                AND qv.trace_id = qr.trace_id
            WHERE qv.questionnaire_id = ?
        `, [questionnaireId]);
    }

    // ============================================================================
    // 進階統計
    // ============================================================================

    /**
     * 取得詳細統計（30天每日統計）
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object>}
     */
    async getDetailedStats(questionnaireId) {
        const basicStats = await this.rawGet(`
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

        const dailyStats = await this.rawAll(`
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

        const hourlyStats = await this.rawAll(`
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

        return { basicStats, dailyStats, hourlyStats };
    }

    /**
     * 取得問題分析數據
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object>}
     */
    async getQuestionAnalysisData(questionnaireId) {
        const questions = await this.rawAll(`
            SELECT id, question_text, question_type, options
            FROM questionnaire_questions
            WHERE questionnaire_id = ?
            ORDER BY display_order ASC, id ASC
        `, [questionnaireId]);

        const responses = await this.rawAll(`
            SELECT response_data, completed_at, completion_time
            FROM questionnaire_responses
            WHERE questionnaire_id = ? AND is_completed = 1
        `, [questionnaireId]);

        return { questions, responses };
    }

    /**
     * 取得問卷問題列表（用於提交驗證）
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Array>}
     */
    async getQuestionsForValidation(questionnaireId) {
        return this.rawAll(`
            SELECT id, question_text, question_type, is_required
            FROM questionnaire_questions
            WHERE questionnaire_id = ?
        `, [questionnaireId]);
    }

    /**
     * 取得公開問卷（完整資訊）
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object|null>}
     */
    async getPublicQuestionnaireFull(questionnaireId) {
        return this.rawGet(`
            SELECT q.*, p.project_name
            FROM questionnaires q
            LEFT JOIN event_projects p ON q.project_id = p.id
            WHERE q.id = ? AND q.is_active = 1
        `, [questionnaireId]);
    }

    /**
     * 根據 trace_id 查找表單提交
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object|null>}
     */
    async findSubmissionByTraceId(traceId) {
        return this.rawGet(
            `SELECT id FROM form_submissions WHERE trace_id = ?`,
            [traceId]
        );
    }

    // ============================================================================
    // 跨表 Transaction 方法 (for 3-Tier Migration)
    // ============================================================================

    /**
     * 創建問卷（含問題）- 完整版本
     * @param {Object} data - 問卷資料
     * @returns {Promise<Object>} { id, lastID }
     */
    async createWithQuestions(data) {
        const {
            project_id,
            title,
            description,
            instructions,
            start_time,
            end_time,
            allow_multiple_submissions,
            is_active,
            created_by,
            questions
        } = data;

        // 創建問卷
        const sql = `
            INSERT INTO questionnaires (
                project_id, title, description, instructions,
                start_time, end_time, allow_multiple_submissions,
                is_active, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        const result = await this.rawRun(sql, [
            project_id,
            title,
            description || null,
            instructions || null,
            start_time || null,
            end_time || null,
            allow_multiple_submissions ? 1 : 0,
            is_active !== undefined ? (is_active ? 1 : 0) : 1,
            created_by
        ]);

        // 創建問題
        if (questions && questions.length > 0) {
            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                await this.rawRun(`
                    INSERT INTO questionnaire_questions (
                        questionnaire_id, question_text, question_type,
                        is_required, options, display_order
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    result.lastID,
                    question.question_text,
                    question.question_type,
                    question.is_required || 1,
                    question.options ? JSON.stringify(question.options) : null,
                    i + 1
                ]);
            }
        }

        return { id: result.lastID, lastID: result.lastID };
    }

    /**
     * 更新問卷（含問題替換）- 完整版本
     * @param {number} questionnaireId - 問卷 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async updateWithQuestions(questionnaireId, data) {
        const {
            title,
            description,
            instructions,
            is_active,
            start_time,
            end_time,
            allow_multiple_submissions,
            questions
        } = data;

        // 更新問卷基本信息
        await this.rawRun(`
            UPDATE questionnaires
            SET title = ?, description = ?, instructions = ?,
                is_active = ?, start_time = ?, end_time = ?,
                allow_multiple_submissions = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            title,
            description || null,
            instructions || null,
            is_active ? 1 : 0,
            start_time || null,
            end_time || null,
            allow_multiple_submissions ? 1 : 0,
            questionnaireId
        ]);

        // 更新問題（先刪除後重建）
        if (questions) {
            await this.deleteQuestions(questionnaireId);

            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                await this.rawRun(`
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

        return { changes: 1 };
    }

    /**
     * 徹底刪除問卷（含所有關聯數據）- 完整版本
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object>}
     */
    async deleteCascadeFull(questionnaireId) {
        await this.deleteResponses(questionnaireId);
        await this.deleteViews(questionnaireId);
        await this.deleteQuestions(questionnaireId);
        return this.rawRun('DELETE FROM questionnaires WHERE id = ?', [questionnaireId]);
    }

    /**
     * 複製問卷（含問題）- 完整版本
     * @param {number} questionnaireId - 原始問卷 ID
     * @param {Object} data - 新問卷資料
     * @returns {Promise<Object>}
     */
    async duplicateWithQuestions(questionnaireId, { newTitle, projectId, createdBy }) {
        const original = await this.findById(questionnaireId);
        if (!original) {
            return { success: false, error: 'NOT_FOUND', message: '問卷不存在' };
        }

        // 創建新問卷（使用完整字段）
        const sql = `
            INSERT INTO questionnaires (
                project_id, title, description, instructions,
                start_time, end_time, allow_multiple_submissions,
                is_active, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        const result = await this.rawRun(sql, [
            projectId || original.project_id,
            newTitle || `${original.title} (複製)`,
            original.description,
            original.instructions,
            original.start_time || null,
            original.end_time || null,
            original.allow_multiple_submissions ? 1 : 0,
            0, // 預設停用
            createdBy
        ]);

        // 複製問題
        const questions = await this.rawAll(`
            SELECT * FROM questionnaire_questions
            WHERE questionnaire_id = ?
            ORDER BY display_order ASC
        `, [questionnaireId]);

        for (const question of questions) {
            await this.rawRun(`
                INSERT INTO questionnaire_questions (
                    questionnaire_id, question_text, question_type,
                    is_required, options, display_order
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                result.lastID,
                question.question_text,
                question.question_type,
                question.is_required,
                question.options,
                question.display_order
            ]);
        }

        return { success: true, id: result.lastID, title: newTitle || `${original.title} (複製)` };
    }
}

// 單例模式
module.exports = new QuestionnaireRepository();
