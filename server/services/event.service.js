/**
 * Event Service - V1 API 活動管理業務邏輯
 *
 * @description 處理前端活動查詢：列表、詳情、模板解析
 * @refactor 2025-12-01: 從 v1/events.js 提取業務邏輯
 * @refactor 2026-01-08: 遷移至 Repository Pattern
 */
const BaseService = require('./base.service');
const eventRepository = require('../repositories/event.repository');

class EventService extends BaseService {
    constructor() {
        super('EventService');
        this.repository = eventRepository;
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
        const result = await this.repository.getEventListWithPagination({
            page,
            limit,
            status,
            type
        });

        this.log('getEventList', { page, limit, status, type, total: result.pagination.total });

        return result;
    }

    /**
     * 根據活動代碼獲取活動詳情
     * @param {string} code - 活動代碼
     * @returns {Promise<Object>}
     */
    async getEventByCode(code) {
        const event = await this.repository.findByCodeWithParticipants(code);

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
        const event = await this.repository.findByIdWithParticipants(id);

        if (!event) {
            this.throwError(this.ErrorCodes.PROJECT_NOT_FOUND, {
                message: '活動不存在'
            });
        }

        return this._formatEventResponse(event);
    }

    /**
     * 內部方法：獲取活動模板
     * @private
     */
    async _getEventTemplate(templateId) {
        if (!templateId) return null;

        try {
            const template = await this.repository.getEventTemplate(templateId);

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

        // 計算剩餘名額
        const remainingSlots = event.max_participants > 0
            ? Math.max(0, event.max_participants - event.current_participants)
            : null; // null 表示無限制

        // 判斷是否開放報名
        const registrationOpen = this._checkRegistrationOpen(event, remainingSlots);

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
            remaining_slots: remainingSlots,
            registration_open: registrationOpen,
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

    /**
     * 內部方法：檢查是否開放報名
     * @private
     */
    _checkRegistrationOpen(event, remainingSlots) {
        // 1. 活動狀態必須是 active
        if (event.status !== 'active') {
            return false;
        }

        // 2. 檢查報名截止時間
        if (event.registration_deadline) {
            const deadline = new Date(event.registration_deadline);
            if (new Date() > deadline) {
                return false;
            }
        }

        // 3. 檢查名額（若有設定上限）
        if (event.max_participants > 0 && remainingSlots <= 0) {
            return false;
        }

        return true;
    }
}

module.exports = new EventService();
