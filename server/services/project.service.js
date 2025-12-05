/**
 * Project Service - 專案相關業務邏輯
 *
 * 職責：
 * - 專案 CRUD 操作
 * - 專案搜尋與分頁
 * - 專案統計
 * - 權限管理
 * - 參加者列表
 * - 問卷狀況
 *
 * @description 從 admin-extended.js 抽取的業務邏輯
 * @refactor 2025-12-01: 使用 Repository 層
 * @refactor 2025-12-05: 從 projectController 抽取 CRUD 和權限邏輯
 */
const BaseService = require('./base.service');
const projectRepository = require('../repositories/project.repository');

class ProjectService extends BaseService {
    constructor() {
        super('ProjectService');
        this.repository = projectRepository;
        this.VALID_STATUSES = ['draft', 'active', 'completed', 'cancelled'];
        this.STATUS_TEXT = {
            'draft': '草稿',
            'active': '進行中',
            'completed': '已完成',
            'cancelled': '已取消'
        };
    }

    // ============================================================================
    // 權限檢查
    // ============================================================================

    /**
     * 構建專案權限過濾條件
     * @param {string} userRole - 用戶角色
     * @param {number} userId - 用戶 ID
     * @returns {{ filter: string, params: number[] }}
     */
    buildProjectFilter(userRole, userId) {
        if (userRole === 'super_admin') {
            return { filter: '', params: [] };
        }

        return {
            filter: `
                WHERE (p.created_by = ? OR p.id IN (
                    SELECT project_id FROM user_project_permissions WHERE user_id = ?
                ))
            `,
            params: [userId, userId]
        };
    }

    /**
     * 檢查用戶對專案的權限
     * @param {number} userId - 用戶 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<boolean>}
     */
    async checkProjectPermission(userId, projectId) {
        const project = await this.db.get(
            'SELECT * FROM event_projects WHERE id = ? AND created_by = ?',
            [projectId, userId]
        );

        if (project) return true;

        const permission = await this.db.get(
            'SELECT * FROM user_project_permissions WHERE user_id = ? AND project_id = ?',
            [userId, projectId]
        );

        return !!permission;
    }

    /**
     * 檢查用戶是否有專案管理權限
     * @param {number} userId - 用戶 ID
     * @param {number} projectId - 專案 ID
     * @param {string} userRole - 用戶角色
     * @returns {Promise<boolean>}
     */
    async checkAdminPermission(userId, projectId, userRole) {
        if (['super_admin', 'project_manager', 'vendor'].includes(userRole)) {
            return true;
        }

        const project = await this.db.get(
            'SELECT * FROM event_projects WHERE id = ? AND created_by = ?',
            [projectId, userId]
        );

        if (project) return true;

        const adminPermission = await this.db.get(
            'SELECT * FROM user_project_permissions WHERE user_id = ? AND project_id = ? AND permission_level = ?',
            [userId, projectId, 'admin']
        );

        return !!adminPermission;
    }

    // ============================================================================
    // CRUD 操作
    // ============================================================================

