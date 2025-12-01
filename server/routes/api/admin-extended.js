/**
 * 管理後台擴展 API 路由
 * 包含原始 server.js 中的特殊 API 端點
 *
 * @refactor 2025-12-01: 開始使用 Service 層
 * @refactor 2025-12-01: 使用 viewHelpers 分離 HTML 生成
 * @see @refactor/ARCHITECTURE.md
 */
const express = require('express');
const router = express.Router();
const { authenticateSession } = require('../../middleware/auth');
const database = require('../../config/database');
const responses = require('../../utils/responses');

// Services - 3-Tier Architecture Business Logic Layer
const {
    checkinService,
    projectService,
    qrCodeService,
    profileService,
    logService,
    submissionService,
    questionnaireService
} = require('../../services');

// View Helpers - HTML Generation Layer
const vh = require('../../utils/viewHelpers');

// 項目分頁 API
// @refactor: 使用 projectService + viewHelpers
router.get('/projects/pagination', authenticateSession, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const pagination = await projectService.getPagination(page, limit);

        const paginationHtml = vh.pagination({
            ...pagination,
            loadFunction: 'loadProjectsPage',
            itemName: '專案'
        });

        responses.html(res, paginationHtml);
    } catch (error) {
        console.error('Get projects pagination error:', error);
        responses.html(res, vh.alert('載入分頁失敗', 'danger'));
    }
});

// 項目搜尋 API
// @refactor: 使用 projectService + viewHelpers
router.get('/projects/search', authenticateSession, async (req, res) => {
    try {
        const { search, status } = req.query;
        const projects = await projectService.search({ search, status, limit: 50 });

        const html = projects.length === 0
            ? vh.emptyTableRow('無符合條件的專案', 8)
            : projects.map(p => vh.projectTableRow(p)).join('');

        responses.html(res, html);
    } catch (error) {
        console.error('Search projects error:', error);
        responses.html(res, vh.errorTableRow('搜尋失敗', 8));
    }
});

// 表單提交搜尋 API
// @refactor: 使用 submissionService + viewHelpers
router.get('/submissions/search', authenticateSession, async (req, res) => {
    try {
        const { search, 'project-filter': projectFilter, 'status-filter': statusFilter } = req.query;
        const submissions = await submissionService.search({
            search, projectId: projectFilter, status: statusFilter, limit: 50
        });

        const html = submissions.length === 0
            ? vh.emptyTableRow('無符合條件的表單提交記錄', 9)
            : submissions.map(s => vh.submissionTableRow(s)).join('');

        responses.html(res, html);
    } catch (error) {
        console.error('Search submissions error:', error);
        responses.html(res, vh.errorTableRow('搜尋失敗', 9));
    }
});

// 報到搜尋 API
// @refactor: 使用 checkinService + viewHelpers
router.get('/checkin/search', authenticateSession, async (req, res) => {
    try {
        const { search } = req.query;
        const participants = await checkinService.searchParticipants({ search, limit: 50 });

        const html = participants.length === 0
            ? vh.emptyTableRow('無符合條件的參與者', 7)
            : participants.map(p => vh.participantCheckinRow(p)).join('');

        responses.html(res, html);
    } catch (error) {
        console.error('Search participants error:', error);
        responses.html(res, vh.errorTableRow('搜尋失敗', 7));
    }
});

// 日誌統計 API - 必須在通用 /logs 路由之前
// @refactor: 使用 logService
router.get('/logs/stats', authenticateSession, async (req, res) => {
    try {
        const stats = await logService.getStats();
        responses.success(res, stats);
    } catch (error) {
        console.error('Get logs stats error:', error);
        responses.error(res, 'Failed to get logs stats', 500);
    }
});

// 系統日誌 API
// @refactor: 使用 logService + viewHelpers
router.get('/logs', authenticateSession, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const logs = await logService.getLogs({ page, limit });
        const formattedLogs = logService.formatLogs(logs);

        const html = formattedLogs.length === 0
            ? vh.emptyTableRow('暫無日誌記錄', 7)
            : formattedLogs.map(log => vh.logTableRow(log)).join('');

        responses.html(res, html);
    } catch (error) {
        console.error('Get logs error:', error);
        responses.html(res, vh.errorTableRow('載入日誌失敗', 7));
    }
});

// 日誌統計 API 已移至前面，避免與 /logs 路由衝突

