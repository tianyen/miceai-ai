/**
 * QR Code 名片 API
 * 路徑: /api/v1/business-cards
 * @swagger
 * tags:
 *   name: Business Cards
 *   description: QR Code 名片管理 API
 */

const express = require('express');
const router = express.Router();
const database = require('../../../config/database');
const config = require('../../../config');
const responses = require('../../../utils/responses');
const { body, param, query, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const crypto = require('crypto');

// 記錄 API 訪問日誌
const logApiAccess = async (req, endpoint, responseStatus, responseTime) => {
    try {
        await database.run(`
            INSERT INTO api_access_logs (
                endpoint, method, ip_address, user_agent,
                request_data, response_status, response_time_ms, trace_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            endpoint,
            req.method,
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent'),
            JSON.stringify(req.body),
            responseStatus,
            responseTime,
            req.body?.trace_id || null
        ]);
    } catch (error) {
        console.error('記錄 API 訪問日誌失敗:', error);
    }
};

// 中間件：記錄請求開始時間
router.use((req, res, next) => {
    req.startTime = Date.now();
    next();
});

// 中間件：記錄 API 訪問
router.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function(data) {
        const responseTime = Date.now() - req.startTime;
        logApiAccess(req, req.originalUrl, res.statusCode, responseTime);
        originalSend.call(this, data);
    };
    next();
});

/**
 * 生成唯一的名片 ID
 */
function generateCardId() {
    return 'BC' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
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

        const {
            project_id,
            name,
            title,
            company,
            phone,
            email,
            address,
            website,
            linkedin,
            wechat,
            facebook,
            twitter,
            instagram
        } = req.body;

        // 驗證專案是否存在
        const project = await database.get(`
            SELECT id, project_name, status 
            FROM invitation_projects 
            WHERE id = ?
        `, [project_id]);

        if (!project) {
            return responses.error(res, '專案不存在', 404);
        }

        if (project.status !== 'active') {
            return responses.error(res, '專案未啟用，無法創建名片', 400);
        }

        // 生成唯一的名片 ID
        const cardId = generateCardId();

        // 生成名片展示頁面 URL（用於 QR Code 掃描）
        const cardUrl = `${config.app.baseUrl}/business-card/${cardId}`;

        // 生成 QR Code Base64（使用網址，方便名片交換）
        const qrCodeBase64 = await QRCode.toDataURL(cardUrl, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            width: 256
        });

        // 儲存到數據庫
        const result = await database.run(`
            INSERT INTO business_cards (
                card_id, project_id, name, title, company, phone, email, 
                address, website, linkedin, wechat, facebook, twitter, 
                instagram, qr_code_base64, qr_code_data, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            cardId, project_id, name, title || null, company || null,
            phone || null, email || null, address || null, website || null,
            linkedin || null, wechat || null, facebook || null,
            twitter || null, instagram || null, qrCodeBase64, cardUrl
        ]);

        // 返回成功回應
        const responseData = {
            card_id: cardId,
            project_id: project_id,
            project_name: project.project_name,
            name: name,
            title: title || null,
            company: company || null,
            contact_info: {
                phone: phone || null,
                email: email || null,
                address: address || null,
                website: website || null
            },
            social_media: {
                linkedin: linkedin || null,
                wechat: wechat || null,
                facebook: facebook || null,
                twitter: twitter || null,
                instagram: instagram || null
            },
            qr_code: {
                base64: qrCodeBase64,
                data: cardUrl
            },
            created_at: new Date().toISOString()
        };

        return responses.success(res, responseData, '名片創建成功');

    } catch (error) {
        console.error('創建名片錯誤:', error);
        return responses.error(res, '創建名片失敗', 500);
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

        const projectId = req.params.projectId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // 驗證專案是否存在
        const project = await database.get(`
            SELECT id, project_name, status
            FROM invitation_projects
            WHERE id = ?
        `, [projectId]);

        if (!project) {
            return responses.error(res, '專案不存在', 404);
        }

        // 獲取名片列表
        const cards = await database.query(`
            SELECT
                card_id, name, title, company, email, phone,
                scan_count, created_at, is_active
            FROM business_cards
            WHERE project_id = ? AND is_active = 1
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [projectId, limit, offset]);

        // 獲取總數
        const totalResult = await database.get(`
            SELECT COUNT(*) as total
            FROM business_cards
            WHERE project_id = ? AND is_active = 1
        `, [projectId]);

        const total = totalResult.total;
        const totalPages = Math.ceil(total / limit);

        const responseData = {
            project_id: projectId,
            project_name: project.project_name,
            cards: cards,
            pagination: {
                current_page: page,
                total_pages: totalPages,
                total_items: total,
                items_per_page: limit,
                has_next: page < totalPages,
                has_prev: page > 1
            }
        };

        return responses.success(res, responseData);

    } catch (error) {
        console.error('獲取名片列表錯誤:', error);
        return responses.error(res, '獲取名片列表失敗', 500);
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

        const cardId = req.params.cardId;

        const card = await database.get(`
            SELECT
                bc.*,
                p.project_name,
                p.status as project_status
            FROM business_cards bc
            JOIN invitation_projects p ON bc.project_id = p.id
            WHERE bc.card_id = ? AND bc.is_active = 1
        `, [cardId]);

        if (!card) {
            return responses.error(res, '名片不存在或已停用', 404);
        }

        // 更新掃描統計
        await database.run(`
            UPDATE business_cards
            SET scan_count = scan_count + 1, last_scanned_at = CURRENT_TIMESTAMP
            WHERE card_id = ?
        `, [cardId]);

        // 格式化回應數據
        const responseData = {
            card_id: card.card_id,
            project_id: card.project_id,
            project_name: card.project_name,
            name: card.name,
            title: card.title,
            company: card.company,
            contact_info: {
                phone: card.phone,
                email: card.email,
                address: card.address,
                website: card.website
            },
            social_media: {
                linkedin: card.linkedin,
                wechat: card.wechat,
                facebook: card.facebook,
                twitter: card.twitter,
                instagram: card.instagram
            },
            qr_code: {
                base64: card.qr_code_base64,
                data: card.qr_code_data
            },
            statistics: {
                scan_count: card.scan_count + 1,
                last_scanned_at: new Date().toISOString()
            },
            created_at: card.created_at
        };

        return responses.success(res, responseData);

    } catch (error) {
        console.error('獲取名片錯誤:', error);
        return responses.error(res, '獲取名片失敗', 500);
    }
});

module.exports = router;