    /**
     * 建立專案
     * @param {Object} data - 專案資料
     * @param {number} createdBy - 建立者 ID
     * @returns {Promise<Object>}
     */
    async createProject(data, createdBy) {
        const {
            project_name, project_code, description, event_date,
            event_location, event_type, template_config, brand_config
        } = data;

        const result = await this.db.run(`
            INSERT INTO event_projects (
                project_name, project_code, description, event_date, event_location,
                event_type, created_by, template_config, brand_config, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            project_name,
            project_code,
            description,
            event_date,
            event_location,
            event_type || 'standard',
            createdBy,
            template_config ? JSON.stringify(template_config) : null,
            brand_config ? JSON.stringify(brand_config) : null,
            'draft'
        ]);

        this.log('createProject', { projectId: result.lastID, project_name, project_code });

        return { id: result.lastID };
    }

    /**
     * 更新專案
     * @param {number} projectId - 專案 ID
     * @param {Object} updates - 更新資料
     * @returns {Promise<Object>}
     */
    async updateProject(projectId, updates) {
        const allowedFields = [
            'project_name', 'project_code', 'description', 'event_date',
            'event_location', 'event_type', 'status', 'assigned_to',
            'template_config', 'brand_config'
        ];

        const updateFields = [];
        const updateValues = [];

        Object.keys(updates).forEach(field => {
            if (allowedFields.includes(field) && updates[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                if (field === 'template_config' || field === 'brand_config') {
                    updateValues.push(JSON.stringify(updates[field]));
                } else {
                    updateValues.push(updates[field]);
                }
            }
        });

        if (updateFields.length === 0) {
            return { success: false, error: 'NO_FIELDS', message: '沒有有效的更新字段' };
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(projectId);

        const query = `UPDATE event_projects SET ${updateFields.join(', ')} WHERE id = ?`;
        const result = await this.db.run(query, updateValues);

        if (result.changes === 0) {
            return { success: false, error: 'NOT_FOUND', message: '項目不存在' };
        }

        this.log('updateProject', { projectId, fields: Object.keys(updates) });

        return { success: true };
    }

    /**
     * 刪除專案（含相關資料）
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async deleteProject(projectId) {
        const project = await this.db.get('SELECT * FROM event_projects WHERE id = ?', [projectId]);

        if (!project) {
            return { success: false, error: 'NOT_FOUND', message: '項目不存在' };
        }

        await this.db.beginTransaction();

        try {
            await this.db.run('DELETE FROM user_project_permissions WHERE project_id = ?', [projectId]);
            await this.db.run('DELETE FROM form_submissions WHERE project_id = ?', [projectId]);
            await this.db.run('DELETE FROM qr_codes WHERE project_id = ?', [projectId]);
            await this.db.run('DELETE FROM event_projects WHERE id = ?', [projectId]);

            await this.db.commit();

            this.log('deleteProject', { projectId, project_name: project.project_name });

            return { success: true, project };
        } catch (error) {
            await this.db.rollback();
            throw error;
        }
    }

    /**
     * 複製專案
     * @param {number} projectId - 原始專案 ID
     * @param {number} userId - 建立者 ID
     * @returns {Promise<Object>}
     */
    async duplicateProject(projectId, userId) {
        const original = await this.db.get('SELECT * FROM event_projects WHERE id = ?', [projectId]);

        if (!original) {
            return { success: false, error: 'NOT_FOUND', message: '專案不存在' };
        }

        const timestamp = Date.now().toString().slice(-5);
        const newCode = `${original.project_code}_copy_${timestamp}`.slice(0, 50);
        const newName = `${original.project_name} - 複本`;

        const result = await this.db.run(`
            INSERT INTO event_projects (
                project_name, project_code, description, event_date, event_location,
                event_type, created_by, template_config, brand_config, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
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
        ]);

        this.log('duplicateProject', { originalId: projectId, newId: result.lastID });

        return { success: true, id: result.lastID };
    }

    /**
     * 更新專案狀態
     * @param {number} projectId - 專案 ID
     * @param {string} status - 新狀態
     * @returns {Promise<Object>}
     */
    async updateStatus(projectId, status) {
        if (!this.VALID_STATUSES.includes(status)) {
            return { success: false, error: 'INVALID_STATUS', message: '無效的專案狀態' };
        }

        const project = await this.db.get('SELECT * FROM event_projects WHERE id = ?', [projectId]);

        if (!project) {
            return { success: false, error: 'NOT_FOUND', message: '專案不存在' };
        }

        await this.db.run(
            'UPDATE event_projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, projectId]
        );

        this.log('updateStatus', { projectId, oldStatus: project.status, newStatus: status });

        return {
            success: true,
            oldStatus: project.status,
            newStatus: status,
            statusText: this.STATUS_TEXT[status]
        };
    }

    // ============================================================================
    // 權限管理
    // ============================================================================

    /**
     * 取得專案權限列表
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async getProjectPermissions(projectId) {
        return this.db.query(`
            SELECT pp.*, u.full_name as user_name, u.email as user_email,
                   ab.full_name as assigned_by_name
            FROM user_project_permissions pp
            LEFT JOIN users u ON pp.user_id = u.id
            LEFT JOIN users ab ON pp.assigned_by = ab.id
            WHERE pp.project_id = ?
            ORDER BY pp.created_at DESC
        `, [projectId]);
    }

    /**
     * 新增專案權限
     * @param {number} projectId - 專案 ID
     * @param {number} userId - 被授權用戶 ID
     * @param {string} permissionLevel - 權限等級
     * @param {number} assignedBy - 授權者 ID
     * @returns {Promise<Object>}
     */
    async addPermission(projectId, userId, permissionLevel, assignedBy) {
        await this.db.run(`
            INSERT OR REPLACE INTO user_project_permissions (
                user_id, project_id, permission_level, assigned_by
            ) VALUES (?, ?, ?, ?)
        `, [userId, projectId, permissionLevel, assignedBy]);

        this.log('addPermission', { projectId, userId, permissionLevel });

        return { success: true };
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
        const result = await this.db.run(`
            UPDATE user_project_permissions
            SET permission_level = ?, assigned_by = ?
            WHERE user_id = ? AND project_id = ?
        `, [permissionLevel, assignedBy, userId, projectId]);

        if (result.changes === 0) {
            return { success: false, error: 'NOT_FOUND', message: '權限記錄不存在' };
        }

        this.log('updatePermission', { projectId, userId, permissionLevel });

        return { success: true };
    }

