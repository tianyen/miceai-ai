const express = require('express');
const router = express.Router();
const database = require('../../config/database');
const responses = require('../../utils/responses');

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

        // 驗證專案是否存在且開放報名
        const project = await database.get(`
            SELECT id, project_name, status 
            FROM event_projects 
            WHERE id = ? AND status = 'active'
        `, [project_id]);

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

        // 檢查追蹤 ID 是否已存在
        const existingSubmission = await database.get(
            'SELECT id FROM form_submissions WHERE trace_id = ?',
            [trace_id]
        );

        if (existingSubmission) {
            return responses.error(res, '此追蹤 ID 已被使用，請重新整理頁面後重新提交', 409);
        }

        // 檢查是否已報名過該專案
        const existingRegistration = await database.get(`
            SELECT id FROM form_submissions 
            WHERE project_id = ? AND submitter_email = ?
        `, [project_id, email]);

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

        const result = await database.run(`
            INSERT INTO form_submissions (
                trace_id, project_id, submitter_name, submitter_email, submitter_phone,
                participation_level, activity_notifications, product_updates,
                submission_data, ip_address, user_agent, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            trace_id,
            project_id,
            name.substring(0, 100),
            email.substring(0, 100),
            phone.substring(0, 20),
            parseInt(participation_level) || 50,
            !!activity_notifications,
            !!product_updates,
            JSON.stringify(submissionData),
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent'),
            'pending'
        ]);

        // 記錄參加者互動
        await database.run(`
            INSERT INTO participant_interactions (
                trace_id, project_id, submission_id, interaction_type,
                interaction_target, interaction_data, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            trace_id,
            project_id,
            result.lastID,
            'project_registration',
            'registration_form',
            JSON.stringify({
                attendee_name: name,
                project_name: project.project_name,
                participation_level,
                notifications_enabled: activity_notifications || product_updates
            }),
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
        ]);

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

