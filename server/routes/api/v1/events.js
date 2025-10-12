/**
 * API v1 - 活動管理路由
 * 路徑: /api/v1/events
 * @swagger
 * tags:
 *   name: Events (活動管理)
 *   description: 活動查詢和管理 API - 前端串接使用
 */

const express = require('express');
const router = express.Router();
const database = require('../../../config/database');
const responses = require('../../../utils/responses');
const { param, query, validationResult } = require('express-validator');

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
 * @swagger
 * /api/v1/events:
 *   get:
 *     tags: [Events (活動管理)]
 *     summary: 獲取活動列表
 *     description: 獲取所有可報名的活動列表，支援分頁和篩選
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 頁碼
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 每頁筆數
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, completed, cancelled]
 *         description: 活動狀態
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [conference, seminar, workshop, exhibition, party, other]
 *         description: 活動類型
 *     responses:
 *       200:
 *         description: 成功獲取活動列表
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
 *                     events:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           name:
 *                             type: string
 *                             example: "2024 科技研討會"
 *                           code:
 *                             type: string
 *                             example: "TECH2024"
 *                           description:
 *                             type: string
 *                             example: "探討最新科技趨勢"
 *                           date:
 *                             type: string
 *                             format: date
 *                             example: "2024-12-15"
 *                           location:
 *                             type: string
 *                             example: "台北國際會議中心"
 *                           type:
 *                             type: string
 *                             example: "conference"
 *                           status:
 *                             type: string
 *                             example: "active"
 *                           max_participants:
 *                             type: integer
 *                             example: 200
 *                           current_participants:
 *                             type: integer
 *                             example: 45
 *                           registration_deadline:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-12-10T23:59:59Z"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 10
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         pages:
 *                           type: integer
 *                           example: 1
 *       400:
 *         description: 請求參數錯誤
 *       500:
 *         description: 服務器錯誤
 */
