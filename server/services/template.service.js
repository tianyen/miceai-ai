/**
 * Template Service - 模板管理業務邏輯
 *
 * @description 處理模板 CRUD、預覽、權限檢查
 * @refactor 2025-12-01: 從 admin/templates.js 提取業務邏輯
 * @refactor 2025-12-05: 從 templateController 抽取業務邏輯
 */
const BaseService = require('./base.service');

class TemplateService extends BaseService {
    constructor() {
        super('TemplateService');
        this.TEMPLATE_TYPES = ['event', 'invitation', 'notification', 'email', 'form'];
    }

    // ============================================================================
    // 權限檢查
    // ============================================================================

    /**
     * 檢查用戶對模板的編輯權限
     * @param {Object} template - 模板記錄
     * @param {Object} user - 用戶資訊
     * @returns {boolean}
     */
    checkEditPermission(template, user) {
        if (user.role === 'super_admin') return true;
        return template.created_by === user.id;
    }

    /**
     * 檢查是否可以刪除模板
     * @param {Object} template - 模板記錄
     * @param {Object} user - 用戶資訊
     * @returns {{ canDelete: boolean, reason?: string }}
     */
    async checkDeletePermission(template, user) {
        // 權限檢查
        if (!this.checkEditPermission(template, user)) {
            return { canDelete: false, reason: '權限不足' };
        }

        // 預設模板不可刪除
        if (template.is_default) {
            return { canDelete: false, reason: '無法刪除預設模板' };
        }

        // 檢查是否有項目使用此模板
        const usage = await this.db.get(`
            SELECT COUNT(*) as count
            FROM event_projects
            WHERE template_config LIKE ?
        `, [`%"template_id":${template.id}%`]);

        if (usage.count > 0) {
            return { canDelete: false, reason: '有項目正在使用此模板，無法刪除' };
        }

        return { canDelete: true };
    }

    /**
     * 根據 ID 獲取模板
     * @param {number} templateId - 模板 ID
     * @returns {Promise<Object|null>}
     */
    async getById(templateId) {
        return this.db.get('SELECT * FROM invitation_templates WHERE id = ?', [templateId]);
    }

    /**
     * 獲取模板列表（含分頁）
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getList({ page = 1, limit = 20, search, category, status } = {}) {
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

        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }

        // 獲取總數
        const countResult = await this.db.get(`
            SELECT COUNT(*) as total FROM invitation_templates ${whereClause}
        `, params);

        // 獲取列表
        const templates = await this.db.query(`
            SELECT * FROM invitation_templates
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        const total = countResult.total;
        return {
            templates,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * 獲取分頁資訊
     * @param {number} page - 頁碼
     * @param {number} limit - 每頁筆數
     * @returns {Promise<Object>}
     */
    async getPagination(page = 1, limit = 20) {
        const countResult = await this.db.get(
            'SELECT COUNT(*) as count FROM invitation_templates'
        );
        const total = countResult?.count || 0;
        return {
            total,
            pages: Math.ceil(total / limit)
        };
    }

    /**
     * 創建模板
     * @param {Object} data - 模板資料
     * @returns {Promise<Object>}
     */
    async create(data) {
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
            html_content
        } = data;

        // 處理模板內容
        let contentToStore = template_content;
        if (html_content && !template_content) {
            contentToStore = JSON.stringify({ html: html_content });
        }

