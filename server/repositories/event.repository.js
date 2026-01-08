/**
 * Event Repository - 活動/項目資料存取層
 *
 * @description Repository Pattern - Data Access Layer for event_projects
 * @see @refactor/ARCHITECTURE.md
 */

const BaseRepository = require('./base.repository');

class EventRepository extends BaseRepository {
    constructor() {
        super('event_projects', 'id');
    }

    // ============================================================================
    // 查詢方法
    // ============================================================================

    /**
     * 取得活動列表（含分頁、篩選和參與人數）
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getEventListWithPagination({ page = 1, limit = 20, status, type } = {}) {
        const offset = (page - 1) * limit;

        // 構建查詢條件
        let whereClause = 'WHERE 1=1';
        let params = [];

        if (status) {
            whereClause += ' AND p.status = ?';
            params.push(status);
        }

        if (type) {
            whereClause += ' AND p.event_type = ?';
            params.push(type);
        }

        // 獲取總數
        const countQuery = `
            SELECT COUNT(*) as total
            FROM event_projects p
            ${whereClause}
        `;
        const countResult = await this.rawGet(countQuery, params);
        const total = countResult?.total || 0;

        // 獲取活動列表
        const eventsQuery = `
            SELECT
                p.id,
                p.project_name as name,
                p.project_code as code,
                p.description,
                p.event_date as date,
                p.event_location as location,
                p.event_type as type,
                p.status,
                p.max_participants,
                p.registration_deadline,
                p.contact_email,
                p.contact_phone,
                p.created_at,
                COUNT(fs.id) as current_participants
            FROM event_projects p
            LEFT JOIN form_submissions fs ON p.id = fs.project_id
                AND fs.status IN ('pending', 'approved', 'confirmed')
            ${whereClause}
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const events = await this.rawAll(eventsQuery, [...params, limit, offset]);

        return {
            events,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * 依 ID 或 Code 取得活動數據
     * @param {string} field - 欄位名稱 ('id' 或 'code')
     * @param {*} value - 值
     * @returns {Promise<Object|null>}
     */
    async getEventData(field, value) {
        const whereClause = field === 'code' ? 'p.project_code = ?' : 'p.id = ?';

        const sql = `
            SELECT
                p.id,
                p.project_name as name,
                p.project_code as code,
                p.description,
                p.event_date as date,
                p.event_start_date,
                p.event_end_date,
                p.event_highlights,
                p.event_location as location,
                p.event_type as type,
                p.status,
                p.max_participants,
                p.registration_deadline,
                p.contact_email,
                p.contact_phone,
                p.agenda,
                p.template_id,
                p.created_at,
                p.updated_at,
                COUNT(fs.id) as current_participants
            FROM event_projects p
            LEFT JOIN form_submissions fs ON p.id = fs.project_id
                AND fs.status IN ('pending', 'approved', 'confirmed')
            WHERE ${whereClause}
            GROUP BY p.id
        `;

        return this.rawGet(sql, [value]);
    }

    /**
     * 依 ID 取得活動
     * @param {number} id - 活動 ID
     * @returns {Promise<Object|null>}
     */
    async findByIdWithParticipants(id) {
        return this.getEventData('id', id);
    }

    /**
     * 依 Code 取得活動
     * @param {string} code - 活動代碼
     * @returns {Promise<Object|null>}
     */
    async findByCodeWithParticipants(code) {
        return this.getEventData('code', code);
    }

    /**
     * 依狀態取得活動列表
     * @param {string} status - 狀態
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findByStatus(status, { limit = 100, offset = 0 } = {}) {
        const sql = `
            SELECT * FROM event_projects
            WHERE status = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;
        return this.rawAll(sql, [status, limit, offset]);
    }

    /**
     * 依類型取得活動列表
     * @param {string} eventType - 活動類型
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findByEventType(eventType, { limit = 100, offset = 0 } = {}) {
        const sql = `
            SELECT * FROM event_projects
            WHERE event_type = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;
        return this.rawAll(sql, [eventType, limit, offset]);
    }

    /**
     * 搜尋活動
     * @param {string} searchTerm - 搜尋關鍵字
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async search(searchTerm, { limit = 50 } = {}) {
        const sql = `
            SELECT * FROM event_projects
            WHERE project_name LIKE ? OR description LIKE ? OR project_code LIKE ?
            ORDER BY created_at DESC
            LIMIT ?
        `;
        const term = `%${searchTerm}%`;
        return this.rawAll(sql, [term, term, term, limit]);
    }

    // ============================================================================
    // 統計方法
    // ============================================================================

    /**
     * 依狀態統計活動數量
     * @returns {Promise<Array>}
     */
    async countByStatus() {
        const sql = `
            SELECT status, COUNT(*) as count
            FROM event_projects
            GROUP BY status
        `;
        return this.rawAll(sql);
    }

    /**
     * 依類型統計活動數量
     * @returns {Promise<Array>}
     */
    async countByType() {
        const sql = `
            SELECT event_type, COUNT(*) as count
            FROM event_projects
            GROUP BY event_type
        `;
        return this.rawAll(sql);
    }

    /**
     * 取得活動統計
     * @returns {Promise<Object>}
     */
    async getStats() {
        const sql = `
            SELECT
                COUNT(*) as total_projects,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_projects,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_projects
            FROM event_projects
        `;
        return this.rawGet(sql);
    }

    // ============================================================================
    // 參與者相關方法
    // ============================================================================

    /**
     * 取得活動的參與人數
     * @param {number} projectId - 項目 ID
     * @returns {Promise<number>}
     */
    async countParticipants(projectId) {
        const result = await this.rawGet(`
            SELECT COUNT(*) as count
            FROM form_submissions
            WHERE project_id = ? AND status IN ('pending', 'approved', 'confirmed')
        `, [projectId]);
        return result?.count || 0;
    }

    /**
     * 檢查是否還有名額
     * @param {number} projectId - 項目 ID
     * @param {number} maxParticipants - 最大參與人數
     * @returns {Promise<boolean>}
     */
    async hasAvailableSlots(projectId, maxParticipants) {
        if (maxParticipants <= 0) return true; // 無限制

        const count = await this.countParticipants(projectId);
        return count < maxParticipants;
    }

    // ============================================================================
    // 模板相關方法
    // ============================================================================

    /**
     * 取得活動模板
     * @param {number} templateId - 模板 ID
     * @returns {Promise<Object|null>}
     */
    async getEventTemplate(templateId) {
        if (!templateId) return null;

        return this.rawGet(`
            SELECT
                id,
                template_name,
                template_type,
                template_content,
                special_guests
            FROM invitation_templates
            WHERE id = ? AND template_type = 'event'
        `, [templateId]);
    }
}

module.exports = new EventRepository();
