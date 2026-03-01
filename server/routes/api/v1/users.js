/**
 * API v1 - 用戶查詢路由
 * 路徑: /api/v1/users
 *
 * 提供用戶資料查詢和完整旅程追蹤功能
 */

const express = require('express');
const router = express.Router();
const { param, query, validationResult } = require('express-validator');
const responses = require('../../../utils/responses');
const { validateTraceId } = require('../../../utils/traceId');
const { userQueryService } = require('../../../services');

/**
 * @swagger
 * tags:
 *   name: Users (用戶查詢)
 *   description: |
 *     用戶資料查詢 API - 提供 trace_id 查找和完整旅程追蹤
 *
 *     **使用流程**：
 *     1. 透過 email 查詢 trace_id: `GET /users/email/{email}`
 *     2. 透過 trace_id 查詢用戶資料: `GET /users/{traceId}`
 *     3. 透過 trace_id 查詢完整旅程: `GET /users/{traceId}/journey`
 */

/**
 * @swagger
 * /api/v1/users/email/{email}:
 *   get:
 *     tags: [Users (用戶查詢)]
 *     summary: 透過 Email 查詢 trace_id
 *     description: |
 *       根據用戶 email 查詢其所有報名記錄的 trace_id。
 *       可選擇額外帶入 `project_id` 或 `project_code`，僅查詢特定活動的報名記錄。
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: 用戶電子郵件
 *         example: "wang@example.com"
 *       - in: query
 *         name: project_id
 *         required: false
 *         schema:
 *           type: integer
 *         description: 限定查詢特定專案 ID
 *         example: 1
 *       - in: query
 *         name: project_code
 *         required: false
 *         schema:
 *           type: string
 *         description: 限定查詢特定專案代碼
 *         example: "DEMO_2026_1"
 *     responses:
 *       200:
 *         description: 成功查詢
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
 *                   example: "查詢成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       example: "wang@example.com"
 *                     registrations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           trace_id:
 *                             type: string
 *                             example: "MICE-d074dd3e-e3e27b6b0"
 *                           project_id:
 *                             type: integer
 *                             example: 1
 *                           user_id:
 *                             type: integer
 *                             description: 報名記錄 ID，等同於該專案流程使用的 user_id
 *                             example: 123
 *                           name:
 *                             type: string
 *                             example: "王小明"
 *                           project_name:
 *                             type: string
 *                             example: "2024 科技論壇"
 *                           project_code:
 *                             type: string
 *                             example: "TECH2024"
 *                           status:
 *                             type: string
 *                             example: "pending"
 *                           registered_at:
 *                             type: string
 *                             example: "2025-01-18 10:30:00"
 *                     total:
 *                       type: integer
 *                       example: 2
 *       400:
 *         description: Email 或查詢參數格式錯誤
 *       404:
 *         description: 找不到該 Email 的報名記錄
 */
router.get('/email/:email', [
    param('email').isEmail().withMessage('Email 格式無效'),
    query('project_id').optional().isInt({ min: 1 }).withMessage('project_id 必須為正整數'),
    query('project_code').optional().trim().isLength({ min: 1, max: 50 }).withMessage('project_code 格式無效')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.badRequest(res, errors.array()[0].msg);
        }

        const { email } = req.params;
        const { project_id: projectId, project_code: projectCode } = req.query;
        const result = await userQueryService.findByEmail(email, {
            projectId: projectId ? parseInt(projectId, 10) : null,
            projectCode: projectCode ? projectCode.trim() : null
        });

        if (!result.found) {
            return responses.notFound(res, '找不到該 Email 的報名記錄');
        }

        return responses.success(res, result.data, '查詢成功');
    } catch (error) {
        console.error('查詢用戶 Email 失敗:', error);
        return responses.serverError(res, '查詢失敗');
    }
});