        const result = await this.db.run(`
            INSERT INTO invitation_templates (
                template_name, template_type, template_content,
                special_guests, css_styles, js_scripts, is_default,
                category, status, tags, description, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
            template_name,
            template_type || category || 'email',
            contentToStore,
            special_guests || null,
            css_styles || null,
            js_scripts || null,
            is_default ? 1 : 0,
            category || null,
            status || 'active',
            tags || null,
            description || null
        ]);

        this.log('create', { templateId: result.lastID, template_name });

        return {
            id: result.lastID,
            template_name
        };
    }

    /**
     * 更新模板
     * @param {number} templateId - 模板 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async update(templateId, data) {
        const template = await this.getById(templateId);
        if (!template) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '模板不存在' });
        }

        const {
            template_name,
            template_type,
            template_content,
            special_guests,
            css_styles,
            js_scripts,
            is_default
        } = data;

        await this.db.run(`
            UPDATE invitation_templates SET
                template_name = COALESCE(?, template_name),
                template_type = COALESCE(?, template_type),
                template_content = COALESCE(?, template_content),
                special_guests = COALESCE(?, special_guests),
                css_styles = COALESCE(?, css_styles),
                js_scripts = COALESCE(?, js_scripts),
                is_default = COALESCE(?, is_default),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            template_name,
            template_type,
            template_content,
            special_guests,
            css_styles,
            js_scripts,
            is_default !== undefined ? (is_default ? 1 : 0) : null,
            templateId
        ]);

        this.log('update', { templateId });

        return { id: templateId, updated: true };
    }

    /**
     * 刪除模板（含權限檢查）
     * @param {number} templateId - 模板 ID
     * @param {Object} user - 用戶資訊
     * @returns {Promise<Object>}
     */
    async deleteTemplate(templateId, user) {
        const template = await this.getById(templateId);
        if (!template) {
            return { success: false, error: 'NOT_FOUND', message: '模板不存在' };
        }

        const { canDelete, reason } = await this.checkDeletePermission(template, user);
        if (!canDelete) {
            return { success: false, error: 'FORBIDDEN', message: reason };
        }

        await this.db.run('DELETE FROM invitation_templates WHERE id = ?', [templateId]);

        this.log('delete', { templateId, template_name: template.template_name });

        return { success: true, template };
    }

    // ============================================================================
    // 複製與預設
    // ============================================================================

    /**
     * 複製模板
     * @param {number} templateId - 模板 ID
     * @param {string} newName - 新名稱（可選）
     * @param {number} userId - 用戶 ID
     * @returns {Promise<Object>}
     */
    async duplicateTemplate(templateId, newName, userId) {
        const original = await this.getById(templateId);
        if (!original) {
            return { success: false, error: 'NOT_FOUND', message: '模板不存在' };
        }

        const result = await this.db.run(`
            INSERT INTO invitation_templates (
                template_name, template_type, template_content, css_styles,
                js_scripts, is_default, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            newName || `${original.template_name} (副本)`,
            original.template_type,
            original.template_content,
            original.css_styles,
            original.js_scripts,
            0, // 副本不設為預設
            userId
        ]);

        this.log('duplicate', { originalId: templateId, newId: result.lastID });

        return {
            success: true,
            id: result.lastID,
            template_name: newName || `${original.template_name} (副本)`
        };
    }

    /**
     * 設置預設模板
     * @param {number} templateId - 模板 ID
     * @returns {Promise<Object>}
     */
    async setDefaultTemplate(templateId) {
        const template = await this.getById(templateId);
        if (!template) {
            return { success: false, error: 'NOT_FOUND', message: '模板不存在' };
        }

        await this.db.beginTransaction();

        try {
            // 將所有模板設為非預設
            await this.db.run('UPDATE invitation_templates SET is_default = 0');

            // 設置指定模板為預設
            await this.db.run(
                'UPDATE invitation_templates SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [templateId]
            );

            await this.db.commit();

            this.log('setDefault', { templateId, template_name: template.template_name });

            return { success: true, template };
        } catch (error) {
            await this.db.rollback();
            throw error;
        }
    }

    // ============================================================================
    // 搜尋與統計
    // ============================================================================

    /**
     * 搜尋模板
     * @param {Object} params - 搜尋參數
     * @returns {Promise<Array>}
     */
    async searchTemplates({ search, category, limit = 50 }) {
        let query = `
            SELECT t.*, u.full_name as creator_name
            FROM invitation_templates t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (search && search.trim()) {
            query += ` AND (t.template_name LIKE ? OR t.description LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm);
        }

        if (category && category.trim() && category !== 'all') {
            query += ` AND t.template_type = ?`;
            params.push(category.trim());
        }

        query += ` ORDER BY t.is_default DESC, t.created_at DESC LIMIT ?`;
        params.push(limit);

        return this.db.query(query, params);
    }

    /**
     * 取得模板使用情況
     * @param {number} templateId - 模板 ID
     * @returns {Promise<Object>}
     */
    async getTemplateUsage(templateId) {
        const projects = await this.db.query(`
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
     * 按類型取得模板列表
     * @param {string} templateType - 模板類型
     * @returns {Promise<Array>}
     */
    async getTemplatesByType(templateType) {
        let query = `
            SELECT t.*, u.full_name as creator_name
            FROM invitation_templates t
            LEFT JOIN users u ON t.created_by = u.id
        `;
        const params = [];

        if (templateType) {
            query += ' WHERE t.template_type = ?';
            params.push(templateType);
        }

        query += ' ORDER BY t.is_default DESC, t.created_at DESC';

        return this.db.query(query, params);
    }

    // ============================================================================
    // 列表查詢（Controller 用）
    // ============================================================================

    /**
     * 取得模板列表（含分頁和創建者資訊）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getTemplatesList({ page = 1, limit = 20, category = null }) {
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

        const templates = await this.db.query(query, [...params, limit, offset]);
        const totalResult = await this.db.get(countQuery, params);

        return {
            templates,
            pagination: {
                page,
                limit,
                total: totalResult.count,
                pages: Math.ceil(totalResult.count / limit)
            }
        };
    }

    /**
     * 取得模板詳情（含創建者和解析內容）
     * @param {number} templateId - 模板 ID
     * @returns {Promise<Object|null>}
     */
    async getTemplateDetail(templateId) {
        const template = await this.db.get(`
            SELECT t.*, u.full_name as creator_name
            FROM invitation_templates t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.id = ?
        `, [templateId]);

        if (!template) return null;

        // 解析 template_content
        if (template.template_content) {
            try {
                template.template_content = JSON.parse(template.template_content);
            } catch (e) {
                // 解析失敗保留原始字符串
            }
        }

        // 如果是活動模板，格式化內容結構
        if (template.template_type === 'event' && template.template_content) {
            template.formatted_content = this.formatEventTemplate(template.template_content);
        }

        return template;
    }

    /**
     * 更新模板（含權限檢查）
     * @param {number} templateId - 模板 ID
     * @param {Object} updates - 更新資料
     * @param {Object} user - 用戶資訊
     * @returns {Promise<Object>}
     */
    async updateTemplate(templateId, updates, user) {
        const template = await this.getById(templateId);
        if (!template) {
            return { success: false, error: 'NOT_FOUND', message: '模板不存在' };
        }

        if (!this.checkEditPermission(template, user)) {
            return { success: false, error: 'FORBIDDEN', message: '權限不足' };
        }

        const allowedFields = [
            'template_name', 'template_type', 'template_content',
            'css_styles', 'js_scripts', 'is_default'
        ];

        const updateFields = [];
        const updateValues = [];

        Object.keys(updates).forEach(field => {
            if (allowedFields.includes(field) && updates[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                if (field === 'template_content') {
                    updateValues.push(JSON.stringify(updates[field]));
                } else if (field === 'is_default') {
                    updateValues.push(updates[field] ? 1 : 0);
                } else {
                    updateValues.push(updates[field]);
                }
            }
        });

        if (updateFields.length === 0) {
            return { success: false, error: 'NO_FIELDS', message: '沒有有效的更新字段' };
        }

        // 如果設置為預設模板，先將其他預設模板設為非預設
        if (updates.is_default) {
            await this.db.run('UPDATE invitation_templates SET is_default = 0 WHERE id != ?', [templateId]);
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(templateId);

        const query = `UPDATE invitation_templates SET ${updateFields.join(', ')} WHERE id = ?`;
        await this.db.run(query, updateValues);

        this.log('update', { templateId, fields: Object.keys(updates) });

        return { success: true, template };
    }

    // ============================================================================
    // 格式化輔助
    // ============================================================================

    /**
     * 格式化活動模板內容
     * @param {Object} content - 模板內容
     * @returns {Object|null}
     */
    formatEventTemplate(content) {
        if (!content || typeof content !== 'object') {
            return null;
        }

        return {
            schedule: content.schedule || null,
            introduction: content.introduction || '',
            process: content.process || [],
            special_guests: content.special_guests || [],
            additional_info: content.additional_info || {}
        };
    }

    /**
     * 取得模板類型標籤
     * @param {string} type - 模板類型
     * @returns {Object}
     */
    getTypeBadge(type) {
        const typeMap = {
            'event': { class: 'event', label: '活動模板' },
            'invitation': { class: 'invitation', label: 'MICE-AI' },
            'notification': { class: 'notification', label: '通知' },
            'email': { class: 'email', label: '電子郵件' },
            'form': { class: 'form', label: '表單' }
        };
        return typeMap[type] || { class: '', label: '其他' };
    }

    /**
     * 解析模板內容
     * @param {string} templateContent - 模板內容
     * @returns {string} 解析後的 HTML
     */
    parseTemplateContent(templateContent) {
        if (!templateContent) return '<p>無預覽內容</p>';

        try {
            const parsed = JSON.parse(templateContent);
            if (parsed.html) {
                return parsed.html;
            }
            if (typeof parsed === 'string') {
                return parsed;
            }
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            return templateContent;
        }
    }

    /**
     * 替換模板變量
     * @param {string} content - 模板內容
     * @param {Object} data - 替換數據
     * @returns {string} 替換後的內容
     */
    replaceVariables(content, data = {}) {
        const defaultData = {
            '{{event_name}}': '企業數位轉型研討會',
            '{{participant_name}}': '張先生/女士',
            '{{event_date}}': '2024年12月15日',
            '{{event_time}}': '下午2:00',
            '{{event_location}}': '台北國際會議中心',
            '{{organizer_name}}': '主辦單位名稱'
        };

        const mergedData = { ...defaultData, ...data };
        let result = content;

        Object.entries(mergedData).forEach(([placeholder, value]) => {
            result = result.replace(new RegExp(placeholder, 'g'), value);
        });

        return result;
    }
}

module.exports = new TemplateService();
