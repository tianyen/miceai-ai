/**
 * 管理後台 API 路由
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: 管理後台認證相關 API
 *   - name: Dashboard
 *     description: 儀表板統計資料 API
 *   - name: Projects
 *     description: 專案管理 API
 *   - name: Templates
 *     description: 模板管理 API
 *   - name: Users
 *     description: 使用者管理 API
 *   - name: Submissions
 *     description: 報名資料管理 API
 *   - name: Check-in
 *     description: 打卡簽到 API
 *   - name: Questionnaire
 *     description: 問卷管理 API
 *   - name: Logs
 *     description: 系統日誌 API
 */
const express = require('express');
const router = express.Router();
const { authenticateSession } = require('../../middleware/auth');

// 導入子路由
const businessCardsRouter = require('./admin/business-cards');

// 導入控制器
const dashboardController = require('../../controllers/dashboardController');
const projectController = require('../../controllers/projectController');
const templateController = require('../../controllers/templateController');
const userController = require('../../controllers/userController');
const submissionController = require('../../controllers/submissionController');
const checkinController = require('../../controllers/checkinController');
const questionnaireController = require('../../controllers/questionnaireController');

/**
 * @swagger
 * /api/admin/user/current:
 *   get:
 *     summary: 獲取當前登入使用者資訊
 *     description: 取得當前登入使用者的基本資訊
 *     tags: [Authentication]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: 使用者資訊獲取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: 未授權，需要登入
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "需要登入才能訪問此資源"
 */
// User current info API
router.get('/user/current', authenticateSession, (req, res) => {
    res.json({
        success: true,
        data: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role,
            email: req.user.email || null,
            created_at: req.user.created_at
        }
    });
});

