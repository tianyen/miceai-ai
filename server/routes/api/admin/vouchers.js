/**
 * 兌換券管理 API 路由
 * 路徑: /api/admin/vouchers
 *
 * @refactor 2025-12-01: 使用 voucherService，遵循 3-Tier Architecture
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { voucherService } = require('../../../services');
const responses = require('../../../utils/responses');
const logger = require('../../../utils/logger');

/**
 * 處理 Service 層錯誤
 */
function handleServiceError(res, error, defaultMessage) {
    if (error.statusCode) {
        const message = error.details?.message || error.message || defaultMessage;
        return responses.error(res, message, error.statusCode);
    }
    return responses.serverError(res, defaultMessage, error);
}

/**
 * @swagger
 * /api/admin/vouchers/stats:
 *   get:
 *     tags: [Admin - Vouchers]
 *     summary: 獲取兌換券統計
 *     description: 獲取兌換券的統計資訊，可依專案篩選
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: 統計日期（YYYY-MM-DD）
 *       - in: query
 *         name: project_id
 *         schema:
 *           type: integer
 *         description: 專案 ID（篩選特定專案的統計）
 *     responses:
 *       200:
 *         description: 成功獲取統計資訊
 */
router.get('/stats', async (req, res) => {
    try {
        const result = await voucherService.getStats({
            date: req.query.date,
            project_id: req.query.project_id
        });

        return responses.success(res, result, '成功獲取統計資訊');
    } catch (error) {
        return handleServiceError(res, error, '獲取兌換券統計失敗');
    }
});

/**
 * @swagger
 * /api/admin/vouchers/inventory-stats:
 *   get:
 *     tags: [Admin - Vouchers]
 *     summary: 獲取兌換券庫存統計
 *     description: 獲取兌換券總數、啟用數、停用數
 *     responses:
 *       200:
 *         description: 成功獲取庫存統計
 */
router.get('/inventory-stats', async (req, res) => {
    try {
        const result = await voucherService.getInventoryStats();
        return responses.success(res, result, '成功獲取庫存統計');
    } catch (error) {
        return handleServiceError(res, error, '獲取兌換券庫存統計失敗');
    }
});

/**
 * @swagger
 * /api/admin/vouchers:
 *   get:
 *     tags: [Admin - Vouchers]
 *     summary: 獲取兌換券列表
 *     description: 獲取所有兌換券列表，支援分頁、搜尋和篩選
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜尋關鍵字（兌換券名稱）
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: 分類篩選
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: string
 *           enum: ['1', '0']
 *         description: 是否啟用
 *     responses:
 *       200:
 *         description: 成功獲取兌換券列表
 */
router.get('/', async (req, res) => {
    try {
        const result = await voucherService.getList({
            page: req.query.page,
            limit: req.query.limit,
            search: req.query.search,
            category: req.query.category,
            is_active: req.query.is_active
        });

        return responses.success(res, result, '成功獲取兌換券列表');
    } catch (error) {
        return handleServiceError(res, error, '獲取兌換券列表失敗');
    }
});

/**
 * @swagger
 * /api/admin/vouchers/scan:
 *   post:
 *     tags: [Admin - Vouchers]
 *     summary: 掃描兌換券 QR Code
 *     description: 掃描兌換券 QR Code 並標記為已使用
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 description: 兌換碼或 trace_id
 *               redemption_code:
 *                 type: string
 *                 description: 兌換碼（JSON 格式）
 *               trace_id:
 *                 type: string
 *                 description: Trace ID（JSON 格式）
 *     responses:
 *       200:
 *         description: 掃描成功
 *       404:
 *         description: 兌換記錄不存在
 */
router.post('/scan', async (req, res) => {
    try {
        const result = await voucherService.scanVoucher({
            code: req.body.code,
            redemption_code: req.body.redemption_code,
            trace_id: req.body.trace_id
        });

        logger.business('兌換券掃描使用', {
            redemption_code: result.redemption_code,
            trace_id: result.trace_id,
            voucher_name: result.voucher_name,
            user_id: req.user?.id
        });

        return responses.success(res, result, '兌換成功');
    } catch (error) {
        return handleServiceError(res, error, '掃描兌換券失敗');
    }
});

/**
 * @swagger
 * /api/admin/vouchers/redemptions:
 *   get:
 *     tags: [Admin - Vouchers]
 *     summary: 獲取兌換記錄列表
 *     description: 獲取所有兌換券兌換記錄
 *     responses:
 *       200:
 *         description: 成功獲取兌換記錄列表
 */
router.get('/redemptions', async (req, res) => {
    try {
        const result = await voucherService.getRedemptions({
            limit: req.query.limit || 100
        });

        return responses.success(res, result, '成功獲取兌換記錄列表');
    } catch (error) {
        return handleServiceError(res, error, '獲取兌換記錄列表失敗');
    }
});

/**
 * @swagger
 * /api/admin/vouchers/redemptions/{id}/use:
 *   post:
 *     tags: [Admin - Vouchers]
 *     summary: 標記兌換券為已使用
 *     description: 將兌換券標記為已使用狀態
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 兌換記錄 ID
 *     responses:
 *       200:
 *         description: 成功標記為已使用
 *       404:
 *         description: 兌換記錄不存在
 */
