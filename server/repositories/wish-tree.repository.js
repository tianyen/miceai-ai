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

    // ============================================================================
    // 創建方法
    // ============================================================================

    /**
     * 建立許願記錄
     * @param {Object} data - 許願資料
     * @returns {Promise<Object>}
     */
    async createWish({ project_id, booth_id, wish_text, image_base64, ip_address, user_agent, created_at }) {
        const sql = `
            INSERT INTO wish_tree_interactions (
                project_id, booth_id, wish_text, image_base64,
                ip_address, user_agent, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        return this.rawRun(sql, [
            project_id,
            booth_id || null,
            wish_text,
            image_base64 || null,
            ip_address,
            user_agent,
            created_at
        ]);
    }

    // ============================================================================
    // 查詢方法
    // ============================================================================

    /**
     * 依 ID 查詢許願記錄（含圖片）
     * @param {number} wishId - 許願 ID
     * @returns {Promise<Object|null>}
     */
    async findByIdWithImage(wishId) {
        return this.rawGet(
            `SELECT id, wish_text, image_base64, created_at, ip_address
             FROM wish_tree_interactions
             WHERE id = ?`,
            [wishId]
        );
    }

    /**
     * 取得最近的許願記錄（不含圖片）
     * @param {number} projectId - 專案 ID
     * @param {number} limit - 數量限制
     * @returns {Promise<Array>}
     */
    async findRecentWishes(projectId, limit = 20) {
        return this.rawAll(
            `SELECT id, wish_text, created_at, ip_address
             FROM wish_tree_interactions
             WHERE project_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [projectId, Math.min(limit, 100)]
        );
    }

    // ============================================================================
    // 統計查詢（帶條件過濾）
    // ============================================================================

    /**
     * 依條件統計許願數量
     * @param {Object} conditions - 查詢條件
     * @returns {Promise<number>}
     */
    async countWithConditions({ project_id, booth_id, start_date, end_date }) {
        let sql = 'SELECT COUNT(*) as total FROM wish_tree_interactions WHERE project_id = ?';
        const params = [project_id];

        if (booth_id) {
            sql += ' AND booth_id = ?';
            params.push(booth_id);
        }
        if (start_date) {
            sql += ' AND DATE(created_at) >= ?';
            params.push(start_date);
        }
        if (end_date) {
            sql += ' AND DATE(created_at) <= ?';
            params.push(end_date);
        }

        const result = await this.rawGet(sql, params);
        return result?.total || 0;
    }

    /**
     * 取得每小時分佈
     * @param {Object} conditions - 查詢條件
     * @returns {Promise<Array>}
     */
    async getHourlyDistribution({ project_id, booth_id, start_date, end_date }) {
        let sql = `
            SELECT
                strftime('%H:00', created_at) as hour,
                COUNT(*) as count
             FROM wish_tree_interactions
             WHERE project_id = ?`;
        const params = [project_id];

        if (booth_id) {
            sql += ' AND booth_id = ?';
            params.push(booth_id);
        }
        if (start_date) {
            sql += ' AND DATE(created_at) >= ?';
            params.push(start_date);
        }
        if (end_date) {
            sql += ' AND DATE(created_at) <= ?';
            params.push(end_date);
        }

        sql += ` GROUP BY strftime('%H', created_at) ORDER BY hour`;
        return this.rawAll(sql, params);
    }

    /**
     * 取得每日分佈
     * @param {Object} conditions - 查詢條件
     * @returns {Promise<Array>}
     */
    async getDailyDistribution({ project_id, booth_id, start_date, end_date }) {
        let sql = `
            SELECT
                DATE(created_at) as date,
                COUNT(*) as count
             FROM wish_tree_interactions
             WHERE project_id = ?`;
        const params = [project_id];

        if (booth_id) {
            sql += ' AND booth_id = ?';
            params.push(booth_id);
        }
        if (start_date) {
            sql += ' AND DATE(created_at) >= ?';
            params.push(start_date);
        }
        if (end_date) {
            sql += ' AND DATE(created_at) <= ?';
            params.push(end_date);
        }

        sql += ` GROUP BY DATE(created_at) ORDER BY date`;
        return this.rawAll(sql, params);
    }

    /**
     * 取得高峰時段（前5名）
     * @param {Object} conditions - 查詢條件
     * @returns {Promise<Array>}
     */
    async getPeakHours({ project_id, booth_id, start_date, end_date }) {
        let sql = `
            SELECT
                strftime('%H:00', created_at) as hour,
                COUNT(*) as count
             FROM wish_tree_interactions
             WHERE project_id = ?`;
        const params = [project_id];

        if (booth_id) {
            sql += ' AND booth_id = ?';
            params.push(booth_id);
        }
        if (start_date) {
            sql += ' AND DATE(created_at) >= ?';
            params.push(start_date);
        }
        if (end_date) {
            sql += ' AND DATE(created_at) <= ?';
            params.push(end_date);
        }

        sql += ` GROUP BY strftime('%H', created_at) ORDER BY count DESC LIMIT 5`;
        return this.rawAll(sql, params);
    }

    /**
     * 取得完整統計數據
     * @param {Object} conditions - 查詢條件
     * @returns {Promise<Object>}
     */
    async getStats({ project_id, booth_id, start_date, end_date }) {
        const [total, hourly, daily, peak] = await Promise.all([
            this.countWithConditions({ project_id, booth_id, start_date, end_date }),
            this.getHourlyDistribution({ project_id, booth_id, start_date, end_date }),
            this.getDailyDistribution({ project_id, booth_id, start_date, end_date }),
            this.getPeakHours({ project_id, booth_id, start_date, end_date })
        ]);

        return {
            total_wishes: total,
            hourly_distribution: hourly,
            daily_distribution: daily,
            peak_hours: peak
        };
    }
}

// 單例模式
module.exports = new WishTreeRepository();
