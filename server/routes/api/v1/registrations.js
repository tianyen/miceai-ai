/**
 * API v1 - 活動報名路由
 * 路徑: /api/v1/events/:eventId/registrations 和 /api/v1/registrations
 *
 * ⚠️ user_id 與 registration_id 區分說明：
 *
 * | 欄位/參數 | 來源 | 說明 |
 * |-----------|------|------|
 * | registration_id | form_submissions.id | 報名記錄主鍵 |
 * | user_id (API 返回) | = registration_id | 遊戲 API 用的識別參數 |
 * | form_submissions.user_id | users.id | 後台管理員 ID（通常為 NULL）|
 *
 * 前端報名後，使用返回的 user_id (= registration_id) 來呼叫遊戲 API。
 *
 * @swagger
 * tags:
 *   name: Registrations (活動報名)
 *   description: |
 *     活動報名和 QR Code 管理 API - 前端串接使用
 *
 *     ⚠️ **ID 區分說明**：
 *     - `registration_id`: 報名記錄的主鍵 (form_submissions.id)
 *     - `user_id`: 等同於 registration_id，用於遊戲 API 的用戶識別
 *     - 後台管理員的 users.id 是完全不同的概念！
 */

const express = require('express');
const router = express.Router();
const { registrationService } = require('../../../services');
const responses = require('../../../utils/responses');
const { body, param, validationResult } = require('express-validator');

// 驗證手機號碼格式
const phoneRegex = /^[0-9\-\+\s\(\)]{8,20}$/;

/**
 * 處理 Service 層錯誤（AppError）
 */
function handleServiceError(res, error, defaultMessage) {
    console.error(`${defaultMessage}:`, error);

    // 檢查是否為 AppError（有 statusCode 屬性）
    if (error.statusCode) {
        const message = error.details?.message || error.message || defaultMessage;
        return responses.error(res, message, error.statusCode);
    }

    return responses.error(res, defaultMessage, 500);
}

