/**
 * Template Repository - 邀請模板資料存取層
 *
 * @description Repository Pattern - Data Access Layer for invitation_templates
 * @see @refactor/ARCHITECTURE.md
 */

const BaseRepository = require('./base.repository');
const database = require('../config/database');

class TemplateRepository extends BaseRepository {
    constructor() {
        super('invitation_templates', 'id');
    }

    // ============================================================================
    // 基礎查詢方法
    // ============================================================================

    /**
     * 依 ID 取得模板（含創建者資訊）
     * @param {number} templateId - 模板 ID
     * @returns {Promise<Object|null>}
     */
    async findByIdWithCreator(templateId) {
        const sql = `
            SELECT t.*, u.full_name as creator_name
            FROM invitation_templates t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.id = ?
        `;
        return this.rawGet(sql, [templateId]);
    }

    /**
     * 取得預設模板
     * @returns {Promise<Object|null>}
     */
    async findDefault() {
        return this.findOne({ is_default: 1 });
    }

    /**
     * 依類型取得模板列表
     * @param {string} templateType - 模板類型
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findByType(templateType, { limit = 100, offset = 0 } = {}) {
        const sql = `
            SELECT t.*, u.full_name as creator_name
            FROM invitation_templates t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.template_type = ?
            ORDER BY t.is_default DESC, t.created_at DESC
            LIMIT ? OFFSET ?
        `;
        return this.rawAll(sql, [templateType, limit, offset]);
    }

    /**
     * 依類別取得模板列表
     * @param {string} category - 類別
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findByCategory(category, { limit = 100, offset = 0 } = {}) {
        const sql = `
            SELECT t.*, u.full_name as creator_name
            FROM invitation_templates t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.category = ?
            ORDER BY t.is_default DESC, t.created_at DESC
            LIMIT ? OFFSET ?
        `;
        return this.rawAll(sql, [category, limit, offset]);
    }

    /**
     * 搜尋模板
     * @param {string} searchTerm - 搜尋關鍵字
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async search(searchTerm, { limit = 50 } = {}) {
        const sql = `
            SELECT t.*, u.full_name as creator_name
            FROM invitation_templates t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.template_name LIKE ? OR t.description LIKE ?
            ORDER BY t.is_default DESC, t.created_at DESC
            LIMIT ?
        `;
        const term = `%${searchTerm}%`;
        return this.rawAll(sql, [term, term, limit]);
    }

    // ============================================================================
    // 列表查詢方法
    // ============================================================================

    /**
     * 取得模板列表（含分頁和創建者資訊）
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getListWithPagination({ page = 1, limit = 20, category = null } = {}) {
        const offset = (page - 1) * limit;

        let query = `
            SELECT t.*, u.full_name as creator_name
            FROM invitation_templates t
            LEFT JOIN users u ON t.created_by = u.id
        `;
        let countQuery = 'SELECT COUNT(*) as count FROM invitation_templates t';
        const params = [];

        if (category && category.trim()) {
            const whereClause = ' WHERE t.template_type = ?';
            query += whereClause;
            countQuery += whereClause;
            params.push(category.trim());
        }

        query += ' ORDER BY t.is_default DESC, t.created_at DESC LIMIT ? OFFSET ?';

        const templates = await this.rawAll(query, [...params, limit, offset]);
        const totalResult = await this.rawGet(countQuery, params);

        return {
            templates,
            pagination: {
                page,
                limit,
                total: totalResult?.count || 0,
                pages: Math.ceil((totalResult?.count || 0) / limit)
            }
        };
    }

    /**
     * 取得簡單列表（無創建者資訊）
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getSimpleList({ page = 1, limit = 20, search, category } = {}) {
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        let params = [];

        if (search) {
            whereClause += ' AND (template_name LIKE ? OR description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            whereClause += ' AND category = ?';
            params.push(category);
        }

        // 獲取總數
        const countResult = await this.rawGet(
            `SELECT COUNT(*) as total FROM invitation_templates ${whereClause}`,
            params
        );

        // 獲取列表
        const templates = await this.rawAll(
            `SELECT * FROM invitation_templates ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return {
            templates,
            pagination: {
                total: countResult?.total || 0,
                page,
                limit,
                pages: Math.ceil((countResult?.total || 0) / limit)
            }
        };
    }

    // ============================================================================
    // 統計方法
    // ============================================================================

    /**
     * 取得模板使用統計
     * @param {number} templateId - 模板 ID
     * @returns {Promise<Object>}
     */
    async getUsageStats(templateId) {
        const projects = await this.rawAll(`
            SELECT id, project_name, project_code, status, created_at
            FROM event_projects
            WHERE template_config LIKE ?
            ORDER BY created_at DESC
        `, [`%"template_id":${templateId}%`]);

        return {
            usage_count: projects.length,
            projects
        };
    }

