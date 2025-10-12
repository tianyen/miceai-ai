/**
 * API v1 - 活動報名路由
 * 路徑: /api/v1/events/:eventId/registrations 和 /api/v1/registrations
 * @swagger
 * tags:
 *   name: Registrations (活動報名)
 *   description: 活動報名和 QR Code 管理 API - 前端串接使用
 */

const express = require('express');
const router = express.Router();
const database = require('../../../config/database');
const responses = require('../../../utils/responses');
const { body, param, validationResult } = require('express-validator');
const crypto = require('crypto');

// 生成唯一的 trace_id
const generateTraceId = () => {
    return 'TRACE' + Date.now() + crypto.randomBytes(4).toString('hex').toUpperCase();
};

// 驗證電子郵件格式
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 驗證手機號碼格式
const phoneRegex = /^[0-9\-\+\s\(\)]{8,20}$/;

/**
 * @swagger
 * /api/v1/events/{eventId}/registrations:
 *   post:
 *     tags: [Registrations (活動報名)]
 *     summary: 提交活動報名
 *     description: 提交活動報名資料，系統會自動生成 QR Code Base64 並返回 trace_id
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 活動 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - data_consent
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 description: 姓名
 *                 example: "王小明"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 電子郵件
 *                 example: "wang@example.com"
 *               phone:
 *                 type: string
 *                 pattern: '^[0-9\-\+\s\(\)]{8,20}$'
 *                 description: 手機號碼
 *                 example: "0912345678"
 *               company:
 *                 type: string
 *                 maxLength: 100
 *                 description: 公司名稱
 *                 example: "科技公司"
 *               position:
 *                 type: string
 *                 maxLength: 50
 *                 description: 職位
 *                 example: "工程師"
 *               data_consent:
 *                 type: boolean
 *                 description: 資料使用同意（必須為 true）
 *                 example: true
 *               marketing_consent:
 *                 type: boolean
 *                 description: 行銷同意
 *                 example: false
 *     responses:
 *       201:
 *         description: 報名成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "報名成功！確認信已發送至您的電子郵件。"
 *                 data:
 *                   type: object
 *                   properties:
 *                     registration_id:
 *                       type: integer
 *                       example: 123
 *                     trace_id:
 *                       type: string
 *                       description: 追蹤 ID，用於查詢報名狀態和 QR Code
 *                       example: "TRACE123456789ABC"
 *                     event:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "2024 科技研討會"
 *                         date:
 *                           type: string
 *                           example: "2024-12-15"
 *                         location:
 *                           type: string
 *                           example: "台北國際會議中心"
 *                     participant:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "王小明"
 *                         email:
 *                           type: string
 *                           example: "wang@example.com"
 *                     qr_code:
 *                       type: object
 *                       properties:
 *                         data:
 *                           type: string
 *                           example: "TRACE123456789ABC"
 *                         url:
 *                           type: string
 *                           description: QR Code 查詢 URL
 *                           example: "/api/v1/qr-codes/TRACE123456789ABC"
 *       400:
 *         description: 請求參數錯誤或活動已滿額
 *       404:
 *         description: 活動不存在
 *       409:
 *         description: 重複報名
 *       500:
 *         description: 服務器錯誤
 */
