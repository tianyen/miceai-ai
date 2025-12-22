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

        // 使用 Service 獲取問卷資訊
        const questionnaire = await questionnaireService.getById(questionnaireId);

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
                checkinTime: result.checkinTime,
                // Phase 2: 新增欄位 - 報到成功後顯示完整資訊
                phone: result.participant.phone,
                company: result.participant.company,
                children_count: result.participant.children_count,
                children_ages: result.participant.children_ages,
                notes: result.participant.notes,
                adult_age: result.participant.adult_age,
                // Phase 3: 性別和小孩標識
                gender: result.participant.gender,
                is_child: result.participant.is_child
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

// 手動新增參加者 API（支援主報名人和附屬報名人）
router.post('/projects/:projectId/participants', authenticateSession, async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId);
        const {
            name, email, phone, company, position, gender, notes,
            children_ages, participation_level,
            // 附屬報名人欄位
            parent_submission_id, is_minor
        } = req.body;

        // 驗證必填欄位
        if (!name || !name.trim()) {
            return responses.badRequest(res, '姓名不可為空');
        }

        const submissionRepository = require('../../repositories/submission.repository');
        let finalEmail = email;
        let finalPhone = phone;
        let groupId = null;
        let isPrimary = true;

        // 處理附屬報名人邏輯
        if (parent_submission_id) {
            // 查詢主報名人
            const parent = await submissionRepository.findById(parent_submission_id);
            if (!parent) {
                return responses.badRequest(res, '找不到主報名人');
            }

            // 使用主報名人的 group_id，若無則生成新的
            groupId = parent.group_id || `GRP-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;
            isPrimary = false;

            // 若主報名人尚無 group_id，更新之
            if (!parent.group_id) {
                await submissionRepository.update(parent_submission_id, {
                    group_id: groupId,
                    is_primary: 1
                });
            }

            // 未成年或未填寫 email/phone 時繼承主報名人
            if (is_minor || !email || !email.trim()) {
                finalEmail = parent.submitter_email;
            }
            if (is_minor || !phone || !phone.trim()) {
                finalPhone = parent.submitter_phone;
            }
        } else {
            // 主報名人必須有 email
            if (!email || !email.trim()) {
                return responses.badRequest(res, '電子郵件不可為空');
            }
        }

        // 生成 trace_id 和 pass_code
        const traceId = `MICE-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 8)}`;
        const passCode = Math.random().toString().substr(2, 6);

        // 計算 children_count
        const ages = children_ages || {};
        const childrenCount = (parseInt(ages.age_0_6) || 0) + (parseInt(ages.age_6_12) || 0) + (parseInt(ages.age_12_18) || 0);

        // 建立參加者
        const result = await submissionRepository.createRegistration({
            traceId,
            projectId,
            name: name.trim(),
            email: (finalEmail || '').trim(),
            phone: finalPhone || '',
            company: company || '',
            position: position || '',
            gender: gender || null,
            notes: notes || null,
            childrenCount,
            childrenAges: ages,
            passCode,
            dataConsent: true,
            marketingConsent: false,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            // 團體報名欄位
            groupId: groupId,
            isPrimary: isPrimary ? 1 : 0,
            parentSubmissionId: parent_submission_id || null
        });

        // 自動生成 QR Code
        try {
            await qrCodeService.generateForParticipant(result.lastID);
        } catch (qrError) {
            console.warn('QR Code 生成失敗，但參加者已建立:', qrError.message);
        }

        // 記錄操作日誌
        const { logUserActivity } = require('../../middleware/auth');
        const logDetails = { name: name.trim(), email: finalEmail, projectId };
        if (parent_submission_id) {
            logDetails.parentSubmissionId = parent_submission_id;
            logDetails.isDependent = true;
        }
        await logUserActivity(
            req.user.id,
            'create_participant',
            'participant',
            result.lastID,
            logDetails,
            req.ip
        );

        responses.success(res, {
            id: result.lastID,
            traceId,
            passCode,
            groupId
        }, parent_submission_id ? '附屬報名人已新增' : '參加者已新增');
    } catch (error) {
        console.error('新增參加者失敗:', error);
        responses.error(res, '新增參加者失敗', 500);
    }
});

// 更新參加者資料 API
router.put('/participants/:id', authenticateSession, async (req, res) => {
    try {
        const participantId = req.params.id;
        const updateData = req.body;

        // 允許更新的欄位
        const allowedFields = [
            'submitter_name', 'submitter_email', 'submitter_phone',
            'company_name', 'position', 'gender',
            'participation_level', 'children_count', 'children_ages', 'notes'
        ];

        // 過濾只允許的欄位
        const filteredData = {};
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                filteredData[field] = updateData[field];
            }
        }

        if (Object.keys(filteredData).length === 0) {
            return responses.badRequest(res, '沒有提供要更新的資料');
        }

        // 驗證必填欄位
        if (filteredData.submitter_name !== undefined && !filteredData.submitter_name.trim()) {
            return responses.badRequest(res, '姓名不可為空');
        }

        // 使用 repository 更新
        const submissionRepo = require('../../repositories/submission.repository');
        const result = await submissionRepo.update(participantId, filteredData);

        if (result.changes === 0) {
            return responses.notFound(res, '找不到該參加者');
        }

        // 記錄操作日誌
        const { logUserActivity } = require('../../middleware/auth');
        await logUserActivity(
            req.user.id,
            'update_participant',
            'participant',
            participantId,
            { updatedFields: Object.keys(filteredData) },
            req.ip
        );

        responses.success(res, null, '參加者資料已更新');
    } catch (error) {
        console.error('更新參加者失敗:', error);
        responses.error(res, '更新參加者失敗', 500);
    }
});

// 刪除參加者 API
router.delete('/participants/:id', authenticateSession, async (req, res) => {
    try {
        const participantId = req.params.id;

        // 取得參加者資訊（用於記錄）
        const submissionRepo = require('../../repositories/submission.repository');
        const participant = await submissionRepo.findById(participantId);

        if (!participant) {
            return responses.notFound(res, '找不到該參加者');
        }

        // 使用 repository 刪除參加者及所有相關資料
        // (QR Code、簽到紀錄、問卷回答、互動紀錄、掃描歷史)
        await submissionRepo.deleteWithRelated(participantId);

        // 記錄操作日誌
        const { logUserActivity } = require('../../middleware/auth');
        await logUserActivity(
            req.user.id,
            'delete_participant',
            'participant',
            participantId,
            {
                participantName: participant.submitter_name,
                participantEmail: participant.submitter_email,
                projectId: participant.project_id
            },
            req.ip
        );

        responses.success(res, null, '參加者已刪除');
    } catch (error) {
        console.error('刪除參加者失敗:', error);
        responses.error(res, `刪除參加者失敗: ${error.message}`, 500);
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

// API: 獲取專案參加者列表 (JSON，支援分頁和排序)
// @refactor: 使用 projectService + viewHelpers
router.get('/projects/:id/participants', authenticateSession, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const sort = req.query.sort || 'id';
        const order = req.query.order || 'desc';

        const result = await projectService.getParticipants(req.params.id, { page, limit, search, sort, order });
        const { participants, pagination } = result;

        // 生成表格 HTML
        const tableHtml = participants.length === 0
            ? vh.emptyTableRow('暫無參加者資料', 8)
            : participants.map(p => vh.projectParticipantRow(p)).join('');

        // 生成分頁 HTML
        let paginationHtml = '';
        if (pagination.totalPages > 1) {
            paginationHtml = `
                <div class="pagination-wrapper" style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem; background: #f8f9fa; border-radius: 4px;">
                    <div class="pagination-info">
                        共 <strong>${pagination.total}</strong> 筆，第 ${pagination.page} / ${pagination.totalPages} 頁
                    </div>
                    <div class="pagination-buttons" style="display: flex; gap: 0.5rem;">
                        ${pagination.hasPrev ? `<button class="btn btn-sm btn-outline-primary" onclick="loadParticipants(${page - 1})">上一頁</button>` : ''}
                        ${pagination.hasNext ? `<button class="btn btn-sm btn-outline-primary" onclick="loadParticipants(${page + 1})">下一頁</button>` : ''}
                    </div>
                </div>
            `;
        }

        res.json({
            success: true,
            tableHtml,
            paginationHtml,
            pagination
        });
    } catch (error) {
        console.error('獲取專案參加者失敗:', error);
        res.json({
            success: false,
            tableHtml: vh.errorTableRow('載入失敗', 8),
            paginationHtml: ''
        });
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

// ========== 報名確認信 APIs ==========

// 取得報名確認信收件者列表
router.get('/projects/:id/registration-emails/recipients', authenticateSession, async (req, res) => {
    try {
        const projectId = req.params.id;
        const { search, groupOnly } = req.query;
        const submissionRepo = require('../../repositories/submission.repository');

        // 基礎查詢 - 包含小孩判斷所需欄位
        let sql = `
            SELECT
                fs.id,
                fs.user_id,
                fs.trace_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.group_id,
                fs.is_primary,
                fs.parent_submission_id,
                fs.children_count,
                fs.children_ages,
                fs.created_at,
                parent.submitter_name as parent_name
            FROM form_submissions fs
            LEFT JOIN form_submissions parent ON fs.parent_submission_id = parent.id
            WHERE fs.project_id = ?
        `;
        const params = [projectId];

        // 搜尋過濾
        if (search && search.trim()) {
            sql += ` AND (fs.submitter_name LIKE ? OR fs.submitter_email LIKE ?)`;
            const searchPattern = `%${search.trim()}%`;
            params.push(searchPattern, searchPattern);
        }

        // 僅顯示團體報名
        if (groupOnly === 'true') {
            sql += ` AND fs.group_id IS NOT NULL`;
        }

        sql += ` ORDER BY fs.created_at DESC`;

        const recipients = await submissionRepo.rawAll(sql, params);

        // 統計
        const statsSql = `
            SELECT
                COUNT(*) as total,
                COUNT(DISTINCT group_id) as groupCount
            FROM form_submissions
            WHERE project_id = ?
        `;
        const statsResult = await submissionRepo.rawGet(statsSql, [projectId]);

        responses.success(res, {
            recipients,
            stats: {
                total: statsResult?.total || 0,
                groupCount: statsResult?.groupCount || 0
            }
        });
    } catch (error) {
        console.error('取得報名確認信收件者失敗:', error);
        responses.error(res, '取得收件者列表失敗', 500);
    }
});

// 重寄報名確認信
router.post('/projects/:id/registration-emails/resend', authenticateSession, async (req, res) => {
    try {
        const projectId = req.params.id;
        const { traceIds } = req.body;
        const { registrationService } = require('../../services');

        if (!traceIds || !Array.isArray(traceIds) || traceIds.length === 0) {
            return responses.badRequest(res, '請指定要重寄的報名者');
        }

        console.log(`[RegistrationEmail] 開始重寄邀請信，共 ${traceIds.length} 位`);

        // 延遲函數（避免 Gmail SMTP spam 偵測）
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        let successCount = 0;
        let failCount = 0;
        const results = [];

        for (let i = 0; i < traceIds.length; i++) {
            const traceId = traceIds[i];

            // 發送前延遲（第一封除外）
            if (i > 0) {
                await delay(1500);
            }

            console.log(`[RegistrationEmail] 發送 ${i + 1}/${traceIds.length}: ${traceId}`);

            try {
                const result = await registrationService.resendInvitationEmail(traceId);
                results.push({ traceId, success: true });
                successCount++;
            } catch (err) {
                console.error(`[RegistrationEmail] 發送失敗 ${traceId}:`, err.message);
                results.push({ traceId, success: false, error: err.message });
                failCount++;
            }
        }

        console.log(`[RegistrationEmail] 發送完成：成功 ${successCount}，失敗 ${failCount}`);

        responses.success(res, {
            message: `已發送 ${successCount} 封，失敗 ${failCount} 封`,
            successCount,
            failCount,
            total: traceIds.length,
            results
        });
    } catch (error) {
        console.error('重寄報名確認信失敗:', error);
        responses.error(res, '重寄失敗', 500);
    }
});

// ========== Email 模板預覽 APIs ==========

// 預覽 Email 模板
router.get('/projects/:id/email-templates/preview', authenticateSession, async (req, res) => {
    try {
        const { type } = req.query;
        const { emailService } = require('../../services');

        let html = '';

        switch (type) {
            case 'individual':
                html = emailService._buildRegistrationEmailHtml({
                    name: '王小明',
                    email: 'example@email.com',
                    traceId: 'MICE-SAMPLE-001',
                    passCode: '123456',
                    eventName: '平安夜公益活動',
                    eventLocation: '誠品生活松菸店',
                    eventDate: '2025/12/24'
                });
                break;
            case 'group-primary':
                html = emailService._buildGroupRegistrationEmailHtml({
                    name: '王大明',
                    traceId: 'MICE-GRP-001',
                    passCode: '654321',
                    eventName: '平安夜公益活動',
                    eventLocation: '誠品生活松菸店',
                    eventDate: '2025/12/24',
                    totalCount: 3,
                    otherMembers: ['王小華', '王小弟']
                });
                break;
            case 'group-member':
                html = emailService._buildMemberEmailHtml({
                    name: '王小華',
                    traceId: 'MICE-MEM-001',
                    passCode: '111111',
                    eventName: '平安夜公益活動',
                    eventLocation: '誠品生活松菸店',
                    eventDate: '2025/12/24',
                    primaryName: '王大明',
                    primaryEmail: 'primary@email.com'
                });
                break;
            case 'pre-event':
                html = emailService.generatePreEventEmailHtml('王小明');
                break;
            default:
                html = '<p>請選擇模板類型</p>';
        }

        responses.html(res, html);
    } catch (error) {
        console.error('預覽 Email 模板失敗:', error);
        responses.html(res, `<p style="color: red;">載入模板失敗: ${error.message}</p>`);
    }
});

// ========== 行前通知 Email APIs ==========

// 預覽行前通知 Email
router.get('/projects/:id/pre-event-email/preview', authenticateSession, async (req, res) => {
    try {
        const { emailService } = require('../../services');
        const previewName = req.query.name || '參加者';
        const html = emailService.generatePreEventEmailHtml(previewName);
        responses.html(res, html);
    } catch (error) {
        console.error('預覽行前通知失敗:', error);
        responses.error(res, '預覽失敗', 500);
    }
});

// 取得專案參加者列表（用於行前通知）
router.get('/projects/:id/pre-event-email/recipients', authenticateSession, async (req, res) => {
    try {
        const projectId = req.params.id;
        const submissionRepo = require('../../repositories/submission.repository');

        // 查詢有 email 的參加者
        const sql = `
            SELECT
                id,
                trace_id,
                submitter_name,
                submitter_email,
                submitter_phone,
                group_id,
                is_primary,
                created_at
            FROM form_submissions
            WHERE project_id = ?
              AND submitter_email IS NOT NULL
              AND submitter_email != ''
            ORDER BY created_at DESC
        `;

        const recipients = await submissionRepo.rawAll(sql, [projectId]);

        responses.success(res, {
            total: recipients.length,
            recipients: recipients
        });
    } catch (error) {
        console.error('取得收件者列表失敗:', error);
        responses.error(res, '取得收件者列表失敗', 500);
    }
});

// 發送行前通知給參加者（支援全部或選取）
router.post('/projects/:id/pre-event-email/send', authenticateSession, async (req, res) => {
    try {
        const projectId = req.params.id;
        const { participantIds } = req.body; // 可選：指定發送對象
        const { emailService } = require('../../services');
        const submissionRepo = require('../../repositories/submission.repository');

        // 查詢有 email 的參加者
        let sql = `
            SELECT
                id,
                submitter_name,
                submitter_email
            FROM form_submissions
            WHERE project_id = ?
              AND submitter_email IS NOT NULL
              AND submitter_email != ''
        `;
        const params = [projectId];

        // 如果有指定 participantIds，只發送給選取的人
        if (participantIds && Array.isArray(participantIds) && participantIds.length > 0) {
            const placeholders = participantIds.map(() => '?').join(',');
            sql += ` AND id IN (${placeholders})`;
            params.push(...participantIds);
        }

        const participants = await submissionRepo.rawAll(sql, params);

        if (participants.length === 0) {
            return responses.error(res, '沒有可發送的參加者', 400);
        }

        console.log(`[PreEventEmail] 開始發送行前通知，共 ${participants.length} 位參加者`);

        // 延遲函數（避免 Gmail SMTP spam 偵測）
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // 逐一發送，每封間隔 1.5 秒
        const results = [];
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < participants.length; i++) {
            const p = participants[i];

            // 發送前延遲（第一封除外）
            if (i > 0) {
                await delay(1500);
            }

            console.log(`[PreEventEmail] 發送 ${i + 1}/${participants.length}: ${p.submitter_email}`);

            const result = await emailService.sendPreEventNotificationEmail({
                name: p.submitter_name,
                email: p.submitter_email
            });

            results.push({
                id: p.id,
                name: p.submitter_name,
                email: p.submitter_email,
                ...result
            });

            if (result.success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        console.log(`[PreEventEmail] 發送完成：成功 ${successCount}，失敗 ${failCount}`);

        responses.success(res, {
            message: `已發送 ${successCount} 封，失敗 ${failCount} 封`,
            successCount,
            failCount,
            total: participants.length,
            results
        });
    } catch (error) {
        console.error('發送行前通知失敗:', error);
        responses.error(res, '發送失敗', 500);
    }
});

module.exports = router;