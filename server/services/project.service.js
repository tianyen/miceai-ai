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
const boothRepository = require('../repositories/booth.repository');
const QRCode = require('qrcode');
const {
    DEFAULT_FORM_CONFIG,
    normalizeFormConfig,
    normalizeInterstitialEffect,
    buildFrontendFields,
    buildFieldSummary
} = require('../utils/registration-config');

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
        const project = await this.repository.findByCreatorId(userId, projectId);

        if (project) return true;

        const permission = await this.repository.findUserPermission(userId, projectId);

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

        const project = await this.repository.findByCreatorId(userId, projectId);

        if (project) return true;

        const adminPermission = await this.repository.findAdminPermission(userId, projectId, 'admin');

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

        const result = await this.repository.createWithCreator({
            project_name,
            project_code,
            description,
            event_date,
            event_location,
            event_type,
            template_config,
            brand_config
        }, createdBy);

        this.log('createProject', { projectId: result.id, project_name, project_code });

        return result;
    }

    /**
     * 更新專案
     * @param {number} projectId - 專案 ID
     * @param {Object} updates - 更新資料
     * @returns {Promise<Object>}
     */
    async updateProject(projectId, updates) {
        const result = await this.repository.updateById(projectId, updates);

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
        const project = await this.repository.findById(projectId);

        if (!project) {
            return { success: false, error: 'NOT_FOUND', message: '項目不存在' };
        }

        await this.db.beginTransaction();

        try {
            await this.repository.deleteProjectCascade(projectId);

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
        const result = await this.repository.duplicate(projectId, userId);

        if (!result) {
            return { success: false, error: 'NOT_FOUND', message: '專案不存在' };
        }

        this.log('duplicateProject', { originalId: projectId, newId: result.id });

        return { success: true, id: result.id };
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

        const project = await this.repository.findById(projectId);

        if (!project) {
            return { success: false, error: 'NOT_FOUND', message: '專案不存在' };
        }

        await this.repository.updateStatus(projectId, status);

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
        return this.repository.getPermissions(projectId);
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
        await this.repository.upsertPermission(projectId, userId, permissionLevel, assignedBy);

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
        const result = await this.repository.updatePermission(projectId, userId, permissionLevel, assignedBy);

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
        const result = await this.repository.deletePermission(projectId, userId);

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
        return this.repository.getListWithPermissionFilter({ userId, userRole, page, limit });
    }

    /**
     * 搜尋專案（Admin Panel 用）
     * @param {Object} params - 搜尋參數
     * @returns {Promise<Array>}
     */
    async searchProjectsAdmin({ userId, userRole, search, status, limit = 50 }) {
        return this.repository.searchWithPermissionFilter({ userId, userRole, search, status, limit });
    }

    /**
     * 取得最近專案
     * @param {Object} params - 查詢參數
     * @returns {Promise<Array>}
     */
    async getRecentProjects({ userId, userRole, limit = 5 }) {
        return this.repository.getRecentProjectsWithFilter({ userId, userRole, limit });
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
        const project = await this.repository.getFullDetail(projectId);
        return project;
    }

    /**
     * 取得專案掃描器 URL
     * @param {number} projectId - 專案 ID
     * @param {string} baseUrl - 基礎 URL
     * @returns {Promise<Object|null>}
     */
    async getScannerUrl(projectId, baseUrl) {
        const project = await this.repository.getScannerInfo(projectId);

        if (!project) return null;

        return {
            project_id: projectId,
            project_name: project.project_name,
            project_status: project.project_status,
            scanner_url: `${baseUrl}/admin/qr-scanner?project=${projectId}`,
            is_active: project.project_status === 'active'
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
        const result = await this.repository.exportSubmissions(projectId);

        if (!result) {
            return { success: false, error: 'NOT_FOUND', message: '專案不存在' };
        }

        return { success: true, ...result };
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
     * 檢測專案中的重複報名
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>} 重複報名結果
     */
    async findDuplicateParticipants(projectId) {
        return this.repository.findDuplicateParticipants(projectId);
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
     * 建立遊戲綁定（自動選擇第一個攤位）
     * @param {number} projectId - 專案 ID
     * @param {Object} data - 綁定資料 { game_id, voucher_id }
     * @returns {Promise<Object>}
     */
    async createGameBinding(projectId, { game_id, voucher_id }) {
        // 取得專案的第一個攤位
        const booth = await boothRepository.findFirstByProject(projectId);

        if (!booth) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '此專案尚未建立攤位，請先新增攤位後再綁定遊戲'
            });
        }

        // 檢查遊戲是否已綁定到此攤位
        const existingBinding = await boothRepository.findBindingByBoothAndGame(booth.id, game_id);
        if (existingBinding) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '此遊戲已經綁定到攤位了'
            });
        }

        // 生成 QR Code
        const qrData = JSON.stringify({
            type: 'booth_game',
            booth_id: booth.id,
            game_id: game_id,
            project_id: projectId,
            timestamp: Date.now()
        });

        const qrCodeBase64 = await QRCode.toDataURL(qrData, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        // 建立綁定
        const result = await boothRepository.createGameBinding(booth.id, game_id, voucher_id, qrCodeBase64);

        this.log('createGameBinding', {
            projectId,
            boothId: booth.id,
            game_id,
            binding_id: result.lastID
        });

        return {
            id: result.lastID,
            booth_id: booth.id,
            booth_name: booth.booth_name,
            message: '遊戲綁定成功'
        };
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
     * 由 form_config 轉換為 project_feature_flags payload（P1 雙寫）
     * @param {Object} formConfig
     * @returns {Object}
     * @private
     */
    _buildFeatureFlagPayload(formConfig) {
        const toggles = formConfig?.feature_toggles || {};
        const defaultKeys = Object.keys(DEFAULT_FORM_CONFIG.feature_toggles || {});
        const payload = {};

        for (const key of defaultKeys) {
            payload[key] = {
                enabled: !!toggles[key],
                config: null
            };
        }

        payload.interstitial_effect = {
            enabled: !!formConfig?.interstitial_effect?.enabled,
            config: formConfig?.interstitial_effect?.asset
                ? { asset: formConfig.interstitial_effect.asset }
                : null
        };

        return payload;
    }

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

        // 合併已儲存配置與預設值
        const formConfig = normalizeFormConfig(project.form_config || DEFAULT_FORM_CONFIG);
        const fields = buildFrontendFields(formConfig);
        const summary = buildFieldSummary(formConfig);

        return {
            project_id: project.id,
            project_name: project.project_name,
            form_config: formConfig,
            summary,
            required_fields: formConfig.required_fields,
            optional_fields: formConfig.optional_fields,
            option_lists: {
                gender: formConfig.gender_options,
                title: formConfig.title_options
            },
            fields
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

        const normalizedConfig = normalizeFormConfig(formConfig);

        await this.repository.updateById(projectId, { form_config: normalizedConfig });
        await this.repository.upsertFeatureFlags(
            projectId,
            this._buildFeatureFlagPayload(normalizedConfig),
            user?.id || null
        );
        await this.repository.syncRegistrationFieldSettings(
            projectId,
            normalizedConfig,
            user?.id || null
        );
        await this.repository.upsertInterstitialMediaAsset(
            projectId,
            normalizedConfig.interstitial_effect,
            user?.id || null
        );

        this.log('updateFormConfig', { projectId, user: user?.id });

        return true;
    }

    /**
     * 更新專案第二頁中間特效設定（僅 patch interstitial_effect）
     * @param {number} projectId - 專案 ID
     * @param {Object} interstitialPatch - 部分更新資料
     * @param {Object} user - 當前用戶
     * @returns {Promise<Object|null>} interstitial_effect
     */
    async updateInterstitialEffect(projectId, interstitialPatch, user) {
        const project = await this.repository.findById(projectId);
        if (!project) {
            return null;
        }

        const currentConfig = normalizeFormConfig(project.form_config || DEFAULT_FORM_CONFIG);
        const currentEffect = normalizeInterstitialEffect(currentConfig.interstitial_effect);
        const patch = interstitialPatch && typeof interstitialPatch === 'object' ? interstitialPatch : {};

        const mergedRawEffect = {
            enabled: Object.prototype.hasOwnProperty.call(patch, 'enabled')
                ? patch.enabled
                : currentEffect.enabled,
            asset: Object.prototype.hasOwnProperty.call(patch, 'asset')
                ? patch.asset
                : currentEffect.asset
        };

        const nextEffect = normalizeInterstitialEffect(mergedRawEffect);

        if (nextEffect.enabled && !nextEffect.asset?.url) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '啟用第二頁特效前，請先設定 GIF 或 MP4 素材'
            });
        }

        const nextConfig = {
            ...currentConfig,
            interstitial_effect: nextEffect
        };

        await this.repository.updateById(projectId, { form_config: nextConfig });
        await this.repository.upsertFeatureFlags(
            projectId,
            this._buildFeatureFlagPayload(nextConfig),
            user?.id || null
        );
        await this.repository.upsertInterstitialMediaAsset(
            projectId,
            nextEffect,
            user?.id || null
        );

        this.log('updateInterstitialEffect', {
            projectId,
            user: user?.id,
            enabled: nextEffect.enabled,
            hasAsset: !!nextEffect.asset?.url
        });

        return nextEffect;
    }
}

// Singleton pattern
module.exports = new ProjectService();
