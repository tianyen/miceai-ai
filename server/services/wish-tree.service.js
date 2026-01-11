/**
 * WishTree Service - 許願樹互動業務邏輯
 *
 * @description 處理許願樹：提交、統計、查詢
 * @refactor 2025-12-01: 從 v1/wish-tree.js 提取業務邏輯
 * @refactor 2026-01-08: 遷移至 Repository Pattern
 */
const BaseService = require('./base.service');
const { getGMT8Timestamp } = require('../utils/timezone');
const wishTreeRepository = require('../repositories/wish-tree.repository');

class WishTreeService extends BaseService {
    constructor() {
        super('WishTreeService');
        this.repository = wishTreeRepository;
    }

    /**
     * 提交許願
     * @param {Object} data - 許願資料
     * @param {Object} clientInfo - 客戶端資訊
     * @returns {Promise<Object>}
     */
    async submitWish(data, clientInfo = {}) {
        const { project_id, booth_id, wish_text, image_base64 } = data;
        const { ipAddress, userAgent } = clientInfo;

        // 驗證必填欄位
        if (!project_id || !wish_text) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '缺少必填欄位: project_id, wish_text'
            });
        }

        // 驗證文字長度
        if (wish_text.length > 500) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '許願文字不得超過 500 字'
            });
        }

        // 生成 GMT+8 時間戳
        const created_at = getGMT8Timestamp();

        // 插入資料
        const result = await this.repository.createWish({
            project_id,
            booth_id,
            wish_text,
            image_base64,
            ip_address: ipAddress,
            user_agent: userAgent,
            created_at
        });

        this.log('submitWish', { wishId: result.lastID, projectId: project_id });

        return {
            id: result.lastID,
            created_at
        };
    }

    /**
     * 獲取統計數據
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getStats({ project_id, booth_id, start_date, end_date }) {
        if (!project_id) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '缺少必填欄位: project_id'
            });
        }

        const stats = await this.repository.getStats({
            project_id,
            booth_id,
            start_date,
            end_date
        });

        this.log('getStats', { project_id, booth_id, start_date, end_date });

        return stats;
    }

    /**
     * 獲取最近的許願記錄
     * @param {number} projectId - 專案 ID
     * @param {number} limit - 數量限制
     * @returns {Promise<Array>}
     */
    async getRecentWishes(projectId, limit = 20) {
        if (!projectId) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '缺少必填欄位: project_id'
            });
        }

        const wishes = await this.repository.findRecentWishes(projectId, limit);

        this.log('getRecentWishes', { projectId, count: wishes.length });

        return wishes;
    }

    /**
     * 根據 ID 獲取許願記錄（含圖片）
     * @param {number} wishId - 許願 ID
     * @returns {Promise<Object>}
     */
    async getWishById(wishId) {
        const wish = await this.repository.findByIdWithImage(wishId);

        if (!wish) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '找不到該許願記錄'
            });
        }

        return wish;
    }
}

module.exports = new WishTreeService();