/**
 * @swagger
 * /api/v1/events/{eventId}/registrations:
 *   post:
 *     tags: [Registrations (活動報名)]
 *     summary: 提交活動報名
 *     description: |
 *       提交活動報名資料，系統會自動生成 QR Code Base64 並返回 trace_id
 *
 *       ---
 *       ## 📋 前端串接教學
 *
 *       ### 步驟 1: 查詢活動資訊
 *       ```javascript
 *       const eventRes = await fetch('/api/v1/events/code/TECH2024');
 *       const eventData = await eventRes.json();
 *       const eventId = eventData.data.id;  // 獲取活動 ID
 *       ```
 *
 *       ### 步驟 2: 提交報名表單
 *       ```javascript
 *       const response = await fetch(`/api/v1/events/${eventId}/registrations`, {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({
 *           // ✅ 必填欄位
 *           name: '王大明',
 *           email: 'wang@example.com',
 *           phone: '0912345678',
 *           data_consent: true,
 *
 *           // ⭕ 選填欄位
 *           company: '科技公司',           // 公司名稱
 *           position: '工程師',            // 職位
 *           gender: '男',                  // 性別: 男/女/其他
 *           title: '先生',                 // 尊稱: 先生/女士/博士/教授
 *           notes: '需要素食餐點',         // 留言備註
 *           marketing_consent: false       // 行銷同意
 *         })
 *       });
 *       const result = await response.json();
 *       ```
 *
 *       ### 步驟 3: 處理回應
 *       ```javascript
 *       if (result.success) {
 *         const { trace_id, user_id, qr_code } = result.data;
 *
 *         // 儲存 trace_id 用於後續查詢
 *         localStorage.setItem('trace_id', trace_id);
 *
 *         // user_id 用於遊戲 API 串接
 *         localStorage.setItem('user_id', user_id);
 *
 *         // 顯示 QR Code (Base64 格式)
 *         document.getElementById('qrcode').src = qr_code.base64;
 *       }
 *       ```
 *
 *       ---
 *       ## 📌 欄位說明
 *
 *       | 欄位 | 類型 | 必填 | 說明 |
 *       |------|------|:----:|------|
 *       | name | string | ✅ | 姓名 (2-50字) |
 *       | email | string | ✅ | 電子郵件 |
 *       | phone | string | ✅ | 手機號碼 |
 *       | data_consent | boolean | ✅ | 資料使用同意 (必須為 true) |
 *       | company | string | ⭕ | 公司名稱 (最多100字) |
 *       | position | string | ⭕ | 職位 (最多50字) |
 *       | gender | string | ⭕ | 性別: `男` / `女` / `其他` |
 *       | title | string | ⭕ | 尊稱: `先生` / `女士` / `博士` / `教授` |
 *       | notes | string | ⭕ | 留言備註 (最多500字) |
 *       | marketing_consent | boolean | ⭕ | 行銷推廣同意 |
 *
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 活動 ID（從 `GET /api/v1/events/code/{code}` 的回應中獲取 `data.id`）
 *         example: 1
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
 *                 example: "王大明"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 電子郵件
 *                 example: "wang@example.com"
 *               phone:
 *                 type: string
 *                 pattern: '^[0-9\-\+\s\(\)]{8,20}$'
 *                 description: 手機號碼
 *                 example: "0934567890"
 *               company:
 *                 type: string
 *                 maxLength: 100
 *                 description: 公司名稱
 *                 example: "軟體開發公司"
 *               position:
 *                 type: string
 *                 maxLength: 50
 *                 description: 職位
 *                 example: "資深工程師"
 *               gender:
 *                 type: string
 *                 enum: ["男", "女", "其他"]
 *                 description: 性別
 *                 example: "男"
 *               title:
 *                 type: string
 *                 enum: ["先生", "女士", "博士", "教授"]
 *                 description: 尊稱
 *                 example: "先生"
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: 留言備註
 *                 example: "請安排素食餐點"
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
 *                       description: 報名記錄 ID
 *                       example: 3
 *                     user_id:
 *                       type: integer
 *                       description: |
 *                         用戶識別 ID，用於遊戲 API 的 user_id 參數
 *                         值與 registration_id 相同，方便前端串接遊戲功能
 *                       example: 3
 *                     trace_id:
 *                       type: string
 *                       description: 追蹤 ID，用於查詢報名狀態和 QR Code
 *                       example: "MICE-05207cf7-199967c04"
 *                     event:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "2024年度科技論壇"
 *                         date:
 *                           type: string
 *                           example: "2025-09-15"
 *                         location:
 *                           type: string
 *                           example: "台北國際會議中心"
 *                     participant:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "王大明"
 *                         email:
 *                           type: string
 *                           example: "wang@example.com"
 *                     qr_code:
 *                       type: object
 *                       properties:
 *                         data:
 *                           type: string
 *                           example: "MICE-05207cf7-199967c04"
 *                         url:
 *                           type: string
 *                           description: QR Code 查詢 URL
 *                           example: "/api/v1/qr-codes/MICE-05207cf7-199967c04"
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
    body('gender').optional().trim().isIn(['男', '女', '其他']).withMessage('性別必須是：男、女、其他'),
    body('title').optional().trim().isIn(['先生', '女士', '博士', '教授']).withMessage('尊稱必須是：先生、女士、博士、教授'),
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('留言備註不能超過 500 字符'),
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

        const { name, email, phone, company, position, gender, title, notes, data_consent, marketing_consent } = req.body;

        const result = await registrationService.submitRegistration({
            eventId: req.params.eventId,
            name,
            email,
            phone,
            company: company || '',
            position: position || '',
            gender: gender || null,
            title: title || null,
            notes: notes || null,
            dataConsent: data_consent === true || data_consent === 'true' || data_consent === 1 ? 1 : 0,
            marketingConsent: marketing_consent === true || marketing_consent === 'true' || marketing_consent === 1 ? 1 : 0,
            ipAddress: req.ip || req.connection.remoteAddress || null,
            userAgent: req.get('User-Agent') || null
        });

        console.log('活動報名成功:', {
            registration_id: result.registrationId,
            trace_id: result.traceId,
            event_name: result.event.name,
            participant_name: name,
            timestamp: new Date().toISOString()
        });

        return responses.success(res, {
            registration_id: result.registrationId,
            user_id: result.registrationId,  // 用於遊戲 API 的 user_id 參數
            trace_id: result.traceId,
            pass_code: result.passCode,
            project_code: result.projectCode,
            event: result.event,
            participant: result.participant,
            qr_code: result.qrCode,
            confirmation_email_sent: false
        }, '報名成功！確認信已發送至您的電子郵件。', 201);

    } catch (error) {
        return handleServiceError(res, error, '報名過程發生錯誤，請稍後再試');
    }
});

/**
 * @swagger
 * /api/v1/events/{eventId}/registrations/batch:
 *   post:
 *     tags: [Registrations (活動報名)]
 *     summary: 提交團體報名 (最多 5 人)
 *     description: |
 *       提交團體報名資料，系統會自動生成多組 QR Code 和 trace_id。
 *       單次請求最多包含 1 位主報名人 + 4 位同行者。
 *       
 *       **注意**: 若同行者未提供 Email，將自動使用主報名人的 Email。
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
 *               - primaryParticipant
 *             properties:
 *               primaryParticipant:
 *                 type: object
 *                 required:
 *                   - name
 *                   - email
 *                   - phone
 *                   - data_consent
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: 姓名
 *                     example: "王大明"
 *                   email:
 *                     type: string
 *                     format: email
 *                     description: 電子郵件
 *                     example: "wang@example.com"
 *                   phone:
 *                     type: string
 *                     description: 手機號碼
 *                     example: "0912345678"
 *                   data_consent:
 *                     type: boolean
 *                     description: 資料使用同意
 *                     example: true
 *                   marketing_consent:
 *                     type: boolean
 *                     description: 行銷同意
 *                     example: false
 *                   company:
 *                     type: string
 *                     description: 公司名稱
 *                     example: "ABC 科技公司"
 *                   position:
 *                     type: string
 *                     description: 職位
 *                     example: "經理"
 *                   gender:
 *                     type: string
 *                     enum: ["男", "女", "其他", "male", "female", "other"]
 *                     description: 性別
 *                     example: "male"
 *                   title:
 *                     type: string
 *                     enum: ["先生", "女士", "博士", "教授"]
 *                     description: 尊稱
 *                     example: "先生"
 *                   notes:
 *                     type: string
 *                     description: 備註
 *                     example: "需要素食餐點"
 *               participants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                   properties:
 *                     name:
 *                       type: string
 *                       description: 姓名
 *                       example: "李小華"
 *                     email:
 *                       type: string
 *                       format: email
 *                       description: 電子郵件（選填，若空白將使用主報名人 Email）
 *                       example: "li@example.com"
 *                     phone:
 *                       type: string
 *                       description: 手機號碼
 *                       example: "0987654321"
 *                     company:
 *                       type: string
 *                       description: 公司名稱
 *                       example: "ABC 科技公司"
 *                     position:
 *                       type: string
 *                       description: 職位
 *                       example: "工程師"
 *                     gender:
 *                       type: string
 *                       enum: ["男", "女", "其他", "male", "female", "other"]
 *                       description: 性別
 *                       example: "female"
 *                     title:
 *                       type: string
 *                       enum: ["先生", "女士", "博士", "教授"]
 *                       description: 尊稱
 *                       example: "女士"
 *                     notes:
 *                       type: string
 *                       description: 備註
 *                 maxItems: 4
 *                 description: 同行者列表（最多 4 人）
 *     responses:
 *       201:
 *         description: 團體報名成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: 
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     groupId: 
 *                       type: string
 *                     count:
 *                       type: integer
 *                     registrations:
 *                       type: array
 */
