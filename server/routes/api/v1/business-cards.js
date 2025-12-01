/**
 * QR Code 名片 API
 * 路徑: /api/v1/business-cards
 * @swagger
 * tags:
 *   name: Business Cards
 *   description: QR Code 名片管理 API
 *
 * @refactor 2025-12-01: 使用 businessCardService 處理業務邏輯
 */

const express = require('express');
const router = express.Router();
const { businessCardService } = require('../../../services');
const responses = require('../../../utils/responses');
const { body, param, query, validationResult } = require('express-validator');

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
 * /api/v1/business-cards:
 *   post:
 *     tags: [Business Cards]
 *     summary: 創建 QR Code 名片
 *     description: 創建新的 QR Code 名片，生成包含名片展示頁面 URL 的 QR Code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - project_id
 *               - name
 *             properties:
 *               project_id:
 *                 type: integer
 *                 description: 專案 ID
 *                 example: 1
 *               name:
 *                 type: string
 *                 description: 姓名
 *                 example: "張志明"
 *               title:
 *                 type: string
 *                 description: 職稱
 *                 example: "技術總監"
 *               company:
 *                 type: string
 *                 description: 公司名稱
 *                 example: "科技創新股份有限公司"
 *               phone:
 *                 type: string
 *                 description: 電話
 *                 example: "0912-345-678"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 電子郵件
 *                 example: "chang@techcompany.com"
 *               address:
 *                 type: string
 *                 description: 地址
 *                 example: "台北市信義區信義路五段7號"
 *               website:
 *                 type: string
 *                 format: uri
 *                 description: 網站
 *                 example: "https://techcompany.com"
 *               linkedin:
 *                 type: string
 *                 format: uri
 *                 description: LinkedIn 網址
 *                 example: "https://linkedin.com/in/chang-tech"
 *               wechat:
 *                 type: string
 *                 description: 微信號
 *                 example: "chang_tech_2024"
 *               facebook:
 *                 type: string
 *                 format: uri
 *                 description: Facebook 網址
 *                 example: "https://facebook.com/chang.tech"
 *               twitter:
 *                 type: string
 *                 format: uri
 *                 description: Twitter 網址
 *                 example: "https://twitter.com/chang_tech"
 *               instagram:
 *                 type: string
 *                 format: uri
 *                 description: Instagram 網址
 *                 example: "https://instagram.com/chang_tech"
 *     responses:
 *       201:
 *         description: 名片創建成功
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
 *                   example: "名片創建成功"
 *                 data:
 *                   $ref: '#/components/schemas/BusinessCard'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 專案不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', [
    body('project_id').isInt({ min: 1 }).withMessage('專案 ID 必須是正整數'),
    body('name').isLength({ min: 1, max: 100 }).withMessage('姓名長度必須在 1-100 字符之間'),
    body('title').optional().isLength({ max: 100 }).withMessage('職稱長度不能超過 100 字符'),
    body('company').optional().isLength({ max: 200 }).withMessage('公司名稱長度不能超過 200 字符'),
    body('phone').optional().isLength({ max: 20 }).withMessage('電話長度不能超過 20 字符'),
    body('email').optional().isEmail().withMessage('請提供有效的電子郵件地址'),
    body('address').optional().isLength({ max: 500 }).withMessage('地址長度不能超過 500 字符'),
    body('website').optional().isURL().withMessage('請提供有效的網址'),
    body('linkedin').optional().isURL().withMessage('請提供有效的 LinkedIn 網址'),
    body('wechat').optional().isLength({ max: 100 }).withMessage('微信號長度不能超過 100 字符'),
    body('facebook').optional().isURL().withMessage('請提供有效的 Facebook 網址'),
    body('twitter').optional().isURL().withMessage('請提供有效的 Twitter 網址'),
    body('instagram').optional().isURL().withMessage('請提供有效的 Instagram 網址')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const result = await businessCardService.createCard(req.body);
        return responses.success(res, result, '名片創建成功', 201);

    } catch (error) {
        return handleServiceError(res, error, '創建名片失敗');
    }
});

/**
 * @swagger
 * /api/v1/business-cards/project/{projectId}:
 *   get:
 *     tags: [Business Cards]
 *     summary: 獲取專案名片列表
 *     description: 獲取指定專案下的所有名片列表，支援分頁和搜尋
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 專案 ID
 *         example: 1
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: 每頁筆數
 *         example: 20
 *     responses:
 *       200:
 *         description: 成功獲取名片列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/BusinessCardList'
 *       404:
 *         description: 專案不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/project/:projectId', [
    param('projectId').isInt({ min: 1 }).withMessage('專案 ID 必須是正整數'),
    query('page').optional().isInt({ min: 1 }).withMessage('頁碼必須是正整數'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每頁筆數必須在 1-100 之間')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const projectId = parseInt(req.params.projectId);
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20
        };

        const result = await businessCardService.getCardsByProject(projectId, options);
        return responses.success(res, result);

    } catch (error) {
        return handleServiceError(res, error, '獲取名片列表失敗');
    }
});

/**
 * @swagger
 * /api/v1/business-cards/{cardId}:
 *   get:
 *     tags: [Business Cards]
 *     summary: 獲取名片詳情（JSON API）
 *     description: 根據名片 ID 獲取完整的名片資訊，返回 JSON 格式供前端串接使用
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: string
 *         description: 名片 ID
 *         example: "BCMG4XIRW2551924"
 *     responses:
 *       200:
 *         description: 成功獲取名片資訊
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/BusinessCardDetail'
 *       404:
 *         description: 名片不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:cardId', [
    param('cardId').isLength({ min: 1, max: 50 }).withMessage('名片 ID 長度必須在 1-50 字符之間')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const result = await businessCardService.getCardById(req.params.cardId);
        return responses.success(res, result);

    } catch (error) {
        return handleServiceError(res, error, '獲取名片失敗');
    }
});

module.exports = router;
