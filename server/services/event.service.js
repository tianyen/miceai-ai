/**
 * Event Service - V1 API 活動管理業務邏輯
 *
 * @description 處理前端活動查詢：列表、詳情、模板解析
 * @refactor 2025-12-01: 從 v1/events.js 提取業務邏輯
 */
const BaseService = require('./base.service');
const projectRepository = require('../repositories/project.repository');

class EventService extends BaseService {
    constructor() {
        super('EventService');
        this.projectRepo = projectRepository;
    }

    /**
     * 獲取活動列表（含分頁和篩選）
     * @param {Object} params - 查詢參數
     * @param {number} params.page - 頁碼
     * @param {number} params.limit - 每頁筆數
     * @param {string} params.status - 狀態篩選
     * @param {string} params.type - 類型篩選
     * @returns {Promise<Object>} 活動列表和分頁資訊
     */
    async getEventList({ page = 1, limit = 20, status, type } = {}) {
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
        const countResult = await this.db.get(countQuery, params);
        const total = countResult.total;

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

        const events = await this.db.query(eventsQuery, [...params, limit, offset]);

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
     * 根據活動代碼獲取活動詳情
     * @param {string} code - 活動代碼
     * @returns {Promise<Object>}
     */
    async getEventByCode(code) {
        const event = await this._getEventData('code', code);

        if (!event) {
            this.throwError(this.ErrorCodes.PROJECT_NOT_FOUND, {
                message: '活動不存在'
            });
        }

        return this._formatEventResponse(event);
    }

    /**
     * 根據活動 ID 獲取活動詳情
     * @param {number} id - 活動 ID
     * @returns {Promise<Object>}
     */
    async getEventById(id) {
        const event = await this._getEventData('id', id);

        if (!event) {
            this.throwError(this.ErrorCodes.PROJECT_NOT_FOUND, {
                message: '活動不存在'
            });
        }

        return this._formatEventResponse(event);
    }

    /**
     * 內部方法：獲取活動數據
     * @private
     */
    async _getEventData(field, value) {
        const whereClause = field === 'code' ? 'p.project_code = ?' : 'p.id = ?';

        return this.db.get(`
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
        `, [value]);
    }

    /**
     * 內部方法：獲取活動模板
     * @private
     */
    async _getEventTemplate(templateId) {
        if (!templateId) return null;

        try {
            const template = await this.db.get(`
                SELECT
                    id,
                    template_name,
                    template_type,
                    template_content,
                    special_guests
                FROM invitation_templates
                WHERE id = ? AND template_type = 'event'
            `, [templateId]);

            if (!template) return null;

            // 解析 JSON 欄位
            return {
                id: template.id,
                name: template.template_name,
                ...this._safeJsonParse(template.template_content, null),
                special_guests: this._safeJsonParse(template.special_guests, [])
            };
        } catch (error) {
            this.logError('_getEventTemplate', error);
            return null;
        }
    }

    /**
     * 內部方法：安全解析 JSON
     * @private
     */
    _safeJsonParse(jsonString, defaultValue) {
        if (!jsonString) return defaultValue;
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            return defaultValue;
        }
    }

    /**
     * 內部方法：格式化活動回應
     * @private
     */
    async _formatEventResponse(event) {
        // 獲取模板
        const template = await this._getEventTemplate(event.template_id);

        // 解析 event_highlights
        const highlights = this._safeJsonParse(event.event_highlights, null);

        return {
            id: event.id,
            name: event.name,
            code: event.code,
            description: event.description,
            date: event.date,
            event_start_date: event.event_start_date,
            event_end_date: event.event_end_date,
            event_highlights: highlights,
            location: event.location,
            type: event.type,
            status: event.status,
            max_participants: event.max_participants,
            current_participants: event.current_participants,
            registration_deadline: event.registration_deadline,
            agenda: event.agenda,
            created_at: event.created_at,
            updated_at: event.updated_at,
            contact_info: {
                email: event.contact_email,
                phone: event.contact_phone
            },
            template
        };
    }
}

module.exports = new EventService();
