/**
 * API v1 - 報到管理路由
 * 路徑: /api/v1/check-in
 * @swagger
 * tags:
 *   name: Check-in (報到管理)
 *   description: 活動報到管理 API - 前端串接使用
 */

const express = require('express');
const router = express.Router();
const database = require('../../../config/database');
const responses = require('../../../utils/responses');
const { body, validationResult } = require('express-validator');

/**
 * @swagger
 * /api/v1/check-in:
 *   post:
 *     tags: [Check-in (報到管理)]
 *     summary: 掃描 QR Code 報到
 *     description: 使用 trace_id 進行活動報到，支援 QR Code 掃描報到
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trace_id
 *             properties:
 *               trace_id:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 description: 報名追蹤 ID（報名時返回）
 *                 example: "TRACE1728567890ABCD1234"
 *               scanner_location:
 *                 type: string
 *                 maxLength: 100
 *                 description: 掃描位置（選填）
 *                 example: "會場入口A"
 *               scanner_user_id:
 *                 type: integer
 *                 minimum: 1
 *                 description: 掃描員用戶 ID（選填）
 *                 example: 1
 *     responses:
 *       200:
 *         description: 報到成功
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
 *                   example: "報到成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     checkin_id:
 *                       type: integer
 *                       description: 報到記錄 ID
 *                       example: 123
 *                     trace_id:
 *                       type: string
 *                       description: 追蹤 ID
 *                       example: "TRACE1728567890ABCD1234"
 *                     participant_name:
 *                       type: string
 *                       description: 參與者姓名
 *                       example: "王小明"
 *                     project_name:
 *                       type: string
 *                       description: 活動名稱
 *                       example: "2024 科技論壇"
 *                     checkin_time:
 *                       type: string
 *                       format: date-time
 *                       description: 報到時間
 *                       example: "2025-10-10T16:30:00.000Z"
 *       400:
 *         description: 請求錯誤（活動未開放、報名狀態不允許等）
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
 *       409:
 *         description: 已經完成報到
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 服務器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', [
    body('trace_id').trim().isLength({ min: 1, max: 50 }).withMessage('追蹤 ID 不能為空'),
    body('scanner_location').optional().trim().isLength({ max: 100 }).withMessage('掃描位置不能超過 100 字符'),
    body('scanner_user_id').optional().isInt({ min: 1 }).withMessage('掃描員 ID 必須是正整數')
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

        const {
            trace_id,
            scanner_location = '',
            scanner_user_id = null
        } = req.body;

        // 查詢報名記錄
        const registration = await database.get(`
            SELECT 
                fs.id as submission_id,
                fs.trace_id,
                fs.project_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.company_name,
                fs.status,
                fs.checked_in_at,
                p.project_name,
                p.event_date,
                p.event_location,
                p.status as project_status
            FROM form_submissions fs
            JOIN invitation_projects p ON fs.project_id = p.id
            WHERE fs.trace_id = ?
        `, [trace_id]);

        if (!registration) {
            return responses.error(res, '找不到報名記錄', 404);
        }

        // 檢查活動狀態
        if (registration.project_status !== 'active') {
            return responses.error(res, '活動未開放報到', 400);
        }

        // 檢查報名狀態
        if (!['pending', 'approved', 'confirmed'].includes(registration.status)) {
            return responses.error(res, '報名狀態不允許報到', 400);
        }

        // 檢查是否已經報到
        if (registration.checked_in_at) {
            return responses.error(res, '已經完成報到', 409);
        }

        // 檢查活動日期（可選）
        if (registration.event_date) {
            const eventDate = new Date(registration.event_date);
            const today = new Date();
            const daysDiff = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
            
            // 如果活動日期超過 1 天前，可能不允許報到
            if (daysDiff < -1) {
                return responses.error(res, '活動已結束，無法報到', 400);
            }
        }

        const checkInTime = new Date().toISOString();

        // 更新報名記錄的報到狀態
        await database.run(`
            UPDATE form_submissions 
            SET checked_in_at = ?, 
                checkin_method = 'qr_scanner',
                checkin_location = ?,
                status = 'confirmed',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [checkInTime, scanner_location, registration.submission_id]);

        // 創建報到記錄
        const checkInResult = await database.run(`
            INSERT INTO check_in_records (
                trace_id, project_id, participant_name, check_in_time,
                scanner_location, scanner_user_id, check_in_method, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'qr_scanner', CURRENT_TIMESTAMP)
        `, [
            trace_id,
            registration.project_id,
            registration.submitter_name,
            checkInTime,
            scanner_location,
            scanner_user_id
        ]);

        // 更新 QR Code 掃描次數
        await database.run(`
            UPDATE qr_codes 
            SET scan_count = scan_count + 1,
                last_scanned = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE submission_id = ?
        `, [registration.submission_id]);

        // 記錄掃描歷史
        await database.run(`
            INSERT INTO scan_history (
                participant_id, scan_time, scanner_location, 
                scanner_user_id, scan_result, created_at
            ) VALUES (?, CURRENT_TIMESTAMP, ?, ?, 'success', CURRENT_TIMESTAMP)
        `, [registration.submission_id, scanner_location, scanner_user_id]);

        // 記錄參與者互動
        await database.run(`
            INSERT INTO participant_interactions (
                trace_id, project_id, submission_id, interaction_type,
                interaction_target, interaction_data, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            trace_id,
            registration.project_id,
            registration.submission_id,
            'check_in_completed',
            'qr_scanner',
            JSON.stringify({
                participant_name: registration.submitter_name,
                event_name: registration.project_name,
                scanner_location: scanner_location,
                check_in_method: 'qr_scanner'
            }),
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
        ]);

        // 構建回應數據
        const responseData = {
            check_in_id: checkInResult.lastID,
            participant: {
                name: registration.submitter_name,
                email: registration.submitter_email,
                company: registration.company_name
            },
            event: {
                name: registration.project_name,
                location: registration.event_location
            },
            check_in_time: checkInTime,
            scanner_location: scanner_location
        };

        console.log('QR Code 報到成功:', {
            check_in_id: checkInResult.lastID,
            trace_id: trace_id,
            participant_name: registration.submitter_name,
            event_name: registration.project_name,
            scanner_location: scanner_location,
            timestamp: checkInTime
        });

        return responses.success(res, responseData, '報到成功！歡迎參加活動。', 201);

    } catch (error) {
        console.error('QR Code 報到錯誤:', error);
        return responses.error(res, '報到過程發生錯誤，請稍後再試', 500);
    }
});

/**
 * @swagger
 * /api/v1/check-in/{traceId}:
 *   get:
 *     tags: [Check-in (報到管理)]
 *     summary: 查詢報到記錄
 *     description: 根據 trace_id 查詢報到記錄詳情
 *     parameters:
 *       - in: path
 *         name: traceId
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *         description: 報名追蹤 ID
 *         example: "TRACE1728567890ABCD1234"
 *     responses:
 *       200:
 *         description: 成功獲取報到記錄
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
 *                     check_in_id:
 *                       type: integer
 *                       description: 報到記錄 ID
 *                       example: 123
 *                     trace_id:
 *                       type: string
 *                       description: 追蹤 ID
 *                       example: "TRACE1728567890ABCD1234"
 *                     participant:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           description: 參與者姓名
 *                           example: "王小明"
 *                         email:
 *                           type: string
 *                           description: 電子郵件
 *                           example: "wang@example.com"
 *                         company:
 *                           type: string
 *                           description: 公司名稱
 *                           example: "科技公司"
 *                     event:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           description: 活動名稱
 *                           example: "2024 科技論壇"
 *                         location:
 *                           type: string
 *                           description: 活動地點
 *                           example: "台北國際會議中心"
 *                     check_in_time:
 *                       type: string
 *                       format: date-time
 *                       description: 報到時間
 *                       example: "2025-10-10T16:30:00.000Z"
 *                     scanner_location:
 *                       type: string
 *                       description: 掃描位置
 *                       example: "會場入口A"
 *                     check_in_method:
 *                       type: string
 *                       description: 報到方式
 *                       example: "qr_scanner"
 *                     scanner_name:
 *                       type: string
 *                       description: 掃描員姓名
 *                       example: "管理員"
 *                     notes:
 *                       type: string
 *                       description: 備註
 *                       example: ""
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: 記錄創建時間
 *                       example: "2025-10-10T16:30:00.000Z"
 *       404:
 *         description: 找不到報到記錄
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 服務器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:traceId', async (req, res) => {
    try {
        const traceId = req.params.traceId;

        const checkInRecord = await database.get(`
            SELECT 
                cr.id as check_in_id,
                cr.trace_id,
                cr.participant_name,
                cr.check_in_time,
                cr.scanner_location,
                cr.check_in_method,
                cr.notes,
                cr.created_at,
                p.project_name as event_name,
                p.event_location,
                fs.submitter_email,
                fs.company_name,
                u.full_name as scanner_name
            FROM check_in_records cr
            JOIN invitation_projects p ON cr.project_id = p.id
            LEFT JOIN form_submissions fs ON cr.trace_id = fs.trace_id
            LEFT JOIN users u ON cr.scanner_user_id = u.id
            WHERE cr.trace_id = ?
        `, [traceId]);

        if (!checkInRecord) {
            return responses.error(res, '找不到報到記錄', 404);
        }

        const responseData = {
            check_in_id: checkInRecord.check_in_id,
            trace_id: checkInRecord.trace_id,
            participant: {
                name: checkInRecord.participant_name,
                email: checkInRecord.submitter_email,
                company: checkInRecord.company_name
            },
            event: {
                name: checkInRecord.event_name,
                location: checkInRecord.event_location
            },
            check_in_time: checkInRecord.check_in_time,
            scanner_location: checkInRecord.scanner_location,
            check_in_method: checkInRecord.check_in_method,
            scanner_name: checkInRecord.scanner_name,
            notes: checkInRecord.notes,
            created_at: checkInRecord.created_at
        };

        return responses.success(res, responseData);

    } catch (error) {
        console.error('查詢報到記錄錯誤:', error);
        return responses.error(res, '查詢報到記錄失敗', 500);
    }
});

module.exports = router;
