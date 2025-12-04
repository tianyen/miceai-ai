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
}

// 單例模式
module.exports = new BusinessCardRepository();
