/**
 * 前端 API 路由
 * @swagger
 * tags:
 *   name: Frontend
 *   description: 前端使用者 API - 報名表單提交與互動追蹤
 */
const express = require('express');
const router = express.Router();
const database = require('../../config/database');
const responses = require('../../utils/responses');

/**
 * @swagger
 * /api/submit-form:
 *   post:
 *     summary: 提交完整報名表單
 *     description: 提交包含詳細資訊的報名表單，包含公司資訊、緊急聯絡人等
 *     tags: [Frontend]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trace_id
 *               - name
 *               - email
 *               - phone
 *               - company
 *               - position
 *               - data_consent
 *             properties:
 *               trace_id:
 *                 type: string
 *                 description: 追蹤 ID，用於防止重複提交
 *                 example: "TRACE123456"
 *               name:
 *                 type: string
 *                 description: 報名者姓名
 *                 example: "王小明"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 電子郵件地址
 *                 example: "wang@example.com"
 *               phone:
 *                 type: string
 *                 description: 電話號碼（8-12位數字）
 *                 example: "0912345678"
 *               company:
 *                 type: string
 *                 description: 公司名稱
 *                 example: "範例科技有限公司"
 *               position:
 *                 type: string
 *                 description: 職位
 *                 example: "軟體工程師"
 *               department:
 *                 type: string
 *                 description: 部門
 *                 example: "技術部"
 *               employee_id:
 *                 type: string
 *                 description: 員工編號
 *                 example: "EMP001"
 *               company_tax_id:
 *                 type: string
 *                 pattern: '^[0-9]{8}$'
 *                 description: 公司統一編號（8位數字）
 *                 example: "12345678"
 *               address:
 *                 type: string
 *                 description: 地址
 *                 example: "台北市信義區信義路五段7號"
 *               emergency_contact:
 *                 type: string
 *                 description: 緊急聯絡人姓名
 *                 example: "王大明"
 *               emergency_phone:
 *                 type: string
 *                 description: 緊急聯絡人電話
 *                 example: "0912345679"
 *               dietary_restrictions:
 *                 type: string
 *                 description: 飲食禁忌
 *                 example: "素食，不吃牛肉"
 *               special_needs:
 *                 type: string
 *                 description: 特殊需求
 *                 example: "需要無障礙設施"
 *               data_consent:
 *                 type: boolean
 *                 description: 資料使用同意（必填）
 *                 example: true
 *               marketing_consent:
 *                 type: boolean
 *                 description: 行銷訊息同意
 *                 example: false
 *               project_id:
 *                 type: integer
 *                 description: 專案ID，預設為1
 *                 example: 1
 *     responses:
 *       200:
 *         description: 報名成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               success: true
 *               message: "報名成功！感謝您的參與，我們將盡快與您聯繫。"
 *               data:
 *                 submissionId: 123
 *                 traceId: "TRACE123456"
 *       400:
 *         description: 驗證錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               validationError:
 *                 value:
 *                   success: false
 *                   message: "請填寫所有必填欄位"
 *               duplicateSubmission:
 *                 value:
 *                   success: false
 *                   message: "此追蹤 ID 已被使用，請重新整理頁面後重新提交"
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// 表單提交 API
router.post('/submit-form', async (req, res) => {
    try {
        const {
            trace_id,
            name,
            email,
            phone,
            company,
            position,
            department,
            employee_id,
            company_tax_id,
            address,
            emergency_contact,
            emergency_phone,
            dietary_restrictions,
            special_needs,
            data_consent,
            marketing_consent,
            project_id = 1
        } = req.body;

        // 驗證必填字段
        if (!trace_id || !name || !email || !phone || !company || !position) {
            return responses.validationError(res, {
                message: 'Please fill in all required fields'
            });
        }

        // 驗證數據使用同意
        if (!data_consent) {
            return responses.validationError(res, {
                message: 'Please agree to data usage terms'
            });
        }

        // 郵件格式驗證
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return responses.validationError(res, {
                message: 'Please enter a valid email address'
            });
        }

        // 電話號碼驗證
        const phoneRegex = /^[0-9]{8,12}$/;
        if (!phoneRegex.test(phone.replace(/[-\s]/g, ''))) {
            return responses.validationError(res, {
                message: 'Phone number format incorrect, please enter 8-12 digits'
            });
        }

        // 公司統編驗證（如果提供）
        if (company_tax_id) {
            const taxIdRegex = /^[0-9]{8}$/;
            if (!taxIdRegex.test(company_tax_id)) {
                return responses.validationError(res, {
                    message: 'Company tax ID must be 8 digits'
                });
            }
        }

        // 檢查追蹤 ID 是否已存在
        const existingSubmission = await database.get(
            'SELECT id FROM form_submissions WHERE trace_id = ?',
            [trace_id]
        );

        if (existingSubmission) {
            return responses.error(res, 'This tracking ID is already used, please refresh page and resubmit', 409);
        }

        // 保存表單數據
        const result = await database.run(`
            INSERT INTO form_submissions (
                trace_id, project_id, submitter_name, submitter_email, submitter_phone, 
                company_name, position, department, employee_id, company_tax_id,
                address, emergency_contact, emergency_phone, dietary_restrictions,
                special_needs, submission_data, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            trace_id,
            project_id,
            name.substring(0, 100),
            email.substring(0, 100),
            phone.replace(/[-\s]/g, ''),
            company.substring(0, 200),
            position.substring(0, 100),
            department ? department.substring(0, 100) : null,
            employee_id ? employee_id.substring(0, 50) : null,
            company_tax_id ? company_tax_id.replace(/[-\s]/g, '') : null,
            address ? address.substring(0, 1000) : null,
            emergency_contact ? emergency_contact.substring(0, 100) : null,
            emergency_phone ? emergency_phone.replace(/[-\s]/g, '') : null,
            dietary_restrictions ? dietary_restrictions.substring(0, 1000) : null,
            special_needs ? special_needs.substring(0, 1000) : null,
            JSON.stringify({
                ...req.body,
                data_consent,
                marketing_consent
            }),
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
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
            'registration_completed',
            'registration_form',
            JSON.stringify({ attendee_name: name, company_name: company }),
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
        ]);

        console.log('Form submission received:', {
            id: result.lastID,
            trace_id,
            name,
            email,
            phone,
            company,
            position,
            timestamp: new Date().toISOString()
        });

        return responses.success(res, {
            submissionId: result.lastID,
            traceId: trace_id
        }, 'Registration successful! Thank you for participating, we will contact you soon.');

    } catch (error) {
        console.error('Form submission error:', error);
        return responses.error(res, 'Submission failed, please try again later', 500);
    }
});

/**
 * @swagger
 * /api/track-interaction:
 *   post:
 *     summary: 記錄使用者互動
 *     description: 追蹤使用者在網站上的各種互動行為，如點擊、瀏覽等
 *     tags: [Frontend]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trace_id
 *               - project_id
 *               - interaction_type
 *               - interaction_target
 *             properties:
 *               trace_id:
 *                 type: string
 *                 description: 追蹤 ID
 *                 example: "TRACE123456"
 *               project_id:
 *                 type: integer
 *                 description: 專案ID
 *                 example: 1
 *               interaction_type:
 *                 type: string
 *                 description: 互動類型
 *                 example: "button_click"
 *                 enum: ["page_view", "button_click", "form_start", "form_submit", "link_click", "video_play", "download"]
 *               interaction_target:
 *                 type: string
 *                 description: 互動目標
 *                 example: "register_button"
 *               interaction_data:
 *                 type: object
 *                 description: 互動資料（選填）
 *                 example: { "button_text": "立即報名", "page_url": "/register" }
 *     responses:
 *       200:
 *         description: 互動記錄成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               success: true
 *               message: "互動記錄成功"
 *       400:
 *         description: 參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// 互動追蹤 API
router.post('/track-interaction', async (req, res) => {
    try {
        const {
            trace_id,
            project_id,
            interaction_type,
            interaction_target,
            interaction_data
        } = req.body;

        if (!trace_id || !project_id || !interaction_type || !interaction_target) {
            return responses.validationError(res, {
                message: 'Missing required parameters'
            });
        }

        // 查找對應的提交記錄
        const submission = await database.get(
            'SELECT id FROM form_submissions WHERE trace_id = ? AND project_id = ?',
            [trace_id, project_id]
        );

        await database.run(`
            INSERT INTO participant_interactions (
                trace_id, project_id, submission_id, interaction_type,
                interaction_target, interaction_data, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            trace_id,
            project_id,
            submission?.id || null,
            interaction_type,
            interaction_target,
            interaction_data,
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
        ]);

        return responses.success(res, null, 'Interaction recorded successfully');

    } catch (error) {
        console.error('Interaction tracking error:', error);
        return responses.error(res, 'Failed to record interaction', 500);
    }
});

/**
 * @swagger
 * /api/qr-data:
 *   get:
 *     summary: 獲取 QR 碼資料
 *     description: 取得活動 QR 碼的相關資訊
 *     tags: [Frontend]
 *     responses:
 *       200:
 *         description: QR 碼資料獲取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               success: true
 *               data:
 *                 eventName: "Business Meeting Invitation - Taichung Station"
 *                 date: "2025-11-03"
 *                 location: "Online Meeting Room"
 *                 eventId: "MICE-AI-2025-11-03"
 *                 url: "http://localhost:3000/qr"
 */
