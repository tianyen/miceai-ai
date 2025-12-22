/**
 * Voucher Service - 兌換券業務邏輯層
 *
 * @description 處理兌換券相關業務：CRUD、發放、兌換、統計
 * @refactor 2025-12-01: 擴展 Admin API 支援
 */
const BaseService = require('./base.service');

class VoucherService extends BaseService {
    constructor() {
        super('VoucherService');
    }

    // ==================== Admin API 方法 ====================

    /**
     * 獲取統計數據
     * @param {Object} options - 選項 (date, project_id)
     * @returns {Promise<Object>}
     */
    async getStats(options = {}) {
        const { project_id } = options;

        // 構建專案過濾條件（透過 game_sessions 關聯）
        const projectJoin = project_id
            ? 'INNER JOIN game_sessions gs ON vr.session_id = gs.id'
            : '';
        const projectWhere = project_id ? 'WHERE gs.project_id = ?' : '';
        const projectWhereAnd = project_id ? 'AND gs.project_id = ?' : '';
        const projectParams = project_id ? [project_id] : [];

        // 1. 總覽統計
        const summaryQuery = project_id
            ? `SELECT
                COUNT(*) as total_redemptions,
                SUM(CASE WHEN vr.is_used = 1 THEN 1 ELSE 0 END) as used_redemptions,
                COUNT(DISTINCT vr.trace_id) as unique_users,
                ROUND(CAST(SUM(CASE WHEN vr.is_used = 1 THEN 1 ELSE 0 END) AS FLOAT) /
                      NULLIF(COUNT(*), 0) * 100, 1) as usage_rate
               FROM voucher_redemptions vr
               ${projectJoin}
               ${projectWhere}`
            : `SELECT
                COUNT(*) as total_redemptions,
                SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used_redemptions,
                COUNT(DISTINCT trace_id) as unique_users,
                ROUND(CAST(SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) AS FLOAT) /
                      NULLIF(COUNT(*), 0) * 100, 1) as usage_rate
               FROM voucher_redemptions`;

        const summary = await this.db.get(summaryQuery, projectParams);

        // 2. 各兌換券發放統計
        const voucherStatsQuery = project_id
            ? `SELECT
                v.voucher_name,
                v.category,
                v.voucher_value,
                COUNT(*) as redemption_count,
                SUM(CASE WHEN vr.is_used = 1 THEN 1 ELSE 0 END) as used_count
               FROM voucher_redemptions vr
               JOIN vouchers v ON vr.voucher_id = v.id
               ${projectJoin}
               ${projectWhere}
               GROUP BY vr.voucher_id
               ORDER BY redemption_count DESC`
            : `SELECT
                v.voucher_name,
                v.category,
                v.voucher_value,
                COUNT(*) as redemption_count,
                SUM(CASE WHEN vr.is_used = 1 THEN 1 ELSE 0 END) as used_count
               FROM voucher_redemptions vr
               JOIN vouchers v ON vr.voucher_id = v.id
               GROUP BY vr.voucher_id
               ORDER BY redemption_count DESC`;

        const voucherStats = await this.db.query(voucherStatsQuery, projectParams);

        // 3. 每日兌換趨勢（最近 30 天）
        const dailyTrendQuery = project_id
            ? `SELECT
                DATE(vr.redeemed_at) as date,
                COUNT(*) as redemption_count,
                SUM(CASE WHEN vr.is_used = 1 THEN 1 ELSE 0 END) as used_count
               FROM voucher_redemptions vr
               ${projectJoin}
               WHERE vr.redeemed_at >= DATE('now', '-30 days') ${projectWhereAnd}
               GROUP BY DATE(vr.redeemed_at)
               ORDER BY date ASC`
            : `SELECT
                DATE(redeemed_at) as date,
                COUNT(*) as redemption_count,
                SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used_count
               FROM voucher_redemptions
               WHERE redeemed_at >= DATE('now', '-30 days')
               GROUP BY DATE(redeemed_at)
               ORDER BY date ASC`;

        const dailyTrend = await this.db.query(dailyTrendQuery, projectParams);

        // 4. 熱門兌換券排行榜 TOP 10
        const topVouchersQuery = project_id
            ? `SELECT
                v.voucher_name,
                v.category,
                v.voucher_value,
                COUNT(*) as redemption_count,
                SUM(CASE WHEN vr.is_used = 1 THEN 1 ELSE 0 END) as used_count
               FROM voucher_redemptions vr
               JOIN vouchers v ON vr.voucher_id = v.id
               ${projectJoin}
               ${projectWhere}
               GROUP BY vr.voucher_id
               ORDER BY redemption_count DESC
               LIMIT 10`
            : `SELECT
                v.voucher_name,
                v.category,
                v.voucher_value,
                COUNT(*) as redemption_count,
                SUM(CASE WHEN vr.is_used = 1 THEN 1 ELSE 0 END) as used_count
               FROM voucher_redemptions vr
               JOIN vouchers v ON vr.voucher_id = v.id
               GROUP BY vr.voucher_id
               ORDER BY redemption_count DESC
               LIMIT 10`;

        const topVouchers = await this.db.query(topVouchersQuery, projectParams);

        this.log('getStats', { date: options.date, project_id });

        return {
            summary: summary || { total_redemptions: 0, used_redemptions: 0, unique_users: 0, usage_rate: 0 },
            voucher_stats: voucherStats || [],
            daily_trend: dailyTrend || [],
            top_vouchers: topVouchers || []
        };
    }

