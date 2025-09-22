/**
 * 管理後台認證路由
 */
const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const { loginLimiter } = require('../../config/security');

// 登入頁面
router.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/admin/dashboard');
    }
    res.render('admin/login', {
        layout: 'main',
        pageTitle: '管理後台登入',
        isAdmin: true,
        additionalCSS: ['/css/common/base.css']
    });
});

// 登入處理
router.post('/login', loginLimiter, authController.adminLogin);

// 登出
router.get('/logout', authController.adminLogout);

module.exports = router;