/**
 * WishTree Service - 許願樹互動業務邏輯
 *
 * @description 處理許願樹：提交、統計、查詢
 * @refactor 2025-12-01: 從 v1/wish-tree.js 提取業務邏輯
 */
const BaseService = require('./base.service');
const { getGMT8Timestamp } = require('../utils/timezone');

class WishTreeService extends BaseService {
    constructor() {
        super('WishTreeService');
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
        const result = await this.db.run(`
            INSERT INTO wish_tree_interactions (
                project_id, booth_id, wish_text, image_base64,
                ip_address, user_agent, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [project_id, booth_id || null, wish_text, image_base64 || null, ipAddress, userAgent, created_at]);

        // 獲取創建時間
        const record = await this.db.get(
            'SELECT created_at FROM wish_tree_interactions WHERE id = ?',
            [result.lastID]
        );

        this.log('submitWish', { wishId: result.lastID, projectId: project_id });

        return {
            id: result.lastID,
            created_at: record.created_at
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

        // 構建 WHERE 條件
        let whereConditions = ['project_id = ?'];
        let params = [project_id];

        if (booth_id) {
            whereConditions.push('booth_id = ?');
            params.push(booth_id);
        }

        if (start_date) {
            whereConditions.push('DATE(created_at) >= ?');
            params.push(start_date);
        }

        if (end_date) {
            whereConditions.push('DATE(created_at) <= ?');
            params.push(end_date);
        }

        const whereClause = whereConditions.join(' AND ');

        // 1. 總許願數
        const totalResult = await this.db.get(
            `SELECT COUNT(*) as total FROM wish_tree_interactions WHERE ${whereClause}`,
            params
        );

        // 2. 每小時分佈
        const hourlyDistribution = await this.db.query(
            `SELECT
                strftime('%H:00', created_at) as hour,
                COUNT(*) as count
             FROM wish_tree_interactions
             WHERE ${whereClause}
             GROUP BY strftime('%H', created_at)
             ORDER BY hour`,
            params
        );

        // 3. 每日分佈
        const dailyDistribution = await this.db.query(
            `SELECT
                DATE(created_at) as date,
                COUNT(*) as count
             FROM wish_tree_interactions
             WHERE ${whereClause}
             GROUP BY DATE(created_at)
             ORDER BY date`,
            params
        );

        // 4. 高峰時段（前5名）
        const peakHours = await this.db.query(
            `SELECT
                strftime('%H:00', created_at) as hour,
                COUNT(*) as count
             FROM wish_tree_interactions
             WHERE ${whereClause}
             GROUP BY strftime('%H', created_at)
             ORDER BY count DESC
             LIMIT 5`,
            params
        );

        return {
            total_wishes: totalResult.total,
            hourly_distribution: hourlyDistribution,
            daily_distribution: dailyDistribution,
            peak_hours: peakHours
        };
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

        // 限制數量
        const limitNum = Math.min(parseInt(limit) || 20, 100);

        // 查詢最近的記錄（不含圖片）
        return this.db.query(
            `SELECT id, wish_text, created_at, ip_address
             FROM wish_tree_interactions
             WHERE project_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [projectId, limitNum]
        );
    }

    /**
     * 根據 ID 獲取許願記錄（含圖片）
     * @param {number} wishId - 許願 ID
     * @returns {Promise<Object>}
     */
    async getWishById(wishId) {
        const wish = await this.db.get(
            `SELECT id, wish_text, image_base64, created_at, ip_address
             FROM wish_tree_interactions
             WHERE id = ?`,
            [wishId]
        );

        if (!wish) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '找不到該許願記錄'
            });
        }

        return wish;
    }
}

module.exports = new WishTreeService();
