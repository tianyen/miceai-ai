/**
 * Project Service - 專案相關業務邏輯
 *
 * 職責：
 * - 專案搜尋與分頁
 * - 專案統計
 * - 參加者列表
 * - 問卷狀況
 *
 * @description 從 admin-extended.js 抽取的業務邏輯
 * @refactor 2025-12-01: 使用 Repository 層
 */
const BaseService = require('./base.service');
const projectRepository = require('../repositories/project.repository');

class ProjectService extends BaseService {
    constructor() {
        super('ProjectService');
        this.repository = projectRepository;
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
     * 取得專案參加者列表
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>} 參加者列表
     */
    async getParticipants(projectId) {
        return this.repository.getParticipants(projectId);
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
