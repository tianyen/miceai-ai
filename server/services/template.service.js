/**
 * Template Service - 模板管理業務邏輯
 *
 * @description 處理模板 CRUD、預覽
 * @refactor 2025-12-01: 從 admin/templates.js 提取業務邏輯
 */
const BaseService = require('./base.service');

class TemplateService extends BaseService {
    constructor() {
        super('TemplateService');
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
     * 刪除模板
     * @param {number} templateId - 模板 ID
     * @returns {Promise<Object>}
     */
    async delete(templateId) {
        const template = await this.getById(templateId);
        if (!template) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '模板不存在' });
        }

        await this.db.run('DELETE FROM invitation_templates WHERE id = ?', [templateId]);

        this.log('delete', { templateId });

        return { deleted: true };
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
