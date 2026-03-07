/**
 * Voucher Service - 兌換券業務邏輯層
 *
 * @description 處理兌換券相關業務：CRUD、發放、兌換、統計
 * @refactor 2025-12-01: 擴展 Admin API 支援
 */
const BaseService = require('./base.service');
const voucherRepository = require('../repositories/voucher.repository');

class VoucherService extends BaseService {
    constructor() {
        super('VoucherService');
        this.repository = voucherRepository;
    }

    // ==================== Admin API 方法 ====================

    /**
     * 獲取統計數據
     * @param {Object} options - 選項 (date, project_id)
     * @returns {Promise<Object>}
     */
    async getStats(options = {}) {
        const { project_id } = options;

        // 並行查詢各項統計
        const [summary, voucherStats, dailyTrend, topVouchers] = await Promise.all([
            this.repository.getRedemptionSummary(project_id),
            this.repository.getVoucherStatsByProject(project_id),
            this.repository.getDailyRedemptionTrend(project_id),
            this.repository.getTopVouchers(project_id)
        ]);

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
        return this.repository.getInventoryStats();
    }

    /**
     * 獲取兌換券列表（含分頁）
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getList(options = {}) {
        const result = await this.repository.findVouchersWithFilter(options);

        this.log('getList', {
            page: options.page,
            limit: options.limit,
            search: options.search,
            category: options.category,
            is_active: options.is_active,
            total: result.pagination.total_items,
            count: result.vouchers.length
        });

        return result;
    }

    /**
     * 根據 ID 獲取兌換券
     * @param {number} voucherId - 兌換券 ID
     * @returns {Promise<Object>}
     */
    async getById(voucherId) {
        const voucher = await this.repository.findVoucherByIdWithConditions(voucherId);

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
            is_active = 1,
            created_by,
            min_score = 0,
            min_play_time = 0
        } = data;

