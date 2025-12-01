/**
 * Business Card Service
 * 名片 CRUD 操作、狀態管理、專案關聯查詢
 */
const BaseService = require('./base.service');
const QRCode = require('qrcode');
const crypto = require('crypto');

class BusinessCardService extends BaseService {
    constructor() {
        super('BusinessCardService');
    }

    /**
     * 生成名片 ID (格式: BC + 10碼隨機字串)
     */
    _generateCardId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = 'BC';
        for (let i = 0; i < 10; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }

    /**
     * 創建名片
     */
    async createCard(data) {
        const { project_id, name, title, company, phone, email, address,
                website, linkedin, wechat, facebook, twitter, instagram } = data;

        // 驗證專案存在
        const project = await this.db.get(
            'SELECT id, project_name FROM event_projects WHERE id = ?',
            [project_id]
        );
        if (!project) {
            this.throwError(this.ErrorCodes.PROJECT_NOT_FOUND);
        }

        // 生成唯一 card_id
        let cardId;
        let exists = true;
        while (exists) {
            cardId = this._generateCardId();
            const check = await this.db.get(
                'SELECT id FROM business_cards WHERE card_id = ?',
                [cardId]
            );
            exists = !!check;
        }

        // 生成 QR Code (指向名片展示頁)
        const cardUrl = `${process.env.BASE_URL || 'https://example.com'}/cards/${cardId}`;
        const qrCodeBase64 = await QRCode.toDataURL(cardUrl, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            width: 300,
            margin: 2
        });

        // 插入資料庫
        const result = await this.db.run(`
            INSERT INTO business_cards (
                card_id, project_id, name, title, company, phone, email, address,
                website, linkedin, wechat, facebook, twitter, instagram,
                qr_code_base64, qr_code_data, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
            cardId, project_id, name, title || null, company || null,
            phone || null, email || null, address || null, website || null,
            linkedin || null, wechat || null, facebook || null,
            twitter || null, instagram || null, qrCodeBase64, cardUrl
        ]);

        this.log('createCard', { cardId, name, project_id });

        return {
            id: result.lastID,
            card_id: cardId,
            project_id,
            project_name: project.project_name,
            name,
            title,
            company,
            contact_info: { phone, email, address, website },
            social_media: { linkedin, wechat, facebook, twitter, instagram },
            qr_code: { base64: qrCodeBase64, url: cardUrl },
            is_active: true
        };
    }

    /**
     * 獲取專案下的名片列表
     */
    async getCardsByProject(projectId, { page = 1, limit = 20, search = '' } = {}) {
        const offset = (page - 1) * limit;

        // 驗證專案是否存在
        const project = await this.db.get(`
            SELECT id, project_name, status
            FROM event_projects
            WHERE id = ?
        `, [projectId]);

        if (!project) {
            this.throwError(this.ErrorCodes.PROJECT_NOT_FOUND);
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
        const cards = await this.db.query(`
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
        const totalResult = await this.db.get(`
            SELECT COUNT(*) as total
            FROM business_cards
            ${whereClause}
        `, params);

        const total = totalResult.total;
        const totalPages = Math.ceil(total / limit);

        this.log('getCardsByProject', { projectId, page, limit, search, total, count: cards.length });

        return {
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
    }

    /**
     * 獲取名片詳情
     */
    async getCardById(cardId) {
        const card = await this.db.get(`
            SELECT
                bc.*,
                p.project_name,
                p.status as project_status
            FROM business_cards bc
            JOIN event_projects p ON bc.project_id = p.id
            WHERE bc.card_id = ?
        `, [cardId]);

        if (!card) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '名片不存在' });
        }

        this.log('getCardById', { cardId, name: card.name });

        return {
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
    }

    /**
     * 切換名片狀態
     */
    async toggleStatus(cardId, is_active) {
        // 驗證名片是否存在
        const card = await this.db.get(`
            SELECT id, card_id, name, is_active
            FROM business_cards
            WHERE card_id = ?
        `, [cardId]);

        if (!card) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '名片不存在' });
        }

        // 計算新狀態
        const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : (card.is_active ? 0 : 1);

        // 更新狀態
        await this.db.run(`
            UPDATE business_cards
            SET is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE card_id = ?
        `, [newStatus, cardId]);

        this.log('toggleStatus', { cardId, name: card.name, newStatus });

        return {
            card_id: cardId,
            name: card.name,
            is_active: newStatus,
            message: newStatus ? '名片已啟用' : '名片已停用'
        };
    }

    /**
     * 刪除名片
     */
    async deleteCard(cardId) {
        // 驗證名片是否存在
        const card = await this.db.get(`
            SELECT id, card_id, name
            FROM business_cards
            WHERE card_id = ?
        `, [cardId]);

        if (!card) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '名片不存在' });
        }

        // 刪除名片
        await this.db.run(`
            DELETE FROM business_cards
            WHERE card_id = ?
        `, [cardId]);

        this.log('deleteCard', { cardId, name: card.name });

        return {
            card_id: cardId,
            name: card.name,
            message: '名片已刪除'
        };
    }
}

module.exports = new BusinessCardService();