// 用戶統計 API 已移至 admin.js 中的 userController.getUserStats

// 重設用戶密碼 API
// @refactor: 使用 profileService
router.post('/users/:id/reset-password', authenticateSession, async (req, res) => {
    try {
        const result = await profileService.resetPassword(parseInt(req.params.id));
        responses.success(res, result);
    } catch (error) {
        console.error('Reset password error:', error);
        responses.error(res, '重設密碼失敗', 500);
    }
});

// 更新表單提交記錄 API
// @refactor: 使用 submissionService
router.put('/submissions/:id', authenticateSession, async (req, res) => {
    try {
        const result = await submissionService.update(req.params.id, req.body);
        responses.success(res, result);
    } catch (error) {
        if (error.statusCode) {
            return responses.error(res, error.message, error.statusCode);
        }
        console.error('更新提交記錄失敗:', error);
        responses.error(res, '更新提交記錄失敗', 500);
    }
});

// 表單提交分頁 API
// @refactor: 使用 submissionService + viewHelpers
router.get('/submissions/pagination', authenticateSession, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const pagination = await submissionService.getPagination(page, limit);

        const html = vh.pagination({
            ...pagination,
            loadFunction: 'loadSubmissionsPage',
            itemName: '筆提交'
        });

        responses.html(res, html);
    } catch (error) {
        console.error('Submissions pagination error:', error);
        responses.html(res, vh.alert('載入分頁失敗', 'danger'));
    }
});

// Profile API 端點
// @refactor: 使用 profileService
router.put('/profile/basic', authenticateSession, async (req, res) => {
    try {
        const result = await profileService.updateBasicInfo(req.user.id, req.body);
        responses.success(res, null, result.message);
    } catch (error) {
        if (error.statusCode) {
            return responses.error(res, error.message, error.statusCode);
        }
        console.error('Update profile basic error:', error);
        responses.error(res, '更新基本資訊失敗', 500);
    }
});

// @refactor: 使用 profileService
router.put('/profile/password', authenticateSession, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        const result = await profileService.updatePassword(req.user.id, current_password, new_password);
        responses.success(res, null, result.message);
    } catch (error) {
        if (error.statusCode) {
            return responses.error(res, error.message, error.statusCode);
        }
        console.error('Update password error:', error);
        responses.error(res, '更新密碼失敗', 500);
    }
});

// 獲取用戶偏好設定
// @refactor: 使用 profileService
router.get('/profile/preferences', authenticateSession, async (req, res) => {
    try {
        const preferences = await profileService.getPreferences(req.user.id);
        responses.success(res, preferences);
    } catch (error) {
        console.error('Get preferences error:', error);
        responses.error(res, '獲取偏好設定失敗', 500);
    }
});

// 更新用戶偏好設定
// @refactor: 使用 profileService
router.put('/profile/preferences', authenticateSession, async (req, res) => {
    try {
        const result = await profileService.updatePreferences(req.user.id, req.body);
        responses.success(res, null, result.message);
    } catch (error) {
        console.error('Update preferences error:', error);
        responses.error(res, '更新偏好設定失敗', 500);
    }
});

// @refactor: 使用 profileService + viewHelpers
router.get('/profile/login-history', authenticateSession, async (req, res) => {
    try {
        const history = await profileService.getLoginHistory(req.user.id, 10);
        const html = vh.loginHistoryList(history);
        responses.success(res, html);
    } catch (error) {
        console.error('Get login history error:', error);
        responses.error(res, '載入登入記錄失敗', 500);
    }
});

// 問卷統計 API
// @refactor: 使用 questionnaireService + viewHelpers
router.get('/questionnaire/stats', authenticateSession, async (req, res) => {
    try {
        const { questionnaire_id } = req.query;
        let html = '<div class="stats-container">';

        if (!questionnaire_id) {
            const overview = await questionnaireService.getOverviewStats();
            html += vh.questionnaireOverviewStats(overview);
        } else {
            const stats = await questionnaireService.getQuestionnaireStats(questionnaire_id);
            html += stats ? vh.questionnaireStatsDetail(stats) : vh.alert('問卷不存在', 'warning');
        }

        html += '</div>';
        responses.html(res, html);
    } catch (error) {
        console.error('Get questionnaire stats error:', error);
        responses.html(res, vh.alert('載入統計失敗', 'danger'));
    }
});

