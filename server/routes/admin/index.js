/**
 * 管理後台主路由
 */
const express = require('express');
const router = express.Router();
const { authenticateSession } = require('../../middleware/auth');

// 導入子路由
const authRoutes = require('./auth');
const dashboardRoutes = require('./dashboard');
const projectsRoutes = require('./projects');
const templatesRoutes = require('./templates');
const usersRoutes = require('./users');
const submissionsRoutes = require('./submissions');
const checkinRoutes = require('./checkin');
const logsRoutes = require('./logs');
const questionnaireRoutes = require('./questionnaire');
const profileRoutes = require('./profile');
const gamesRoutes = require('./games');
const vouchersRoutes = require('./vouchers');
const projectGamesRoutes = require('./project-games');
const boothsRoutes = require('./booths');
const userTrackingRoutes = require('./user-tracking');
const wishTreeRoutes = require('./wish-tree');

// 根路徑重定向到登入頁面
router.get('/', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/admin/dashboard');
    }
    return res.redirect('/admin/login');
});

// 公開路由（不需要認證）
router.use('/', authRoutes);

// 需要認證的路由
router.use('/dashboard', authenticateSession, dashboardRoutes);
router.use('/projects', authenticateSession, projectsRoutes);
router.use('/projects', authenticateSession, projectGamesRoutes);
router.use('/templates', authenticateSession, templatesRoutes);
router.use('/users', authenticateSession, usersRoutes);
router.use('/submissions', authenticateSession, submissionsRoutes);
router.use('/checkin-management', authenticateSession, checkinRoutes);
router.use('/logs', authenticateSession, logsRoutes);
router.use('/questionnaire', authenticateSession, questionnaireRoutes);
router.use('/profile', authenticateSession, profileRoutes);
router.use('/games', authenticateSession, gamesRoutes);
router.use('/vouchers', authenticateSession, vouchersRoutes);
router.use('/booths', authenticateSession, boothsRoutes);
router.use('/user-tracking', authenticateSession, userTrackingRoutes);
router.use('/wish-tree', authenticateSession, wishTreeRoutes);

// 設定頁面
router.get('/settings', authenticateSession, (req, res) => {
    res.render('admin/settings', {
        layout: 'admin',
        pageTitle: '系統設定',
        currentPage: 'settings',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '系統設定' }
        ]
    });
});

// QR 掃描器頁面
router.get('/qr-scanner', authenticateSession, (req, res) => {
    res.render('admin/qr-scanner', {
        layout: 'admin',
        pageTitle: 'QR Code 掃描器',
        currentPage: 'qr-scanner',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '報到管理', url: '/admin/checkin-management' },
            { name: 'QR Code 掃描器' }
        ]
    });
});

// 參加者追蹤頁面
router.get('/trace-tracking', authenticateSession, (req, res) => {
    res.render('admin/trace-tracking', {
        layout: 'admin',
        pageTitle: '參加者追蹤',
        currentPage: 'trace-tracking',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '參加者追蹤' }
        ]
    });
});

module.exports = router;