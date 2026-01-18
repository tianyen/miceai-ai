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

    // ============================================================================
    // 統計查詢（帶專案過濾）
    // ============================================================================

    /**
     * 取得兌換總覽統計（帶專案過濾）
     * @param {number|null} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async getRedemptionSummary(projectId) {
        if (projectId) {
            return this.db.get(`
                SELECT
                    COUNT(*) as total_redemptions,
                    SUM(CASE WHEN vr.is_used = 1 THEN 1 ELSE 0 END) as used_redemptions,
                    COUNT(DISTINCT vr.trace_id) as unique_users,
                    ROUND(CAST(SUM(CASE WHEN vr.is_used = 1 THEN 1 ELSE 0 END) AS FLOAT) /
                          NULLIF(COUNT(*), 0) * 100, 1) as usage_rate
                FROM voucher_redemptions vr
                INNER JOIN game_sessions gs ON vr.session_id = gs.id
                WHERE gs.project_id = ?
            `, [projectId]);
        }
        return this.db.get(`
            SELECT
                COUNT(*) as total_redemptions,
                SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used_redemptions,
                COUNT(DISTINCT trace_id) as unique_users,
                ROUND(CAST(SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) AS FLOAT) /
                      NULLIF(COUNT(*), 0) * 100, 1) as usage_rate
            FROM voucher_redemptions
        `);
    }

    /**
     * 取得各兌換券發放統計（帶專案過濾）
     * @param {number|null} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async getVoucherStatsByProject(projectId) {
        if (projectId) {
            return this.db.query(`
                SELECT
                    v.voucher_name,
                    v.category,
                    v.voucher_value,
                    COUNT(*) as redemption_count,
                    SUM(CASE WHEN vr.is_used = 1 THEN 1 ELSE 0 END) as used_count
                FROM voucher_redemptions vr
                JOIN vouchers v ON vr.voucher_id = v.id
                INNER JOIN game_sessions gs ON vr.session_id = gs.id
                WHERE gs.project_id = ?
                GROUP BY vr.voucher_id
                ORDER BY redemption_count DESC
            `, [projectId]);
        }
        return this.db.query(`
            SELECT
                v.voucher_name,
                v.category,
                v.voucher_value,
                COUNT(*) as redemption_count,
                SUM(CASE WHEN vr.is_used = 1 THEN 1 ELSE 0 END) as used_count
            FROM voucher_redemptions vr
            JOIN vouchers v ON vr.voucher_id = v.id
            GROUP BY vr.voucher_id
            ORDER BY redemption_count DESC
        `);
    }

    /**
     * 取得每日兌換趨勢（最近 30 天，帶專案過濾）
     * @param {number|null} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async getDailyRedemptionTrend(projectId) {
        if (projectId) {
            return this.db.query(`
                SELECT
                    DATE(vr.redeemed_at) as date,
                    COUNT(*) as redemption_count,
                    SUM(CASE WHEN vr.is_used = 1 THEN 1 ELSE 0 END) as used_count
                FROM voucher_redemptions vr
                INNER JOIN game_sessions gs ON vr.session_id = gs.id
                WHERE vr.redeemed_at >= DATE('now', '-30 days') AND gs.project_id = ?
                GROUP BY DATE(vr.redeemed_at)
                ORDER BY date ASC
            `, [projectId]);
        }
        return this.db.query(`
            SELECT
                DATE(redeemed_at) as date,
                COUNT(*) as redemption_count,
                SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used_count
            FROM voucher_redemptions
            WHERE redeemed_at >= DATE('now', '-30 days')
            GROUP BY DATE(redeemed_at)
            ORDER BY date ASC
        `);
    }

    /**
     * 取得熱門兌換券排行榜 TOP 10（帶專案過濾）
     * @param {number|null} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async getTopVouchers(projectId) {
        if (projectId) {
            return this.db.query(`
                SELECT
                    v.voucher_name,
                    v.category,
                    v.voucher_value,
                    COUNT(*) as redemption_count,
                    SUM(CASE WHEN vr.is_used = 1 THEN 1 ELSE 0 END) as used_count
                FROM voucher_redemptions vr
                JOIN vouchers v ON vr.voucher_id = v.id
                INNER JOIN game_sessions gs ON vr.session_id = gs.id
                WHERE gs.project_id = ?
                GROUP BY vr.voucher_id
                ORDER BY redemption_count DESC
                LIMIT 10
            `, [projectId]);
        }
        return this.db.query(`
            SELECT
                v.voucher_name,
                v.category,
                v.voucher_value,
                COUNT(*) as redemption_count,
                SUM(CASE WHEN vr.is_used = 1 THEN 1 ELSE 0 END) as used_count
            FROM voucher_redemptions vr
            JOIN vouchers v ON vr.voucher_id = v.id
            GROUP BY vr.voucher_id
            ORDER BY redemption_count DESC
            LIMIT 10
        `);
    }

    /**
     * 取得庫存統計
     * @returns {Promise<Object>}
     */
    async getInventoryStats() {
        const stats = await this.db.get(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive
            FROM vouchers
        `);
        return {
            total: stats.total || 0,
            active: stats.active || 0,
            inactive: stats.inactive || 0
        };
    }

    // ============================================================================
    // 兌換券 CRUD
    // ============================================================================

    /**
     * 帶條件查詢兌換券列表（含分頁）
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async findVouchersWithFilter({ page = 1, limit = 20, search = '', category = '', is_active = '' } = {}) {
        const offset = (page - 1) * limit;

        let query = `
            SELECT
                v.*,
                (v.total_quantity - v.remaining_quantity) as redeemed_count,
                vc.min_score,
                vc.min_play_time
            FROM vouchers v
            LEFT JOIN voucher_conditions vc ON v.id = vc.voucher_id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND v.voucher_name LIKE ?`;
            params.push(`%${search}%`);
        }
        if (category) {
            query += ` AND v.category = ?`;
            params.push(category);
        }
        if (is_active !== '') {
            query += ` AND v.is_active = ?`;
            params.push(is_active);
        }

        query += ` ORDER BY v.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const vouchers = await this.db.query(query, params);

        // 獲取總數
        let countQuery = `SELECT COUNT(*) as total FROM vouchers WHERE 1=1`;
        const countParams = [];

        if (search) {
            countQuery += ` AND voucher_name LIKE ?`;
            countParams.push(`%${search}%`);
        }
        if (category) {
            countQuery += ` AND category = ?`;
            countParams.push(category);
        }
        if (is_active !== '') {
            countQuery += ` AND is_active = ?`;
            countParams.push(is_active);
        }

        const { total } = await this.db.get(countQuery, countParams);

        return {
            vouchers,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(total / limit),
                total_items: total,
                items_per_page: parseInt(limit)
            }
        };
    }

    /**
     * 帶條件查詢單個兌換券
     * @param {number} voucherId - 兌換券 ID
     * @returns {Promise<Object|null>}
     */
    async findVoucherByIdWithConditions(voucherId) {
        return this.db.get(`
            SELECT
                v.*,
                vc.min_score,
                vc.min_play_time
            FROM vouchers v
            LEFT JOIN voucher_conditions vc ON v.id = vc.voucher_id
            WHERE v.id = ?
        `, [voucherId]);
    }

    /**
     * 創建兌換券
     * @param {Object} data - 兌換券資料
     * @returns {Promise<Object>}
     */
    async createVoucher({ voucher_name, vendor_name, sponsor_name, category, voucher_value, total_quantity, description, is_active = 1, created_by }) {
        return this.db.run(
            `INSERT INTO vouchers (
                voucher_name, vendor_name, sponsor_name, category, voucher_value,
                total_quantity, remaining_quantity, description, is_active, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                voucher_name,
                vendor_name || null,
                sponsor_name || null,
                category || null,
                voucher_value || null,
                total_quantity,
                total_quantity,
                description || null,
                is_active ? 1 : 0,
                created_by
            ]
        );
    }

    /**
     * 更新兌換券
     * @param {number} voucherId - 兌換券 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async updateVoucher(voucherId, data) {
        const updates = [];
        const params = [];

        if (data.voucher_name !== undefined) {
            updates.push('voucher_name = ?');
            params.push(data.voucher_name);
        }
        if (data.vendor_name !== undefined) {
            updates.push('vendor_name = ?');
            params.push(data.vendor_name);
        }
        if (data.sponsor_name !== undefined) {
            updates.push('sponsor_name = ?');
            params.push(data.sponsor_name);
        }
        if (data.category !== undefined) {
            updates.push('category = ?');
            params.push(data.category);
        }
        if (data.voucher_value !== undefined) {
            updates.push('voucher_value = ?');
            params.push(data.voucher_value);
        }
        if (data.total_quantity !== undefined) {
            updates.push('total_quantity = ?');
            params.push(data.total_quantity);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (data.is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(data.is_active ? 1 : 0);
        }
        if (data.remaining_quantity !== undefined) {
            updates.push('remaining_quantity = ?');
            params.push(data.remaining_quantity);
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(voucherId);

            return this.db.run(
                `UPDATE vouchers SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }
        return { changes: 0 };
    }

    /**
     * 軟刪除兌換券
     * @param {number} voucherId - 兌換券 ID
     * @returns {Promise<Object>}
     */
    async softDeleteVoucher(voucherId) {
        return this.db.run(
            'UPDATE vouchers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [voucherId]
        );
    }

    // ============================================================================
    // 掃描和兌換
    // ============================================================================

    /**
     * 根據兌換碼或 trace_id 查詢兌換記錄
     * @param {string|null} code - 兌換碼
     * @param {string|null} traceId - 追蹤 ID
     * @returns {Promise<Object|null>}
     */
    async findRedemptionByCodeOrTrace(code, traceId) {
        if (code) {
            return this.db.get(`
                SELECT
                    vr.*,
                    v.voucher_name,
                    v.vendor_name,
                    v.category,
                    v.voucher_value
                FROM voucher_redemptions vr
                JOIN vouchers v ON vr.voucher_id = v.id
                WHERE vr.redemption_code = ?
            `, [code]);
        }
        if (traceId) {
            return this.db.get(`
                SELECT
                    vr.*,
                    v.voucher_name,
                    v.vendor_name,
                    v.category,
                    v.voucher_value
                FROM voucher_redemptions vr
                JOIN vouchers v ON vr.voucher_id = v.id
                WHERE vr.trace_id = ?
                ORDER BY vr.redeemed_at DESC
                LIMIT 1
            `, [traceId]);
        }
        return null;
    }

    /**
     * 標記兌換記錄為已使用
     * @param {number} redemptionId - 兌換記錄 ID
     * @returns {Promise<Object>}
     */
    async markRedemptionUsed(redemptionId) {
        return this.db.run(
            'UPDATE voucher_redemptions SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?',
            [redemptionId]
        );
    }

    /**
     * 標記兌換記錄為已使用（按兌換碼）
     * @param {string} redemptionCode - 兌換碼
     * @returns {Promise<Object>}
     */
    async markRedemptionUsedByCode(redemptionCode) {
        return this.db.run(`
            UPDATE voucher_redemptions
            SET is_used = 1, used_at = CURRENT_TIMESTAMP
            WHERE redemption_code = ? AND is_used = 0
        `, [redemptionCode]);
    }

    /**
     * 取得兌換記錄列表（帶兌換券信息）
     * @param {number} limit - 限制筆數
     * @returns {Promise<Array>}
     */
    async getRedemptionsWithVouchers(limit = 100) {
        return this.db.query(`
            SELECT
                vr.*,
                v.voucher_name,
                v.vendor_name,
                v.category,
                v.voucher_value
            FROM voucher_redemptions vr
            JOIN vouchers v ON vr.voucher_id = v.id
            ORDER BY vr.redeemed_at DESC
            LIMIT ?
        `, [limit]);
    }

    /**
     * 根據 trace_id 查詢最後兌換記錄
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object|null>}
     */
    async findLastRedemptionByTraceId(traceId) {
        return this.db.get(`
            SELECT vr.*, v.voucher_name, v.category, v.voucher_value, v.vendor_name
            FROM voucher_redemptions vr
            JOIN vouchers v ON vr.voucher_id = v.id
            WHERE vr.trace_id = ?
            ORDER BY vr.redeemed_at DESC
            LIMIT 1
        `, [traceId]);
    }

    /**
     * 根據 trace_id 查詢所有兌換記錄 (含 QR Code)
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Array>}
     */
    async findAllRedemptionsByTraceId(traceId) {
        return this.db.query(`
            SELECT
                vr.id,
                vr.redemption_code,
                vr.is_used,
                vr.redeemed_at,
                vr.used_at,
                vr.qr_code_base64,
                v.id AS voucher_id,
                v.voucher_name,
                v.voucher_value,
                v.vendor_name,
                v.category
            FROM voucher_redemptions vr
            JOIN vouchers v ON vr.voucher_id = v.id
            WHERE vr.trace_id = ?
            ORDER BY vr.redeemed_at DESC
        `, [traceId]);
    }
}

module.exports = new VoucherRepository();
