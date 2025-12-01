/**
 * Booth Service - 攤位相關業務邏輯
 *
 * 職責：
 * - 攤位 CRUD 操作
 * - 攤位統計
 * - 遊戲綁定管理
 * - 業務驗證
 *
 * @refactor 2025-12-01: 新增遊戲綁定方法
 */
const BaseService = require('./base.service');
const boothRepository = require('../repositories/booth.repository');
const QRCode = require('qrcode');
const config = require('../config');

class BoothService extends BaseService {
    constructor() {
        super('BoothService');
        this.repository = boothRepository;
    }

    // ============================================================================
    // 查詢方法
    // ============================================================================

    /**
     * 取得攤位（含專案資訊）
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<Object|null>}
     */
    async getById(boothId) {
        return this.repository.findByIdWithProject(boothId);
    }

    /**
     * 取得所有攤位（含統計）
     * @param {number|null} projectId - 專案 ID（可選）
     * @returns {Promise<Array>}
     */
    async getAll(projectId = null) {
        return this.repository.findAllWithStats(projectId);
    }

    /**
     * 取得攤位詳情
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<Object|null>}
     */
    async getDetail(boothId) {
        return this.repository.findByIdWithProject(boothId);
    }

    // ============================================================================
    // CRUD 操作
    // ============================================================================

    /**
     * 建立攤位
     * @param {Object} data - 攤位資料
     * @returns {Promise<Object>}
     */
    async create({ project_id, booth_name, booth_code, location, description }) {
        // 驗證必填欄位
        if (!project_id || !booth_name || !booth_code) {
            this.throwError(this.ErrorCodes.MISSING_REQUIRED_FIELD, '專案 ID、攤位名稱和代碼為必填');
        }

        // 檢查攤位代碼是否已存在
        const existing = await this.repository.findByCode(booth_code);
        if (existing) {
            this.throwError(this.ErrorCodes.DUPLICATE_ENTRY, '攤位代碼已存在');
        }

        // 建立攤位
        const result = await this.repository.createBooth({
            project_id,
            booth_name,
            booth_code,
            location,
            description
        });

        this.log('create', { booth_code, project_id });

        return {
            success: true,
            id: result.lastID,
            message: '新增攤位成功'
        };
    }

