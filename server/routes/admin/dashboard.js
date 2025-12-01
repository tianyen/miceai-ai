/**
 * 儀表板路由
 */
const express = require('express');
const router = express.Router();

// 儀表板頁面
router.get('/', (req, res) => {
    res.render('admin/dashboard', {
        layout: 'admin',
        pageTitle: '儀表板',
        currentPage: 'dashboard',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板' }
        ],
        additionalCSS: ['/css/admin/pages/dashboard.css'],
        additionalJS: ['/js/admin/pages/dashboard.js']
    });
});

module.exports = router;