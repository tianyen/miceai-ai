/**
 * 前端報名 API（遺留版本）
 *
 * @deprecated 此 API 已被棄用，請使用 V1 API (/api/v1/registration)
 * 此端點保留僅為向後相容，未來版本將移除
 *
 * @see /api/v1/registration - 新版報名 API
 * @refactor 2025-12-04: 使用 Repository 層
 */
const express = require('express');
const router = express.Router();
const responses = require('../../utils/responses');
const projectRepository = require('../../repositories/project.repository');
const submissionRepository = require('../../repositories/submission.repository');
const checkinRepository = require('../../repositories/checkin.repository');

// 專案特定報名提交 API
router.post('/register', async (req, res) => {
    try {
        const {
            project_id,
            project_code,
            trace_id,
            name,
            email,
            phone,
            participation_level,
            activity_notifications,
            product_updates
        } = req.body;

        // 驗證必填字段
        if (!project_id || !trace_id || !name || !email || !phone) {
            return responses.validationError(res, {
                message: '請填寫所有必填欄位'
            });
        }

        // 使用 Repository 驗證專案是否存在且開放報名
        const project = await projectRepository.findActiveById(project_id);

        if (!project) {
            return responses.error(res, '專案不存在或未開放報名', 404);
        }

        // 郵件格式驗證
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return responses.validationError(res, {
                message: '請輸入有效的電子郵件地址'
            });
        }

        // 電話號碼驗證
        const phoneRegex = /^[0-9\-\+\s]{8,20}$/;
        if (!phoneRegex.test(phone)) {
            return responses.validationError(res, {
                message: '電話號碼格式不正確'
            });
        }

        // 使用 Repository 檢查追蹤 ID 是否已存在
        const traceIdExists = await submissionRepository.traceIdExists(trace_id);

        if (traceIdExists) {
            return responses.error(res, '此追蹤 ID 已被使用，請重新整理頁面後重新提交', 409);
        }

        // 使用 Repository 檢查是否已報名過該專案
        const existingRegistration = await submissionRepository.findByProjectAndEmail(project_id, email);

        if (existingRegistration) {
            return responses.error(res, '您已報名過此專案', 409);
        }

        // 保存報名數據
        const submissionData = {
            trace_id,
            name,
            email,
            phone,
            project_id,
            project_code,
            participation_level: parseInt(participation_level) || 50,
            activity_notifications: !!activity_notifications,
            product_updates: !!product_updates,
            submission_type: 'project_registration'
        };

        // 使用 Repository 建立報名記錄
        const result = await submissionRepository.createLegacyRegistration({
            traceId: trace_id,
            projectId: project_id,
            name,
            email,
            phone,
            participationLevel: parseInt(participation_level) || 50,
            activityNotifications: !!activity_notifications,
            productUpdates: !!product_updates,
            submissionData: JSON.stringify(submissionData),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });

        // 使用 Repository 記錄參加者互動
        await checkinRepository.createInteraction({
            traceId: trace_id,
            projectId: project_id,
            submissionId: result.lastID,
            interactionType: 'project_registration',
            interactionTarget: 'registration_form',
            interactionData: {
                attendee_name: name,
                project_name: project.project_name,
                participation_level,
                notifications_enabled: activity_notifications || product_updates
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });

        console.log('專案報名提交成功:', {
            id: result.lastID,
            trace_id,
            project_id,
            project_name: project.project_name,
            name,
            email,
            phone,
            participation_level,
            timestamp: new Date().toISOString()
        });

        return responses.success(res, {
            submissionId: result.lastID,
            traceId: trace_id,
            projectName: project.project_name,
            redirectUrl: `/success?trace_id=${trace_id}&project=${project_code}`
        }, `報名 ${project.project_name} 成功！感謝您的參與，我們將盡快與您聯繫。`);

    } catch (error) {
        console.error('專案報名提交錯誤:', error);
        return responses.error(res, '提交失敗，請稍後再試', 500);
    }
});

module.exports = router;

