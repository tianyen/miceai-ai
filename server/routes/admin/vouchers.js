/**
 * 兌換券管理路由
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const database = require('../../config/database');
const responses = require('../../utils/responses');
const { validateRedemptionCode } = require('../../utils/redemption-code-generator');
const { validateTraceId } = require('../../utils/traceId');

// 兌換券管理頁面
router.get('/', (req, res) => {
    res.render('admin/vouchers', {
        layout: 'admin',
        pageTitle: '兌換券管理',
        currentPage: 'vouchers',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '遊戲室', url: '#' },
            { name: '兌換券管理' }
        ]
    });
});

// 獲取兌換券列表 API
router.get('/api/list', async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', category = '', is_active = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT v.*, u.full_name as creator_name,
                   vc.min_score, vc.min_play_time
            FROM vouchers v
            LEFT JOIN users u ON v.created_by = u.id
            LEFT JOIN voucher_conditions vc ON v.id = vc.voucher_id
            WHERE 1=1
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM vouchers WHERE 1=1';
        let params = [];
        let countParams = [];

        // 搜尋條件
        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            query += ` AND (v.voucher_name LIKE ? OR v.vendor_name LIKE ? OR v.sponsor_name LIKE ?)`;
            countQuery += ` AND (voucher_name LIKE ? OR vendor_name LIKE ? OR sponsor_name LIKE ?)`;
            params.push(searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        // 類別篩選
        if (category && category.trim()) {
            query += ` AND v.category = ?`;
            countQuery += ` AND category = ?`;
            params.push(category);
            countParams.push(category);
        }

        // 狀態篩選
        if (is_active !== '') {
            query += ` AND v.is_active = ?`;
            countQuery += ` AND is_active = ?`;
            params.push(is_active);
            countParams.push(is_active);
        }

        query += ` ORDER BY v.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const vouchers = await database.query(query, params);
        const totalResult = await database.get(countQuery, countParams);
        const total = totalResult.total;

        return responses.paginated(res, vouchers, {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('獲取兌換券列表失敗:', error);
        return responses.error(res, '獲取兌換券列表失敗', 500);
    }
});

// 獲取單一兌換券 API
router.get('/api/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const voucher = await database.get('SELECT * FROM vouchers WHERE id = ?', [id]);

        if (!voucher) {
            return responses.notFound(res, '兌換券');
        }

        // 獲取兌換條件
        const condition = await database.get('SELECT * FROM voucher_conditions WHERE voucher_id = ?', [id]);
        voucher.condition = condition || null;

        return responses.success(res, voucher);
    } catch (error) {
        console.error('獲取兌換券失敗:', error);
        return responses.error(res, '獲取兌換券失敗', 500);
    }
});

// 新增兌換券 API
router.post('/api', [
    body('voucher_name').trim().notEmpty().withMessage('兌換券名稱為必填'),
    body('vendor_name').optional().trim(),
    body('sponsor_name').optional().trim(),
    body('category').optional().trim(),
    body('total_quantity').isInt({ min: 0 }).withMessage('總數量必須為非負整數'),
    body('voucher_value').optional().isFloat({ min: 0 }).withMessage('價值必須為非負數'),
    body('description').optional().trim(),
    body('min_score').optional().isInt({ min: 0 }).withMessage('最低分數必須為非負整數'),
    body('min_play_time').optional().isInt({ min: 0 }).withMessage('最低遊玩時間必須為非負整數'),
    body('other_conditions').optional()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, errors.array());
        }

        const {
            voucher_name,
            vendor_name = '',
            sponsor_name = '',
            category = '',
            total_quantity,
            voucher_value = 0,
            description = '',
            min_score = 0,
            min_play_time = 0,
            other_conditions = null
        } = req.body;

        const created_by = req.user.id;
        const remaining_quantity = total_quantity;

        // 開始交易
        await database.run('BEGIN TRANSACTION');

        try {
            // 新增兌換券
            const voucherResult = await database.run(`
                INSERT INTO vouchers (voucher_name, vendor_name, sponsor_name, category, total_quantity, remaining_quantity, voucher_value, description, is_active, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            `, [voucher_name, vendor_name, sponsor_name, category, total_quantity, remaining_quantity, voucher_value, description, created_by]);

            const voucherId = voucherResult.lastID;

            // 新增兌換條件
            const otherConditionsJson = other_conditions ? JSON.stringify(other_conditions) : null;
            await database.run(`
                INSERT INTO voucher_conditions (voucher_id, min_score, min_play_time, other_conditions)
                VALUES (?, ?, ?, ?)
            `, [voucherId, min_score, min_play_time, otherConditionsJson]);

            await database.run('COMMIT');

            const newVoucher = await database.get('SELECT * FROM vouchers WHERE id = ?', [voucherId]);
            const condition = await database.get('SELECT * FROM voucher_conditions WHERE voucher_id = ?', [voucherId]);
            newVoucher.condition = condition;

            return responses.success(res, newVoucher, '兌換券新增成功');
        } catch (error) {
            await database.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('新增兌換券失敗:', error);
        return responses.error(res, '新增兌換券失敗', 500);
    }
});

// 更新兌換券 API
router.put('/api/:id', [
    body('voucher_name').optional().trim().notEmpty().withMessage('兌換券名稱不能為空'),
    body('vendor_name').optional().trim(),
    body('sponsor_name').optional().trim(),
    body('category').optional().trim(),
    body('total_quantity').optional().isInt({ min: 0 }).withMessage('總數量必須為非負整數'),
    body('voucher_value').optional().isFloat({ min: 0 }).withMessage('價值必須為非負數'),
    body('description').optional().trim(),
    body('is_active').optional().isBoolean().withMessage('狀態必須為布林值'),
    body('min_score').optional().isInt({ min: 0 }).withMessage('最低分數必須為非負整數'),
    body('min_play_time').optional().isInt({ min: 0 }).withMessage('最低遊玩時間必須為非負整數'),
    body('other_conditions').optional()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, errors.array());
        }

        const { id } = req.params;
        const voucher = await database.get('SELECT * FROM vouchers WHERE id = ?', [id]);

        if (!voucher) {
            return responses.notFound(res, '兌換券');
        }

        await database.run('BEGIN TRANSACTION');

        try {
            // 更新兌換券基本資訊
            const voucherUpdates = [];
            const voucherParams = [];

            if (req.body.voucher_name !== undefined) {
                voucherUpdates.push('voucher_name = ?');
                voucherParams.push(req.body.voucher_name);
            }
            if (req.body.vendor_name !== undefined) {
                voucherUpdates.push('vendor_name = ?');
                voucherParams.push(req.body.vendor_name);
            }
            if (req.body.sponsor_name !== undefined) {
                voucherUpdates.push('sponsor_name = ?');
                voucherParams.push(req.body.sponsor_name);
            }
            if (req.body.category !== undefined) {
                voucherUpdates.push('category = ?');
                voucherParams.push(req.body.category);
            }
            if (req.body.total_quantity !== undefined) {
                voucherUpdates.push('total_quantity = ?');
                voucherParams.push(req.body.total_quantity);
                // 同時更新剩餘數量
                const diff = req.body.total_quantity - voucher.total_quantity;
                voucherUpdates.push('remaining_quantity = remaining_quantity + ?');
                voucherParams.push(diff);
            }
            if (req.body.voucher_value !== undefined) {
                voucherUpdates.push('voucher_value = ?');
                voucherParams.push(req.body.voucher_value);
            }
            if (req.body.description !== undefined) {
                voucherUpdates.push('description = ?');
                voucherParams.push(req.body.description);
            }
            if (req.body.is_active !== undefined) {
                voucherUpdates.push('is_active = ?');
                voucherParams.push(req.body.is_active ? 1 : 0);
            }

            if (voucherUpdates.length > 0) {
                voucherUpdates.push('updated_at = CURRENT_TIMESTAMP');
                voucherParams.push(id);
                await database.run(
                    `UPDATE vouchers SET ${voucherUpdates.join(', ')} WHERE id = ?`,
                    voucherParams
                );
            }

            // 更新兌換條件
            const conditionUpdates = [];
            const conditionParams = [];

            if (req.body.min_score !== undefined) {
                conditionUpdates.push('min_score = ?');
                conditionParams.push(req.body.min_score);
            }
            if (req.body.min_play_time !== undefined) {
                conditionUpdates.push('min_play_time = ?');
                conditionParams.push(req.body.min_play_time);
            }
            if (req.body.other_conditions !== undefined) {
                conditionUpdates.push('other_conditions = ?');
                conditionParams.push(JSON.stringify(req.body.other_conditions));
            }

            if (conditionUpdates.length > 0) {
                conditionParams.push(id);
                await database.run(
                    `UPDATE voucher_conditions SET ${conditionUpdates.join(', ')} WHERE voucher_id = ?`,
                    conditionParams
                );
            }

            await database.run('COMMIT');

            const updatedVoucher = await database.get('SELECT * FROM vouchers WHERE id = ?', [id]);
            const condition = await database.get('SELECT * FROM voucher_conditions WHERE voucher_id = ?', [id]);
            updatedVoucher.condition = condition;

            return responses.success(res, updatedVoucher, '兌換券更新成功');
        } catch (error) {
            await database.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('更新兌換券失敗:', error);
        return responses.error(res, '更新兌換券失敗', 500);
    }
});

// 刪除兌換券 API
router.delete('/api/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const voucher = await database.get('SELECT * FROM vouchers WHERE id = ?', [id]);

        if (!voucher) {
            return responses.notFound(res, '兌換券');
        }

        // 檢查是否有專案正在使用此兌換券
        const projectGames = await database.query(
            'SELECT COUNT(*) as count FROM project_games WHERE voucher_id = ? AND is_active = 1',
            [id]
        );

        if (projectGames[0].count > 0) {
            return responses.error(res, '此兌換券正在被專案使用，無法刪除', 400);
        }

        // 軟刪除
        await database.run(
            'UPDATE vouchers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );

        return responses.success(res, null, '兌換券刪除成功');
    } catch (error) {
        console.error('刪除兌換券失敗:', error);
        return responses.error(res, '刪除兌換券失敗', 500);
    }
});

// ===== 兌換券掃描功能 =====

// 兌換券掃描頁面
router.get('/scanner', (req, res) => {
    res.render('admin/voucher-scanner', {
        layout: 'admin',
        pageTitle: '兌換券掃描',
        currentPage: 'voucher-scanner',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '遊戲室', url: '#' },
            { name: '兌換券掃描' }
        ]
    });
});

// Webcam 掃描器獨立視窗（無 layout）
router.get('/camera-scanner', (req, res) => {
    res.render('admin/voucher-camera-scanner', {
        layout: false  // 不使用 admin layout，獨立頁面
    });
});

// 掃描 QR Code 兌換
router.post('/scan', async (req, res) => {
    try {
        const { code, redemption_code, trace_id, user_id, game_id, project_id, score, voucher_id } = req.body;

        let redemptionCode = redemption_code || code;
        let traceIdValue = trace_id;

        // 如果沒有提供 redemption_code，嘗試從 trace_id 查找
        if (!redemptionCode && traceIdValue) {
            // 驗證 trace_id 格式
            if (!validateTraceId(traceIdValue)) {
                return responses.badRequest(res, '無效的 trace_id 格式');
            }

            // 從 trace_id 查找兌換記錄
            const redemption = await database.get(
                `SELECT vr.*, v.voucher_name, v.voucher_value,
                        v.vendor_name as voucher_vendor, v.category as voucher_category
                 FROM voucher_redemptions vr
                 JOIN vouchers v ON vr.voucher_id = v.id
                 WHERE vr.trace_id = ? AND vr.is_used = 0
                 ORDER BY vr.redeemed_at DESC
                 LIMIT 1`,
                [traceIdValue]
            );

            if (!redemption) {
                return responses.notFound(res, '找不到未使用的兌換記錄');
            }

            redemptionCode = redemption.redemption_code;
        }

        // 驗證兌換碼格式
        if (!validateRedemptionCode(redemptionCode)) {
            return responses.badRequest(res, '無效的兌換碼格式');
        }

        // 查詢兌換記錄
        const redemption = await database.get(
            `SELECT vr.*, v.voucher_name, v.voucher_value,
                    v.vendor_name as voucher_vendor, v.category as voucher_category
             FROM voucher_redemptions vr
             JOIN vouchers v ON vr.voucher_id = v.id
             WHERE vr.redemption_code = ?`,
            [redemptionCode]
        );

        if (!redemption) {
            return responses.notFound(res, '找不到兌換記錄');
        }

        if (redemption.is_used) {
            return responses.error(res, '此兌換券已使用', 400);
        }

        // 標記為已使用
        await database.run(
            `UPDATE voucher_redemptions
             SET is_used = 1, used_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [redemption.id]
        );

        console.log(`✅ 兌換券已使用: ${redemptionCode}, trace_id=${redemption.trace_id}`);

        return responses.success(res, {
            id: redemption.id,
            redemption_code: redemption.redemption_code,
            trace_id: redemption.trace_id,
            voucher_name: redemption.voucher_name,
            voucher_value: redemption.voucher_value,
            voucher_vendor: redemption.voucher_vendor,
            voucher_category: redemption.voucher_category,
            redeemed_at: redemption.redeemed_at,
            used_at: new Date().toISOString()
        }, '兌換成功');

    } catch (error) {
        console.error('掃描兌換失敗:', error);
        return responses.serverError(res, '掃描兌換失敗', error);
    }
});

// 獲取兌換記錄列表
router.get('/redemptions', async (req, res) => {
    try {
        const { page = 1, limit = 50, is_used = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT vr.*, v.voucher_name, v.voucher_value,
                   v.vendor_name as voucher_vendor, v.category as voucher_category
            FROM voucher_redemptions vr
            JOIN vouchers v ON vr.voucher_id = v.id
            WHERE 1=1
        `;
        let params = [];

        if (is_used !== '') {
            query += ` AND vr.is_used = ?`;
            params.push(is_used === '1' ? 1 : 0);
        }

        query += ` ORDER BY vr.redeemed_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const redemptions = await database.query(query, params);

        return responses.success(res, redemptions);

    } catch (error) {
        console.error('獲取兌換記錄失敗:', error);
        return responses.serverError(res, '獲取兌換記錄失敗', error);
    }
});

// 標記兌換券為已使用
router.post('/redemptions/:id/use', async (req, res) => {
    try {
        const { id } = req.params;

        // 查詢兌換記錄
        const redemption = await database.get(
            'SELECT * FROM voucher_redemptions WHERE id = ?',
            [id]
        );

        if (!redemption) {
            return responses.notFound(res, '找不到兌換記錄');
        }

        if (redemption.is_used) {
            return responses.error(res, '此兌換券已使用', 400);
        }

        // 標記為已使用
        await database.run(
            `UPDATE voucher_redemptions
             SET is_used = 1, used_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [id]
        );

        console.log(`✅ 兌換券已標記為使用: id=${id}, code=${redemption.redemption_code}`);

        return responses.success(res, null, '標記成功');

    } catch (error) {
        console.error('標記兌換券失敗:', error);
        return responses.serverError(res, '標記兌換券失敗', error);
    }
});

module.exports = router;