router.post('/events/:eventId/registrations/batch', [
    param('eventId').isInt({ min: 1 }).withMessage('活動 ID 必須是正整數'),
    body('primaryParticipant').isObject().withMessage('主報名人資料必須是物件'),
    body('primaryParticipant.name').trim().isLength({ min: 2, max: 50 }).withMessage('主報名人姓名長度錯誤'),
    body('primaryParticipant.email').isEmail().withMessage('主報名人 Email 格式錯誤'),
    body('primaryParticipant.phone').matches(phoneRegex).withMessage('主報名人手機號碼格式錯誤'),
    body('primaryParticipant.data_consent').custom(val => val === true || val === 'true' || val === 1).withMessage('主報名人必須同意資料使用條款'),
    
    body('participants').optional().isArray({ max: 4 }).withMessage('同行者最多 4 人'),
    body('participants.*.name').trim().isLength({ min: 2, max: 50 }).withMessage('同行者姓名長度錯誤'),
    body('participants.*.email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('同行者 Email 格式錯誤'),
    body('participants.*.phone').optional({ nullable: true, checkFalsy: true }).matches(phoneRegex).withMessage('同行者手機號碼格式錯誤')
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

        const { primaryParticipant, participants } = req.body;

        // 轉換欄位名稱以符合 Service 層預期 (snake_case -> camelCase)
        const formatParticipant = (p) => ({
            name: p.name,
            email: p.email,
            phone: p.phone,
            company: p.company || '',
            position: p.position || '',
            gender: p.gender || null,
            title: p.title || null,
            notes: p.notes || null,
            dataConsent: p.data_consent === true || p.data_consent === 'true' || p.data_consent === 1,
            marketingConsent: p.marketing_consent === true || p.marketing_consent === 'true' || p.marketing_consent === 1
        });

        const result = await registrationService.submitBatchRegistration({
            eventId: req.params.eventId,
            primaryParticipant: formatParticipant(primaryParticipant),
            participants: (participants || []).map(formatParticipant),
            ipAddress: req.ip || req.connection.remoteAddress || null,
            userAgent: req.get('User-Agent') || null
        });

        return responses.success(res, result, '團體報名成功！', 201);

    } catch (error) {
        return handleServiceError(res, error, '團體報名過程發生錯誤');
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
 *         example: "MICE-d074dd3e-e3e27b6b0"
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
 *                       example: 3
 *                     trace_id:
 *                       type: string
 *                       example: "MICE-05207cf7-199967c04"
 *                     user_id:
 *                       type: integer
 *                       nullable: true
 *                       description: 關聯的後台用戶 ID（前端報名時為 null）
 *                       example: null
 *                     status:
 *                       type: string
 *                       enum: [pending, approved, confirmed, rejected, cancelled]
 *                       example: "confirmed"
 *                     event:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "2024年度科技論壇"
 *                         date:
 *                           type: string
 *                           example: "2025-09-15"
 *                         location:
 *                           type: string
 *                           example: "台北國際會議中心"
 *                     participant:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "王大明"
 *                         email:
 *                           type: string
 *                           example: "wang@example.com"
 *                         phone:
 *                           type: string
 *                           example: "0934567890"
 *                         company:
 *                           type: string
 *                           example: "軟體開發公司"
 *                         position:
 *                           type: string
 *                           example: "資深工程師"
 *                         title:
 *                           type: string
 *                           nullable: true
 *                           description: 尊稱
 *                           example: "先生"
 *                         gender:
 *                           type: string
 *                           nullable: true
 *                           description: 性別
 *                           example: "male"
 *                         notes:
 *                           type: string
 *                           nullable: true
 *                           description: 備註
 *                           example: "需要素食餐點"
 *                     qr_code:
 *                       type: object
 *                       properties:
 *                         data:
 *                           type: string
 *                           example: "MICE-05207cf7-199967c04"
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

        const result = await registrationService.getRegistrationStatus(req.params.traceId);

        return responses.success(res, {
            registration_id: result.registrationId,
            trace_id: result.traceId,
            user_id: result.userId,
            status: result.status,
            event: result.event,
            participant: result.participant,
            qr_code: {
                data: result.qrCode.data,
                scan_count: result.qrCode.scanCount,
                last_scanned: result.qrCode.lastScanned
            },
            check_in_status: result.checkInStatus,
            created_at: result.createdAt
        });

    } catch (error) {
        return handleServiceError(res, error, '查詢報名狀態失敗');
    }
});