    /**
     * 更新攤位
     * @param {number} boothId - 攤位 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async update(boothId, { booth_name, booth_code, location, description, is_active }) {
        // 檢查攤位是否存在
        const booth = await this.repository.findById(boothId);
        if (!booth) {
            this.throwError(this.ErrorCodes.NOT_FOUND, '找不到攤位');
        }

        // 如果更新攤位代碼，檢查是否重複
        if (booth_code) {
            const existing = await this.repository.findByCodeExcluding(booth_code, boothId);
            if (existing) {
                this.throwError(this.ErrorCodes.DUPLICATE_ENTRY, '攤位代碼已存在');
            }
        }

        // 更新攤位
        await this.repository.updateBooth(boothId, {
            booth_name,
            booth_code,
            location,
            description,
            is_active
        });

        this.log('update', { boothId });

        return {
            success: true,
            message: '更新攤位成功'
        };
    }

    /**
     * 刪除攤位
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<Object>}
     */
    async delete(boothId) {
        // 檢查攤位是否存在
        const booth = await this.repository.findById(boothId);
        if (!booth) {
            this.throwError(this.ErrorCodes.NOT_FOUND, '找不到攤位');
        }

        // 檢查是否有關聯的遊戲會話
        const hasSessions = await this.repository.hasGameSessions(boothId);
        if (hasSessions) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, '此攤位已有遊戲記錄，無法刪除');
        }

        // 刪除攤位
        await this.repository.deleteBooth(boothId);

        this.log('delete', { boothId });

        return {
            success: true,
            message: '刪除攤位成功'
        };
    }

    // ============================================================================
    // 統計方法
    // ============================================================================

    /**
     * 取得攤位統計
     * @param {number} boothId - 攤位 ID
     * @param {string|null} date - 日期篩選（可選）
     * @returns {Promise<Object>}
     */
    async getStats(boothId, date = null) {
        // 檢查攤位是否存在
        const booth = await this.repository.findById(boothId);
        if (!booth) {
            this.throwError(this.ErrorCodes.NOT_FOUND, '找不到攤位');
        }

        // 取得統計數據
        const summary = await this.repository.getStatsSummary(boothId, date);
        const hourlyStats = await this.repository.getHourlyStats(boothId, date);

        return {
            booth,
            summary: {
                total_players: summary.total_players || 0,
                total_sessions: summary.total_sessions || 0,
                avg_score: Math.round((summary.avg_score || 0) * 10) / 10,
                max_score: summary.max_score || 0,
                avg_play_time: Math.round((summary.avg_play_time || 0) * 10) / 10,
                vouchers_earned: summary.vouchers_earned || 0
            },
            hourly_stats: hourlyStats
        };
    }

    /**
     * 檢查攤位是否存在
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<boolean>}
     */
    async exists(boothId) {
        const booth = await this.repository.findById(boothId);
        return !!booth;
    }

    // ============================================================================
    // 遊戲綁定方法
    // ============================================================================

    /**
     * 獲取攤位綁定的遊戲列表
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<Object>}
     */
    async getBoothGames(boothId) {
        // 檢查攤位是否存在
        const booth = await this.repository.findById(boothId);
        if (!booth) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '找不到攤位' });
        }

        // 獲取攤位綁定的遊戲列表
        const games = await this.db.query(`
            SELECT
                bg.*,
                g.game_name_zh,
                g.game_name_en,
                g.game_url,
                g.game_version,
                g.is_active as game_is_active,
                v.voucher_name,
                v.voucher_value,
                v.remaining_quantity,
                v.total_quantity
            FROM booth_games bg
            LEFT JOIN games g ON bg.game_id = g.id
            LEFT JOIN vouchers v ON bg.voucher_id = v.id
            WHERE bg.booth_id = ?
            ORDER BY bg.created_at DESC
        `, [boothId]);

        this.log('getBoothGames', { boothId, count: games.length });

        return { games };
    }

    /**
     * 綁定遊戲到攤位
     * @param {number} boothId - 攤位 ID
     * @param {Object} data - 綁定資料
     * @returns {Promise<Object>}
     */
    async bindGame(boothId, { game_id, voucher_id }) {
        // 檢查攤位是否存在
        const booth = await this.db.get('SELECT * FROM booths WHERE id = ?', [boothId]);
        if (!booth) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '找不到攤位' });
        }

        // 檢查遊戲是否存在
        const game = await this.db.get('SELECT * FROM games WHERE id = ?', [game_id]);
        if (!game) {
            this.throwError(this.ErrorCodes.GAME_NOT_FOUND);
        }

        // 檢查是否已綁定
        const existing = await this.db.get(
            'SELECT * FROM booth_games WHERE booth_id = ? AND game_id = ?',
            [boothId, game_id]
        );
        if (existing) {
            this.throwError(this.ErrorCodes.DUPLICATE_ENTRY, { message: '此遊戲已綁定到該攤位' });
        }

        // 如果有兌換券，檢查兌換券是否存在
        if (voucher_id) {
            const voucher = await this.db.get('SELECT * FROM vouchers WHERE id = ?', [voucher_id]);
            if (!voucher) {
                this.throwError(this.ErrorCodes.VOUCHER_NOT_FOUND);
            }
        }

        // 生成 QR Code
        const qrData = {
            type: 'game',
            booth_id: boothId,
            game_id: game_id,
            booth_code: booth.booth_code,
            game_name: game.game_name_zh
        };

        const baseUrl = config.app?.baseUrl || 'http://localhost:3000';
        const qrCodeUrl = `${baseUrl}/api/v1/game/start?data=${encodeURIComponent(JSON.stringify(qrData))}`;
        const qrCodeBase64 = await QRCode.toDataURL(qrCodeUrl, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        // 插入綁定記錄
        const result = await this.db.run(`
            INSERT INTO booth_games (booth_id, game_id, voucher_id, qr_code_base64)
            VALUES (?, ?, ?, ?)
        `, [boothId, game_id, voucher_id || null, qrCodeBase64]);

        this.log('bindGame', { boothId, game_id, binding_id: result.lastID });

        return { id: result.lastID };
    }

    /**
     * 更新遊戲綁定
     * @param {number} boothId - 攤位 ID
     * @param {number} bindingId - 綁定 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async updateBinding(boothId, bindingId, { voucher_id, is_active }) {
        // 檢查綁定是否存在
        const binding = await this.db.get(
            'SELECT * FROM booth_games WHERE id = ? AND booth_id = ?',
            [bindingId, boothId]
        );
        if (!binding) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '找不到遊戲綁定' });
        }

        // 更新綁定
        const updates = [];
        const params = [];

        if (voucher_id !== undefined) {
            updates.push('voucher_id = ?');
            params.push(voucher_id || null);
        }

        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(bindingId, boothId);

            await this.db.run(`
                UPDATE booth_games
                SET ${updates.join(', ')}
                WHERE id = ? AND booth_id = ?
            `, params);
        }

        this.log('updateBinding', { boothId, bindingId });

        return { updated: true };
    }

    /**
     * 解除遊戲綁定
     * @param {number} boothId - 攤位 ID
     * @param {number} bindingId - 綁定 ID
     * @returns {Promise<Object>}
     */
    async unbindGame(boothId, bindingId) {
        // 檢查綁定是否存在
        const binding = await this.db.get(
            'SELECT * FROM booth_games WHERE id = ? AND booth_id = ?',
            [bindingId, boothId]
        );
        if (!binding) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '找不到遊戲綁定' });
        }

        // 刪除綁定
        await this.db.run('DELETE FROM booth_games WHERE id = ? AND booth_id = ?', [bindingId, boothId]);

        this.log('unbindGame', { boothId, bindingId });

        return { deleted: true };
    }
}

// Singleton pattern
module.exports = new BoothService();