/**
 * @swagger
 * /api/admin/dashboard/stats:
 *   get:
 *     summary: 獲取儀表板統計資料
 *     description: 取得系統的整體統計資訊，包含專案數量、報名人數等
 *     tags: [Dashboard]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: 統計資料獲取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalProjects:
 *                       type: integer
 *                       example: 15
 *                     activeProjects:
 *                       type: integer
 *                       example: 8
 *                     totalSubmissions:
 *                       type: integer
 *                       example: 256
 *                     pendingSubmissions:
 *                       type: integer
 *                       example: 45
 *                     totalUsers:
 *                       type: integer
 *                       example: 12
 *                     recentActivities:
 *                       type: integer
 *                       example: 23
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/dashboard/stats', authenticateSession, dashboardController.getStats);

/**
 * @swagger
 * /api/admin/dashboard/recent-projects:
 *   get:
 *     summary: 獲取最近專案
 *     description: 取得最近更新或建立的專案列表
 *     tags: [Dashboard]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: 最近專案獲取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/dashboard/recent-projects', authenticateSession, dashboardController.getRecentProjects);

/**
 * @swagger
 * /api/admin/dashboard/recent-activities:
 *   get:
 *     summary: 獲取最近活動
 *     description: 取得系統最近的活動記錄
 *     tags: [Dashboard]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: 最近活動獲取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       action:
 *                         type: string
 *                         example: "project_created"
 *                       user_name:
 *                         type: string
 *                         example: "管理員"
 *                       resource_type:
 *                         type: string
 *                         example: "project"
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-01T00:00:00.000Z"
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/dashboard/recent-activities', authenticateSession, dashboardController.getRecentActivities);

// Project APIs
router.get('/projects/search', authenticateSession, projectController.searchProjects);
router.get('/projects/pagination', authenticateSession, projectController.getProjectsPagination); // 專用分頁端點
router.get('/projects', authenticateSession, projectController.getProjects);
router.post('/projects', authenticateSession, projectController.createProject);
router.get('/projects/:id', authenticateSession, projectController.getProject);
// 專案複製與匯出
router.post('/projects/:id/duplicate', authenticateSession, projectController.duplicateProject);
router.get('/projects/:id/export', authenticateSession, projectController.exportProject);
router.put('/projects/:id', authenticateSession, projectController.updateProject);
router.delete('/projects/:id', authenticateSession, projectController.deleteProject);

// Template APIs - 更具體的路由必須在更通用的路由之前
router.get('/templates/search', authenticateSession, templateController.searchTemplates);
router.get('/templates/pagination', authenticateSession, templateController.getTemplatesPagination); // 分頁端點
router.post('/templates/:id/duplicate', authenticateSession, templateController.duplicateTemplate);
router.patch('/templates/:id/toggle-status', authenticateSession, templateController.setDefaultTemplate);
// 模板匯出（占位）
router.get('/templates/:id/export', authenticateSession, (req, res) => {
    return responses.badRequest(res, '匯出模板功能尚未實現');
});
router.get('/templates', authenticateSession, templateController.getTemplates);
router.post('/templates', authenticateSession, templateController.createTemplate);
router.get('/templates/:id', authenticateSession, templateController.getTemplate);
router.put('/templates/:id', authenticateSession, templateController.updateTemplate);
router.delete('/templates/:id', authenticateSession, templateController.deleteTemplate);

// User APIs - 更具體的路由必須在更通用的路由之前
router.get('/users/stats', authenticateSession, userController.getUserStats);
router.get('/users/search', authenticateSession, userController.searchUsers);
router.get('/users/pagination', authenticateSession, userController.getUsersPagination); // 專用分頁端點
router.post('/users/import', authenticateSession, userController.importUsers);
router.get('/users', authenticateSession, userController.getUsers);
router.post('/users', authenticateSession, userController.createUser);
router.get('/users/:id', authenticateSession, userController.getUser);
router.put('/users/:id', authenticateSession, userController.updateUser);
router.delete('/users/:id', authenticateSession, userController.deleteUser);
router.patch('/users/:id/status', authenticateSession, userController.updateUserStatus);

// Submission APIs - 更具體的路由必須在更通用的路由之前
router.get('/submissions/stats', authenticateSession, submissionController.getSubmissionStats);
router.get('/submissions/search', authenticateSession, submissionController.searchSubmissions);
router.get('/submissions/pagination', authenticateSession, submissionController.getSubmissionsPagination); // 分頁端點
router.get('/submissions/export', authenticateSession, submissionController.exportSubmissions);
// 便捷狀態更新端點
router.patch('/submissions/:id/confirm', authenticateSession, (req, res) => {
    req.body = { ...(req.body || {}), status: 'confirmed' };
    return submissionController.updateSubmissionStatus(req, res);
});
router.patch('/submissions/:id/cancel', authenticateSession, (req, res) => {
    req.body = { ...(req.body || {}), status: 'cancelled' };
    return submissionController.updateSubmissionStatus(req, res);
});
// 發送確認郵件（占位實作）
router.post('/submissions/:id/send-confirmation', authenticateSession, (req, res) => {
    return responses.success(res, null, '確認郵件已排程發送');
});
router.get('/submissions', authenticateSession, submissionController.getSubmissions);
router.get('/submissions/:id', authenticateSession, submissionController.getSubmission);
router.put('/submissions/:id', authenticateSession, submissionController.updateSubmission);
router.delete('/submissions/:id', authenticateSession, submissionController.deleteSubmission);

// Check-in APIs
router.get('/checkin/stats', authenticateSession, checkinController.getCheckinStats);
router.get('/checkin/participants', authenticateSession, checkinController.getParticipants);
router.get('/checkin/pagination', authenticateSession, checkinController.getParticipantsPagination);
router.post('/checkin/:id/checkin', authenticateSession, checkinController.manualCheckin);
router.post('/checkin/:id/cancel', authenticateSession, checkinController.cancelCheckin);
router.get('/checkin/export', authenticateSession, checkinController.exportCheckinData);

// Questionnaire APIs - 更具體的路由必須在更通用的路由之前
router.get('/questionnaire/qr-codes', authenticateSession, questionnaireController.getQuestionnaireQRCodes);
router.post('/questionnaire', authenticateSession, questionnaireController.createQuestionnaire);
router.get('/questionnaire/:id', authenticateSession, questionnaireController.getQuestionnaire);
router.put('/questionnaire/:id', authenticateSession, questionnaireController.updateQuestionnaire);
router.delete('/questionnaire/:id', authenticateSession, questionnaireController.deleteQuestionnaire);
router.post('/questionnaire/:id/duplicate', authenticateSession, questionnaireController.duplicateQuestionnaire);
router.patch('/questionnaire/:id/status', authenticateSession, questionnaireController.toggleQuestionnaireStatus);

// Logs APIs - 使用 Repository 層
const logRepository = require('../../repositories/log.repository');

router.get('/logs', authenticateSession, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        // 使用 Repository 取得日誌
        const logs = await logRepository.getLogsWithUser({ page, limit });

        // 檢查是否為 HTML 請求
        if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.query.format === 'html') {
            let html = '';

            if (logs.length === 0) {
                html = `
                    <tr>
                        <td colspan="6" class="empty-state">
                            <div class="empty-icon">📋</div>
                            <div class="empty-text">
                                <h4>尚無日誌記錄</h4>
                                <p>系統日誌將在這裡顯示</p>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                logs.forEach(log => {
                    const createdAt = new Date(log.created_at).toLocaleString('zh-TW');
                    html += `
                        <tr>
                            <td>${log.id}</td>
                            <td>${log.action || '-'}</td>
                            <td>${log.user_name || '系統'}</td>
                            <td>${log.resource_type || '-'}</td>
                            <td>${createdAt}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-info" onclick="viewLogDetails(${log.id})" title="查看詳情">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
            }

            res.send(html);
        } else {
            res.json({
                success: true,
                data: logs
            });
        }

    } catch (error) {
        console.error('獲取日誌失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取日誌失敗'
        });
    }
});

// 日誌分頁 API
router.get('/logs/pagination', authenticateSession, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        // 使用 Repository 取得總數
        const total = await logRepository.count();
        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: {
                total,
                pages,
                current_page: page,
                per_page: limit
            }
        });
    } catch (error) {
        console.error('獲取日誌分頁失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取日誌分頁失敗'
        });
    }
});

// 日誌搜尋 API
router.get('/logs/search', authenticateSession, async (req, res) => {
    try {
        const { search, level, action, 'date-filter': dateFilter } = req.query;

        // 使用 Repository 進行搜尋（支援 action 篩選）
        const logs = await logRepository.search({ search, level, action, dateFilter, limit: 100 });

        // 使用 logService 格式化日誌
        const { logService } = require('../../services');
        const formattedLogs = logService.formatLogs(logs);

        // 使用 viewHelpers 生成 HTML
        const vh = require('../../utils/viewHelpers');
        const html = formattedLogs.length === 0
            ? vh.emptyTableRow('無符合條件的日誌', 7)
            : formattedLogs.map(log => vh.logTableRow(log)).join('');

        res.send(html);
    } catch (error) {
        console.error('搜尋日誌失敗:', error);
        const vh = require('../../utils/viewHelpers');
        res.status(500).send(vh.errorTableRow('搜尋失敗', 7));
    }
});

// 日誌匯出 API
router.get('/logs/export', authenticateSession, async (req, res) => {
    try {
        const { dateFrom, dateTo, action } = req.query;

        const logs = await logRepository.exportLogs({
            dateFrom, dateTo, action
        });

        // 生成 CSV
        const headers = ['ID', '動作', '目標類型', '目標ID', 'IP位址', '使用者', 'Email', '時間', '詳情'];
        const csvRows = [headers.join(',')];

        logs.forEach(log => {
            const details = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '';
            const row = [
                log.id,
                `"${(log.action || '').replace(/"/g, '""')}"`,
                `"${(log.target_type || '').replace(/"/g, '""')}"`,
                log.target_id || '',
                log.ip_address || '',
                `"${(log.user_name || '系統').replace(/"/g, '""')}"`,
                log.user_email || '',
                log.created_at || '',
                `"${details}"`
            ];
            csvRows.push(row.join(','));
        });

        const csv = '\uFEFF' + csvRows.join('\n'); // BOM for Excel UTF-8
        const filename = `logs_export_${new Date().toISOString().slice(0, 10)}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (error) {
        console.error('匯出日誌失敗:', error);
        res.status(500).json({
            success: false,
            message: '匯出日誌失敗'
        });
    }
});

// 掛載子路由
router.use('/business-cards', authenticateSession, businessCardsRouter);

module.exports = router;