router.get('/', [
    query('page').optional().isInt({ min: 1 }).withMessage('頁碼必須是正整數'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每頁筆數必須在 1-100 之間'),
    query('status').optional().isIn(['draft', 'active', 'completed', 'cancelled']).withMessage('狀態值無效'),
    query('type').optional().isIn(['conference', 'seminar', 'workshop', 'exhibition', 'party', 'other']).withMessage('活動類型無效')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const status = req.query.status;
        const type = req.query.type;

        // 構建查詢條件
        let whereClause = 'WHERE 1=1';
        let params = [];

        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }

        if (type) {
            whereClause += ' AND event_type = ?';
            params.push(type);
        }

        // 獲取總數
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM invitation_projects 
            ${whereClause}
        `;
        const countResult = await database.get(countQuery, params);
        const total = countResult.total;

        // 獲取活動列表
        const eventsQuery = `
            SELECT 
                p.id,
                p.project_name as name,
                p.project_code as code,
                p.description,
                p.event_date as date,
                p.event_location as location,
                p.event_type as type,
                p.status,
                p.max_participants,
                p.registration_deadline,
                p.contact_email,
                p.contact_phone,
                p.created_at,
                COUNT(fs.id) as current_participants
            FROM invitation_projects p
            LEFT JOIN form_submissions fs ON p.id = fs.project_id 
                AND fs.status IN ('pending', 'approved', 'confirmed')
            ${whereClause}
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const events = await database.query(eventsQuery, [...params, limit, offset]);

        return responses.success(res, {
            events,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('獲取活動列表錯誤:', error);
        return responses.error(res, '獲取活動列表失敗', 500);
    }
});

/**
 * @swagger
 * /api/v1/events/code/{code}:
 *   get:
 *     tags: [Events (活動管理)]
 *     summary: 根據代碼獲取活動資訊
 *     description: |
 *       根據活動代碼獲取完整的活動資訊，包含活動模板資料
 *
 *       **用途**：前端報名頁面顯示活動詳情
 *
 *       **取代舊端點**：`/api/project-info/{projectCode}`
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: 活動代碼
 *         example: "TECH2024"
 *     responses:
 *       200:
 *         description: 成功獲取活動資訊
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
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "2024 科技研討會"
 *                     code:
 *                       type: string
 *                       example: "TECH2024"
 *                     description:
 *                       type: string
 *                       example: "探討最新科技趨勢"
 *                     date:
 *                       type: string
 *                       format: date
 *                       example: "2024-12-15"
 *                     event_start_date:
 *                       type: string
 *                       format: date
 *                       example: "2025-10-10"
 *                       description: 活動開始日期
 *                     event_end_date:
 *                       type: string
 *                       format: date
 *                       example: "2025-10-13"
 *                       description: 活動結束日期
 *                     event_highlights:
 *                       type: array
 *                       description: 活動亮點
 *                       items:
 *                         type: object
 *                         properties:
 *                           order:
 *                             type: integer
 *                             example: 1
 *                           title:
 *                             type: string
 *                             example: "大咖雲集"
 *                           content:
 *                             type: string
 *                             example: "200+ 知識學者和企業的行銷資訊，討論業界動態"
 *                     location:
 *                       type: string
 *                       example: "台北國際會議中心"
 *                     type:
 *                       type: string
 *                       example: "conference"
 *                     status:
 *                       type: string
 *                       example: "active"
 *                     max_participants:
 *                       type: integer
 *                       example: 200
 *                     current_participants:
 *                       type: integer
 *                       example: 45
 *                     registration_deadline:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-12-10T23:59:59Z"
 *                     agenda:
 *                       type: string
 *                       example: "09:00 報到\n10:00 開幕..."
 *                     contact_info:
 *                       type: object
 *                       properties:
 *                         email:
 *                           type: string
 *                           example: "contact@event.com"
 *                         phone:
 *                           type: string
 *                           example: "02-1234-5678"
 *                     template:
 *                       type: object
 *                       description: 活動模板資料（時刻表、流程、特別嘉賓等）
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: "科技論壇活動模板"
 *                         schedule:
 *                           type: object
 *                           description: 活動時刻表
 *                         agenda:
 *                           type: array
 *                           description: 活動議程
 *                           items:
 *                             type: object
 *                             properties:
 *                               order:
 *                                 type: string
 *                                 example: "1"
 *                               title:
 *                                 type: string
 *                                 example: "大咖雲集"
 *                               content:
 *                                 type: string
 *                                 example: "200+ 知識學者和企業的行銷資訊，討論業界動態"
 *                         special_guests:
 *                           type: array
 *                           description: 特別嘉賓資訊
 *       404:
 *         description: 找不到活動
 *       500:
 *         description: 服務器錯誤
 */
router.get('/code/:code', [
    param('code').isLength({ min: 1, max: 50 }).withMessage('活動代碼長度必須在 1-50 字符之間')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const eventCode = req.params.code;

        const event = await database.get(`
            SELECT
                p.id,
                p.project_name as name,
                p.project_code as code,
                p.description,
                p.event_date as date,
                p.event_start_date,
                p.event_end_date,
                p.event_highlights,
                p.event_location as location,
                p.event_type as type,
                p.status,
                p.max_participants,
                p.registration_deadline,
                p.contact_email,
                p.contact_phone,
                p.agenda,
                p.template_id,
                p.created_at,
                p.updated_at,
                COUNT(fs.id) as current_participants
            FROM invitation_projects p
            LEFT JOIN form_submissions fs ON p.id = fs.project_id
                AND fs.status IN ('pending', 'approved', 'confirmed')
            WHERE p.project_code = ?
            GROUP BY p.id
        `, [eventCode]);

        if (!event) {
            return responses.error(res, '活動不存在', 404);
        }

        // 獲取活動模板資料
        let eventTemplate = null;
        if (event.template_id) {
            try {
                eventTemplate = await database.get(`
                    SELECT
                        id,
                        template_name,
                        template_type,
                        template_content
                    FROM invitation_templates
                    WHERE id = ? AND template_type = 'event'
                `, [event.template_id]);

                if (eventTemplate && eventTemplate.template_content) {
                    try {
                        eventTemplate.template_content = JSON.parse(eventTemplate.template_content);
                    } catch (e) {
                        console.error('解析活動模板內容失敗:', e);
                        eventTemplate.template_content = null;
                    }
                }
            } catch (error) {
                console.error('獲取活動模板失敗:', error);
                // 不影響主要活動資料的返回
            }
        }

        // 解析 event_highlights JSON
        let highlights = null;
        if (event.event_highlights) {
            try {
                highlights = JSON.parse(event.event_highlights);
            } catch (e) {
                console.error('解析活動亮點失敗:', e);
                highlights = null;
            }
        }

        // 格式化回應數據
        const responseData = {
            ...event,
            event_highlights: highlights,
            contact_info: {
                email: event.contact_email,
                phone: event.contact_phone
            },
            template: eventTemplate ? {
                id: eventTemplate.id,
                name: eventTemplate.template_name,
                schedule: eventTemplate.template_content?.schedule || null,
                agenda: eventTemplate.template_content?.agenda || [],
                special_guests: eventTemplate.template_content?.special_guests || []
            } : null
        };

        // 移除重複的聯絡資訊欄位
        delete responseData.contact_email;
        delete responseData.contact_phone;
        delete responseData.template_id;

        return responses.success(res, responseData);

    } catch (error) {
        console.error('獲取活動詳情錯誤:', error);
        return responses.error(res, '獲取活動詳情失敗', 500);
    }
});