/**
 * @swagger
 * /api/v1/qr-codes/{traceId}:
 *   get:
 *     tags: [Registrations (活動報名)]
 *     summary: 獲取 QR Code 圖片
 *     description: |
 *       根據 trace_id 生成並返回 QR Code 圖片（PNG 格式）
 *
 *       **用途**：
 *       - 前端直接顯示 QR Code 圖片
 *       - 下載 QR Code 圖片
 *
 *       **注意**：如果需要 Base64 格式，請使用 `/api/v1/qr-codes/{traceId}/data` 端點
 *     parameters:
 *       - in: path
 *         name: traceId
 *         required: true
 *         schema:
 *           type: string
 *         description: 報名追蹤 ID
 *         example: "MICE-05207cf7-199967c04"
 *     responses:
 *       200:
 *         description: QR Code 圖片（PNG 格式）
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: 參數驗證失敗
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 找不到報名記錄
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
router.get('/qr-codes/:traceId', [
    param('traceId').isLength({ min: 1, max: 50 }).withMessage('追蹤 ID 格式不正確')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const qrImageBuffer = await registrationService.getQrCodeImage(req.params.traceId);

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', qrImageBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');

        return res.send(qrImageBuffer);

    } catch (error) {
        return handleServiceError(res, error, '生成 QR Code 失敗');
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
 *         example: "MICE-d074dd3e-e3e27b6b0"
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
 *                       example: "MICE-05207cf7-199967c04"
 *                     qr_data:
 *                       type: string
 *                       example: "MICE-05207cf7-199967c04"
 *                     qr_base64:
 *                       type: string
 *                       description: QR Code Base64 編碼，可直接用於 <img src="">
 *                       example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *                     participant_name:
 *                       type: string
 *                       example: "王大明"
 *                     event_name:
 *                       type: string
 *                       example: "2024年度科技論壇"
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

        const result = await registrationService.getQrCodeData(req.params.traceId);

        return responses.success(res, {
            trace_id: result.traceId,
            qr_data: result.qrData,
            qr_base64: result.qrBase64,
            participant_name: result.participantName,
            event_name: result.eventName,
            scan_count: result.scanCount,
            last_scanned: result.lastScanned,
            created_at: result.createdAt
        });

    } catch (error) {
        return handleServiceError(res, error, '查詢 QR Code 數據失敗');
    }
});

/**
 * @swagger
 * /api/v1/verify-pass-code:
 *   post:
 *     tags: [Registrations (活動報名)]
 *     summary: 驗證活動通行碼
 *     description: |
 *       用通行碼和專案資訊驗證報名身份，返回 trace_id
 *
 *       **用途**：
 *       - 跨瀏覽器場景下恢復報名資訊
 *       - localStorage 遺失時重新獲取 trace_id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pass_code
 *             properties:
 *               pass_code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 description: 6 位數通行碼（報名成功時返回）
 *                 example: "847291"
 *               project_id:
 *                 type: integer
 *                 description: 專案 ID（與 project_code 二選一）
 *                 example: 1
 *               project_code:
 *                 type: string
 *                 description: 專案代碼（與 project_id 二選一）
 *                 example: "TECH2024"
 *     responses:
 *       200:
 *         description: 驗證成功
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
 *                       example: "MICE-05207cf7-199967c04"
 *                     participant_name:
 *                       type: string
 *                       example: "王大明"
 *                     project_code:
 *                       type: string
 *                       example: "TECH2024"
 *       400:
 *         description: 請求參數錯誤
 *       404:
 *         description: 通行碼無效或不存在
 */