// 問卷匯出 API
// @refactor: 使用 questionnaireService
router.get('/questionnaire/:id/export', authenticateSession, async (req, res) => {
    try {
        const exportData = await questionnaireService.exportResponses(req.params.id);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${exportData.fileName}"`);
        res.send('\uFEFF' + exportData.csvContent); // BOM for Chinese support
    } catch (error) {
        if (error.statusCode) {
            return responses.error(res, error.message, error.statusCode);
        }
        console.error('Export questionnaire error:', error);
        responses.error(res, '匯出失敗', 500);
    }
});

// 問卷 QR Code 列表 API
// @refactor: 使用 questionnaireService + viewHelpers
router.get('/questionnaire/qr-codes', authenticateSession, async (req, res) => {
    try {
        const { questionnaire_id } = req.query;
        let html = '<div class="qr-codes-container">';

        if (!questionnaire_id) {
            html += vh.emptyState('請選擇問卷查看 QR Code');
        } else {
            const questionnaire = await questionnaireService.getById(questionnaire_id);
            if (!questionnaire) {
                html += vh.alert('問卷不存在', 'warning');
            } else {
                const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
                html += vh.questionnaireQrCodeSection(questionnaire, baseUrl);
            }
        }

        html += '</div>';
        responses.html(res, html);
    } catch (error) {
        console.error('Get QR codes error:', error);
        responses.html(res, vh.alert('載入 QR Code 失敗', 'danger'));
    }
});