router.post('/redemptions/:id/use', async (req, res) => {
    try {
        await voucherService.markRedemptionUsed(req.params.id);

        logger.business('兌換券標記為已使用', {
            redemption_id: req.params.id,
            user_id: req.user?.id
        });

        return responses.success(res, null, '成功標記為已使用');
    } catch (error) {
        return handleServiceError(res, error, '標記兌換券為已使用失敗');
    }
});

/**
 * @swagger
 * /api/admin/vouchers/{id}:
 *   get:
 *     tags: [Admin - Vouchers]
 *     summary: 獲取單一兌換券
 *     description: 根據 ID 獲取兌換券詳細資訊
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 兌換券 ID
 *     responses:
 *       200:
 *         description: 成功獲取兌換券資訊
 *       404:
 *         description: 兌換券不存在
 */
router.get('/:id', async (req, res) => {
    try {
        const voucher = await voucherService.getById(req.params.id);
        return responses.success(res, voucher, '成功獲取兌換券資訊');
    } catch (error) {
        return handleServiceError(res, error, '獲取兌換券資訊失敗');
    }
});

/**
 * @swagger
 * /api/admin/vouchers:
 *   post:
 *     tags: [Admin - Vouchers]
 *     summary: 新增兌換券
 *     description: 創建新的兌換券
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - voucher_name
 *               - total_quantity
 *             properties:
 *               voucher_name:
 *                 type: string
 *                 example: "咖啡券"
 *               vendor_name:
 *                 type: string
 *                 example: "星巴克"
 *               sponsor_name:
 *                 type: string
 *                 example: "贊助商A"
 *               category:
 *                 type: string
 *                 example: "飲品"
 *               voucher_value:
 *                 type: string
 *                 example: "一杯咖啡"
 *               total_quantity:
 *                 type: integer
 *                 example: 100
 *               description:
 *                 type: string
 *                 example: "可兌換一杯中杯咖啡"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: 成功創建兌換券
 *       400:
 *         description: 驗證錯誤
 */
router.post('/', [
    body('voucher_name').trim().notEmpty().withMessage('兌換券名稱為必填'),
    body('vendor_name').optional().trim(),
    body('sponsor_name').optional().trim(),
    body('category').optional().trim(),
    body('total_quantity').isInt({ min: 0 }).withMessage('總數量必須為非負整數'),
    body('voucher_value').optional().trim(),
    body('description').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.badRequest(res, '驗證失敗', errors.array());
        }

        const result = await voucherService.create(req.body);

        logger.business('兌換券創建', {
            voucher_id: result.voucher.id,
            voucher_name: req.body.voucher_name,
            total_quantity: req.body.total_quantity,
            user_id: req.user?.id
        });

        return responses.success(res, result, '成功創建兌換券', 201);
    } catch (error) {
        return handleServiceError(res, error, '創建兌換券失敗');
    }
});

/**
 * @swagger
 * /api/admin/vouchers/{id}:
 *   put:
 *     tags: [Admin - Vouchers]
 *     summary: 更新兌換券
 *     description: 更新兌換券資訊
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 兌換券 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               voucher_name:
 *                 type: string
 *               vendor_name:
 *                 type: string
 *               sponsor_name:
 *                 type: string
 *               category:
 *                 type: string
 *               voucher_value:
 *                 type: string
 *               total_quantity:
 *                 type: integer
 *               description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 成功更新兌換券
 *       404:
 *         description: 兌換券不存在
 */
router.put('/:id', [
    body('voucher_name').optional().trim().notEmpty().withMessage('兌換券名稱不能為空'),
    body('vendor_name').optional().trim(),
    body('sponsor_name').optional().trim(),
    body('category').optional().trim(),
    body('total_quantity').optional().isInt({ min: 0 }).withMessage('總數量必須為非負整數'),
    body('voucher_value').optional().trim(),
    body('description').optional().trim(),
    body('is_active').optional().isBoolean().withMessage('is_active 必須為布林值')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.badRequest(res, '驗證失敗', errors.array());
        }

        const result = await voucherService.update(req.params.id, req.body);

        logger.business('兌換券更新', {
            voucher_id: req.params.id,
            updates: Object.keys(req.body),
            user_id: req.user?.id
        });

        return responses.success(res, result, '成功更新兌換券');
    } catch (error) {
        return handleServiceError(res, error, '更新兌換券失敗');
    }
});

/**
 * @swagger
 * /api/admin/vouchers/{id}:
 *   delete:
 *     tags: [Admin - Vouchers]
 *     summary: 刪除兌換券
 *     description: 刪除兌換券（軟刪除）
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 兌換券 ID
 *     responses:
 *       200:
 *         description: 成功刪除兌換券
 *       404:
 *         description: 兌換券不存在
 */
router.delete('/:id', async (req, res) => {
    try {
        await voucherService.delete(req.params.id);

        logger.business('兌換券刪除', {
            voucher_id: req.params.id,
            user_id: req.user?.id
        });

        return responses.success(res, null, '成功刪除兌換券');
    } catch (error) {
        return handleServiceError(res, error, '刪除兌換券失敗');
    }
});

module.exports = router;