    /**
     * 移除專案權限
     * @param {number} projectId - 專案 ID
     * @param {number} userId - 被移除用戶 ID
     * @returns {Promise<Object>}
     */
    async removePermission(projectId, userId) {
        const result = await this.db.run(`
            DELETE FROM user_project_permissions
            WHERE user_id = ? AND project_id = ?
        `, [userId, projectId]);

        if (result.changes === 0) {
            return { success: false, error: 'NOT_FOUND', message: '權限記錄不存在' };
        }

        this.log('removePermission', { projectId, userId });

        return { success: true };
    }

    // ============================================================================
    // 列表查詢
    // ============================================================================

    /**
     * 取得專案列表（含分頁）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getProjectsList({ userId, userRole, page = 1, limit = 20 }) {
        const { filter, params } = this.buildProjectFilter(userRole, userId);
        const offset = (page - 1) * limit;

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
            ${filter}
            GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?
        `;

        const countQuery = `SELECT COUNT(*) as count FROM event_projects p ${filter}`;

        const projects = await this.db.query(projectsQuery, [...params, limit, offset]);
        const totalResult = await this.db.get(countQuery, params);

        return {
            projects,
            pagination: {
                page,
                limit,
                total: totalResult.count,
                pages: Math.ceil(totalResult.count / limit)
            }
        };
    }

    /**
     * 搜尋專案（Admin Panel 用）
     * @param {Object} params - 搜尋參數
     * @returns {Promise<Array>}
     */
    async searchProjectsAdmin({ userId, userRole, search, status, limit = 50 }) {
        const { filter, params } = this.buildProjectFilter(userRole, userId);

        let searchQuery = `
            SELECT
                p.*,
                u.full_name as creator_name,
                COUNT(fs.id) as participant_count
            FROM event_projects p
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN form_submissions fs ON p.id = fs.project_id
            WHERE 1=1
        `;

        const queryParams = [];

        if (filter) {
            searchQuery += ` AND (p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            ))`;
            queryParams.push(userId, userId);
        }

        if (search && search.trim()) {
            searchQuery += ` AND (p.project_name LIKE ? OR p.project_code LIKE ? OR p.description LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        if (status && status !== 'all') {
            searchQuery += ` AND p.status = ?`;
            queryParams.push(status);
        }

        searchQuery += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT ?`;
        queryParams.push(limit);

        return this.db.query(searchQuery, queryParams);
    }

    /**
     * 取得最近專案
     * @param {Object} params - 查詢參數
     * @returns {Promise<Array>}
     */
    async getRecentProjects({ userId, userRole, limit = 5 }) {
        const { filter, params } = this.buildProjectFilter(userRole, userId);

        return this.db.query(`
            SELECT p.*, u.full_name as creator_name
            FROM event_projects p
            LEFT JOIN users u ON p.created_by = u.id
            ${filter}
            ORDER BY p.created_at DESC LIMIT ?
        `, [...params, limit]);
    }

    // ============================================================================
    // 專案詳情
    // ============================================================================

    /**
     * 取得專案完整詳情（含權限和統計）
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async getProjectFullDetail(projectId) {
        const project = await this.db.get(`
            SELECT p.*, u.full_name as creator_name, a.full_name as assignee_name
            FROM event_projects p
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN users a ON p.assigned_to = a.id
            WHERE p.id = ?
        `, [projectId]);

        if (!project) return null;

        const permissions = await this.getProjectPermissions(projectId);

        const submissionStats = await this.db.get(`
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
     * 取得專案掃描器 URL
     * @param {number} projectId - 專案 ID
     * @param {string} baseUrl - 基礎 URL
     * @returns {Promise<Object|null>}
     */
    async getScannerUrl(projectId, baseUrl) {
        const project = await this.db.get('SELECT * FROM event_projects WHERE id = ?', [projectId]);

        if (!project) return null;

        return {
            project_id: projectId,
            project_name: project.project_name,
            project_status: project.status,
            scanner_url: `${baseUrl}/admin/qr-scanner?project=${projectId}`,
            is_active: project.status === 'active'
        };
    }

    // ============================================================================
    // 匯出功能
    // ============================================================================

    /**
     * 匯出專案表單提交資料
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async exportProjectSubmissions(projectId) {
        const project = await this.db.get('SELECT * FROM event_projects WHERE id = ?', [projectId]);

        if (!project) {
            return { success: false, error: 'NOT_FOUND', message: '專案不存在' };
        }

        const submissions = await this.db.query(`
            SELECT s.*, p.project_name
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
            WHERE s.project_id = ?
            ORDER BY s.created_at DESC
        `, [projectId]);

        return { success: true, project, submissions };
    }

    // ============================================================================
    // 輔助方法
    // ============================================================================

    /**
     * 取得狀態文字
     * @param {string} status - 狀態代碼
     * @returns {string}
     */
    getStatusText(status) {
        return this.STATUS_TEXT[status] || status;
    }

    /**
     * 取得專案分頁資訊
     * @param {number} page - 頁碼
     * @param {number} limit - 每頁筆數
     * @returns {Promise<Object>} 分頁資訊
     */
    async getPagination(page = 1, limit = 20) {
        const total = await this.repository.count();
        const pages = Math.ceil(total / limit);

        return {
            total,
            pages,
            currentPage: page,
            limit,
            hasNext: page < pages,
            hasPrev: page > 1
        };
    }

    /**
     * 根據 ID 取得專案
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>} 專案資料
     */
    async getById(projectId) {
        return this.repository.findById(projectId);
    }

    /**
     * 搜尋專案
     * @param {Object} params - 搜尋參數
     * @param {string} params.search - 搜尋關鍵字
     * @param {string} params.status - 狀態篩選
     * @param {number} params.limit - 限制筆數
     * @returns {Promise<Array>} 專案列表
     */
    async search({ search, status, limit = 50 } = {}) {
        return this.repository.search(search || '', { status, limit });
    }

    /**
     * 取得專案統計
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>} 統計數據
     */
    async getStats(projectId) {
        return this.repository.getStats(projectId);
    }

    /**
     * 取得專案參加者列表（支援分頁）
     * @param {number} projectId - 專案 ID
     * @param {Object} options - 分頁選項 { page, limit }
     * @returns {Promise<Object>} { participants, pagination }
     */
    async getParticipants(projectId, options = {}) {
        return this.repository.getParticipants(projectId, options);
    }

    /**
     * 取得專案問卷狀況
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>} 問卷列表
     */
    async getQuestionnaires(projectId) {
        return this.repository.getQuestionnaires(projectId);
    }

    /**
     * 搜尋專案內的參加者
     * @param {number} projectId - 專案 ID
     * @param {string} searchTerm - 搜尋關鍵字
     * @returns {Promise<Object|null>} 參加者及其互動記錄
     */
    async searchParticipantTracking(projectId, searchTerm) {
        if (!searchTerm) {
            return null;
        }

        // 搜尋參加者
        const participant = await this.repository.searchParticipantTracking(projectId, searchTerm);

        if (!participant) {
            return null;
        }

        // 獲取互動記錄
        const interactions = await this.repository.getParticipantInteractions(participant.trace_id);

        return {
            participant,
            interactions
        };
    }

    /**
     * 取得專案詳情（含統計）
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>} 專案詳情
     */
    async getProjectWithStats(projectId) {
        const project = await this.repository.findById(projectId);

        if (!project) {
            return null;
        }

        const stats = await this.getStats(projectId);

        return {
            ...project,
            stats
        };
    }

    /**
     * 取得分頁專案列表（含統計）
     * @param {number} page - 頁碼
     * @param {number} limit - 每頁筆數
     * @returns {Promise<Object>} 分頁資料
     */
    async getPaginatedProjects(page = 1, limit = 20) {
        return this.repository.paginateWithStats(page, limit);
    }

    // ============================================================================
    // 專案詳情
    // ============================================================================

    /**
     * 取得專案詳情（含創建者資訊）
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async getProjectDetail(projectId) {
        return this.repository.getProjectWithCreator(projectId);
    }

    /**
     * 取得專案報名連結資訊
     * @param {number} projectId - 專案 ID
     * @param {Object} user - 當前用戶
     * @param {string} baseUrl - 基礎 URL
     * @returns {Promise<Object|null>}
     */
    async getRegistrationUrls(projectId, user, baseUrl) {
        const project = await this.repository.getProjectForRegistration(
            projectId,
            user.id,
            user.role
        );

        if (!project) {
            return null;
        }

        const stats = await this.repository.getRegistrationStats(projectId);

        return {
            project: {
                id: project.id,
                name: project.project_name,
                code: project.project_code,
                status: project.status,
                description: project.description,
                event_date: project.event_date,
                event_location: project.event_location
            },
            registration_urls: {
                primary: `${baseUrl}/register/${project.project_code}`,
                legacy: `${baseUrl}/form?project=${project.project_code}`,
                qr_direct: `${baseUrl}/qr?project=${project.project_code}`
            },
            statistics: stats,
            is_open_for_registration: project.status === 'active'
        };
    }

    /**
     * 取得可用模板列表
     * @returns {Promise<Array>}
     */
    async getActiveTemplates() {
        return this.repository.getActiveTemplates();
    }

    /**
     * 取得所有專案（用於下拉選單）
     * @returns {Promise<Array>}
     */
    async getAllForDropdown() {
        return this.repository.getAllForDropdown();
    }

    // ============================================================================
    // 遊戲綁定管理
    // ============================================================================

    /**
     * 取得專案遊戲列表
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async getProjectGames(projectId) {
        return this.repository.getProjectGames(projectId);
    }

    /**
     * 取得遊戲綁定 QR Code 資訊
     * @param {number} bindingId - 綁定 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async getGameBindingQrCode(bindingId, projectId) {
        const binding = await this.repository.getGameBinding(bindingId, projectId);

        if (!binding) {
            return null;
        }

        return {
            id: binding.id,
            game_id: binding.game_id,
            game_name_zh: binding.game_name_zh,
            game_name_en: binding.game_name_en,
            booth_name: binding.booth_name,
            voucher_id: binding.voucher_id,
            voucher_name: binding.voucher_name,
            qr_code_base64: binding.qr_code_base64
        };
    }

    /**
     * 更新遊戲綁定
     * @param {number} bindingId - 綁定 ID
     * @param {number} projectId - 專案 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async updateGameBinding(bindingId, projectId, data) {
        const binding = await this.repository.checkGameBindingExists(bindingId, projectId);

        if (!binding) {
            this.throwError(this.ErrorCodes.NOT_FOUND, '綁定不存在');
        }

        await this.repository.updateGameBinding(bindingId, data);

        this.log('updateGameBinding', { bindingId, projectId });

        return { success: true, message: '更新成功' };
    }

    /**
     * 刪除遊戲綁定
     * @param {number} bindingId - 綁定 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async deleteGameBinding(bindingId, projectId) {
        const binding = await this.repository.checkGameBindingExists(bindingId, projectId);

        if (!binding) {
            this.throwError(this.ErrorCodes.NOT_FOUND, '綁定不存在');
        }

        await this.repository.deleteGameBinding(bindingId);

        this.log('deleteGameBinding', { bindingId, projectId });

        return { success: true, message: '解除綁定成功' };
    }

    // ===== 報名表單配置 =====

    /**
     * 取得專案報名表單配置
     * @param {number} projectId - 專案 ID
     * @param {Object} user - 當前用戶
     * @returns {Promise<Object|null>}
     */
    async getFormConfig(projectId, user) {
        const project = await this.repository.findById(projectId);
        if (!project) {
            return null;
        }

        // 預設配置
        const defaultConfig = {
            required_fields: ['name', 'email', 'phone'],
            optional_fields: ['company', 'position', 'gender', 'title', 'notes'],
            field_labels: {
                name: '姓名',
                email: '電子郵件',
                phone: '手機號碼',
                company: '公司名稱',
                position: '職位',
                gender: '性別',
                title: '尊稱',
                notes: '留言備註'
            },
            gender_options: ['男', '女', '其他'],
            title_options: ['先生', '女士', '博士', '教授']
        };

        // 合併已存儲的配置
        let formConfig = defaultConfig;
        if (project.form_config) {
            try {
                formConfig = { ...defaultConfig, ...JSON.parse(project.form_config) };
            } catch (e) {
                // JSON 解析失敗，使用預設配置
            }
        }

        return {
            project_id: project.id,
            project_name: project.project_name,
            form_config: formConfig
        };
    }

    /**
     * 更新專案報名表單配置
     * @param {number} projectId - 專案 ID
     * @param {Object} formConfig - 表單配置
     * @param {Object} user - 當前用戶
     * @returns {Promise<boolean>}
     */
    async updateFormConfig(projectId, formConfig, user) {
        const project = await this.repository.findById(projectId);
        if (!project) {
            return false;
        }

        await this.db.run(
            'UPDATE event_projects SET form_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [JSON.stringify(formConfig), projectId]
        );

        this.log('updateFormConfig', { projectId, user: user?.id });

        return true;
    }
}

// Singleton pattern
module.exports = new ProjectService();