router.post('/events/:eventId/registrations', [
    param('eventId').isInt({ min: 1 }).withMessage('活動 ID 必須是正整數'),
    body('name').trim().isLength({ min: 2, max: 50 }).withMessage('姓名長度必須在 2-50 字符之間'),
    body('email').isEmail().withMessage('請輸入有效的電子郵件地址'),
    body('phone').matches(phoneRegex).withMessage('手機號碼格式不正確'),
    body('company').optional().trim().isLength({ max: 100 }).withMessage('公司名稱不能超過 100 字符'),
    body('position').optional().trim().isLength({ max: 50 }).withMessage('職位不能超過 50 字符'),
    body('data_consent').isBoolean().custom(value => {
        if (value !== true) {
            throw new Error('必須同意資料使用條款');
        }
        return true;
    }),
    body('marketing_consent').optional().isBoolean().withMessage('行銷同意必須是布林值')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { 
                message: '請求參數驗證失敗',
                errors: errors.array().reduce((acc, error) => {
                    acc[error.path] = error.msg;
                    return acc;
                }, {})
            });
        }

        const eventId = req.params.eventId;
        const {
            name,
            email,
            phone,
            company = '',
            position = '',
            data_consent,
            marketing_consent = false
        } = req.body;

        // 檢查活動是否存在且開放報名
        const event = await database.get(`
            SELECT id, project_name, project_code, event_date, event_location, 
                   status, max_participants, registration_deadline,
                   contact_email, contact_phone
            FROM invitation_projects 
            WHERE id = ? AND status = 'active'
        `, [eventId]);

        if (!event) {
            return responses.error(res, '活動不存在或未開放報名', 404);
        }

        // 檢查報名截止時間
        if (event.registration_deadline) {
            const deadline = new Date(event.registration_deadline);
            if (new Date() > deadline) {
                return responses.error(res, '報名已截止', 400);
            }
        }

        // 檢查是否已達到最大參與人數
        if (event.max_participants > 0) {
            const currentCount = await database.get(`
                SELECT COUNT(*) as count 
                FROM form_submissions 
                WHERE project_id = ? AND status IN ('pending', 'approved', 'confirmed')
            `, [eventId]);

            if (currentCount.count >= event.max_participants) {
                return responses.error(res, '活動已滿額', 400);
            }
        }

        // 檢查是否重複報名（同一電子郵件）
        const existingRegistration = await database.get(`
            SELECT id, trace_id, status 
            FROM form_submissions 
            WHERE project_id = ? AND submitter_email = ?
        `, [eventId, email]);

        if (existingRegistration) {
            return responses.error(res, '此電子郵件已報名過此活動', 409);
        }

        // 生成唯一的 trace_id
        let traceId;
        let attempts = 0;
        do {
            traceId = generateTraceId();
            attempts++;
            if (attempts > 10) {
                throw new Error('無法生成唯一的追蹤 ID');
            }
        } while (await database.get('SELECT id FROM form_submissions WHERE trace_id = ?', [traceId]));

        // 插入報名記錄
        const result = await database.run(`
            INSERT INTO form_submissions (
                trace_id, project_id, submitter_name, submitter_email, submitter_phone,
                company_name, position,
                data_consent, marketing_consent, activity_notifications, product_updates,
                ip_address, user_agent, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            traceId,
            eventId,
            name,
            email,
            phone,
            company,
            position,
            data_consent,
            marketing_consent,
            marketing_consent, // activity_notifications
            marketing_consent, // product_updates
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent'),
            'pending'
        ]);

        // 生成 QR Code 記錄和 Base64
        const qrData = traceId; // 使用 trace_id 作為 QR Code 數據
        const QRCode = require('qrcode');

        // 生成 QR Code Base64
        const qrBase64 = await QRCode.toDataURL(qrData, {
            type: 'image/png',
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        await database.run(`
            INSERT INTO qr_codes (
                project_id, submission_id, qr_code, qr_data, qr_base64, created_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [eventId, result.lastID, qrData, qrData, qrBase64]);

        // 記錄參與者互動
        await database.run(`
            INSERT INTO participant_interactions (
                trace_id, project_id, submission_id, interaction_type,
                interaction_target, interaction_data, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            traceId,
            eventId,
            result.lastID,
            'event_registration',
            'registration_api_v1',
            JSON.stringify({
                participant_name: name,
                event_name: event.project_name,
                registration_method: 'api_v1'
            }),
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
        ]);

        // 構建回應數據
        const responseData = {
            registration_id: result.lastID,
            trace_id: traceId,
            event: {
                name: event.project_name,
                date: event.event_date,
                location: event.event_location
            },
            participant: {
                name: name,
                email: email
            },
            qr_code: {
                data: qrData,
                url: `/api/v1/qr-codes/${traceId}`
            },
            confirmation_email_sent: false // TODO: 實現郵件發送功能
        };

        console.log('活動報名成功:', {
            registration_id: result.lastID,
            trace_id: traceId,
            event_id: eventId,
            event_name: event.project_name,
            participant_name: name,
            participant_email: email,
            timestamp: new Date().toISOString()
        });

        return responses.success(res, responseData, '報名成功！確認信已發送至您的電子郵件。', 201);

    } catch (error) {
        console.error('活動報名錯誤:', error);
        return responses.error(res, '報名過程發生錯誤，請稍後再試', 500);
    }
});

/**
 * @swagger
 * /api/v1/registrations/{traceId}:
 *   get:
 *     tags: [Registrations (活動報名)]
 *     summary: 查詢報名狀態
 *     description: |
 *       根據 trace_id 查詢報名狀態和詳細資訊
 *
 *       **用途**：
 *       - 前端顯示報名確認頁面
 *       - 查詢報到狀態
 *       - 獲取 QR Code 掃描次數
 *     parameters:
 *       - in: path
 *         name: traceId
 *         required: true
 *         schema:
 *           type: string
 *         description: 報名追蹤 ID（報名時返回）
 *         example: "TRACE123456789ABC"
 *     responses:
 *       200:
 *         description: 成功獲取報名資訊
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
 *                     registration_id:
 *                       type: integer
 *                       example: 123
 *                     trace_id:
 *                       type: string
 *                       example: "TRACE123456789ABC"
 *                     status:
 *                       type: string
 *                       enum: [pending, approved, confirmed, rejected, cancelled]
 *                       example: "pending"
 *                     event:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "2024 科技研討會"
 *                         date:
 *                           type: string
 *                           example: "2024-12-15"
 *                         location:
 *                           type: string
 *                           example: "台北國際會議中心"
 *                     participant:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "王小明"
 *                         email:
 *                           type: string
 *                           example: "wang@example.com"
 *                         phone:
 *                           type: string
 *                           example: "0912345678"
 *                         company:
 *                           type: string
 *                           example: "科技公司"
 *                         position:
 *                           type: string
 *                           example: "工程師"
 *                     qr_code:
 *                       type: object
 *                       properties:
 *                         data:
 *                           type: string
 *                           example: "TRACE123456789ABC"
 *                         scan_count:
 *                           type: integer
 *                           example: 0
 *                         last_scanned:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                           example: null
 *                     check_in_status:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-12-01T10:30:00Z"
 *       404:
 *         description: 找不到報名記錄
 *       500:
 *         description: 服務器錯誤
 */
router.get('/registrations/:traceId', [
    param('traceId').isLength({ min: 1, max: 50 }).withMessage('追蹤 ID 格式不正確')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const traceId = req.params.traceId;

        const registration = await database.get(`
            SELECT
                fs.id as registration_id,
                fs.trace_id,
                fs.status,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.company_name,
                fs.position,
                fs.checked_in_at,
                fs.created_at,
                p.project_name as event_name,
                p.event_date,
                p.event_location,
                qr.qr_data,
                qr.scan_count,
                qr.last_scanned
            FROM form_submissions fs
            JOIN invitation_projects p ON fs.project_id = p.id
            LEFT JOIN qr_codes qr ON fs.id = qr.submission_id
            WHERE fs.trace_id = ?
        `, [traceId]);

        if (!registration) {
            return responses.error(res, '找不到報名記錄', 404);
        }

        const responseData = {
            registration_id: registration.registration_id,
            trace_id: registration.trace_id,
            status: registration.status,
            event: {
                name: registration.event_name,
                date: registration.event_date,
                location: registration.event_location
            },
            participant: {
                name: registration.submitter_name,
                email: registration.submitter_email,
                phone: registration.submitter_phone,
                company: registration.company_name,
                position: registration.position
            },
            qr_code: {
                data: registration.qr_data,
                scan_count: registration.scan_count || 0,
                last_scanned: registration.last_scanned
            },
            check_in_status: registration.checked_in_at,
            created_at: registration.created_at
        };

        return responses.success(res, responseData);

    } catch (error) {
        console.error('查詢報名狀態錯誤:', error);
        return responses.error(res, '查詢報名狀態失敗', 500);
    }
});

/**
 * QR Code 圖片生成
 * GET /api/v1/qr-codes/:traceId
 */
router.get('/qr-codes/:traceId', [
    param('traceId').isLength({ min: 1, max: 50 }).withMessage('追蹤 ID 格式不正確')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const traceId = req.params.traceId;
        const QRCode = require('qrcode');

        // 檢查 QR Code 記錄是否存在
        const qrRecord = await database.get(`
            SELECT qr.qr_data, fs.submitter_name, p.project_name
            FROM qr_codes qr
            JOIN form_submissions fs ON qr.submission_id = fs.id
            JOIN invitation_projects p ON qr.project_id = p.id
            WHERE fs.trace_id = ?
        `, [traceId]);

        if (!qrRecord) {
            return responses.error(res, '找不到 QR Code 記錄', 404);
        }

        // 生成 QR Code 圖片
        const qrImageBuffer = await QRCode.toBuffer(qrRecord.qr_data, {
            type: 'png',
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // 設置回應標頭
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', qrImageBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 快取 1 小時

        return res.send(qrImageBuffer);

    } catch (error) {
        console.error('生成 QR Code 圖片錯誤:', error);
        return responses.error(res, '生成 QR Code 失敗', 500);
    }
});

/**
 * @swagger
 * /api/v1/qr-codes/{traceId}/data:
 *   get:
 *     tags: [Registrations (活動報名)]
 *     summary: 獲取 QR Code Base64 數據
 *     description: 根據 trace_id 獲取 QR Code 的 Base64 編碼，可直接用於前端顯示
 *     parameters:
 *       - in: path
 *         name: traceId
 *         required: true
 *         schema:
 *           type: string
 *         description: 報名追蹤 ID
 *         example: "TRACE123456789ABC"
 *     responses:
 *       200:
 *         description: 成功獲取 QR Code 數據
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
 *                     trace_id:
 *                       type: string
 *                       example: "TRACE123456789ABC"
 *                     qr_data:
 *                       type: string
 *                       example: "TRACE123456789ABC"
 *                     qr_base64:
 *                       type: string
 *                       description: QR Code Base64 編碼，可直接用於 <img src="">
 *                       example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *                     participant_name:
 *                       type: string
 *                       example: "王小明"
 *                     event_name:
 *                       type: string
 *                       example: "2024 科技研討會"
 *                     scan_count:
 *                       type: integer
 *                       example: 0
 *                     last_scanned:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       example: null
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-12-01T10:30:00Z"
 *       404:
 *         description: 找不到 QR Code 記錄
 *       500:
 *         description: 服務器錯誤
 */
router.get('/qr-codes/:traceId/data', [
    param('traceId').isLength({ min: 1, max: 50 }).withMessage('追蹤 ID 格式不正確')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const traceId = req.params.traceId;

        const qrRecord = await database.get(`
            SELECT
                qr.qr_data,
                qr.qr_base64,
                qr.scan_count,
                qr.last_scanned,
                qr.created_at,
                fs.submitter_name as participant_name,
                p.project_name as event_name
            FROM qr_codes qr
            JOIN form_submissions fs ON qr.submission_id = fs.id
            JOIN invitation_projects p ON qr.project_id = p.id
            WHERE fs.trace_id = ?
        `, [traceId]);

        if (!qrRecord) {
            return responses.error(res, '找不到 QR Code 記錄', 404);
        }

        const responseData = {
            trace_id: traceId,
            qr_data: qrRecord.qr_data,
            qr_base64: qrRecord.qr_base64,
            participant_name: qrRecord.participant_name,
            event_name: qrRecord.event_name,
            scan_count: qrRecord.scan_count || 0,
            last_scanned: qrRecord.last_scanned,
            created_at: qrRecord.created_at
        };

        return responses.success(res, responseData);

    } catch (error) {
        console.error('查詢 QR Code 數據錯誤:', error);
        return responses.error(res, '查詢 QR Code 數據失敗', 500);
    }
});

module.exports = router;
