/**
 * API v1 - 活動管理路由
 * 路徑: /api/v1/events
 */

const express = require('express');
const router = express.Router();
const database = require('../../../config/database');
const responses = require('../../../utils/responses');
const { body, param, query, validationResult } = require('express-validator');

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
 * 獲取活動列表
 * GET /api/v1/events
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
 * 根據代碼獲取特定活動
 * GET /api/v1/events/code/:code
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
                p.event_location as location,
                p.event_type as type,
                p.status,
                p.max_participants,
                p.registration_deadline,
                p.contact_email,
                p.contact_phone,
                p.agenda,
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

        // 格式化回應數據
        const responseData = {
            ...event,
            contact_info: {
                email: event.contact_email,
                phone: event.contact_phone
            }
        };

        // 移除重複的聯絡資訊欄位
        delete responseData.contact_email;
        delete responseData.contact_phone;

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
                p.event_location as location,
                p.event_type as type,
                p.status,
                p.max_participants,
                p.registration_deadline,
                p.contact_email,
                p.contact_phone,
                p.agenda,
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

        // 格式化回應數據
        const responseData = {
            ...event,
            contact_info: {
                email: event.contact_email,
                phone: event.contact_phone
            }
        };

        // 移除重複的聯絡資訊欄位
        delete responseData.contact_email;
        delete responseData.contact_phone;

        return responses.success(res, responseData);

    } catch (error) {
        console.error('獲取活動詳情錯誤:', error);
        return responses.error(res, '獲取活動詳情失敗', 500);
    }
});

module.exports = router;
