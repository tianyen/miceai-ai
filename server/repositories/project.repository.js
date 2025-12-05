/**
 * Project Repository - 專案資料存取
 *
 * 職責：
 * - 封裝 projects 表的所有 SQL 查詢
 * - 提供專案特定的查詢方法
 *
 * @extends BaseRepository
 */

const BaseRepository = require('./base.repository');

class ProjectRepository extends BaseRepository {
    constructor() {
        super('event_projects', 'id');
    }

    // ============================================================================
    // 專案特定查詢
    // ============================================================================

    /**
     * 依專案代碼查詢
     * @param {string} projectCode - 專案代碼
     * @returns {Promise<Object|null>}
     */
    async findByCode(projectCode) {
        return this.findOne({ project_code: projectCode });
    }

    /**
     * 取得進行中的專案
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findActive(options = {}) {
        return this.findBy({ status: 'active' }, options);
    }

    /**
     * 根據 ID 查詢活動中的專案（含報名相關資訊）
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findActiveById(projectId) {
        const sql = `
            SELECT id, project_name, project_code, event_date, event_location,
                   status, max_participants, registration_deadline,
                   contact_email, contact_phone
            FROM event_projects
            WHERE id = ? AND status = 'active'
        `;
        return this.rawGet(sql, [projectId]);
    }

    /**
     * 搜尋專案（名稱或代碼）
     * @param {string} searchTerm - 搜尋關鍵字
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async search(searchTerm, { status = null, limit = 50 } = {}) {
        let sql = `
            SELECT p.*, COUNT(fs.id) as submission_count
            FROM event_projects p
            LEFT JOIN form_submissions fs ON p.id = fs.project_id
            WHERE (p.project_name LIKE ? OR p.project_code LIKE ?)
        `;
        const params = [`%${searchTerm}%`, `%${searchTerm}%`];

        if (status) {
            sql += ' AND p.status = ?';
            params.push(status);
        }

        sql += ' GROUP BY p.id ORDER BY p.created_at DESC LIMIT ?';
        params.push(limit);

        return this.rawAll(sql, params);
    }

    /**
     * 取得專案統計資料
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async getStats(projectId) {
        const sql = `
            SELECT
                COUNT(DISTINCT s.id) as total_participants,
                COUNT(DISTINCT CASE WHEN s.checked_in_at IS NOT NULL THEN s.id END) as checked_in_count,
                COUNT(DISTINCT qr.id) as questionnaire_responses,
                ROUND(
                    CASE
                        WHEN COUNT(DISTINCT s.id) > 0 THEN
                            (COUNT(DISTINCT CASE WHEN s.checked_in_at IS NOT NULL THEN s.id END) * 100.0) / COUNT(DISTINCT s.id)
                        ELSE 0
                    END
                ) as checkin_rate,
                COALESCE(SUM(s.children_count), 0) as total_children
            FROM form_submissions s
            LEFT JOIN questionnaire_responses qr ON s.trace_id = qr.trace_id
            WHERE s.project_id = ?
        `;
        const result = await this.rawGet(sql, [projectId]);
        return result || {
            total_participants: 0,
            checked_in_count: 0,
            questionnaire_responses: 0,
            checkin_rate: 0,
            total_children: 0
        };
    }

    /**
     * 取得專案參與者列表（含簽到狀態）
     * @param {number} projectId - 專案 ID
     * @param {number} limit - 筆數限制
     * @returns {Promise<Array>}
     */
    async getParticipants(projectId, limit = 100) {
        const sql = `
            SELECT
                fs.id,
                fs.user_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.trace_id,
                fs.participation_level,
                fs.checked_in_at,
                fs.status,
                fs.created_at
            FROM form_submissions fs
            WHERE fs.project_id = ?
            ORDER BY fs.created_at DESC
            LIMIT ?
        `;
        return this.rawAll(sql, [projectId, limit]);
    }

