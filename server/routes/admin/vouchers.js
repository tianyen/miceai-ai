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

// ============================================================
// P1-7: 以下舊的 API 路由已廢棄
// 新的 RESTful API 已移至 /api/admin/vouchers (server/routes/api/admin/vouchers.js)
// 請使用新的 API 端點
// ============================================================

module.exports = router;