        if (!voucher_name) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '兌換券名稱為必填'
            });
        }

        const result = await this.repository.createVoucher({
            voucher_name,
            vendor_name,
            sponsor_name,
            category,
            voucher_value,
            total_quantity,
            description,
            is_active,
            created_by
        });

        const voucherId = result.lastID;

        // 創建兌換券條件
        await this.repository.createVoucherConditions({
            voucher_id: voucherId,
            min_score,
            min_play_time
        });

        const voucher = await this.repository.findVoucherByIdWithConditions(voucherId);

        this.log('create', { voucher_id: voucherId, voucher_name, total_quantity, min_score, min_play_time });

        return { voucher };
    }

    /**
     * 更新兌換券
     * @param {number} voucherId - 兌換券 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async update(voucherId, data) {
        const voucher = await this.repository.findById(voucherId);

        if (!voucher) {
            this.throwError(this.ErrorCodes.VOUCHER_NOT_FOUND);
        }

        // 計算數量差異並更新 remaining_quantity
        if (data.total_quantity !== undefined) {
            const diff = data.total_quantity - voucher.total_quantity;
            data.remaining_quantity = voucher.remaining_quantity + diff;
        }

        // 分離 voucher 和 voucher_conditions 的資料
        const { min_score, min_play_time, ...voucherData } = data;

        await this.repository.updateVoucher(voucherId, voucherData);

        // 更新兌換券條件（使用 upsert）
        if (min_score !== undefined || min_play_time !== undefined) {
            await this.repository.upsertVoucherConditions(voucherId, {
                min_score: min_score ?? 0,
                min_play_time: min_play_time ?? 0
            });
        }

        const updatedVoucher = await this.repository.findVoucherByIdWithConditions(voucherId);

        this.log('update', { voucher_id: voucherId, updates: Object.keys(data) });

        return { voucher: updatedVoucher };
    }

    /**
     * 刪除兌換券（軟刪除）
     * @param {number} voucherId - 兌換券 ID
     * @returns {Promise<Object>}
     */
    async delete(voucherId) {
        const voucher = await this.repository.findById(voucherId);

        if (!voucher) {
            this.throwError(this.ErrorCodes.VOUCHER_NOT_FOUND);
        }

        await this.repository.softDeleteVoucher(voucherId);

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
        const searchCode = code || redemption_code;

        if (!searchCode && !trace_id) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '請提供兌換碼或 trace_id'
            });
        }

        // 查詢兌換記錄
        const redemption = await this.repository.findRedemptionByCodeOrTrace(searchCode, trace_id);

        if (!redemption) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '找不到對應的兌換記錄',
                scan_status: 'not_found'
            });
        }

        let childrenAges = null;
        if (redemption.children_ages) {
            try {
                childrenAges = typeof redemption.children_ages === 'string'
                    ? JSON.parse(redemption.children_ages)
                    : redemption.children_ages;
            } catch (error) {
                childrenAges = null;
            }
        }

        const participant = redemption.submitter_name ? {
            name: redemption.submitter_name,
            gender: redemption.gender || null,
            adult_age: redemption.adult_age || null,
            children_count: redemption.children_count || 0,
            children_ages: childrenAges,
            notes: redemption.notes || null,
            is_vip: !!(redemption.notes && redemption.notes.includes('貴賓'))
        } : null;

        if (redemption.is_used) {
            this.throwError(this.ErrorCodes.VOUCHER_ALREADY_USED, {
                message: '此兌換券已經使用過了',
                scan_status: 'duplicate',
                redemption_code: redemption.redemption_code,
                trace_id: redemption.trace_id,
                voucher_name: redemption.voucher_name,
                voucher_vendor: redemption.vendor_name,
                voucher_category: redemption.category,
                voucher_value: redemption.voucher_value,
                redeemed_at: redemption.redeemed_at,
                used_at: redemption.used_at,
                participant
            });
        }

        // 標記為已使用
        await this.repository.markRedemptionUsed(redemption.id);

        this.log('scanVoucher', {
            redemption_id: redemption.id,
            redemption_code: redemption.redemption_code,
            trace_id: redemption.trace_id,
            voucher_name: redemption.voucher_name
        });

        return {
            scan_status: 'success',
            redemption_code: redemption.redemption_code,
            trace_id: redemption.trace_id,
            voucher_name: redemption.voucher_name,
            voucher_vendor: redemption.vendor_name,
            voucher_category: redemption.category,
            voucher_value: redemption.voucher_value,
            redeemed_at: redemption.redeemed_at,
            used_at: new Date().toISOString(),
            participant
        };
    }

    /**
     * 獲取兌換記錄列表
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async getRedemptions(options = {}) {
        const { limit = 100 } = options;

        const redemptions = await this.repository.getRedemptionsWithVouchers(limit);

        this.log('getRedemptions', { count: redemptions.length });

        return redemptions;
    }

    /**
     * 標記兌換記錄為已使用
     * @param {number} redemptionId - 兌換記錄 ID
     * @returns {Promise<Object>}
     */
    async markRedemptionUsed(redemptionId) {
        const normalizedRedemptionId = Number(redemptionId);

        if (!Number.isInteger(normalizedRedemptionId) || normalizedRedemptionId <= 0) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '兌換記錄 ID 格式錯誤'
            });
        }

        const redemption = await this.repository.findRedemptionById(normalizedRedemptionId);

        if (!redemption) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '兌換記錄不存在'
            });
        }

        if (redemption.is_used) {
            this.throwError(this.ErrorCodes.VOUCHER_ALREADY_USED, {
                message: '此兌換券已經使用過了',
                redemption_code: redemption.redemption_code,
                used_at: redemption.used_at
            });
        }

        await this.repository.markRedemptionUsed(normalizedRedemptionId);

        this.log('markRedemptionUsed', {
            redemption_id: normalizedRedemptionId,
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
        const voucher = await this.repository.findById(voucherId);

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
        return this.repository.findAvailable(options);
    }

    /**
     * 發放兌換券
     * @param {Object} issueData - 發放資料
     * @returns {Promise<Object>}
     */
    async issueVoucher(issueData) {
        const {
            voucherId, traceId, userId, sessionId, projectId,
            redemptionCode, qrCodeBase64
        } = issueData;

        // 驗證兌換券存在且有庫存
        const voucher = await this.getVoucherById(voucherId);

        if (voucher.remaining_quantity <= 0) {
            this.throwError(this.ErrorCodes.VOUCHER_OUT_OF_STOCK);
        }

        // 扣減庫存
        const updateResult = await this.repository.decrementStock(voucherId);

        if (updateResult.changes === 0) {
            this.throwError(this.ErrorCodes.VOUCHER_OUT_OF_STOCK);
        }

        // 建立兌換記錄
        const result = await this.repository.createRedemption({
            voucherId,
            traceId,
            userId,
            sessionId,
            projectId,
            redemptionCode,
            qrCodeBase64
        });

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
        const redemption = await this.repository.findByRedemptionCode(redemptionCode);

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
        await this.repository.markRedemptionUsedByCode(redemptionCode);

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
        const redemption = await this.repository.findByRedemptionCode(redemptionCode);

        if (!redemption) {
            this.throwError(this.ErrorCodes.VOUCHER_NOT_FOUND);
        }

        return redemption;
    }

    // ==================== V1 API 方法 ====================

    /**
     * 根據 trace_id 查詢用戶的所有兌換券 (V1 API)
     * @param {string} traceId - 用戶追蹤 ID
     * @returns {Promise<Object>}
     */
    async getByTraceId(traceId) {
        const redemptions = await this.repository.findAllRedemptionsByTraceId(traceId);

        // 格式化回傳資料
        const vouchers = redemptions.map(r => ({
            id: r.id,
            redemption_code: r.redemption_code,
            voucher_name: r.voucher_name,
            voucher_value: r.voucher_value,
            vendor_name: r.vendor_name,
            category: r.category,
            is_used: r.is_used === 1,
            redeemed_at: r.redeemed_at,
            used_at: r.used_at,
            qr_code_base64: r.qr_code_base64
        }));

        // 計算統計
        const total = vouchers.length;
        const used = vouchers.filter(v => v.is_used).length;
        const unused = total - used;

        this.log('getByTraceId', { traceId, total, used, unused });

        return {
            vouchers,
            summary: {
                total,
                used,
                unused
            }
        };
    }
}

module.exports = new VoucherService();
