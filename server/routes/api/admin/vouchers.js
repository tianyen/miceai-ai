/**
 * 兌換券管理 API 路由
 * 路徑: /api/admin/vouchers
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const database = require('../../../config/database');
const responses = require('../../../utils/responses');
const logger = require('../../../utils/logger');
const ErrorCodes = require('../../../utils/error-codes');
const AppError = require('../../../utils/app-error');

/**
 * @swagger
 * /api/admin/vouchers/stats:
 *   get:
 *     tags: [Admin - Vouchers]
 *     summary: 獲取兌換券統計
 *     description: 獲取兌換券的統計資訊
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: 統計日期（YYYY-MM-DD）
 *     responses:
 *       200:
 *         description: 成功獲取統計資訊
 */
router.get('/stats', async (req, res) => {
    try {
        const { date } = req.query;

        // 1. 總覽統計 - 從 voucher_redemptions 表獲取
        const summary = await database.get(`
            SELECT
                COUNT(*) as total_redemptions,
                SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used_redemptions,
                COUNT(DISTINCT trace_id) as unique_users,
                ROUND(CAST(SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 1) as usage_rate
            FROM voucher_redemptions
        `);

        // 2. 各兌換券發放統計
        const voucherStats = await database.query(`
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

        // 3. 每日兌換趨勢（最近 30 天）
        const dailyTrend = await database.query(`
            SELECT
                DATE(redeemed_at) as date,
                COUNT(*) as redemption_count,
                SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used_count
            FROM voucher_redemptions
            WHERE redeemed_at >= DATE('now', '-30 days')
            GROUP BY DATE(redeemed_at)
            ORDER BY date ASC
        `);

        // 4. 熱門兌換券排行榜 TOP 10
        const topVouchers = await database.query(`
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

        logger.info('獲取兌換券統計', { date, summary });

        return responses.success(res, {
            summary: summary || { total_redemptions: 0, used_redemptions: 0, unique_users: 0, usage_rate: 0 },
            voucher_stats: voucherStats || [],
            daily_trend: dailyTrend || [],
            top_vouchers: topVouchers || []
        }, '成功獲取統計資訊');
    } catch (error) {
        logger.error('獲取兌換券統計失敗', { error: error.message }, error);
        return responses.serverError(res, '獲取兌換券統計失敗', error);
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
        const { page = 1, limit = 20, search = '', category = '', is_active = '' } = req.query;
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

        const vouchers = await database.query(query, params);

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

        const { total } = await database.get(countQuery, countParams);

        logger.info('獲取兌換券列表', {
            page,
            limit,
            search,
            category,
            is_active,
            total,
            count: vouchers.length
        });

        return responses.success(res, {
            vouchers,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(total / limit),
                total_items: total,
                items_per_page: parseInt(limit)
            }
        }, '成功獲取兌換券列表');
    } catch (error) {
        logger.error('獲取兌換券列表失敗', { error: error.message }, error);
        return responses.serverError(res, '獲取兌換券列表失敗', error);
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
        const { code, redemption_code, trace_id } = req.body;

        // 確定要查詢的兌換碼或 trace_id
        let searchCode = code || redemption_code;
        let searchTraceId = trace_id;

        if (!searchCode && !searchTraceId) {
            return responses.badRequest(res, '請提供兌換碼或 trace_id');
        }

        // 查詢兌換記錄
        let redemption;
        if (searchCode) {
            redemption = await database.get(`
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
        } else if (searchTraceId) {
            redemption = await database.get(`
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
            `, [searchTraceId]);
        }

        if (!redemption) {
            return responses.notFound(res, '找不到對應的兌換記錄');
        }

        if (redemption.is_used) {
            return responses.badRequest(res, '此兌換券已經使用過了');
        }

        // 標記為已使用
        await database.run(
            'UPDATE voucher_redemptions SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?',
            [redemption.id]
        );

        logger.business('兌換券掃描使用', {
            redemption_id: redemption.id,
            redemption_code: redemption.redemption_code,
            trace_id: redemption.trace_id,
            voucher_name: redemption.voucher_name,
            user_id: req.user?.id
        });

        // 返回兌換資訊
        return responses.success(res, {
            redemption_code: redemption.redemption_code,
            trace_id: redemption.trace_id,
            voucher_name: redemption.voucher_name,
            voucher_vendor: redemption.vendor_name,
            voucher_category: redemption.category,
            voucher_value: redemption.voucher_value,
            redeemed_at: redemption.redeemed_at,
            used_at: new Date().toISOString()
        }, '兌換成功');
    } catch (error) {
        logger.error('掃描兌換券失敗', { error: error.message }, error);
        return responses.serverError(res, '掃描兌換券失敗', error);
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
        const redemptions = await database.query(`
            SELECT
                vr.*,
                v.voucher_name,
                v.vendor_name,
                v.category,
                v.voucher_value
            FROM voucher_redemptions vr
            JOIN vouchers v ON vr.voucher_id = v.id
            ORDER BY vr.redeemed_at DESC
            LIMIT 100
        `);

        logger.info('獲取兌換記錄列表', { count: redemptions.length });
        return responses.success(res, redemptions, '成功獲取兌換記錄列表');
    } catch (error) {
        logger.error('獲取兌換記錄列表失敗', { error: error.message }, error);
        return responses.serverError(res, '獲取兌換記錄列表失敗', error);
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
        const { id } = req.params;

        // 檢查兌換記錄是否存在
        const redemption = await database.get(
            'SELECT * FROM voucher_redemptions WHERE id = ?',
            [id]
        );

        if (!redemption) {
            return responses.notFound(res, '兌換記錄不存在');
        }

        if (redemption.is_used) {
            return responses.badRequest(res, '此兌換券已經使用過了');
        }

        // 標記為已使用
        await database.run(
            'UPDATE voucher_redemptions SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );

        logger.business('兌換券標記為已使用', {
            redemption_id: id,
            redemption_code: redemption.redemption_code,
            trace_id: redemption.trace_id,
            user_id: req.user?.id
        });

        return responses.success(res, null, '成功標記為已使用');
    } catch (error) {
        logger.error('標記兌換券為已使用失敗', { redemption_id: req.params.id, error: error.message }, error);
        return responses.serverError(res, '標記兌換券為已使用失敗', error);
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
        const { id } = req.params;
        const voucher = await database.get(`
            SELECT
                v.*,
                vc.min_score,
                vc.min_play_time
            FROM vouchers v
            LEFT JOIN voucher_conditions vc ON v.id = vc.voucher_id
            WHERE v.id = ?
        `, [id]);

        if (!voucher) {
            throw new AppError(ErrorCodes.VOUCHER_NOT_FOUND);
        }

        // 計算已兌換數量
        voucher.redeemed_count = voucher.total_quantity - voucher.remaining_quantity;

        logger.info('獲取兌換券資訊', { voucher_id: id });
        return responses.success(res, voucher, '成功獲取兌換券資訊');
    } catch (error) {
        if (error instanceof AppError) {
            return responses.error(res, error);
        }
        logger.error('獲取兌換券資訊失敗', { voucher_id: req.params.id, error: error.message }, error);
        return responses.serverError(res, '獲取兌換券資訊失敗', error);
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
            throw new AppError(ErrorCodes.VALIDATION_ERROR, '驗證失敗', errors.array());
        }

        const {
            voucher_name,
            vendor_name,
            sponsor_name,
            category,
            voucher_value,
            total_quantity,
            description,
            is_active = 1
        } = req.body;

        const result = await database.run(
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

        const voucher = await database.get('SELECT * FROM vouchers WHERE id = ?', [result.lastID]);

        logger.business('兌換券創建', {
            voucher_id: result.lastID,
            voucher_name,
            total_quantity,
            user_id: req.user?.id
        });

        return responses.success(res, { voucher }, '成功創建兌換券', 201);
    } catch (error) {
        if (error instanceof AppError) {
            return responses.error(res, error);
        }
        logger.error('創建兌換券失敗', { error: error.message }, error);
        return responses.serverError(res, '創建兌換券失敗', error);
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
            throw new AppError(ErrorCodes.VALIDATION_ERROR, '驗證失敗', errors.array());
        }

        const { id } = req.params;
        const voucher = await database.get('SELECT * FROM vouchers WHERE id = ?', [id]);

        if (!voucher) {
            throw new AppError(ErrorCodes.VOUCHER_NOT_FOUND);
        }

        const updates = [];
        const params = [];

        if (req.body.voucher_name !== undefined) {
            updates.push('voucher_name = ?');
            params.push(req.body.voucher_name);
        }
        if (req.body.vendor_name !== undefined) {
            updates.push('vendor_name = ?');
            params.push(req.body.vendor_name);
        }
        if (req.body.sponsor_name !== undefined) {
            updates.push('sponsor_name = ?');
            params.push(req.body.sponsor_name);
        }
        if (req.body.category !== undefined) {
            updates.push('category = ?');
            params.push(req.body.category);
        }
        if (req.body.voucher_value !== undefined) {
            updates.push('voucher_value = ?');
            params.push(req.body.voucher_value);
        }
        if (req.body.total_quantity !== undefined) {
            updates.push('total_quantity = ?');
            params.push(req.body.total_quantity);
            // 同時更新 remaining_quantity
            const diff = req.body.total_quantity - voucher.total_quantity;
            updates.push('remaining_quantity = remaining_quantity + ?');
            params.push(diff);
        }
        if (req.body.description !== undefined) {
            updates.push('description = ?');
            params.push(req.body.description);
        }
        if (req.body.is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(req.body.is_active ? 1 : 0);
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id);

            await database.run(
                `UPDATE vouchers SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }

        const updatedVoucher = await database.get('SELECT * FROM vouchers WHERE id = ?', [id]);

        logger.business('兌換券更新', {
            voucher_id: id,
            updates: Object.keys(req.body),
            user_id: req.user?.id
        });

        return responses.success(res, { voucher: updatedVoucher }, '成功更新兌換券');
    } catch (error) {
        if (error instanceof AppError) {
            return responses.error(res, error);
        }
        logger.error('更新兌換券失敗', { voucher_id: req.params.id, error: error.message }, error);
        return responses.serverError(res, '更新兌換券失敗', error);
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
        const { id } = req.params;
        const voucher = await database.get('SELECT * FROM vouchers WHERE id = ?', [id]);

        if (!voucher) {
            throw new AppError(ErrorCodes.VOUCHER_NOT_FOUND);
        }

        // 軟刪除：設置 is_active = 0
        await database.run(
            'UPDATE vouchers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );

        logger.business('兌換券刪除', {
            voucher_id: id,
            voucher_name: voucher.voucher_name,
            user_id: req.user?.id
        });

        return responses.success(res, null, '成功刪除兌換券');
    } catch (error) {
        if (error instanceof AppError) {
            return responses.error(res, error);
        }
        logger.error('刪除兌換券失敗', { voucher_id: req.params.id, error: error.message }, error);
        return responses.serverError(res, '刪除兌換券失敗', error);
    }
});

module.exports = router;