/**
 * 根據 ID 獲取特定活動
 * GET /api/v1/events/:id
 */
router.get('/:id', [
    param('id').isInt({ min: 1 }).withMessage('活動 ID 必須是正整數')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const eventId = req.params.id;

        const event = await database.get(`
            SELECT
                p.id,
                p.project_name as name,
                p.project_code as code,
                p.description,
                p.event_date as date,
                p.event_start_date,
                p.event_end_date,
                p.event_highlights,
                p.event_location as location,
                p.event_type as type,
                p.status,
                p.max_participants,
                p.registration_deadline,
                p.contact_email,
                p.contact_phone,
                p.agenda,
                p.template_id,
                p.created_at,
                p.updated_at,
                COUNT(fs.id) as current_participants
            FROM invitation_projects p
            LEFT JOIN form_submissions fs ON p.id = fs.project_id
                AND fs.status IN ('pending', 'approved', 'confirmed')
            WHERE p.id = ?
            GROUP BY p.id
        `, [eventId]);

        if (!event) {
            return responses.error(res, '活動不存在', 404);
        }

        // 獲取活動模板資料
        let eventTemplate = null;
        if (event.template_id) {
            try {
                eventTemplate = await database.get(`
                    SELECT
                        id,
                        template_name,
                        template_type,
                        template_content
                    FROM invitation_templates
                    WHERE id = ? AND template_type = 'event'
                `, [event.template_id]);

                if (eventTemplate && eventTemplate.template_content) {
                    try {
                        eventTemplate.template_content = JSON.parse(eventTemplate.template_content);
                    } catch (e) {
                        console.error('解析活動模板內容失敗:', e);
                        eventTemplate.template_content = null;
                    }
                }
            } catch (error) {
                console.error('獲取活動模板失敗:', error);
                // 不影響主要活動資料的返回
            }
        }

        // 解析 event_highlights JSON
        let highlights = null;
        if (event.event_highlights) {
            try {
                highlights = JSON.parse(event.event_highlights);
            } catch (e) {
                console.error('解析活動亮點失敗:', e);
                highlights = null;
            }
        }

        // 格式化回應數據
        const responseData = {
            ...event,
            event_highlights: highlights,
            contact_info: {
                email: event.contact_email,
                phone: event.contact_phone
            },
            template: eventTemplate ? {
                id: eventTemplate.id,
                name: eventTemplate.template_name,
                schedule: eventTemplate.template_content?.schedule || null,
                agenda: eventTemplate.template_content?.agenda || [],
                special_guests: eventTemplate.template_content?.special_guests || []
            } : null
        };

        // 移除重複的聯絡資訊欄位
        delete responseData.contact_email;
        delete responseData.contact_phone;
        delete responseData.template_id;

        return responses.success(res, responseData);

    } catch (error) {
        console.error('獲取活動詳情錯誤:', error);
        return responses.error(res, '獲取活動詳情失敗', 500);
    }
});

module.exports = router;
