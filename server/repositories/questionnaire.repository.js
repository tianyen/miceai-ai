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
}

// 單例模式
module.exports = new QuestionnaireRepository();