/**
 * @swagger
 * /api/v1/registrations/{traceId}/resend-email:
 *   post:
 *     tags: [Registrations (活動報名)]
 *     summary: 重新發送邀請信
 *     description: |
 *       當用戶遺失或刪除邀請信時，可透過此端點重新發送。
 *       系統會使用相同的 QR Code 和通行碼重新發送郵件。
 *     parameters:
 *       - in: path
 *         name: traceId
 *         required: true
 *         schema:
 *           type: string
 *         description: 報名追蹤 ID
 *         example: "MICE-05207cf7-199967c04"
 *     responses:
 *       200:
 *         description: 郵件發送成功
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
 *                     email:
 *                       type: string
 *                       example: "wang@example.com"
 *                     message:
 *                       type: string
 *                       example: "邀請信已重新發送"
 *       404:
 *         description: 找不到報名記錄
 *       500:
 *         description: 郵件發送失敗
 */
router.post('/registrations/:traceId/resend-email', [
    param('traceId').isLength({ min: 1, max: 50 }).withMessage('追蹤 ID 格式不正確')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const result = await registrationService.resendInvitationEmail(req.params.traceId);

        return responses.success(res, result);

    } catch (error) {
        return handleServiceError(res, error, '重新發送邀請信失敗');
    }
});

router.post('/verify-pass-code', [
    body('pass_code').isLength({ min: 6, max: 6 }).withMessage('通行碼必須是 6 位數')
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

        const { pass_code, project_id, project_code } = req.body;

        const result = await registrationService.verifyPassCode({
            passCode: pass_code,
            projectId: project_id,
            projectCode: project_code
        });

        console.log('通行碼驗證成功:', {
            pass_code,
            trace_id: result.traceId,
            participant_name: result.participantName,
            timestamp: new Date().toISOString()
        });

        return responses.success(res, {
            trace_id: result.traceId,
            participant_name: result.participantName,
            project_code: result.projectCode
        }, '驗證成功');

    } catch (error) {
        return handleServiceError(res, error, '通行碼驗證失敗');
    }
});

module.exports = router;
