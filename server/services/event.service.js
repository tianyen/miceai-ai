/**
 * Event Service - V1 API 活動管理業務邏輯
 *
 * @description 處理前端活動查詢：列表、詳情、模板解析
 * @refactor 2025-12-01: 從 v1/events.js 提取業務邏輯
 * @refactor 2026-01-08: 遷移至 Repository Pattern
 */
const BaseService = require('./base.service');
const eventRepository = require('../repositories/event.repository');
const {
    normalizeFormConfig,
    buildFrontendFields,
    buildPayloadExample
} = require('../utils/registration-config');

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

        // 合併活動報名欄位設定
        const formConfig = normalizeFormConfig(event.form_config);

        // 解析 event_highlights
        const highlights = this._safeJsonParse(event.event_highlights, null);

        // 計算剩餘名額
        const remainingSlots = event.max_participants > 0
            ? Math.max(0, event.max_participants - event.current_participants)
            : null; // null 表示無限制

        // 判斷是否開放報名
        const registrationOpen = this._checkRegistrationOpen(event, remainingSlots);

        // 前端動態渲染欄位用設定
        const registrationConfig = {
            version: 1,
            submit_endpoint: `/api/v1/events/${event.id}/registrations`,
            required_fields: formConfig.required_fields,
            optional_fields: formConfig.optional_fields,
            field_labels: formConfig.field_labels,
            fields: buildFrontendFields(formConfig),
            payload_example: buildPayloadExample(formConfig),
            feature_toggles: formConfig.feature_toggles
        };

        const commonData = await this._buildCommonData(event, formConfig.feature_toggles);

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
            template,
            registration_config: registrationConfig,
            common_data: commonData
        };
    }

    /**
     * 內部方法：根據 feature_toggles 輸出活動共用資料
     * @private
     */
    async _buildCommonData(event, toggles = {}) {
        const showBooths = !!toggles.show_booth_info;
        const showVouchers = !!toggles.show_voucher_info;
        const showVendors = !!toggles.show_vendor_info;
        const showInventory = !!toggles.show_inventory_info;

        const needBoothData = showBooths;
        const needVoucherData = showVouchers || showVendors || showInventory;

        const [booths, bindings] = await Promise.all([
            needBoothData ? this.repository.findBoothsByProject(event.id) : Promise.resolve([]),
            needVoucherData ? this.repository.findVoucherBindingsByProject(event.id) : Promise.resolve([])
        ]);

        const vouchers = [];
        const voucherById = new Map();
        const vendorMap = new Map();

        for (const row of bindings) {
            if (!row.voucher_id) continue;

            if (!voucherById.has(row.voucher_id)) {
                const voucherItem = {
                    id: row.voucher_id,
                    name: row.voucher_name,
                    category: row.category,
                    value: row.voucher_value,
                    booth_bindings: []
                };

                if (showInventory) {
                    voucherItem.inventory = {
                        total_quantity: row.total_quantity,
                        remaining_quantity: row.remaining_quantity
                    };
                }

                voucherById.set(row.voucher_id, voucherItem);
                vouchers.push(voucherItem);
            }

            voucherById.get(row.voucher_id).booth_bindings.push({
                booth_id: row.booth_id,
                booth_name: row.booth_name,
                booth_code: row.booth_code,
                game_id: row.game_id,
                min_score: row.min_score,
                min_play_time: row.min_play_time
            });

            const vendorName = row.vendor_name || '';
            const sponsorName = row.sponsor_name || '';

            if (showVendors && vendorName && !vendorMap.has(`vendor:${vendorName}`)) {
                vendorMap.set(`vendor:${vendorName}`, {
                    type: 'vendor',
                    name: vendorName
                });
            }

            if (showVendors && sponsorName && !vendorMap.has(`sponsor:${sponsorName}`)) {
                vendorMap.set(`sponsor:${sponsorName}`, {
                    type: 'sponsor',
                    name: sponsorName
                });
            }
        }

        return {
            event_info: toggles.show_event_info
                ? {
                    id: event.id,
                    name: event.name,
                    code: event.code,
                    date: event.date,
                    start_date: event.event_start_date,
                    end_date: event.event_end_date,
                    location: event.location
                }
                : null,
            booths: showBooths
                ? booths.map(booth => ({
                    id: booth.id,
                    name: booth.booth_name,
                    code: booth.booth_code,
                    location: booth.location,
                    description: booth.description,
                    is_active: !!booth.is_active
                }))
                : [],
            vouchers: showVouchers || showInventory ? vouchers : [],
            vendors: showVendors ? Array.from(vendorMap.values()) : []
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
