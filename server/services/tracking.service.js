/**
 * Tracking Service - 參與者追蹤業務邏輯
 *
 * @description 處理參與者追蹤統計查詢（Admin 後台用）
 * @refactor 2026-01-28: 建立 Service 包裝 trackingRepository
 */
const BaseService = require('./base.service');
const { trackingRepository } = require('../repositories');

class TrackingService extends BaseService {
    constructor() {
        super('TrackingService');
    }

    /**
     * 取得參與者追蹤記錄（含權限過濾）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getParticipants({ userId, userRole, event, dateFrom, dateTo, limit = 50 }) {
        const participants = await trackingRepository.getParticipantsWithTracking({
            userId,
            userRole,
            event,
            dateFrom,
            dateTo,
            limit
        });

        return {
            participants,
            total: participants.length
        };
    }

    /**
     * 搜尋參與者
     * @param {Object} params - 搜尋參數
     * @returns {Promise<Object>}
     */
    async searchParticipants({ userId, userRole, search, limit = 50 }) {
        const participants = await trackingRepository.searchParticipants({
            userId,
            userRole,
            search,
            limit
        });

        return {
            participants,
            total: participants.length
        };
    }

    /**
     * 取得參與者詳情
     * @param {number} participantId - 參與者 ID
     * @param {Object} params - 權限參數
     * @returns {Promise<Object|null>}
     */
    async getParticipantDetails(participantId, { userId, userRole }) {
        const participant = await trackingRepository.getParticipantDetails(participantId, {
            userId,
            userRole
        });

        if (!participant) {
            return { found: false, data: null };
        }

        return { found: true, data: participant };
    }

    /**
     * 匯出參與者追蹤記錄
     * @param {Object} params - 查詢參數
     * @returns {Promise<Array>}
     */
    async exportParticipants({ userId, userRole, event, dateFrom, dateTo }) {
        return trackingRepository.exportParticipants({
            userId,
            userRole,
            event,
            dateFrom,
            dateTo
        });
    }

    /**
     * 取得追蹤統計
     * @param {Object} params - 權限參數
     * @returns {Promise<Object>}
     */
    async getStats({ userId, userRole }) {
        return trackingRepository.getStats({ userId, userRole });
    }
}

module.exports = new TrackingService();
