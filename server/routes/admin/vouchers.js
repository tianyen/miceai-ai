/**
 * 兌換券管理路由
 */
const express = require('express');
const router = express.Router();
const { voucherService } = require('../../services');
const responses = require('../../utils/responses');

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
        ],
        additionalCSS: ['/css/admin/pages/vouchers.css'],
        additionalJS: ['/js/admin/pages/vouchers.js']
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

        const result = await voucherService.getList({
            is_active: is_active,
            limit: parseInt(limit)
        });

        return responses.success(res, result.vouchers, '獲取兌換券列表成功');
    } catch (error) {
        console.error('獲取兌換券列表失敗:', error);
        return responses.serverError(res, '獲取兌換券列表失敗');
    }
});

module.exports = router;

