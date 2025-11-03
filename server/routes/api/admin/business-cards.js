/**
 * 後台 QR Code 名片管理 API
 * 路徑: /api/admin/business-cards
 */

const express = require('express');
const router = express.Router();
const database = require('../../../config/database');
const responses = require('../../../utils/responses');
const { param, query, validationResult } = require('express-validator');

/**
 * 獲取專案下的所有名片列表（後台管理）
 * GET /api/admin/business-cards/project/:projectId
 */
router.get('/project/:projectId', [
    param('projectId').isInt({ min: 1 }).withMessage('專案 ID 必須是正整數'),
    query('page').optional().isInt({ min: 1 }).withMessage('頁碼必須是正整數'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每頁筆數必須在 1-100 之間'),
    query('search').optional().isLength({ max: 100 }).withMessage('搜尋關鍵字長度不能超過 100 字符')
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
        const search = req.query.search || '';

        // 驗證專案是否存在
        const project = await database.get(`
            SELECT id, project_name, status 
            FROM event_projects 
            WHERE id = ?
        `, [projectId]);

        if (!project) {
            return responses.error(res, '專案不存在', 404);
        }

        // 構建搜尋條件
        let whereClause = 'WHERE project_id = ?';
        let params = [projectId];

        if (search) {
            whereClause += ' AND (name LIKE ? OR company LIKE ? OR email LIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        // 獲取名片列表
        const cards = await database.query(`
            SELECT 
                id, card_id, name, title, company, email, phone, website,
                linkedin, wechat, scan_count, last_scanned_at,
                is_active, created_at, updated_at
            FROM business_cards
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        // 獲取總數
        const totalResult = await database.get(`
            SELECT COUNT(*) as total 
            FROM business_cards 
            ${whereClause}
        `, params);

        const total = totalResult.total;
        const totalPages = Math.ceil(total / limit);

        const responseData = {
            project_id: projectId,
            project_name: project.project_name,
            cards: cards.map(card => ({
                ...card,
                last_scanned_at: card.last_scanned_at || null,
                social_media: {
                    linkedin: card.linkedin,
                    wechat: card.wechat
                }
            })),
            pagination: {
                current_page: page,
                total_pages: totalPages,
                total_items: total,
                items_per_page: limit,
                has_next: page < totalPages,
                has_prev: page > 1
            },
            search: search
        };

        return responses.success(res, responseData);

    } catch (error) {
        console.error('獲取名片列表錯誤:', error);
        return responses.error(res, '獲取名片列表失敗', 500);
    }
});

/**
 * 獲取名片詳細資訊（後台管理）
 * GET /api/admin/business-cards/:cardId
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
            JOIN event_projects p ON bc.project_id = p.id
            WHERE bc.card_id = ?
        `, [cardId]);

        if (!card) {
            return responses.error(res, '名片不存在', 404);
        }

        // 格式化回應數據
        const responseData = {
            id: card.id,
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
                scan_count: card.scan_count,
                last_scanned_at: card.last_scanned_at
            },
            status: {
                is_active: card.is_active,
                is_public: card.is_public
            },
            timestamps: {
                created_at: card.created_at,
                updated_at: card.updated_at
            }
        };

        return responses.success(res, responseData);

    } catch (error) {
        console.error('獲取名片詳情錯誤:', error);
        return responses.error(res, '獲取名片詳情失敗', 500);
    }
});

/**
 * 停用/啟用名片
 * PATCH /api/admin/business-cards/:cardId/status
 */
router.patch('/:cardId/status', [
    param('cardId').isLength({ min: 1, max: 50 }).withMessage('名片 ID 長度必須在 1-50 字符之間')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const cardId = req.params.cardId;
        const { is_active } = req.body;

        // 驗證名片是否存在
        const card = await database.get(`
            SELECT id, card_id, name, is_active 
            FROM business_cards 
            WHERE card_id = ?
        `, [cardId]);

        if (!card) {
            return responses.error(res, '名片不存在', 404);
        }

        // 更新狀態
        const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : (card.is_active ? 0 : 1);
        
        await database.run(`
            UPDATE business_cards 
            SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE card_id = ?
        `, [newStatus, cardId]);

        const responseData = {
            card_id: cardId,
            name: card.name,
            is_active: newStatus,
            message: newStatus ? '名片已啟用' : '名片已停用'
        };

        return responses.success(res, responseData, responseData.message);

    } catch (error) {
        console.error('更新名片狀態錯誤:', error);
        return responses.error(res, '更新名片狀態失敗', 500);
    }
});

/**
 * 刪除名片
 * DELETE /api/admin/business-cards/:cardId
 */
router.delete('/:cardId', [
    param('cardId').isLength({ min: 1, max: 50 }).withMessage('名片 ID 長度必須在 1-50 字符之間')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const cardId = req.params.cardId;

        // 驗證名片是否存在
        const card = await database.get(`
            SELECT id, card_id, name 
            FROM business_cards 
            WHERE card_id = ?
        `, [cardId]);

        if (!card) {
            return responses.error(res, '名片不存在', 404);
        }

        // 刪除名片
        await database.run(`
            DELETE FROM business_cards 
            WHERE card_id = ?
        `, [cardId]);

        const responseData = {
            card_id: cardId,
            name: card.name,
            message: '名片已刪除'
        };

        return responses.success(res, responseData, '名片刪除成功');

    } catch (error) {
        console.error('刪除名片錯誤:', error);
        return responses.error(res, '刪除名片失敗', 500);
    }
});

module.exports = router;