    /**
     * 獲取兌換券庫存統計（總數/啟用/停用）
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

        this.log('getInventoryStats', stats);

        return {
            total: stats.total || 0,
            active: stats.active || 0,
            inactive: stats.inactive || 0
        };
    }

    /**
     * 獲取兌換券列表（含分頁）
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getList({ page = 1, limit = 20, search = '', category = '', is_active = '' } = {}) {
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

        this.log('getList', { page, limit, search, category, is_active, total, count: vouchers.length });

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
     * 根據 ID 獲取兌換券
     * @param {number} voucherId - 兌換券 ID
     * @returns {Promise<Object>}
     */
    async getById(voucherId) {
        const voucher = await this.db.get(`
            SELECT
                v.*,
                vc.min_score,
                vc.min_play_time
            FROM vouchers v
            LEFT JOIN voucher_conditions vc ON v.id = vc.voucher_id
            WHERE v.id = ?
        `, [voucherId]);

        if (!voucher) {
            this.throwError(this.ErrorCodes.VOUCHER_NOT_FOUND);
        }

        // 計算已兌換數量
        voucher.redeemed_count = voucher.total_quantity - voucher.remaining_quantity;

        this.log('getById', { voucher_id: voucherId });

        return voucher;
    }

    /**
     * 創建兌換券
     * @param {Object} data - 兌換券資料
     * @returns {Promise<Object>}
     */
    async create(data) {
        const {
            voucher_name,
            vendor_name,
            sponsor_name,
            category,
            voucher_value,
            total_quantity,
            description,
            is_active = 1
        } = data;

        if (!voucher_name) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '兌換券名稱為必填'
            });
        }

        const result = await this.db.run(
            `INSERT INTO vouchers (
                voucher_name, vendor_name, sponsor_name, category, voucher_value,
                total_quantity, remaining_quantity, description, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                voucher_name,
                vendor_name || null,
                sponsor_name || null,
                category || null,
                voucher_value || null,
                total_quantity,
                total_quantity, // remaining_quantity 初始等於 total_quantity
                description || null,
                is_active ? 1 : 0
            ]
        );

        const voucher = await this.db.get('SELECT * FROM vouchers WHERE id = ?', [result.lastID]);

        this.log('create', { voucher_id: result.lastID, voucher_name, total_quantity });

        return { voucher };
    }

    /**
     * 更新兌換券
     * @param {number} voucherId - 兌換券 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async update(voucherId, data) {
        const voucher = await this.db.get('SELECT * FROM vouchers WHERE id = ?', [voucherId]);

        if (!voucher) {
            this.throwError(this.ErrorCodes.VOUCHER_NOT_FOUND);
        }

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
            // 同時更新 remaining_quantity
            const diff = data.total_quantity - voucher.total_quantity;
            updates.push('remaining_quantity = remaining_quantity + ?');
            params.push(diff);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (data.is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(data.is_active ? 1 : 0);
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(voucherId);

            await this.db.run(
                `UPDATE vouchers SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }

        const updatedVoucher = await this.db.get('SELECT * FROM vouchers WHERE id = ?', [voucherId]);

        this.log('update', { voucher_id: voucherId, updates: Object.keys(data) });

        return { voucher: updatedVoucher };
    }

    /**
     * 刪除兌換券（軟刪除）
     * @param {number} voucherId - 兌換券 ID
     * @returns {Promise<Object>}
     */
    async delete(voucherId) {
        const voucher = await this.db.get('SELECT * FROM vouchers WHERE id = ?', [voucherId]);

        if (!voucher) {
            this.throwError(this.ErrorCodes.VOUCHER_NOT_FOUND);
        }

        // 軟刪除：設置 is_active = 0
        await this.db.run(
            'UPDATE vouchers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [voucherId]
        );

        this.log('delete', { voucher_id: voucherId, voucher_name: voucher.voucher_name });

        return { deleted: true };
    }

    // ==================== 掃描和兌換 ====================

    /**
     * 掃描兌換券
     * @param {Object} scanData - 掃描資料
     * @returns {Promise<Object>}
     */
    async scanVoucher({ code, redemption_code, trace_id }) {
        // 確定要查詢的兌換碼或 trace_id
        const searchCode = code || redemption_code;

        if (!searchCode && !trace_id) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '請提供兌換碼或 trace_id'
            });
        }

        // 查詢兌換記錄
        let redemption;
        if (searchCode) {
            redemption = await this.db.get(`
                SELECT
                    vr.*,
                    v.voucher_name,
                    v.vendor_name,
                    v.category,
                    v.voucher_value
                FROM voucher_redemptions vr
                JOIN vouchers v ON vr.voucher_id = v.id
                WHERE vr.redemption_code = ?
            `, [searchCode]);
        } else if (trace_id) {
            redemption = await this.db.get(`
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
            `, [trace_id]);
        }

        if (!redemption) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '找不到對應的兌換記錄'
            });
        }

        if (redemption.is_used) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '此兌換券已經使用過了'
            });
        }

        // 標記為已使用
        await this.db.run(
            'UPDATE voucher_redemptions SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?',
            [redemption.id]
        );

        this.log('scanVoucher', {
            redemption_id: redemption.id,
            redemption_code: redemption.redemption_code,
            trace_id: redemption.trace_id,
            voucher_name: redemption.voucher_name
        });

        return {
            redemption_code: redemption.redemption_code,
            trace_id: redemption.trace_id,
            voucher_name: redemption.voucher_name,
            voucher_vendor: redemption.vendor_name,
            voucher_category: redemption.category,
            voucher_value: redemption.voucher_value,
            redeemed_at: redemption.redeemed_at,
            used_at: new Date().toISOString()
        };
    }

    /**
     * 獲取兌換記錄列表
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async getRedemptions(options = {}) {
        const { limit = 100 } = options;

        const redemptions = await this.db.query(`
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

        this.log('getRedemptions', { count: redemptions.length });

        return redemptions;
    }

    /**
     * 標記兌換記錄為已使用
     * @param {number} redemptionId - 兌換記錄 ID
     * @returns {Promise<Object>}
     */
    async markRedemptionUsed(redemptionId) {
        const redemption = await this.db.get(
            'SELECT * FROM voucher_redemptions WHERE id = ?',
            [redemptionId]
        );

        if (!redemption) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '兌換記錄不存在'
            });
        }

        if (redemption.is_used) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '此兌換券已經使用過了'
            });
        }

        await this.db.run(
            'UPDATE voucher_redemptions SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?',
            [redemptionId]
        );

        this.log('markRedemptionUsed', {
            redemption_id: redemptionId,
            redemption_code: redemption.redemption_code,
            trace_id: redemption.trace_id
        });

        return { marked: true };
    }

    // ==================== 遊戲相關（原有方法） ====================

    /**
     * 根據 ID 查詢兌換券（內部使用）
     * @param {number} voucherId - 兌換券 ID
     * @returns {Promise<Object>}
     */
    async getVoucherById(voucherId) {
        const voucher = await this.db.get(
            'SELECT * FROM vouchers WHERE id = ?',
            [voucherId]
        );

        if (!voucher) {
            this.throwError(this.ErrorCodes.VOUCHER_NOT_FOUND);
        }

        return voucher;
    }

    /**
     * 查詢可用兌換券
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async getAvailableVouchers(options = {}) {
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
     * 發放兌換券
     * @param {Object} issueData - 發放資料
     * @returns {Promise<Object>}
     */
    async issueVoucher(issueData) {
        const {
            voucherId, traceId, userId, sessionId,
            redemptionCode, qrCodeBase64
        } = issueData;

        // 驗證兌換券存在且有庫存
        const voucher = await this.getVoucherById(voucherId);

        if (voucher.remaining_quantity <= 0) {
            this.throwError(this.ErrorCodes.VOUCHER_OUT_OF_STOCK);
        }

        // 扣減庫存
        const updateResult = await this.db.run(`
            UPDATE vouchers
            SET remaining_quantity = remaining_quantity - 1
            WHERE id = ? AND remaining_quantity > 0
        `, [voucherId]);

        if (updateResult.changes === 0) {
            this.throwError(this.ErrorCodes.VOUCHER_OUT_OF_STOCK);
        }

        // 建立兌換記錄
        const result = await this.db.run(`
            INSERT INTO voucher_redemptions (
                voucher_id, trace_id, user_id, session_id,
                redemption_code, qr_code_base64, is_used, redeemed_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
        `, [voucherId, traceId, userId, sessionId, redemptionCode, qrCodeBase64]);

        this.log('issueVoucher', {
            redemptionId: result.lastID,
            voucherId,
            traceId,
            redemptionCode
        });

        return {
            redemptionId: result.lastID,
            voucher: {
                id: voucher.id,
                name: voucher.voucher_name,
                value: voucher.voucher_value,
                vendor: voucher.vendor_name,
                category: voucher.category
            },
            redemptionCode,
            qrCodeBase64
        };
    }

    /**
     * 兌換（核銷）兌換券
     * @param {string} redemptionCode - 兌換碼
     * @param {number} redeemedBy - 兌換者 ID
     * @returns {Promise<Object>}
     */
    async redeemVoucher(redemptionCode, redeemedBy) {
        // 查詢兌換記錄
        const redemption = await this.db.get(`
            SELECT vr.*, v.voucher_name, v.category, v.voucher_value, v.vendor_name
            FROM voucher_redemptions vr
            JOIN vouchers v ON vr.voucher_id = v.id
            WHERE vr.redemption_code = ?
        `, [redemptionCode]);

        if (!redemption) {
            this.throwError(this.ErrorCodes.VOUCHER_NOT_FOUND, {
                message: '找不到此兌換碼'
            });
        }

        if (redemption.is_used) {
            this.throwError(this.ErrorCodes.VOUCHER_ALREADY_USED, {
                usedAt: redemption.used_at
            });
        }

        // 標記已兌換
        await this.db.run(`
            UPDATE voucher_redemptions
            SET is_used = 1, used_at = CURRENT_TIMESTAMP
            WHERE redemption_code = ? AND is_used = 0
        `, [redemptionCode]);

        this.log('redeemVoucher', { redemptionCode, redeemedBy });

        return {
            success: true,
            voucher: {
                name: redemption.voucher_name,
                value: redemption.voucher_value,
                vendor: redemption.vendor_name,
                category: redemption.category
            },
            traceId: redemption.trace_id
        };
    }

    /**
     * 根據兌換碼查詢
     * @param {string} redemptionCode - 兌換碼
     * @returns {Promise<Object>}
     */
    async getByRedemptionCode(redemptionCode) {
        const redemption = await this.db.get(`
            SELECT vr.*, v.voucher_name, v.category, v.voucher_value, v.vendor_name
            FROM voucher_redemptions vr
            JOIN vouchers v ON vr.voucher_id = v.id
            WHERE vr.redemption_code = ?
        `, [redemptionCode]);

        if (!redemption) {
            this.throwError(this.ErrorCodes.VOUCHER_NOT_FOUND);
        }

        return redemption;
    }
}

module.exports = new VoucherService();
