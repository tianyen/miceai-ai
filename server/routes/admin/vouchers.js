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

// 兌換券統計頁面
router.get('/stats', (req, res) => {
    res.render('admin/voucher-stats', {
        layout: 'admin',
        pageTitle: '兌換券統計',
        currentPage: 'voucher-stats',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '遊戲室', url: '#' },
            { name: '兌換券統計' }
        ]
    });
});

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

// ============================================================
// P1-7: 以下舊的 API 路由已廢棄
// 新的 RESTful API 已移至 /api/admin/vouchers (server/routes/api/admin/vouchers.js)
// 請使用新的 API 端點
// ============================================================

// 獲取兌換券列表（API，用於下拉選單）
router.get('/api/list', async (req, res) => {
    try {
        const { is_active, limit = 100 } = req.query;

        let query = 'SELECT id, voucher_name, category, voucher_value, remaining_quantity, total_quantity, is_active FROM vouchers WHERE 1=1';
        const params = [];

        if (is_active !== undefined && is_active !== '') {
            query += ' AND is_active = ?';
            params.push(is_active);
        }

        query += ' ORDER BY voucher_name LIMIT ?';
        params.push(parseInt(limit));

        const vouchers = await database.query(query, params);

        return responses.success(res, vouchers, '獲取兌換券列表成功');
    } catch (error) {
        console.error('獲取兌換券列表失敗:', error);
        return responses.serverError(res, '獲取兌換券列表失敗');
    }
});

module.exports = router;

