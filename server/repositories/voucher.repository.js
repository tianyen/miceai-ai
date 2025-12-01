/**
 * Voucher Repository - 兌換券資料存取層
 *
 * @description 處理 vouchers, voucher_conditions, voucher_redemptions 相關資料庫操作
 */
const BaseRepository = require('./base.repository');

class VoucherRepository extends BaseRepository {
    constructor() {
        super('vouchers');
    }

    /**
     * 根據 ID 查詢兌換券
     * @param {number} voucherId - 兌換券 ID
     * @returns {Promise<Object|null>}
     */
    async findById(voucherId) {
        return this.db.get(
            'SELECT * FROM vouchers WHERE id = ?',
            [voucherId]
        );
    }

    /**
     * 查詢兌換券列表
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findAll(options = {}) {
        const { isActive, limit = 100 } = options;

        let query = `
            SELECT id, voucher_name, category, voucher_value, vendor,
                   remaining_quantity, total_quantity, is_active, created_at
            FROM vouchers
            WHERE 1=1
        `;
        const params = [];

        if (isActive !== undefined && isActive !== '') {
            query += ' AND is_active = ?';
            params.push(isActive);
        }

        query += ' ORDER BY voucher_name LIMIT ?';
        params.push(parseInt(limit));

        return this.db.query(query, params);
    }

    /**
     * 查詢可用兌換券（有庫存且啟用）
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findAvailable(options = {}) {
        const { category, limit = 50 } = options;

        let query = `
            SELECT * FROM vouchers
            WHERE is_active = 1 AND remaining_quantity > 0
        `;
        const params = [];

        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }

        query += ' ORDER BY voucher_value DESC LIMIT ?';
        params.push(limit);

        return this.db.query(query, params);
    }

    /**
     * 扣減庫存
     * @param {number} voucherId - 兌換券 ID
     * @returns {Promise<Object>}
     */
    async decrementStock(voucherId) {
        return this.db.run(`
            UPDATE vouchers
            SET remaining_quantity = remaining_quantity - 1
            WHERE id = ? AND remaining_quantity > 0
        `, [voucherId]);
    }

    /**
     * 查詢兌換記錄
     * @param {Object} filters - 過濾條件
     * @returns {Promise<Array>}
     */
    async findRedemptions(filters = {}) {
        const { voucherId, traceId, redeemed, limit = 100 } = filters;

        let query = `
            SELECT vr.*, v.voucher_name, v.category, v.voucher_value
            FROM voucher_redemptions vr
            JOIN vouchers v ON vr.voucher_id = v.id
            WHERE 1=1
        `;
        const params = [];

        if (voucherId) {
            query += ' AND vr.voucher_id = ?';
            params.push(voucherId);
        }
        if (traceId) {
            query += ' AND vr.trace_id = ?';
            params.push(traceId);
        }
        if (redeemed !== undefined) {
            query += ' AND vr.is_redeemed = ?';
            params.push(redeemed ? 1 : 0);
        }

        query += ' ORDER BY vr.created_at DESC LIMIT ?';
        params.push(limit);

        return this.db.query(query, params);
    }

    /**
     * 根據兌換碼查詢
     * @param {string} redemptionCode - 兌換碼
     * @returns {Promise<Object|null>}
     */
    async findByRedemptionCode(redemptionCode) {
        return this.db.get(`
            SELECT vr.*, v.voucher_name, v.category, v.voucher_value, v.vendor
            FROM voucher_redemptions vr
            JOIN vouchers v ON vr.voucher_id = v.id
            WHERE vr.redemption_code = ?
        `, [redemptionCode]);
    }

    /**
     * 建立兌換記錄
     * @param {Object} redemptionData - 兌換資料
     * @returns {Promise<Object>}
     */
    async createRedemption(redemptionData) {
        const {
            voucherId, traceId, userId, sessionId,
            redemptionCode, qrCodeBase64
        } = redemptionData;

        return this.db.run(`
            INSERT INTO voucher_redemptions (
                voucher_id, trace_id, user_id, session_id,
                redemption_code, qr_code_base64, is_redeemed, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
        `, [voucherId, traceId, userId, sessionId, redemptionCode, qrCodeBase64]);
    }

    /**
     * 標記已兌換
     * @param {string} redemptionCode - 兌換碼
     * @param {number} redeemedBy - 兌換者 ID
     * @returns {Promise<Object>}
     */
    async markRedeemed(redemptionCode, redeemedBy) {
        return this.db.run(`
            UPDATE voucher_redemptions
            SET is_redeemed = 1, redeemed_at = CURRENT_TIMESTAMP, redeemed_by = ?
            WHERE redemption_code = ? AND is_redeemed = 0
        `, [redeemedBy, redemptionCode]);
    }

    /**
     * 查詢兌換統計
     * @returns {Promise<Object>}
     */
    async getStats() {
        const stats = await this.db.get(`
            SELECT
                COUNT(*) as total_vouchers,
                SUM(total_quantity) as total_quantity,
                SUM(remaining_quantity) as remaining_quantity,
                SUM(total_quantity - remaining_quantity) as issued_quantity
            FROM vouchers
            WHERE is_active = 1
        `);

        const redemptionStats = await this.db.get(`
            SELECT
                COUNT(*) as total_issued,
                COUNT(CASE WHEN is_redeemed = 1 THEN 1 END) as total_redeemed
            FROM voucher_redemptions
        `);

        return {
            ...stats,
            ...redemptionStats
        };
    }
}

module.exports = new VoucherRepository();
