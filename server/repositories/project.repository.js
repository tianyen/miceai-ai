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
                   contact_email, contact_phone, form_config
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

    // ============================================================================
    // 權限檢查方法
    // ============================================================================

    /**
     * 檢查用戶是否為專案創建者
     * @param {number} userId - 用戶 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findByCreatorId(userId, projectId) {
        return this.rawGet(
            'SELECT * FROM event_projects WHERE id = ? AND created_by = ?',
            [projectId, userId]
        );
    }

    /**
     * 檢查用戶是否有專案權限
     * @param {number} userId - 用戶 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findUserPermission(userId, projectId) {
        return this.rawGet(
            'SELECT * FROM user_project_permissions WHERE user_id = ? AND project_id = ?',
            [userId, projectId]
        );
    }

    /**
     * 檢查用戶是否有專案管理權限
     * @param {number} userId - 用戶 ID
     * @param {number} projectId - 專案 ID
     * @param {string} permissionLevel - 權限等級
     * @returns {Promise<Object|null>}
     */
    async findAdminPermission(userId, projectId, permissionLevel = 'admin') {
        return this.rawGet(
            'SELECT * FROM user_project_permissions WHERE user_id = ? AND project_id = ? AND permission_level = ?',
            [userId, projectId, permissionLevel]
        );
    }

    // ============================================================================
    // 進階 CRUD 操作
    // ============================================================================

    /**
     * 建立專案
     * @param {Object} data - 專案資料
     * @param {number} createdBy - 建立者 ID
     * @returns {Promise<Object>}
     */
    async createWithCreator(data, createdBy) {
        const sql = `
            INSERT INTO event_projects (
                project_name, project_code, description, event_date, event_location,
                event_type, created_by, template_config, brand_config, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.project_name,
            data.project_code,
            data.description,
            data.event_date,
            data.event_location,
            data.event_type || 'standard',
            createdBy,
            data.template_config ? JSON.stringify(data.template_config) : null,
            data.brand_config ? JSON.stringify(data.brand_config) : null,
            'draft'
        ];
        const result = await this.rawRun(sql, params);
        return { id: result.lastID };
    }

    /**
     * 更新專案（動態欄位）
     * @param {number} projectId - 專案 ID
     * @param {Object} updates - 更新資料
     * @returns {Promise<Object>}
     */
    async updateById(projectId, updates) {
        const allowedFields = [
            'project_name', 'project_code', 'description', 'event_date',
            'event_location', 'event_type', 'status', 'assigned_to',
            'template_config', 'brand_config',
            'max_participants', 'registration_deadline', 'form_config'
        ];

        const updateFields = [];
        const updateValues = [];

        Object.keys(updates).forEach(field => {
            if (allowedFields.includes(field) && updates[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                if (field === 'template_config' || field === 'brand_config' || field === 'form_config') {
                    updateValues.push(JSON.stringify(updates[field]));
                } else {
                    updateValues.push(updates[field]);
                }
            }
        });

        if (updateFields.length === 0) {
            return { changes: 0 };
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(projectId);

        const query = `UPDATE event_projects SET ${updateFields.join(', ')} WHERE id = ?`;
        return this.rawRun(query, updateValues);
    }

    /**
     * 級聯刪除專案（不含交易）
     * @param {number} projectId - 專案 ID
     * @returns {Promise<void>}
     */
    async deleteProjectCascade(projectId) {
        await this.rawRun('DELETE FROM user_project_permissions WHERE project_id = ?', [projectId]);
        await this.rawRun('DELETE FROM form_submissions WHERE project_id = ?', [projectId]);
        await this.rawRun('DELETE FROM qr_codes WHERE project_id = ?', [projectId]);
        await this.rawRun('DELETE FROM event_projects WHERE id = ?', [projectId]);
    }

    /**
     * 複製專案
     * @param {number} projectId - 原始專案 ID
     * @param {number} userId - 建立者 ID
     * @returns {Promise<Object>}
     */
    async duplicate(projectId, userId) {
        const original = await this.findById(projectId);
        if (!original) {
            return null;
        }

        const timestamp = Date.now().toString().slice(-5);
        const newCode = `${original.project_code}_copy_${timestamp}`.slice(0, 50);
        const newName = `${original.project_name} - 複本`;

        const sql = `
            INSERT INTO event_projects (
                project_name, project_code, description, event_date, event_location,
                event_type, created_by, template_config, brand_config, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            newName,
            newCode,
            original.description,
            original.event_date,
            original.event_location,
            original.event_type,
            userId,
            original.template_config,
            original.brand_config,
            'draft'
        ];
        const result = await this.rawRun(sql, params);
        return { id: result.lastID };
    }

    /**
     * 更新專案狀態
     * @param {number} projectId - 專案 ID
     * @param {string} status - 新狀態
     * @returns {Promise<Object>}
     */
    async updateStatus(projectId, status) {
        const sql = `
            UPDATE event_projects
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return this.rawRun(sql, [status, projectId]);
    }

    // ============================================================================
    // 權限管理
    // ============================================================================

    /**
     * 取得專案權限列表
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async getPermissions(projectId) {
        const sql = `
            SELECT pp.*, u.full_name as user_name, u.email as user_email,
                   ab.full_name as assigned_by_name
            FROM user_project_permissions pp
            LEFT JOIN users u ON pp.user_id = u.id
            LEFT JOIN users ab ON pp.assigned_by = ab.id
            WHERE pp.project_id = ?
            ORDER BY pp.created_at DESC
        `;
        return this.rawAll(sql, [projectId]);
    }

    /**
     * 新增或更新專案權限
     * @param {number} projectId - 專案 ID
     * @param {number} userId - 被授權用戶 ID
     * @param {string} permissionLevel - 權限等級
     * @param {number} assignedBy - 授權者 ID
     * @returns {Promise<void>}
     */
    async upsertPermission(projectId, userId, permissionLevel, assignedBy) {
        await this.rawRun(`
            INSERT OR REPLACE INTO user_project_permissions (
                user_id, project_id, permission_level, assigned_by
            ) VALUES (?, ?, ?, ?)
        `, [userId, projectId, permissionLevel, assignedBy]);
    }

    /**
     * 更新專案權限
     * @param {number} projectId - 專案 ID
     * @param {number} userId - 被授權用戶 ID
     * @param {string} permissionLevel - 權限等級
     * @param {number} assignedBy - 授權者 ID
     * @returns {Promise<Object>}
     */
    async updatePermission(projectId, userId, permissionLevel, assignedBy) {
        return this.rawRun(`
            UPDATE user_project_permissions
            SET permission_level = ?, assigned_by = ?
            WHERE user_id = ? AND project_id = ?
        `, [permissionLevel, assignedBy, userId, projectId]);
    }

    /**
     * 移除專案權限
     * @param {number} projectId - 專案 ID
     * @param {number} userId - 被移除用戶 ID
     * @returns {Promise<Object>}
     */
    async deletePermission(projectId, userId) {
        return this.rawRun(`
            DELETE FROM user_project_permissions
            WHERE user_id = ? AND project_id = ?
        `, [userId, projectId]);
    }

    // ============================================================================
    // 帶權限過濾的列表查詢
    // ============================================================================

    /**
     * 取得專案列表（含權限過濾和分頁）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getListWithPermissionFilter({ userId, userRole, page = 1, limit = 20, search, status } = {}) {
        const offset = (page - 1) * limit;

        // 構建權限過濾條件
        let roleFilter = '';
        let roleParams = [];

        if (userRole !== 'super_admin') {
            roleFilter = `WHERE (p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            ))`;
            roleParams = [userId, userId];
        }

        // 構建搜尋條件
        let searchFilter = '';
        const searchParams = [];

        if (search && search.trim()) {
            searchFilter = ` AND (p.project_name LIKE ? OR p.project_code LIKE ? OR p.description LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            searchParams.push(searchTerm, searchTerm, searchTerm);
        }

        // 構建狀態過濾
        let statusFilter = '';
        if (status && status !== 'all') {
            statusFilter = ` AND p.status = ?`;
            searchParams.push(status);
        }

        const projectsQuery = `
            SELECT
                p.*,
                u.full_name as creator_name,
                t.template_name as template_name,
                COUNT(fs.id) as participant_count
            FROM event_projects p
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN invitation_templates t ON p.template_id = t.id
            LEFT JOIN form_submissions fs ON p.id = fs.project_id
            ${roleFilter}${searchFilter}${statusFilter}
            GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?
        `;

        const countQuery = `SELECT COUNT(*) as count FROM event_projects p ${roleFilter}${searchFilter}${statusFilter}`;

        const projects = await this.rawAll(projectsQuery, [...roleParams, ...searchParams, limit, offset]);
        const totalResult = await this.rawGet(countQuery, [...roleParams, ...searchParams]);

        return {
            projects,
            pagination: {
                page,
                limit,
                total: totalResult?.count || 0,
                pages: Math.ceil((totalResult?.count || 0) / limit)
            }
        };
    }

    /**
     * 搜尋專案（Admin Panel 用，帶權限過濾）
     * @param {Object} params - 搜尋參數
     * @returns {Promise<Array>}
     */
    async searchWithPermissionFilter({ userId, userRole, search, status, limit = 50 } = {}) {
        // 構建權限過濾條件
        let roleFilter = '';
        const roleParams = [];

        if (userRole !== 'super_admin') {
            roleFilter = ` AND (p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            ))`;
            roleParams.push(userId, userId);
        }

        // 構建搜尋條件
        let searchFilter = '';
        const searchParams = [];

        if (search && search.trim()) {
            searchFilter = ` AND (p.project_name LIKE ? OR p.project_code LIKE ? OR p.description LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            searchParams.push(searchTerm, searchTerm, searchTerm);
        }

        // 構建狀態過濾
        let statusFilter = '';
        if (status && status !== 'all') {
            statusFilter = ` AND p.status = ?`;
            searchParams.push(status);
        }

        const sql = `
            SELECT
                p.*,
                u.full_name as creator_name,
                COUNT(fs.id) as participant_count
            FROM event_projects p
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN form_submissions fs ON p.id = fs.project_id
            WHERE 1=1 ${roleFilter}${searchFilter}${statusFilter}
            GROUP BY p.id ORDER BY p.created_at DESC LIMIT ?
        `;

        return this.rawAll(sql, [...roleParams, ...searchParams, limit]);
    }

    /**
     * 取得最近專案（帶權限過濾）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Array>}
     */
    async getRecentProjectsWithFilter({ userId, userRole, limit = 5 } = {}) {
        // 構建權限過濾條件
        let roleFilter = '';
        const roleParams = [limit];

        if (userRole !== 'super_admin') {
            roleFilter = ` WHERE p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            )`;
            roleParams.unshift(userId, userId);
        }

        return this.rawAll(`
            SELECT p.*, u.full_name as creator_name
            FROM event_projects p
            LEFT JOIN users u ON p.created_by = u.id
            ${roleFilter}
            ORDER BY p.created_at DESC LIMIT ?
        `, roleParams);
    }

    // ============================================================================
    // 專案詳情與匯出
    // ============================================================================

    /**
     * 取得專案完整詳情（含權限和統計）
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async getFullDetail(projectId) {
        const project = await this.rawGet(`
            SELECT p.*, u.full_name as creator_name, a.full_name as assignee_name
            FROM event_projects p
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN users a ON p.assigned_to = a.id
            WHERE p.id = ?
        `, [projectId]);

        if (!project) return null;

        const permissions = await this.getPermissions(projectId);

        const submissionStats = await this.rawGet(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM form_submissions
            WHERE project_id = ?
        `, [projectId]);

        return { ...project, permissions, submission_stats: submissionStats };
    }

    /**
     * 取得專案掃描器資訊
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async getScannerInfo(projectId) {
        const project = await this.findById(projectId);
        if (!project) return null;
        return {
            project_id: projectId,
            project_name: project.project_name,
            project_status: project.status
        };
    }

    /**
     * 匯出專案表單提交資料
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async exportSubmissions(projectId) {
        const project = await this.findById(projectId);
        if (!project) {
            return null;
        }

        const submissions = await this.rawAll(`
            SELECT s.*, p.project_name
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
            WHERE s.project_id = ?
            ORDER BY s.created_at DESC
        `, [projectId]);

        return { project, submissions };
    }
}

// 單例模式
module.exports = new ProjectRepository();
