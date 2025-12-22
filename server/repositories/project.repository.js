/**
 * Project Repository - 專案資料存取
 *
 * 職責：
 * - 封裝 projects 表的所有 SQL 查詢
 * - 提供專案特定的查詢方法
 *
 * @extends BaseRepository
 */

const BaseRepository = require('./base.repository');

class ProjectRepository extends BaseRepository {
    constructor() {
        super('event_projects', 'id');
    }

    // ============================================================================
    // 專案特定查詢
    // ============================================================================

    /**
     * 依專案代碼查詢
     * @param {string} projectCode - 專案代碼
     * @returns {Promise<Object|null>}
     */
    async findByCode(projectCode) {
        return this.findOne({ project_code: projectCode });
    }

    /**
     * 取得進行中的專案
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findActive(options = {}) {
        return this.findBy({ status: 'active' }, options);
    }

    /**
     * 根據 ID 查詢活動中的專案（含報名相關資訊）
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findActiveById(projectId) {
        const sql = `
            SELECT id, project_name, project_code, event_date, event_location,
                   status, max_participants, registration_deadline,
                   contact_email, contact_phone
            FROM event_projects
            WHERE id = ? AND status = 'active'
        `;
        return this.rawGet(sql, [projectId]);
    }

    /**
     * 搜尋專案（名稱或代碼）
     * @param {string} searchTerm - 搜尋關鍵字
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async search(searchTerm, { status = null, limit = 50 } = {}) {
        let sql = `
            SELECT p.*, COUNT(fs.id) as submission_count
            FROM event_projects p
            LEFT JOIN form_submissions fs ON p.id = fs.project_id
            WHERE (p.project_name LIKE ? OR p.project_code LIKE ?)
        `;
        const params = [`%${searchTerm}%`, `%${searchTerm}%`];

        if (status) {
            sql += ' AND p.status = ?';
            params.push(status);
        }

        sql += ' GROUP BY p.id ORDER BY p.created_at DESC LIMIT ?';
        params.push(limit);

        return this.rawAll(sql, params);
    }

    /**
     * 取得專案統計資料
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async getStats(projectId) {
        const sql = `
            SELECT
                COUNT(DISTINCT s.id) as total_participants,
                COUNT(DISTINCT CASE WHEN s.checked_in_at IS NOT NULL THEN s.id END) as checked_in_count,
                COUNT(DISTINCT qr.id) as questionnaire_responses,
                ROUND(
                    CASE
                        WHEN COUNT(DISTINCT s.id) > 0 THEN
                            (COUNT(DISTINCT CASE WHEN s.checked_in_at IS NOT NULL THEN s.id END) * 100.0) / COUNT(DISTINCT s.id)
                        ELSE 0
                    END
                ) as checkin_rate
            FROM form_submissions s
            LEFT JOIN questionnaire_responses qr ON s.trace_id = qr.trace_id
            WHERE s.project_id = ?
        `;
        const result = await this.rawGet(sql, [projectId]);

        // 計算小孩年齡分佈（只統計附屬報名人記錄，避免雙重計算）
        const ageDistribution = await this.getChildrenAgeDistribution(projectId);
        const totalChildren = ageDistribution.age_0_6 + ageDistribution.age_6_12 + ageDistribution.age_12_18;

        return {
            total_participants: result?.total_participants || 0,
            checked_in_count: result?.checked_in_count || 0,
            questionnaire_responses: result?.questionnaire_responses || 0,
            checkin_rate: result?.checkin_rate || 0,
            total_children: totalChildren,
            children_age_distribution: ageDistribution
        };
    }

    /**
     * 取得專案小孩年齡分佈統計
     *
     * 處理三種格式且避免雙重計算：
     * 1. 新格式（12/20 後）：小孩有獨立記錄 parent_submission_id IS NOT NULL
     * 2. 舊格式（12/20 前後台手動）：主報名人有 children_count 但無對應小孩記錄
     * 3. 舊格式團體小孩：有 group_id 但沒有 parent_submission_id 且 is_primary = 0
     *
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async getChildrenAgeDistribution(projectId) {
        // 1. 統計新格式：有 parent_submission_id 的附屬報名人（小孩獨立記錄）
        const newFormatSql = `
            SELECT children_ages
            FROM form_submissions
            WHERE project_id = ? AND parent_submission_id IS NOT NULL AND children_ages IS NOT NULL
        `;
        const newFormatRows = await this.rawAll(newFormatSql, [projectId]);

        // 2. 統計舊格式：主報名人有 children_count 但沒有對應小孩記錄
        const oldFormatSql = `
            SELECT p.children_ages
            FROM form_submissions p
            WHERE p.project_id = ?
              AND p.children_count > 0
              AND p.parent_submission_id IS NULL
              AND p.children_ages IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM form_submissions c
                  WHERE c.parent_submission_id = p.id
              )
        `;
        const oldFormatRows = await this.rawAll(oldFormatSql, [projectId]);

        // 3. 統計舊格式團體小孩：有 group_id 但沒有 parent_submission_id 連結，且不是主報名人
        const oldFormatGroupChildSql = `
            SELECT children_ages
            FROM form_submissions
            WHERE project_id = ?
              AND group_id IS NOT NULL
              AND parent_submission_id IS NULL
              AND is_primary = 0
              AND children_ages IS NOT NULL
        `;
        const oldFormatGroupChildRows = await this.rawAll(oldFormatGroupChildSql, [projectId]);

        const distribution = {
            age_0_6: 0,
            age_6_12: 0,
            age_12_18: 0
        };

        // 合併三種格式的數據
        const allRows = [...newFormatRows, ...oldFormatRows, ...oldFormatGroupChildRows];
        for (const row of allRows) {
            try {
                const ages = typeof row.children_ages === 'string'
                    ? JSON.parse(row.children_ages)
                    : row.children_ages;
                if (ages && typeof ages === 'object') {
                    distribution.age_0_6 += ages.age_0_6 || 0;
                    distribution.age_6_12 += ages.age_6_12 || 0;
                    distribution.age_12_18 += ages.age_12_18 || 0;
                }
            } catch (e) {
                // 忽略無效的 JSON
            }
        }

        return distribution;
    }

    /**
     * 取得專案參與者列表（含簽到狀態）
     * @param {number} projectId - 專案 ID
     * @param {number} limit - 筆數限制
     * @returns {Promise<Array>}
     */
    async getParticipants(projectId, { page = 1, limit = 20, search = '', sort = 'id', order = 'desc' } = {}) {
        const offset = (page - 1) * limit;

        // 構建搜尋條件
        let whereClause = 'WHERE fs.project_id = ?';
        const countParams = [projectId];
        const queryParams = [projectId];

        if (search && search.trim()) {
            whereClause += ' AND (fs.submitter_name LIKE ? OR fs.submitter_email LIKE ? OR fs.submitter_phone LIKE ?)';
            const searchTerm = `%${search.trim()}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        // 驗證排序欄位和方向（防止 SQL 注入）
        const allowedSortFields = ['id', 'created_at', 'checked_in_at'];
        const sortField = allowedSortFields.includes(sort) ? `fs.${sort}` : 'fs.id';
        const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        // 取得總數
        const countSql = `SELECT COUNT(*) as total FROM form_submissions fs ${whereClause}`;
        const countResult = await this.rawGet(countSql, countParams);
        const total = countResult?.total || 0;

        // 取得分頁資料（含團體報名資訊）
        // 排序邏輯：
        // 1. 先按團體分組（COALESCE 確保無 group_id 的獨立報名者各自分開）
        // 2. 同一團體內，主報名人排在前面（is_primary DESC）
        // 3. 然後按用戶選擇的排序欄位
        const sql = `
            SELECT
                fs.id,
                fs.user_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.trace_id,
                fs.participation_level,
                fs.checked_in_at,
                fs.status,
                fs.created_at,
                fs.children_count,
                fs.children_ages,
                fs.company_name,
                fs.position,
                fs.gender,
                fs.notes,
                fs.group_id,
                fs.is_primary,
                fs.parent_submission_id,
                parent.submitter_name as parent_name
            FROM form_submissions fs
            LEFT JOIN form_submissions parent ON fs.parent_submission_id = parent.id
            ${whereClause}
            ORDER BY
                COALESCE(fs.group_id, 'SOLO-' || fs.id) ${sortOrder},
                fs.is_primary DESC,
                ${sortField} ${sortOrder}
            LIMIT ? OFFSET ?
        `;
        queryParams.push(limit, offset);
        const participants = await this.rawAll(sql, queryParams);

        return {
            participants,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        };
    }

    /**
     * 檢測專案中的重複報名
     * 檢測條件：僅姓名、姓名+手機、姓名+Email、姓名+手機+Email
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>} 包含各種重複類型的結果
     */
    async findDuplicateParticipants(projectId) {
        // 0. 僅姓名重複
        const nameOnlyDuplicates = await this.rawAll(`
            SELECT
                fs.id,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.created_at,
                fs.checked_in_at,
                fs.trace_id,
                dup.duplicate_count
            FROM form_submissions fs
            INNER JOIN (
                SELECT submitter_name, COUNT(*) as duplicate_count
                FROM form_submissions
                WHERE project_id = ?
                    AND submitter_name IS NOT NULL
                    AND submitter_name != ''
                GROUP BY submitter_name
                HAVING COUNT(*) > 1
            ) dup ON fs.submitter_name = dup.submitter_name
            WHERE fs.project_id = ?
            ORDER BY fs.submitter_name, fs.created_at
        `, [projectId, projectId]);

        // 1. 姓名 + Email 重複
        const nameEmailDuplicates = await this.rawAll(`
            SELECT
                fs.id,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.created_at,
                fs.checked_in_at,
                fs.trace_id,
                dup.duplicate_count
            FROM form_submissions fs
            INNER JOIN (
                SELECT submitter_name, submitter_email, COUNT(*) as duplicate_count
                FROM form_submissions
                WHERE project_id = ?
                    AND submitter_email IS NOT NULL
                    AND submitter_email != ''
                GROUP BY submitter_name, submitter_email
                HAVING COUNT(*) > 1
            ) dup ON fs.submitter_name = dup.submitter_name
                 AND fs.submitter_email = dup.submitter_email
            WHERE fs.project_id = ?
            ORDER BY fs.submitter_name, fs.submitter_email, fs.created_at
        `, [projectId, projectId]);

        // 2. 姓名 + 手機 重複
        const namePhoneDuplicates = await this.rawAll(`
            SELECT
                fs.id,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.created_at,
                fs.checked_in_at,
                fs.trace_id,
                dup.duplicate_count
            FROM form_submissions fs
            INNER JOIN (
                SELECT submitter_name, submitter_phone, COUNT(*) as duplicate_count
                FROM form_submissions
                WHERE project_id = ?
                    AND submitter_phone IS NOT NULL
                    AND submitter_phone != ''
                GROUP BY submitter_name, submitter_phone
                HAVING COUNT(*) > 1
            ) dup ON fs.submitter_name = dup.submitter_name
                 AND fs.submitter_phone = dup.submitter_phone
            WHERE fs.project_id = ?
            ORDER BY fs.submitter_name, fs.submitter_phone, fs.created_at
        `, [projectId, projectId]);

        // 3. 姓名 + 手機 + Email 完全重複
        const allFieldsDuplicates = await this.rawAll(`
            SELECT
                fs.id,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.created_at,
                fs.checked_in_at,
                fs.trace_id,
                dup.duplicate_count
            FROM form_submissions fs
            INNER JOIN (
                SELECT submitter_name, submitter_email, submitter_phone, COUNT(*) as duplicate_count
                FROM form_submissions
                WHERE project_id = ?
                    AND submitter_email IS NOT NULL
                    AND submitter_email != ''
                    AND submitter_phone IS NOT NULL
                    AND submitter_phone != ''
                GROUP BY submitter_name, submitter_email, submitter_phone
                HAVING COUNT(*) > 1
            ) dup ON fs.submitter_name = dup.submitter_name
                 AND fs.submitter_email = dup.submitter_email
                 AND fs.submitter_phone = dup.submitter_phone
            WHERE fs.project_id = ?
            ORDER BY fs.submitter_name, fs.created_at
        `, [projectId, projectId]);

        return {
            nameOnlyDuplicates,
            nameEmailDuplicates,
            namePhoneDuplicates,
            allFieldsDuplicates,
            summary: {
                nameOnly: nameOnlyDuplicates.length,
                nameEmail: nameEmailDuplicates.length,
                namePhone: namePhoneDuplicates.length,
                allFields: allFieldsDuplicates.length
            }
        };
    }

    /**
     * 取得專案問卷列表（含回應數）
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async getQuestionnaires(projectId) {
        const sql = `
            SELECT
                q.id,
                q.title,
                q.is_active,
                q.created_at,
                COUNT(qr.id) as response_count
            FROM questionnaires q
            LEFT JOIN questionnaire_responses qr ON q.id = qr.questionnaire_id
            WHERE q.project_id = ?
            GROUP BY q.id
            ORDER BY q.created_at DESC
        `;
        return this.rawAll(sql, [projectId]);
    }

    /**
     * 取得分頁資料（含統計）
     * @param {number} page - 頁碼
     * @param {number} limit - 每頁筆數
     * @returns {Promise<Object>}
     */
    async paginateWithStats(page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        const sql = `
            SELECT p.*, COUNT(fs.id) as submission_count
            FROM event_projects p
            LEFT JOIN form_submissions fs ON p.id = fs.project_id
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const data = await this.rawAll(sql, [limit, offset]);
        const total = await this.count();
        const pages = Math.ceil(total / limit);

        return {
            data,
            pagination: {
                total,
                currentPage: page,
                pages,
                limit,
                hasPrev: page > 1,
                hasNext: page < pages
            }
        };
    }

    /**
     * 搜尋專案內的參加者
     * @param {number} projectId - 專案 ID
     * @param {string} searchTerm - 搜尋關鍵字
     * @returns {Promise<Object|null>}
     */
    async searchParticipantTracking(projectId, searchTerm) {
        const sql = `
            SELECT * FROM form_submissions
            WHERE project_id = ? AND (
                submitter_name LIKE ? OR
                trace_id LIKE ? OR
                submitter_email LIKE ?
            )
            LIMIT 1
        `;
        const term = `%${searchTerm}%`;
        return this.rawGet(sql, [projectId, term, term, term]);
    }

    /**
     * 取得參與者互動記錄
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Array>}
     */
    async getParticipantInteractions(traceId) {
        const sql = `
            SELECT * FROM participant_interactions
            WHERE trace_id = ?
            ORDER BY timestamp DESC
        `;
        return this.rawAll(sql, [traceId]);
    }

    // ============================================================================
    // 專案詳情與創建者
    // ============================================================================

    /**
     * 取得專案詳情（含創建者與模板）
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async getProjectWithCreator(projectId) {
        const sql = `
            SELECT p.*,
                   u.full_name as creator_name,
                   t.template_name,
                   t.id as template_id,
                   (SELECT COUNT(*) FROM form_submissions fs
                    WHERE fs.project_id = p.id
                    AND fs.status IN ('pending', 'approved', 'confirmed')) as current_participants
            FROM event_projects p
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN invitation_templates t ON p.template_id = t.id
            WHERE p.id = ?
        `;
        return this.rawGet(sql, [projectId]);
    }

    /**
     * 取得專案報名連結統計
     * @param {number} projectId - 專案 ID
     * @param {number} userId - 用戶 ID
     * @param {string} userRole - 用戶角色
     * @returns {Promise<Object|null>}
     */
    async getProjectForRegistration(projectId, userId, userRole) {
        const sql = `
            SELECT id, project_name, project_code, status, description, event_date, event_location
            FROM event_projects
            WHERE id = ? AND (created_by = ? OR ? = 'super_admin')
        `;
        return this.rawGet(sql, [projectId, userId, userRole]);
    }

    /**
     * 取得專案報名統計
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async getRegistrationStats(projectId) {
        const sql = `
            SELECT
                COUNT(*) as total_submissions,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_submissions,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_submissions,
                COUNT(CASE WHEN checked_in_at IS NOT NULL THEN 1 END) as checked_in_count
            FROM form_submissions WHERE project_id = ?
        `;
        const result = await this.rawGet(sql, [projectId]);
        return result || { total_submissions: 0, pending_submissions: 0, approved_submissions: 0, checked_in_count: 0 };
    }

    // ============================================================================
    // 遊戲綁定相關
    // ============================================================================

    /**
     * 取得專案綁定的遊戲列表
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async getProjectGames(projectId) {
        const sql = `
            SELECT DISTINCT
                g.id as game_id,
                g.game_name_zh,
                g.game_name_en,
                g.is_active,
                bg.id as binding_id,
                bg.voucher_id,
                v.voucher_name,
                v.remaining_quantity,
                v.total_quantity,
                b.booth_name,
                b.id as booth_id
            FROM booth_games bg
            INNER JOIN games g ON bg.game_id = g.id
            INNER JOIN booths b ON bg.booth_id = b.id
            LEFT JOIN vouchers v ON bg.voucher_id = v.id
            WHERE b.project_id = ?
            ORDER BY g.game_name_zh
        `;
        return this.rawAll(sql, [projectId]);
    }

    /**
     * 取得遊戲綁定資訊
     * @param {number} bindingId - 綁定 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async getGameBinding(bindingId, projectId) {
        const sql = `
            SELECT
                bg.*,
                g.game_name_zh,
                g.game_name_en,
                v.voucher_name,
                b.booth_name
            FROM booth_games bg
            INNER JOIN games g ON bg.game_id = g.id
            INNER JOIN booths b ON bg.booth_id = b.id
            LEFT JOIN vouchers v ON bg.voucher_id = v.id
            WHERE bg.id = ? AND b.project_id = ?
        `;
        return this.rawGet(sql, [bindingId, projectId]);
    }

    /**
     * 檢查綁定是否存在
     * @param {number} bindingId - 綁定 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async checkGameBindingExists(bindingId, projectId) {
        const sql = `
            SELECT bg.*
            FROM booth_games bg
            INNER JOIN booths b ON bg.booth_id = b.id
            WHERE bg.id = ? AND b.project_id = ?
        `;
        return this.rawGet(sql, [bindingId, projectId]);
    }

    /**
     * 更新遊戲綁定
     * @param {number} bindingId - 綁定 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<void>}
     */
    async updateGameBinding(bindingId, { voucher_id }) {
        const sql = `
            UPDATE booth_games
            SET voucher_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return this.rawRun(sql, [voucher_id || null, bindingId]);
    }

    /**
     * 刪除遊戲綁定
     * @param {number} bindingId - 綁定 ID
     * @returns {Promise<void>}
     */
    async deleteGameBinding(bindingId) {
        return this.rawRun('DELETE FROM booth_games WHERE id = ?', [bindingId]);
    }

    // ============================================================================
    // 下拉選單
    // ============================================================================

    /**
     * 取得所有專案（用於下拉選單）
     * @returns {Promise<Array>}
     */
    async getAllForDropdown() {
        const sql = `
            SELECT id, project_name
            FROM event_projects
            ORDER BY project_name
        `;
        return this.rawAll(sql);
    }

    /**
     * 取得活躍專案列表（用於切換下拉選單）
     * @returns {Promise<Array>}
     */
    async getActiveProjects() {
        const sql = `
            SELECT id, project_name, project_code
            FROM event_projects
            WHERE status = 'active'
            ORDER BY created_at DESC
        `;
        return this.rawAll(sql);
    }

    // ============================================================================
    // 模板相關
    // ============================================================================

    /**
     * 取得可用模板
     * @returns {Promise<Array>}
     */
    async getActiveTemplates() {
        const sql = `
            SELECT id, template_name, category
            FROM invitation_templates
            WHERE status = 'active'
            ORDER BY category, template_name
        `;
        return this.rawAll(sql);
    }
}

// 單例模式
module.exports = new ProjectRepository();
