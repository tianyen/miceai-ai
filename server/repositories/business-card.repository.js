/**
 * Business Card Repository - 名片資料存取
 *
 * 職責：
 * - 封裝 business_cards 表的所有 SQL 查詢
 * - 提供名片查詢與統計更新方法
 *
 * @extends BaseRepository
 * @refactor 2025-12-04
 */

const BaseRepository = require('./base.repository');

class BusinessCardRepository extends BaseRepository {
    constructor() {
        super('business_cards', 'id');
    }

    // ============================================================================
    // 查詢方法
    // ============================================================================

    /**
     * 依卡片 ID 查詢名片（含專案資訊）
     * @param {string} cardId - 名片唯一識別碼
     * @returns {Promise<Object|null>}
     */
    async findByCardIdWithProject(cardId) {
        const sql = `
            SELECT
                bc.*,
                ip.project_name,
                ip.event_date,
                ip.event_location
            FROM business_cards bc
            LEFT JOIN event_projects ip ON bc.project_id = ip.id
            WHERE bc.card_id = ? AND bc.is_active = 1
        `;
        return this.rawGet(sql, [cardId]);
    }

    /**
     * 依卡片 ID 查詢名片
     * @param {string} cardId - 名片唯一識別碼
     * @returns {Promise<Object|null>}
     */
    async findByCardId(cardId) {
        return this.findOne({ card_id: cardId });
    }

    /**
     * 依專案 ID 查詢名片列表
     * @param {number} projectId - 專案 ID
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findByProjectId(projectId, { limit = 50, offset = 0 } = {}) {
        const sql = `
            SELECT *
            FROM business_cards
            WHERE project_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;
        return this.rawAll(sql, [projectId, limit, offset]);
    }

    // ============================================================================
    // 統計更新方法
    // ============================================================================

    /**
     * 增加掃描次數並更新最後掃描時間
     * @param {string} cardId - 名片唯一識別碼
     * @returns {Promise<Object>}
     */
    async incrementScanCount(cardId) {
        const sql = `
            UPDATE business_cards
            SET scan_count = scan_count + 1,
                last_scanned_at = CURRENT_TIMESTAMP
            WHERE card_id = ?
        `;
        return this.rawRun(sql, [cardId]);
    }

    /**
     * 取得名片統計資訊
     * @param {number} projectId - 專案 ID（可選）
     * @returns {Promise<Object>}
     */
    async getStats(projectId = null) {
        let sql = `
            SELECT
                COUNT(*) as total_cards,
                SUM(scan_count) as total_scans,
                COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_cards
            FROM business_cards
        `;
        const params = [];

        if (projectId) {
            sql += ' WHERE project_id = ?';
            params.push(projectId);
        }

        return this.rawGet(sql, params);
    }


    /**
     * 依專案 ID 和狀態查詢專案
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findByProjectWithStatus(projectId) {
        const sql = `
            SELECT id, project_name, status
            FROM event_projects
            WHERE id = ?
        `;
        return this.rawGet(sql, [projectId]);
    }

    /**
     * 依專案查詢名片列表（分頁、搜尋）
     * @param {number} projectId - 專案 ID
     * @param {string} search - 搜尋關鍵字
     * @param {number} limit - 限制數量
     * @param {number} offset - 偏移量
     * @returns {Promise<Array>}
     */
    async findByProjectWithSearch(projectId, search, limit, offset) {
        let sql = `
            SELECT
                id, card_id, name, title, company, email, phone, website,
                linkedin, wechat, scan_count, last_scanned_at,
                is_active, created_at, updated_at
            FROM business_cards
            WHERE project_id = ?
        `;
        const params = [projectId];

        if (search) {
            sql += ` AND (name LIKE ? OR company LIKE ? OR email ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        return this.rawAll(sql, params);
    }

    /**
     * 依專案統計名片數量
     * @param {number} projectId - 專案 ID
     * @param {string} search - 搜尋關鍵字（可選）
     * @returns {Promise<number>}
     */
    async countByProject(projectId, search = null) {
        let sql = `SELECT COUNT(*) as total FROM business_cards WHERE project_id = ?`;
        const params = [projectId];

        if (search) {
            sql += ` AND (name LIKE ? OR company LIKE ? OR email LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        const result = await this.rawGet(sql, params);
        return result?.total || 0;
    }

    /**
     * 依 card_id 查詢名片（不含專案資訊）
     * @param {string} cardId - 名片唯一識別碼
     * @returns {Promise<Object|null>}
     */
    async findBasicByCardId(cardId) {
        const sql = `
            SELECT id, card_id, name, title, company, is_active
            FROM business_cards
            WHERE card_id = ?
        `;
        return this.rawGet(sql, [cardId]);
    }

    /**
     * 依 card_id 更新名片狀態
     * @param {string} cardId - 名片唯一識別碼
     * @param {number} isActive - 啟用狀態
     * @returns {Promise<Object>}
     */
    async updateByCardId(cardId, isActive) {
        const sql = `
            UPDATE business_cards
            SET is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE card_id = ?
        `;
        return this.rawRun(sql, [isActive ? 1 : 0, cardId]);
    }

    /**
     * 依 card_id 刪除名片
     * @param {string} cardId - 名片唯一識別碼
     * @returns {Promise<Object>}
     */
    async deleteByCardId(cardId) {
        return this.rawRun(`DELETE FROM business_cards WHERE card_id = ?`, [cardId]);
    }

    /**
     * 建立名片
     * @param {Object} data - 名片資料
     * @returns {Promise<Object>}
     */
    async create(data) {
        const {
            card_id, project_id, name, title, company, phone, email, address,
            website, linkedin, wechat, facebook, twitter, instagram,
            qr_code_base64, qr_code_data
        } = data;

        const sql = `
            INSERT INTO business_cards (
                card_id, project_id, name, title, company, phone, email, address,
                website, linkedin, wechat, facebook, twitter, instagram,
                qr_code_base64, qr_code_data, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `;

        return this.rawRun(sql, [
            card_id, project_id, name, title || null, company || null,
            phone || null, email || null, address || null, website || null,
            linkedin || null, wechat || null, facebook || null,
            twitter || null, instagram || null, qr_code_base64, qr_code_data
        ]);
    }
}

// 單例模式
module.exports = new BusinessCardRepository();