    /**
     * 統計被使用的模板數量
     * @param {number} templateId - 模板 ID
     * @returns {Promise<number>}
     */
    async countUsage(templateId) {
        const result = await this.rawGet(`
            SELECT COUNT(*) as count
            FROM event_projects
            WHERE template_config LIKE ?
        `, [`%"template_id":${templateId}%`]);
        return result?.count || 0;
    }

    /**
     * 依類型統計模板數量
     * @returns {Promise<Array>}
     */
    async countByType() {
        const sql = `
            SELECT template_type, COUNT(*) as count
            FROM invitation_templates
            GROUP BY template_type
        `;
        return this.rawAll(sql);
    }

    // ============================================================================
    // 權限相關方法
    // ============================================================================

    /**
     * 檢查模板是否可刪除
     * @param {number} templateId - 模板 ID
     * @returns {Promise<Object>} - { canDelete: boolean, reason?: string }
     */
    async checkDeletable(templateId) {
        const template = await this.findById(templateId);
        if (!template) {
            return { canDelete: false, reason: '模板不存在' };
        }

        // 預設模板不可刪除
        if (template.is_default) {
            return { canDelete: false, reason: '無法刪除預設模板' };
        }

        // 檢查是否有項目使用此模板
        const usageCount = await this.countUsage(templateId);
        if (usageCount > 0) {
            return { canDelete: false, reason: '有項目正在使用此模板，無法刪除' };
        }

        return { canDelete: true };
    }

    /**
     * 取得用戶创建的模板
     * @param {number} userId - 用戶 ID
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findByCreator(userId, { limit = 50, offset = 0 } = {}) {
        return this.findBy({ created_by: userId }, { limit, offset, orderBy: 'created_at', order: 'DESC' });
    }

    // ============================================================================
    // 更新方法
    // ============================================================================

    /**
     * 設置預設模板
     * @param {number} templateId - 模板 ID
     * @returns {Promise<Object>}
     */
    async setAsDefault(templateId) {
        // 先將所有模板設為非預設
        await this.rawRun('UPDATE invitation_templates SET is_default = 0');

        // 設置指定模板為預設
        return this.update(templateId, { is_default: 1 });
    }

    /**
     * 批量更新狀態
     * @param {Array<number>} ids - 模板 ID 陣列
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async batchUpdate(ids, data) {
        if (!ids || ids.length === 0) {
            return { changes: 0 };
        }

        const placeholders = ids.map(() => '?').join(', ');
        const setClauses = [];
        const values = [];

        Object.entries(data).forEach(([key, value]) => {
            if (key !== 'id') {
                setClauses.push(`${key} = ?`);
                values.push(value);
            }
        });

        if (setClauses.length === 0) {
            return { changes: 0 };
        }

        values.push(...ids);

        const sql = `UPDATE invitation_templates SET ${setClauses.join(', ')} WHERE id IN (${placeholders})`;
        return this.rawRun(sql, values);
    }

    // ============================================================================
    // 創建/刪除方法
    // ============================================================================

    /**
     * 創建模板（擴展版）
     * @param {Object} data - 模板資料
     * @returns {Promise<Object>}
     */
    async createExtended(data) {
        const {
            template_name,
            template_type,
            template_content,
            special_guests,
            css_styles,
            js_scripts,
            is_default,
            category,
            status,
            tags,
            description,
            created_by
        } = data;

        const sql = `
            INSERT INTO invitation_templates (
                template_name, template_type, template_content,
                special_guests, css_styles, js_scripts, is_default,
                category, status, tags, description, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        const result = await this.rawRun(sql, [
            template_name,
            template_type || category || 'email',
            template_content,
            special_guests || null,
            css_styles || null,
            js_scripts || null,
            is_default ? 1 : 0,
            category || null,
            status || 'active',
            tags || null,
            description || null,
            created_by
        ]);

        return { id: result.lastID, template_name };
    }

    /**
     * 複製模板
     * @param {number} templateId - 原始模板 ID
     * @param {Object} options - 複製選項
     * @returns {Promise<Object>}
     */
    async duplicate(templateId, { newName, userId } = {}) {
        const original = await this.findById(templateId);
        if (!original) {
            return { success: false, error: 'NOT_FOUND', message: '模板不存在' };
        }

        const result = await this.createExtended({
            template_name: newName || `${original.template_name} (副本)`,
            template_type: original.template_type,
            template_content: original.template_content,
            css_styles: original.css_styles,
            js_scripts: original.js_scripts,
            is_default: 0,
            created_by: userId
        });

        return {
            success: true,
            id: result.id,
            template_name: result.template_name
        };
    }
}

module.exports = new TemplateRepository();
