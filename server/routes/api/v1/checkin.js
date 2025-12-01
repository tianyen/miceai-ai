/**
 * API v1 - 報到管理路由
 * 路徑: /api/v1/check-in
 * @swagger
 * tags:
 *   name: Check-in (報到管理)
 *   description: 活動報到管理 API - 前端串接使用
 *
 * @refactor 2025-12-01: 使用 checkinService 處理業務邏輯
 */

const express = require('express');
const router = express.Router();
const { checkinService } = require('../../../services');
const responses = require('../../../utils/responses');
const { body, param, validationResult } = require('express-validator');

/**
 * 處理 Service 層錯誤
 */
function handleServiceError(res, error, defaultMessage) {
    console.error(`${defaultMessage}:`, error);

    if (error.statusCode) {
        const message = error.details?.message || error.message || defaultMessage;
        return responses.error(res, message, error.statusCode);
    }

    return responses.error(res, defaultMessage, 500);
}

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
 *                 description: 報名追蹤 ID（報名時返回，格式：MICE-{timestamp}-{random}）
 *                 example: "MICE-d074dd3e-e3e27b6b0"
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
 *                     check_in_id:
 *                       type: integer
 *                       description: 報到記錄 ID
 *                       example: 123
 *                     trace_id:
 *                       type: string
 *                       description: 追蹤 ID（格式：MICE-{timestamp}-{random}）
 *                       example: "MICE-d074dd3e-e3e27b6b0"
 *                     participant:
 *                       type: object
 *                       description: 參與者資訊
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "王小明"
 *                         email:
 *                           type: string
 *                           example: "wang@example.com"
 *                         company:
 *                           type: string
 *                           example: "科技公司"
 *                     event:
 *                       type: object
 *                       description: 活動資訊
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "2024 科技論壇"
 *                         location:
 *                           type: string
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

        const result = await checkinService.v1QrCheckin({
            traceId: trace_id,
            scannerLocation: scanner_location,
            scannerUserId: scanner_user_id,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });

        console.log('QR Code 報到成功:', {
            check_in_id: result.check_in_id,
            trace_id: result.trace_id,
            participant_name: result.participant.name,
            event_name: result.event.name,
            scanner_location: result.scanner_location,
            timestamp: result.check_in_time
        });

        return responses.success(res, result, '報到成功！歡迎參加活動。', 201);

    } catch (error) {
        return handleServiceError(res, error, '報到過程發生錯誤，請稍後再試');
    }
});

/**
 * @swagger
 * /api/v1/check-in/{trace_id}:
 *   get:
 *     tags: [Check-in (報到管理)]
 *     summary: 查詢報到記錄
 *     description: 根據 trace_id 查詢報到記錄詳情
 *     parameters:
 *       - in: path
 *         name: trace_id
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *         description: 報名追蹤 ID（格式：MICE-{timestamp}-{random}）
 *         example: "MICE-d074dd3e-e3e27b6b0"
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
 *                       description: 追蹤 ID（格式：MICE-{timestamp}-{random}）
 *                       example: "MICE-d074dd3e-e3e27b6b0"
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
router.get('/:traceId', [
    param('traceId').trim().isLength({ min: 1, max: 50 }).withMessage('追蹤 ID 格式無效')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const result = await checkinService.v1GetCheckinRecord(req.params.traceId);
        return responses.success(res, result);

    } catch (error) {
        return handleServiceError(res, error, '查詢報到記錄失敗');
    }
});

module.exports = router;
