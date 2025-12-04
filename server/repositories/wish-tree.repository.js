/**
 * Wish Tree Repository - 許願樹互動資料存取
 *
 * 職責：
 * - 封裝 wish_tree_interactions 表的所有 SQL 查詢
 * - 提供許願樹特定的查詢方法
 *
 * @extends BaseRepository
 * @refactor 2025-12-04
 */

const BaseRepository = require('./base.repository');

class WishTreeRepository extends BaseRepository {
    constructor() {
        super('wish_tree_interactions', 'id');
    }

    // ============================================================================
    // 統計查詢
    // ============================================================================

    /**
     * 取得專案許願總數
     * @param {number} projectId - 專案 ID
     * @returns {Promise<number>}
     */
    async countByProject(projectId) {
        const result = await this.rawGet(
            'SELECT COUNT(*) as total FROM wish_tree_interactions WHERE project_id = ?',
            [projectId]
        );
        return result?.total || 0;
    }

    // ============================================================================
    // 列表查詢
    // ============================================================================

    /**
     * 取得許願列表（含攤位資訊）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Array>}
     */
    async findByProjectWithBooth({ projectId, limit = 50, offset = 0 }) {
        const sql = `
            SELECT
                w.*,
                b.booth_name
            FROM wish_tree_interactions w
            LEFT JOIN booths b ON w.booth_id = b.id
            WHERE w.project_id = ?
            ORDER BY w.created_at DESC
            LIMIT ? OFFSET ?
        `;
        return this.rawAll(sql, [projectId, limit, offset]);
    }

    /**
     * 取得許願列表（用於匯出，含完整攤位資訊）
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async findAllByProjectForExport(projectId) {
        const sql = `
            SELECT
                w.id,
                w.wish_text,
                w.created_at,
                w.ip_address,
                b.booth_name,
                b.booth_code
            FROM wish_tree_interactions w
            LEFT JOIN booths b ON w.booth_id = b.id
            WHERE w.project_id = ?
            ORDER BY w.created_at DESC
        `;
        return this.rawAll(sql, [projectId]);
    }
}

// 單例模式
module.exports = new WishTreeRepository();