// 獲取 QR 碼數據 API
router.get('/qr-data', (req, res) => {
    const qrData = {
        eventName: 'Business Meeting Invitation - Taichung Station',
        date: '2025-11-03',
        location: 'Online Meeting Room',
        eventId: 'MICE-AI-2025-11-03',
        url: `${req.protocol}://${req.get('host')}/qr`
    };

    return responses.success(res, qrData);
});

/**
 * @swagger
 * /api/project-info/{projectCode}:
 *   get:
 *     summary: 獲取專案資訊
 *     description: 根據專案代碼取得專案的基本資訊，用於報名頁面顯示
 *     tags: [Frontend]
 *     parameters:
 *       - in: path
 *         name: projectCode
 *         required: true
 *         schema:
 *           type: string
 *         description: 專案代碼
 *         example: "CONF2024"
 *     responses:
 *       200:
 *         description: 專案資訊獲取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               success: true
 *               message: "專案信息獲取成功"
 *               data:
 *                 id: 1
 *                 project_name: "2024 年度研討會"
 *                 project_code: "CONF2024"
 *                 description: "年度技術研討會邀請函"
 *                 event_date: "2024-06-15T09:00:00.000Z"
 *                 event_location: "台北國際會議中心"
 *                 event_type: "conference"
 *                 status: "active"
 *       404:
 *         description: 專案不存在或已關閉
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "專案不存在或已關閉"
 *       400:
 *         description: 專案未開放報名
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "此專案尚未開放報名"
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// 獲取專案信息 API
router.get('/project-info/:projectCode', async (req, res) => {
    try {
        const projectCode = req.params.projectCode;

        // 查找專案
        const project = await database.get(`
            SELECT id, project_name, project_code, description, event_date, 
                   event_location, event_type, status
            FROM invitation_projects 
            WHERE project_code = ? AND status IN ('active', 'draft')
        `, [projectCode]);

        if (!project) {
            return responses.error(res, '專案不存在或已關閉', 404);
        }

        // 檢查專案是否開放報名
        if (project.status !== 'active') {
            return responses.error(res, '此專案尚未開放報名', 400);
        }

        return responses.success(res, project, '專案信息獲取成功');

    } catch (error) {
        console.error('獲取專案信息錯誤:', error);
        return responses.error(res, '獲取專案信息失敗', 500);
    }
});

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
            FROM invitation_projects 
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

// 簡化報名表單提交 API (向後兼容)
router.post('/submit', async (req, res) => {
    try {
        const {
            trace_id,
            name,
            email,
            phone,
            participation_level,
            activity_notifications,
            product_updates,
            project_id = 1
        } = req.body;

        // 驗證必填字段
        if (!trace_id || !name || !email || !phone) {
            return responses.validationError(res, {
                message: '請填寫所有必填欄位'
            });
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

        // 保存簡化表單數據
        const submissionData = {
            trace_id,
            name,
            email,
            phone,
            participation_level: parseInt(participation_level) || 50,
            activity_notifications: !!activity_notifications,
            product_updates: !!product_updates,
            submission_type: 'simplified_registration'
        };

        const result = await database.run(`
            INSERT INTO form_submissions (
                trace_id, project_id, submitter_name, submitter_email, submitter_phone, 
                submission_data, ip_address, user_agent, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            trace_id,
            project_id,
            name.substring(0, 100),
            email.substring(0, 100),
            phone.substring(0, 20),
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
            'simplified_registration',
            'registration_form',
            JSON.stringify({
                attendee_name: name,
                participation_level,
                notifications_enabled: activity_notifications || product_updates
            }),
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
        ]);

        console.log('簡化報名表單提交成功:', {
            id: result.lastID,
            trace_id,
            name,
            email,
            phone,
            participation_level,
            timestamp: new Date().toISOString()
        });

        return responses.success(res, {
            submissionId: result.lastID,
            traceId: trace_id,
            redirectUrl: `/success?trace_id=${trace_id}`
        }, '報名成功！感謝您的參與，我們將盡快與您聯繫。');

    } catch (error) {
        console.error('簡化報名表單提交錯誤:', error);
        return responses.error(res, '提交失敗，請稍後再試', 500);
    }
});

module.exports = router;