    /**
     * 取得專案問卷列表（含回應數）
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async getQuestionnaires(projectId) {
        const sql = `
            SELECT
                q.id,
                q.title,
                q.is_active,
                q.created_at,
                COUNT(qr.id) as response_count
            FROM questionnaires q
            LEFT JOIN questionnaire_responses qr ON q.id = qr.questionnaire_id
            WHERE q.project_id = ?
            GROUP BY q.id
            ORDER BY q.created_at DESC
        `;
        return this.rawAll(sql, [projectId]);
    }

    /**
     * 取得分頁資料（含統計）
     * @param {number} page - 頁碼
     * @param {number} limit - 每頁筆數
     * @returns {Promise<Object>}
     */
    async paginateWithStats(page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        const sql = `
            SELECT p.*, COUNT(fs.id) as submission_count
            FROM event_projects p
            LEFT JOIN form_submissions fs ON p.id = fs.project_id
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const data = await this.rawAll(sql, [limit, offset]);
        const total = await this.count();
        const pages = Math.ceil(total / limit);

        return {
            data,
            pagination: {
                total,
                currentPage: page,
                pages,
                limit,
                hasPrev: page > 1,
                hasNext: page < pages
            }
        };
    }

    /**
     * 搜尋專案內的參加者
     * @param {number} projectId - 專案 ID
     * @param {string} searchTerm - 搜尋關鍵字
     * @returns {Promise<Object|null>}
     */
    async searchParticipantTracking(projectId, searchTerm) {
        const sql = `
            SELECT * FROM form_submissions
            WHERE project_id = ? AND (
                submitter_name LIKE ? OR
                trace_id LIKE ? OR
                submitter_email LIKE ?
            )
            LIMIT 1
        `;
        const term = `%${searchTerm}%`;
        return this.rawGet(sql, [projectId, term, term, term]);
    }

    /**
     * 取得參與者互動記錄
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Array>}
     */
    async getParticipantInteractions(traceId) {
        const sql = `
            SELECT * FROM participant_interactions
            WHERE trace_id = ?
            ORDER BY timestamp DESC
        `;
        return this.rawAll(sql, [traceId]);
    }

    // ============================================================================
    // 專案詳情與創建者
    // ============================================================================

    /**
     * 取得專案詳情（含創建者與模板）
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async getProjectWithCreator(projectId) {
        const sql = `
            SELECT p.*, u.full_name as creator_name, t.template_name, t.id as template_id
            FROM event_projects p
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN invitation_templates t ON p.template_id = t.id
            WHERE p.id = ?
        `;
        return this.rawGet(sql, [projectId]);
    }

    /**
     * 取得專案報名連結統計
     * @param {number} projectId - 專案 ID
     * @param {number} userId - 用戶 ID
     * @param {string} userRole - 用戶角色
     * @returns {Promise<Object|null>}
     */
    async getProjectForRegistration(projectId, userId, userRole) {
        const sql = `
            SELECT id, project_name, project_code, status, description, event_date, event_location
            FROM event_projects
            WHERE id = ? AND (created_by = ? OR ? = 'super_admin')
        `;
        return this.rawGet(sql, [projectId, userId, userRole]);
    }

    /**
     * 取得專案報名統計
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async getRegistrationStats(projectId) {
        const sql = `
            SELECT
                COUNT(*) as total_submissions,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_submissions,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_submissions,
                COUNT(CASE WHEN checked_in_at IS NOT NULL THEN 1 END) as checked_in_count
            FROM form_submissions WHERE project_id = ?
        `;
        const result = await this.rawGet(sql, [projectId]);
        return result || { total_submissions: 0, pending_submissions: 0, approved_submissions: 0, checked_in_count: 0 };
    }

    // ============================================================================
    // 遊戲綁定相關
    // ============================================================================

    /**
     * 取得專案綁定的遊戲列表
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async getProjectGames(projectId) {
        const sql = `
            SELECT DISTINCT
                g.id as game_id,
                g.game_name_zh,
                g.game_name_en,
                g.is_active,
                bg.id as binding_id,
                bg.voucher_id,
                v.voucher_name,
                v.remaining_quantity,
                v.total_quantity,
                b.booth_name,
                b.id as booth_id
            FROM booth_games bg
            INNER JOIN games g ON bg.game_id = g.id
            INNER JOIN booths b ON bg.booth_id = b.id
            LEFT JOIN vouchers v ON bg.voucher_id = v.id
            WHERE b.project_id = ?
            ORDER BY g.game_name_zh
        `;
        return this.rawAll(sql, [projectId]);
    }

    /**
     * 取得遊戲綁定資訊
     * @param {number} bindingId - 綁定 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async getGameBinding(bindingId, projectId) {
        const sql = `
            SELECT
                bg.*,
                g.game_name_zh,
                g.game_name_en,
                v.voucher_name,
                b.booth_name
            FROM booth_games bg
            INNER JOIN games g ON bg.game_id = g.id
            INNER JOIN booths b ON bg.booth_id = b.id
            LEFT JOIN vouchers v ON bg.voucher_id = v.id
            WHERE bg.id = ? AND b.project_id = ?
        `;
        return this.rawGet(sql, [bindingId, projectId]);
    }

    /**
     * 檢查綁定是否存在
     * @param {number} bindingId - 綁定 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async checkGameBindingExists(bindingId, projectId) {
        const sql = `
            SELECT bg.*
            FROM booth_games bg
            INNER JOIN booths b ON bg.booth_id = b.id
            WHERE bg.id = ? AND b.project_id = ?
        `;
        return this.rawGet(sql, [bindingId, projectId]);
    }

    /**
     * 更新遊戲綁定
     * @param {number} bindingId - 綁定 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<void>}
     */
    async updateGameBinding(bindingId, { voucher_id }) {
        const sql = `
            UPDATE booth_games
            SET voucher_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return this.rawRun(sql, [voucher_id || null, bindingId]);
    }

    /**
     * 刪除遊戲綁定
     * @param {number} bindingId - 綁定 ID
     * @returns {Promise<void>}
     */
    async deleteGameBinding(bindingId) {
        return this.rawRun('DELETE FROM booth_games WHERE id = ?', [bindingId]);
    }

    // ============================================================================
    // 下拉選單
    // ============================================================================

    /**
     * 取得所有專案（用於下拉選單）
     * @returns {Promise<Array>}
     */
    async getAllForDropdown() {
        const sql = `
            SELECT id, project_name
            FROM event_projects
            ORDER BY project_name
        `;
        return this.rawAll(sql);
    }

    /**
     * 取得活躍專案列表（用於切換下拉選單）
     * @returns {Promise<Array>}
     */
    async getActiveProjects() {
        const sql = `
            SELECT id, project_name, project_code
            FROM event_projects
            WHERE status = 'active'
            ORDER BY created_at DESC
        `;
        return this.rawAll(sql);
    }

    // ============================================================================
    // 模板相關
    // ============================================================================

    /**
     * 取得可用模板
     * @returns {Promise<Array>}
     */
    async getActiveTemplates() {
        const sql = `
            SELECT id, template_name, category
            FROM invitation_templates
            WHERE status = 'active'
            ORDER BY category, template_name
        `;
        return this.rawAll(sql);
    }
}

// 單例模式
module.exports = new ProjectRepository();
