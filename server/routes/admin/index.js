/**
 * 管理後台主路由
 */
const express = require('express');
const router = express.Router();
const { authenticateSession } = require('../../middleware/auth');
const { blockCheckinOperator, checkinOperatorGuard, isCheckinOperator, getAllowedProjects } = require('../../middleware/checkinOperator');
const ProjectService = require('../../services/project.service');

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
// P1-2: project-games.js 已刪除，改用 /api/admin/booths/:boothId/games
const boothsRoutes = require('./booths');
const gameAnalyticsRoutes = require('./game-analytics');
const wishTreeRoutes = require('./wish-tree');
const emailManagementRoutes = require('./email-management');

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
// 報到專員可存取的路由（不加 blockCheckinOperator）
router.use('/projects', authenticateSession, projectsRoutes);  // 由 projects.js 內部控制

// 報到專員被阻擋的路由
router.use('/dashboard', authenticateSession, blockCheckinOperator, dashboardRoutes);
// P1-2: project-games 路由已移除，改用 /api/admin/booths/:boothId/games
router.use('/templates', authenticateSession, blockCheckinOperator, templatesRoutes);
router.use('/users', authenticateSession, blockCheckinOperator, usersRoutes);
router.use('/submissions', authenticateSession, blockCheckinOperator, submissionsRoutes);
router.use('/checkin-management', authenticateSession, blockCheckinOperator, checkinRoutes);
router.use('/logs', authenticateSession, blockCheckinOperator, logsRoutes);
router.use('/questionnaire', authenticateSession, blockCheckinOperator, questionnaireRoutes);
router.use('/profile', authenticateSession, blockCheckinOperator, profileRoutes);
router.use('/games', authenticateSession, blockCheckinOperator, gamesRoutes);
router.use('/vouchers', authenticateSession, blockCheckinOperator, vouchersRoutes);
router.use('/booths', authenticateSession, blockCheckinOperator, boothsRoutes);
router.use('/game-analytics', authenticateSession, blockCheckinOperator, gameAnalyticsRoutes);
router.use('/wish-tree', authenticateSession, blockCheckinOperator, wishTreeRoutes);
router.use('/email-management', authenticateSession, blockCheckinOperator, emailManagementRoutes);

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

// QR 掃描器頁面（獨立視窗，無 sidebar）
// 報到專員需驗證 project_id 是否在允許列表中
router.get('/qr-scanner', authenticateSession, checkinOperatorGuard, async (req, res) => {
    const projectId = req.query.project_id || null;
    let projectName = null;

    // 查詢專案名稱
    if (projectId) {
        try {
            const project = await ProjectService.getProjectDetail(projectId);
            projectName = project?.project_name || null;
        } catch (e) {
            // 忽略錯誤，保持 projectName 為 null
        }
    }

    res.render('admin/qr-scanner-simple', {
        layout: false,
        pageTitle: projectName ? `${projectName} - QR 報到` : 'QR Code 掃描器',
        currentPage: 'qr-scanner',
        user: req.user,
        project_id: projectId,
        project_name: projectName,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '報到管理', url: '/admin/checkin-management' },
            { name: 'QR Code 掃描器' }
        ]
    });
});

// 參加者追蹤頁面
router.get('/trace-tracking', authenticateSession, async (req, res) => {
    try {
        // 動態載入專案列表 (ProjectService 是 singleton)
        const projects = await ProjectService.getAllForDropdown();

        res.render('admin/trace-tracking', {
            layout: 'admin',
            pageTitle: '參加者追蹤',
            currentPage: 'trace-tracking',
            user: req.user,
            projects,  // 傳遞專案列表給模板
            breadcrumbs: [
                { name: '儀表板', url: '/admin/dashboard' },
                { name: '參加者追蹤' }
            ]
        });
    } catch (error) {
        console.error('載入追蹤頁面失敗:', error);
        res.render('admin/trace-tracking', {
            layout: 'admin',
            pageTitle: '參加者追蹤',
            currentPage: 'trace-tracking',
            user: req.user,
            projects: [],
            breadcrumbs: [
                { name: '儀表板', url: '/admin/dashboard' },
                { name: '參加者追蹤' }
            ]
        });
    }
});

module.exports = router;