/**
 * @swagger
 * /api/v1/users/{traceId}:
 *   get:
 *     tags: [Users (用戶查詢)]
 *     summary: 透過 trace_id 查詢用戶基本資料
 *     description: 根據 trace_id 查詢用戶報名資料和報到狀態
 *     parameters:
 *       - in: path
 *         name: traceId
 *         required: true
 *         schema:
 *           type: string
 *         description: 用戶追蹤 ID（格式：MICE-xxx-xxx）
 *         example: "MICE-d074dd3e-e3e27b6b0"
 *     responses:
 *       200:
 *         description: 成功獲取用戶資料
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
 *                   example: "查詢成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     trace_id:
 *                       type: string
 *                       example: "MICE-d074dd3e-e3e27b6b0"
 *                     name:
 *                       type: string
 *                       example: "王小明"
 *                     email:
 *                       type: string
 *                       example: "wang@example.com"
 *                     phone:
 *                       type: string
 *                       example: "0912345678"
 *                     company:
 *                       type: string
 *                       example: "科技公司"
 *                     position:
 *                       type: string
 *                       example: "工程師"
 *                     project:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: "2024 科技論壇"
 *                     registration:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "pending"
 *                         registered_at:
 *                           type: string
 *                           example: "2025-01-18 10:30:00"
 *                     checkin:
 *                       type: object
 *                       properties:
 *                         checked_in:
 *                           type: boolean
 *                           example: true
 *                         checked_in_at:
 *                           type: string
 *                           example: "2025-01-18 14:30:00"
 *       400:
 *         description: trace_id 格式錯誤
 *       404:
 *         description: 找不到該用戶
 */
router.get('/:traceId', [
    param('traceId').trim().isLength({ min: 1, max: 50 }).withMessage('trace_id 格式無效')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.badRequest(res, errors.array()[0].msg);
        }

        const { traceId } = req.params;

        if (!validateTraceId(traceId)) {
            return responses.badRequest(res, '無效的 trace_id 格式');
        }

        const result = await userQueryService.getUserInfo(traceId);

        if (!result.found) {
            return responses.notFound(res, '找不到該用戶');
        }

        return responses.success(res, result.data, '查詢成功');
    } catch (error) {
        console.error('查詢用戶資料失敗:', error);
        return responses.serverError(res, '查詢失敗');
    }
});

/**
 * @swagger
 * /api/v1/users/{traceId}/journey:
 *   get:
 *     tags: [Users (用戶查詢)]
 *     summary: 查詢用戶完整旅程
 *     description: |
 *       根據 trace_id 查詢用戶的完整活動旅程，包含：
 *       - 報名成功時間
 *       - 報到時間
 *       - 遊戲進度（攤位、分數、成功/失敗）
 *       - 兌換券獲得和使用記錄
 *     parameters:
 *       - in: path
 *         name: traceId
 *         required: true
 *         schema:
 *           type: string
 *         description: 用戶追蹤 ID（格式：MICE-xxx-xxx）
 *         example: "MICE-d074dd3e-e3e27b6b0"
 *     responses:
 *       200:
 *         description: 成功獲取用戶旅程
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
 *                   example: "查詢成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         trace_id:
 *                           type: string
 *                           example: "MICE-d074dd3e-e3e27b6b0"
 *                         name:
 *                           type: string
 *                           example: "王小明"
 *                         email:
 *                           type: string
 *                           example: "wang@example.com"
 *                         company:
 *                           type: string
 *                           example: "科技公司"
 *                         phone:
 *                           type: string
 *                           example: "0912345678"
 *                     timeline:
 *                       type: array
 *                       description: 按時間排序的事件列表
 *                       items:
 *                         type: object
 *                         properties:
 *                           event:
 *                             type: string
 *                             enum: [registration, checkin, game_start, game_end, voucher_received, voucher_used]
 *                             example: "game_end"
 *                           time:
 *                             type: string
 *                             example: "2025-01-18 15:30:00"
 *                           details:
 *                             type: object
 *                             description: 事件詳情（依事件類型不同）
 *                     summary:
 *                       type: object
 *                       properties:
 *                         games_played:
 *                           type: integer
 *                           description: 遊戲總場次
 *                           example: 3
 *                         games_won:
 *                           type: integer
 *                           description: 贏得兌換券的場次
 *                           example: 2
 *                         vouchers_total:
 *                           type: integer
 *                           description: 獲得的兌換券總數
 *                           example: 2
 *                         vouchers_used:
 *                           type: integer
 *                           description: 已使用的兌換券數
 *                           example: 1
 *       400:
 *         description: trace_id 格式錯誤
 *       404:
 *         description: 找不到該用戶
 */
router.get('/:traceId/journey', [
    param('traceId').trim().isLength({ min: 1, max: 50 }).withMessage('trace_id 格式無效')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.badRequest(res, errors.array()[0].msg);
        }

        const { traceId } = req.params;

        if (!validateTraceId(traceId)) {
            return responses.badRequest(res, '無效的 trace_id 格式');
        }

        const result = await userQueryService.getUserJourney(traceId);

        if (!result.found) {
            return responses.notFound(res, '找不到該用戶');
        }

        return responses.success(res, result.data, '查詢成功');
    } catch (error) {
        console.error('查詢用戶旅程失敗:', error);
        return responses.serverError(res, '查詢失敗');
    }
});

module.exports = router;