// QR Code 下載 API
// @refactor: 使用 questionnaireService
router.get('/questionnaire/:id/qr-download', authenticateSession, async (req, res) => {
    try {
        const questionnaireId = req.params.id;
        const { type } = req.query;
        const QRCode = require('qrcode');

        // 獲取問卷資訊
        const questionnaire = await database.get('SELECT * FROM questionnaires WHERE id = ?', [questionnaireId]);

        if (!questionnaire) {
            return responses.error(res, '問卷不存在', 404);
        }

        // 生成問卷 URL
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const questionnaireUrl = `${baseUrl}/questionnaire/${questionnaireId}`;

        // 生成 QR Code 圖片
        const qrImageBuffer = await QRCode.toBuffer(questionnaireUrl, {
            type: 'png',
            width: 400,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // 設置響應頭
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="questionnaire-${questionnaireId}-qr.png"`);
        res.send(qrImageBuffer);
    } catch (error) {
        console.error('Download QR code error:', error);
        responses.error(res, 'QR Code 下載失敗', 500);
    }
});

// QR Code 生成 API
// @refactor: 暫未實作完整邏輯，保留原有代碼
router.post('/questionnaire-qr/generate', authenticateSession, async (req, res) => {
    try {
        const { questionnaire_id, type } = req.body;

        // 這裡應該實現 QR Code 生成邏輯
        // 暫時返回成功響應
        responses.success(res, {
            message: 'QR Code 生成成功',
            questionnaire_id,
            type
        });
    } catch (error) {
        console.error('Generate QR code error:', error);
        responses.error(res, 'QR Code 生成失敗', 500);
    }
});

// QR Scanner APIs
// QR Scanner 報到 API
// @refactor: 使用 checkinService - 大幅簡化！
router.post('/qr-scanner/checkin', authenticateSession, async (req, res) => {
    try {
        const { qrData } = req.body;

        if (!qrData) {
            return responses.error(res, 'QR Code 數據不能為空', 400);
        }

        const result = await checkinService.qrScannerCheckin(qrData, req.user.id, req.ip);

        responses.success(res, {
            message: `${result.participant.name} 報到成功`,
            participant: {
                id: result.participant.id,
                name: result.participant.name,
                email: result.participant.email,
                checkinTime: result.checkinTime
            }
        });
    } catch (error) {
        if (error.statusCode) {
            return responses.error(res, error.message, error.statusCode);
        }
        console.error('QR Scanner checkin error:', error);
        responses.error(res, '報到處理失敗', 500);
    }
});

// QR Scanner 今日統計 API
// @refactor: 使用 checkinService + viewHelpers
router.get('/qr-scanner/today-stats', authenticateSession, async (req, res) => {
    try {
        const stats = await checkinService.getTodayStats();
        responses.html(res, vh.todayStatsGrid(stats));
    } catch (error) {
        console.error('Get today stats error:', error);
        responses.html(res, vh.alert('載入統計失敗', 'danger'));
    }
});

// QR Scanner 掃描歷史 API
// @refactor: 使用 checkinService + viewHelpers
router.get('/qr-scanner/history', authenticateSession, async (req, res) => {
    try {
        const recentScans = await checkinService.getScanHistory(10);
        responses.html(res, vh.scanHistoryList(recentScans));
    } catch (error) {
        console.error('Get scan history error:', error);
        responses.html(res, vh.alert('載入掃描記錄失敗', 'danger'));
    }
});

// QR Code 生成 API for Participants
// @refactor: 使用 qrCodeService
router.post('/participants/:id/generate-qr', authenticateSession, async (req, res) => {
    try {
        const result = await qrCodeService.generateForParticipant(req.params.id);
        responses.success(res, result);
    } catch (error) {
        if (error.statusCode) {
            return responses.error(res, error.message, error.statusCode);
        }
        console.error('Generate QR code error:', error);
        responses.error(res, 'QR Code 生成失敗', 500);
    }
});

// QR Code 顯示 API
// @refactor: 使用 qrCodeService + viewHelpers
router.get('/participants/:id/qr-code', authenticateSession, async (req, res) => {
    try {
        const participantId = req.params.id;
        const qrInfo = await qrCodeService.getParticipantQrCode(participantId);

        if (!qrInfo) {
            return responses.error(res, '找不到參與者記錄', 404);
        }

        const html = vh.participantQrCodeModal(qrInfo.participant, qrInfo.qrCode, participantId);
        responses.html(res, html);
    } catch (error) {
        console.error('Get QR code error:', error);
        responses.html(res, vh.alert('載入 QR Code 失敗', 'danger'));
    }
});

// QR Code 下載 API
// @refactor: 使用 qrCodeService
router.get('/participants/:id/qr-download', authenticateSession, async (req, res) => {
    try {
        const participantId = req.params.id;
        const qrInfo = await qrCodeService.getParticipantQrCode(participantId);

        if (!qrInfo) {
            return responses.error(res, '找不到參與者記錄', 404);
        }

        if (!qrInfo.qrCode.hasQrCode) {
            return responses.error(res, '尚未生成 QR Code', 400);
        }

        responses.success(res, {
            message: 'QR Code 數據',
            participantName: qrInfo.participant.name,
            qrData: qrInfo.qrCode.data,
            downloadUrl: `/api/admin/participants/${participantId}/qr-image`
        });
    } catch (error) {
        console.error('Download QR code error:', error);
        responses.error(res, 'QR Code 下載失敗', 500);
    }
});

// QR Code 圖片生成 API (使用 qrcode 庫)
// @refactor: 使用 qrCodeService
router.get('/participants/:id/qr-image', authenticateSession, async (req, res) => {
    try {
        const qrImageData = await qrCodeService.getQrImageData(req.params.id);
        const QRCode = require('qrcode');

        const qrImageBuffer = await QRCode.toBuffer(qrImageData.qrData, {
            type: 'png',
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="${qrImageData.fileName}"`);
        res.send(qrImageBuffer);
    } catch (error) {
        if (error.statusCode) {
            return responses.error(res, error.message, error.statusCode);
        }
        console.error('Generate QR image error:', error);
        responses.error(res, 'QR Code 圖片生成失敗', 500);
    }
});

// 手動簽到 API
// @refactor: 使用 checkinService
router.post('/participants/:id/checkin', authenticateSession, async (req, res) => {
    try {
        const result = await checkinService.manualCheckin(
            req.params.id,
            req.body.project_id,
            req.user,
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
        );
        responses.success(res, null, '簽到成功');
    } catch (error) {
        if (error.statusCode) {
            return responses.error(res, error.message, error.statusCode);
        }
        console.error('手動簽到失敗:', error);
        responses.error(res, '簽到失敗', 500);
    }
});

// 取消簽到 API
// @refactor: 使用 checkinService
router.post('/participants/:id/cancel-checkin', authenticateSession, async (req, res) => {
    try {
        const result = await checkinService.cancelCheckin(
            req.params.id,
            req.user,
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
        );
        responses.success(res, null, result.message);
    } catch (error) {
        if (error.statusCode) {
            return responses.error(res, error.message, error.statusCode);
        }
        console.error('取消簽到失敗:', error);
        responses.error(res, '取消簽到失敗', 500);
    }
});

// 批量簽到 API
// @refactor: 使用 checkinService
router.post('/projects/:id/bulk-checkin', authenticateSession, async (req, res) => {
    try {
        const result = await checkinService.bulkCheckin(
            req.params.id,
            req.user,
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
        );
        responses.success(res, { count: result.count }, result.message);
    } catch (error) {
        console.error('批量簽到失敗:', error);
        responses.error(res, '批量簽到失敗', 500);
    }
});

// API: 獲取專案統計
// @refactor: 使用 projectService
router.get('/projects/:id/stats', authenticateSession, async (req, res) => {
    try {
        const stats = await projectService.getStats(req.params.id);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('獲取專案統計失敗:', error);
        res.status(500).json({ success: false, message: '獲取專案統計失敗' });
    }
});

// API: 獲取專案參加者列表 (HTML)
// @refactor: 使用 projectService + viewHelpers
router.get('/projects/:id/participants', authenticateSession, async (req, res) => {
    try {
        const participants = await projectService.getParticipants(req.params.id);
        const html = participants.length === 0
            ? vh.emptyTableRow('暫無參加者資料', 7)
            : participants.map(p => vh.projectParticipantRow(p)).join('');
        res.send(html);
    } catch (error) {
        console.error('獲取專案參加者失敗:', error);
        res.send(vh.errorTableRow('載入失敗', 7));
    }
});

// API: 獲取專案問卷狀況 (HTML)
// @refactor: 使用 projectService + viewHelpers
router.get('/projects/:id/questionnaires', authenticateSession, async (req, res) => {
    try {
        const questionnaires = await projectService.getQuestionnaires(req.params.id);

        let html = '<div class="questionnaires-list">';
        if (questionnaires.length === 0) {
            html += '<div class="text-center text-muted py-4">此專案尚未建立問卷</div>';
        } else {
            html += questionnaires.map(q => vh.questionnaireItem(q)).join('');
        }
        html += '</div>';

        res.send(html);
    } catch (error) {
        console.error('獲取專案問卷失敗:', error);
        res.send(vh.alert('載入問卷資料失敗', 'danger'));
    }
});

// API: 獲取專案簽到統計 (HTML)
// @refactor: 使用 checkinService + viewHelpers
router.get('/projects/:id/checkin-stats', authenticateSession, async (req, res) => {
    try {
        const stats = await checkinService.getProjectCheckinStats(req.params.id);
        res.send(vh.checkinStatsGrid(stats));
    } catch (error) {
        console.error('獲取簽到統計失敗:', error);
        res.send(vh.alert('載入簽到統計失敗', 'danger'));
    }
});

// API: 獲取專案簽到記錄 (HTML)
// @refactor: 使用 checkinService + viewHelpers
router.get('/projects/:id/checkin-records', authenticateSession, async (req, res) => {
    try {
        const records = await checkinService.getProjectCheckinRecords(req.params.id, 50);

        let html = '<div class="checkin-records">';
        if (records.length === 0) {
            html += '<div class="text-center text-muted py-4">暫無簽到記錄</div>';
        } else {
            html += '<div class="table-responsive"><table class="table table-sm">';
            html += '<thead><tr><th>參加者</th><th>簽到時間</th><th>簽到方式</th><th>操作</th></tr></thead><tbody>';
            html += records.map(r => vh.checkinRecordRow(r)).join('');
            html += '</tbody></table></div>';
        }
        html += '</div>';

        res.send(html);
    } catch (error) {
        console.error('獲取簽到記錄失敗:', error);
        res.send(vh.alert('載入簽到記錄失敗', 'danger'));
    }
});

// API: 參加者追蹤搜尋 (HTML)
// @refactor: 使用 projectService + viewHelpers
router.get('/projects/:id/tracking', authenticateSession, async (req, res) => {
    try {
        const searchTerm = req.query.search;

        if (!searchTerm) {
            return res.send(vh.alert('請輸入搜尋條件', 'warning'));
        }

        const result = await projectService.searchParticipantTracking(req.params.id, searchTerm);

        if (!result) {
            return res.send(vh.alert('未找到匹配的參加者', 'info'));
        }

        res.send(vh.trackingResult(result.participant, result.interactions));
    } catch (error) {
        console.error('搜尋參加者追蹤失敗:', error);
        res.send(vh.alert('搜尋失敗', 'danger'));
    }
});

module.exports = router;