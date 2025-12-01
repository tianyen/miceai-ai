/**
 * Game Service - 遊戲業務邏輯層
 *
 * @description 處理遊戲相關業務：會話管理、日誌記錄、兌換券發放
 * @refactor 2025-12-01: 擴展 Admin API 支援
 */
const BaseService = require('./base.service');
const gameRepository = require('../repositories/game.repository');
const projectRepository = require('../repositories/project.repository');
const voucherRepository = require('../repositories/voucher.repository');
const { checkVoucherRedemption } = require('../utils/voucher-checker');
const { generateRedemptionCode } = require('../utils/redemption-code-generator');
const QRCode = require('qrcode');

class GameService extends BaseService {
    constructor() {
        super('GameService');
        this.gameRepo = gameRepository;
        this.projectRepo = projectRepository;
        this.voucherRepo = voucherRepository;
    }

    // ==================== Admin API 方法 ====================

    /**
     * 獲取遊戲列表（含分頁）
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getList({ page = 1, limit = 20, search = '', is_active = '' } = {}) {
        const offset = (page - 1) * limit;

        let query = `SELECT * FROM games WHERE 1=1`;
        const params = [];

        if (search) {
            query += ` AND (game_name_zh LIKE ? OR game_name_en LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        if (is_active !== '') {
            query += ` AND is_active = ?`;
            params.push(is_active);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const games = await this.db.query(query, params);

        // 獲取總數
        let countQuery = `SELECT COUNT(*) as total FROM games WHERE 1=1`;
        const countParams = [];

        if (search) {
            countQuery += ` AND (game_name_zh LIKE ? OR game_name_en LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`);
        }

        if (is_active !== '') {
            countQuery += ` AND is_active = ?`;
            countParams.push(is_active);
        }

        const { total } = await this.db.get(countQuery, countParams);

        this.log('getList', { page, limit, search, is_active, total, count: games.length });

        return {
            games,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(total / limit),
                total_items: total,
                items_per_page: parseInt(limit)
            }
        };
    }

    /**
     * 根據 ID 獲取遊戲（Admin API）
     * @param {number} gameId - 遊戲 ID
     * @returns {Promise<Object>}
     */
    async getById(gameId) {
        const game = await this.db.get('SELECT * FROM games WHERE id = ?', [gameId]);

        if (!game) {
            this.throwError(this.ErrorCodes.GAME_NOT_FOUND);
        }

        this.log('getById', { game_id: gameId });

        return { game };
    }

    /**
     * 創建遊戲
     * @param {Object} data - 遊戲資料
     * @returns {Promise<Object>}
     */
    async create(data) {
        const {
            game_name_zh,
            game_name_en,
            game_url,
            game_version,
            description,
            is_active = 1
        } = data;

        if (!game_name_zh) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '遊戲中文名稱為必填'
            });
        }

        const result = await this.db.run(
            `INSERT INTO games (game_name_zh, game_name_en, game_url, game_version, description, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [game_name_zh, game_name_en, game_url, game_version || null, description || null, is_active ? 1 : 0]
        );

        const game = await this.db.get('SELECT * FROM games WHERE id = ?', [result.lastID]);

        this.log('create', { game_id: result.lastID, game_name_zh, game_name_en });

        return { game };
    }

    /**
     * 更新遊戲
     * @param {number} gameId - 遊戲 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async update(gameId, data) {
        const game = await this.db.get('SELECT * FROM games WHERE id = ?', [gameId]);

        if (!game) {
            this.throwError(this.ErrorCodes.GAME_NOT_FOUND);
        }

        const updates = [];
        const params = [];

        if (data.game_name_zh !== undefined) {
            updates.push('game_name_zh = ?');
            params.push(data.game_name_zh);
        }
        if (data.game_name_en !== undefined) {
            updates.push('game_name_en = ?');
            params.push(data.game_name_en);
        }
        if (data.game_url !== undefined) {
            updates.push('game_url = ?');
            params.push(data.game_url);
        }
        if (data.game_version !== undefined) {
            updates.push('game_version = ?');
            params.push(data.game_version);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (data.is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(data.is_active ? 1 : 0);
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(gameId);

            await this.db.run(
                `UPDATE games SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }

        const updatedGame = await this.db.get('SELECT * FROM games WHERE id = ?', [gameId]);

        this.log('update', { game_id: gameId, updates: Object.keys(data) });

        return { game: updatedGame };
    }

    /**
     * 刪除遊戲（軟刪除）
     * @param {number} gameId - 遊戲 ID
     * @returns {Promise<Object>}
     */
    async delete(gameId) {
        const game = await this.db.get('SELECT * FROM games WHERE id = ?', [gameId]);

        if (!game) {
            this.throwError(this.ErrorCodes.GAME_NOT_FOUND);
        }

        // 軟刪除：設置 is_active = 0
        await this.db.run(
            'UPDATE games SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [gameId]
        );

        this.log('delete', { game_id: gameId, game_name_zh: game.game_name_zh });

        return { deleted: true };
    }

    /**
     * 獲取遊戲會話列表
     * @param {number} gameId - 遊戲 ID
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getSessions(gameId, { page = 1, limit = 20, trace_id = '' } = {}) {
        const offset = (page - 1) * limit;

        let query = `
            SELECT
                gs.*,
                g.game_name_zh,
                g.game_name_en,
                p.project_name,
                v.voucher_name
            FROM game_sessions gs
            LEFT JOIN games g ON gs.game_id = g.id
            LEFT JOIN event_projects p ON gs.project_id = p.id
            LEFT JOIN vouchers v ON gs.voucher_id = v.id
            WHERE gs.game_id = ?
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM game_sessions WHERE game_id = ?';
        let params = [gameId];
        let countParams = [gameId];

        if (trace_id && trace_id.trim()) {
            query += ` AND gs.trace_id LIKE ?`;
            countQuery += ` AND trace_id LIKE ?`;
            const searchTerm = `%${trace_id.trim()}%`;
            params.push(searchTerm);
            countParams.push(searchTerm);
        }

        query += ` ORDER BY gs.session_start DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const sessions = await this.db.query(query, params);
        const { total } = await this.db.get(countQuery, countParams);

        this.log('getSessions', { game_id: gameId, page, limit, trace_id, total, count: sessions.length });

        return {
            sessions,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(total / limit),
                total_items: total,
                items_per_page: parseInt(limit)
            }
        };
    }

    // ==================== 遊戲查詢 ====================

    /**
     * 根據 ID 查詢遊戲
     * @param {number} gameId - 遊戲 ID
     * @returns {Promise<Object>}
     */
    async getGameById(gameId) {
        const game = await this.gameRepo.findById(gameId);

        if (!game) {
            this.throwError(this.ErrorCodes.GAME_NOT_FOUND);
        }

        return game;
    }

    /**
     * 查詢遊戲列表
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async listGames(options = {}) {
        return this.gameRepo.findAll(options);
    }

    /**
     * 根據專案查詢綁定的遊戲
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async getGamesByProject(projectId) {
        // 驗證專案存在
        const project = await this.projectRepo.findById(projectId);
        if (!project) {
            this.throwError(this.ErrorCodes.PROJECT_NOT_FOUND);
        }

        return this.gameRepo.findByProject(projectId);
    }

    /**
     * 查詢遊戲綁定資訊（用於 v1 API）
     * @param {number} gameId - 遊戲 ID
     * @param {number} projectId - 專案 ID（可選）
     * @param {number} boothId - 攤位 ID（可選）
     * @returns {Promise<Object>}
     */
    async getGameBinding(gameId, projectId = null, boothId = null) {
        const binding = await this.gameRepo.findGameBinding(gameId, projectId, boothId);

        if (!binding) {
            this.throwError(this.ErrorCodes.GAME_NOT_FOUND, {
                message: '遊戲未綁定到指定專案或攤位'
            });
        }

        return binding;
    }

    // ==================== 會話管理 ====================

    /**
     * 開始遊戲會話
     * @param {Object} sessionData - 會話資料
     * @returns {Promise<Object>}
     */
    async startSession(sessionData) {
        const { gameId, traceId, projectId, boothId, userId, ipAddress, userAgent } = sessionData;

        // 查詢攤位遊戲綁定
        let binding;
        let actualBoothId = boothId;

        if (boothId) {
            binding = await this.gameRepo.findBoothGameBinding(boothId, gameId);
        } else if (projectId) {
            binding = await this.gameRepo.findBoothGameBindingByProject(projectId, gameId);
            if (binding) {
                actualBoothId = binding.booth_id;
            }
        }

        if (!binding) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '攤位未綁定此遊戲或遊戲未啟用'
            });
        }

        // 建立會話
        const result = await this.gameRepo.createSession({
            projectId: binding.project_id,
            gameId,
            boothId: actualBoothId,
            traceId,
            userId,
            ipAddress,
            userAgent
        });

        this.log('startSession', {
            sessionId: result.lastID,
            gameId,
            traceId,
            boothId: actualBoothId
        });

        return {
            sessionId: result.lastID,
            traceId,
            gameInfo: {
                id: binding.game_id,
                name_zh: binding.game_name_zh,
                name_en: binding.game_name_en,
                game_url: binding.game_url
            }
        };
    }

    /**
     * 結束遊戲會話（含兌換券發放邏輯）
     * @param {Object} endData - 結束資料
     * @returns {Promise<Object>}
     */
    async endSession(endData) {
        const { gameId, traceId, projectId, finalScore = 0, totalPlayTime = 0 } = endData;

        // 查找進行中的會話
        const session = await this.gameRepo.findActiveSession(traceId, gameId, projectId);

        if (!session) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '找不到進行中的遊戲會話'
            });
        }

        // 結束會話
        await this.gameRepo.endSession(session.id, {
            finalScore,
            totalPlayTime
        });

        // 查詢攤位綁定的兌換券
        const binding = await this.gameRepo.findBoothGameBinding(session.booth_id, gameId);

        let voucherEarned = false;
        let voucherData = null;
        let reason = '';

        // 如果有綁定兌換券，檢查條件
        if (binding && binding.voucher_id) {
            const voucherResult = await this._processVoucherRedemption({
                voucherId: binding.voucher_id,
                sessionId: session.id,
                traceId,
                finalScore,
                totalPlayTime
            });

            voucherEarned = voucherResult.earned;
            voucherData = voucherResult.voucher;
            reason = voucherResult.reason;
        }

        this.log('endSession', {
            sessionId: session.id,
            finalScore,
            totalPlayTime,
            voucherEarned
        });

        const result = {
            sessionId: session.id,
            traceId,
            finalScore,
            playTime: totalPlayTime,
            voucherEarned
        };

        if (voucherEarned && voucherData) {
            result.voucher = voucherData;
        } else if (reason) {
            result.reason = reason;
        }

        return result;
    }

    /**
     * 內部方法：處理兌換券發放
     * @private
     */
    async _processVoucherRedemption({ voucherId, sessionId, traceId, finalScore, totalPlayTime }) {
        // 查詢兌換券資訊
        const voucher = await this.db.get(
            'SELECT * FROM vouchers WHERE id = ? AND is_active = 1',
            [voucherId]
        );

        if (!voucher) {
            return { earned: false, reason: '兌換券不存在或未啟用' };
        }

        // 查詢兌換條件
        const conditions = await this.db.get(
            'SELECT * FROM voucher_conditions WHERE voucher_id = ?',
            [voucherId]
        );

        if (!conditions) {
            return { earned: false, reason: '未設定兌換條件' };
        }

        // 檢查兌換條件和庫存
        const checkResult = checkVoucherRedemption(
            { final_score: finalScore, total_play_time: totalPlayTime },
            voucher,
            conditions
        );

        if (!checkResult.canRedeem) {
            return { earned: false, reason: checkResult.reason };
        }

        // 開始交易
        await this.db.run('BEGIN TRANSACTION');

        try {
            // 生成兌換碼和 QR Code
            const redemptionCode = generateRedemptionCode();
            const qrCodeData = JSON.stringify({
                redemption_code: redemptionCode,
                trace_id: traceId,
                voucher_id: voucher.id,
                voucher_name: voucher.voucher_name
            });
            const qrCodeBase64 = await QRCode.toDataURL(qrCodeData, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                width: 300,
                margin: 2
            });

            // 建立兌換記錄
            await this.voucherRepo.createRedemption({
                voucherId: voucher.id,
                traceId,
                sessionId,
                redemptionCode,
                qrCodeBase64
            });

            // 扣減庫存
            await this.voucherRepo.decrementStock(voucher.id);

            // 更新會話記錄
            await this.gameRepo.updateSessionVoucher(sessionId, voucher.id);

            await this.db.run('COMMIT');

            this.log('voucherIssued', {
                redemptionCode,
                voucherId: voucher.id,
                traceId
            });

            return {
                earned: true,
                voucher: {
                    id: voucher.id,
                    name: voucher.voucher_name,
                    value: voucher.voucher_value,
                    vendor: voucher.vendor_name,
                    category: voucher.category,
                    redemption_code: redemptionCode,
                    qr_code_base64: qrCodeBase64
                }
            };

        } catch (error) {
            await this.db.run('ROLLBACK');
            throw error;
        }
    }

    /**
     * 查詢會話
     * @param {number} sessionId - 會話 ID
     * @returns {Promise<Object>}
     */
    async getSession(sessionId) {
        const session = await this.gameRepo.findSessionById(sessionId);

        if (!session) {
            this.throwError(this.ErrorCodes.NOT_FOUND);
        }

        return session;
    }

    // ==================== 日誌記錄 ====================

    /**
     * 記錄遊戲事件日誌
     * @param {Object} logData - 日誌資料
     * @returns {Promise<Object>}
     */
    async logEvent(logData) {
        const {
            gameId, traceId, projectId, userId,
            logLevel = 'info', message, userAction, score = 0, playTime = 0,
            ipAddress, userAgent
        } = logData;

        const result = await this.gameRepo.createLog({
            projectId,
            gameId,
            traceId,
            userId,
            logLevel,
            message,
            userAction,
            score,
            playTime,
            ipAddress,
            userAgent
        });

        return {
            logId: result.lastID,
            traceId
        };
    }

    /**
     * 獲取遊戲資訊（含綁定狀態和兌換券資訊）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getGameInfo({ gameId, projectId, boothId }) {
        // 查詢遊戲基本資訊
        const game = await this.gameRepo.findActiveGame(gameId);

        if (!game) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '遊戲不存在或未啟用'
            });
        }

        const responseData = {
            id: game.id,
            name_zh: game.game_name_zh,
            name_en: game.game_name_en,
            game_url: game.game_url,
            game_version: game.game_version,
            is_active: game.is_active
        };

        // 如果提供了 booth_id 或 project_id，查詢綁定資訊
        let binding;
        if (boothId) {
            binding = await this.gameRepo.findBoothGameBinding(boothId, gameId);
        } else if (projectId) {
            binding = await this.gameRepo.findBoothGameBindingByProject(projectId, gameId);
        }

        if (binding) {
            responseData.is_bound = true;

            // 如果有綁定兌換券，返回兌換券資訊
            if (binding.voucher_id) {
                const voucher = await this.db.get(`
                    SELECT v.*, vc.min_score, vc.min_play_time
                    FROM vouchers v
                    LEFT JOIN voucher_conditions vc ON v.id = vc.voucher_id
                    WHERE v.id = ? AND v.is_active = 1
                `, [binding.voucher_id]);

                if (voucher) {
                    responseData.voucher = {
                        id: voucher.id,
                        name: voucher.voucher_name,
                        value: voucher.voucher_value,
                        current_stock: voucher.remaining_quantity,
                        conditions: {
                            min_score: voucher.min_score,
                            min_play_time: voucher.min_play_time
                        }
                    };
                }
            }
        } else if (boothId || projectId) {
            responseData.is_bound = false;
        }

        return responseData;
    }

    // ==================== 統計查詢 ====================

    /**
     * 查詢遊戲統計
     * @param {number} gameId - 遊戲 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async getGameStats(gameId, projectId) {
        // 驗證遊戲存在
        await this.getGameById(gameId);

        // 驗證專案存在
        const project = await this.projectRepo.findById(projectId);
        if (!project) {
            this.throwError(this.ErrorCodes.PROJECT_NOT_FOUND);
        }

        const stats = await this.gameRepo.getGameStats(gameId, projectId);

        return {
            game: await this.gameRepo.findById(gameId),
            project,
            stats
        };
    }

    // ==================== Admin 統計 API ====================

    /**
     * 獲取遊戲統計資料（Admin API）
     * @param {number} gameId - 遊戲 ID
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getAdminGameStats(gameId, { project_id, date, type = 'summary' }) {
        if (!project_id) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '缺少 project_id 參數'
            });
        }

        // 基礎查詢條件
        let whereClause = 'WHERE gs.game_id = ? AND gs.project_id = ?';
        let params = [gameId, project_id];

        if (date) {
            whereClause += ' AND DATE(gs.session_start) = ?';
            params.push(date);
        }

        let statsData = {};

        switch (type) {
            case 'summary':
                statsData = await this._getSummaryStats(whereClause, params);
                break;

            case 'hourly':
                statsData = await this._getHourlyStats(whereClause, params);
                break;

            case 'fastest':
                statsData = await this._getFastestPlayers(whereClause, params);
                break;

            case 'top_scores':
                statsData = await this._getTopScores(whereClause, params);
                break;

            default:
                this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                    message: '無效的統計類型'
                });
        }

        this.log('getAdminGameStats', { gameId, project_id, type, date });

        return statsData;
    }

    /**
     * 獲取總覽統計
     * @private
     */
    async _getSummaryStats(whereClause, params) {
        const summary = await this.db.get(`
            SELECT
                COUNT(DISTINCT gs.trace_id) as total_players,
                COUNT(gs.id) as total_sessions,
                AVG(gs.final_score) as avg_score,
                MAX(gs.final_score) as max_score,
                MIN(gs.final_score) as min_score,
                AVG(gs.total_play_time) as avg_play_time,
                MIN(gs.total_play_time) as min_play_time,
                MAX(gs.total_play_time) as max_play_time
            FROM game_sessions gs
            ${whereClause}
              AND gs.session_end IS NOT NULL
        `, params);

        return {
            total_players: summary.total_players || 0,
            total_sessions: summary.total_sessions || 0,
            avg_score: Math.round((summary.avg_score || 0) * 10) / 10,
            max_score: summary.max_score || 0,
            min_score: summary.min_score || 0,
            avg_play_time: Math.round((summary.avg_play_time || 0) * 10) / 10,
            min_play_time: summary.min_play_time || 0,
            max_play_time: summary.max_play_time || 0
        };
    }

    /**
     * 獲取每小時統計
     * @private
     */
    async _getHourlyStats(whereClause, params) {
        const hourlyStats = await this.db.query(`
            SELECT
                strftime('%Y-%m-%d %H:00', gs.session_start) as hour,
                COUNT(DISTINCT gs.trace_id) as player_count,
                COUNT(gs.id) as session_count,
                AVG(gs.final_score) as avg_score
            FROM game_sessions gs
            ${whereClause}
              AND gs.session_end IS NOT NULL
            GROUP BY hour
            ORDER BY hour DESC
            LIMIT 24
        `, params);

        return {
            hourly_stats: hourlyStats.map(row => ({
                hour: row.hour,
                player_count: row.player_count,
                session_count: row.session_count,
                avg_score: Math.round((row.avg_score || 0) * 10) / 10
            }))
        };
    }

    /**
     * 獲取最快完成玩家
     * @private
     */
    async _getFastestPlayers(whereClause, params) {
        const fastest = await this.db.query(`
            SELECT
                gs.trace_id,
                gs.final_score,
                gs.total_play_time,
                gs.session_start,
                fs.submitter_name,
                fs.submitter_email
            FROM game_sessions gs
            LEFT JOIN form_submissions fs ON gs.trace_id = fs.trace_id
            ${whereClause}
              AND gs.session_end IS NOT NULL
              AND gs.total_play_time > 0
            ORDER BY gs.total_play_time ASC
            LIMIT 10
        `, params);

        return {
            fastest_players: fastest.map(row => ({
                trace_id: row.trace_id,
                name: row.submitter_name || '匿名玩家',
                email: row.submitter_email,
                score: row.final_score,
                play_time: row.total_play_time,
                session_start: row.session_start
            }))
        };
    }

    /**
     * 獲取最高分玩家
     * @private
     */
    async _getTopScores(whereClause, params) {
        const topScores = await this.db.query(`
            SELECT
                gs.trace_id,
                gs.final_score,
                gs.total_play_time,
                gs.session_start,
                fs.submitter_name,
                fs.submitter_email
            FROM game_sessions gs
            LEFT JOIN form_submissions fs ON gs.trace_id = fs.trace_id
            ${whereClause}
              AND gs.session_end IS NOT NULL
            ORDER BY gs.final_score DESC
            LIMIT 10
        `, params);

        return {
            top_scores: topScores.map(row => ({
                trace_id: row.trace_id,
                name: row.submitter_name || '匿名玩家',
                email: row.submitter_email,
                score: row.final_score,
                play_time: row.total_play_time,
                session_start: row.session_start
            }))
        };
    }

    // ==================== 遊戲分析 API ====================

    /**
     * 獲取當天活動用戶列表
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getDailyUsers({ date, project_id } = {}) {
        const targetDate = date || new Date().toISOString().split('T')[0];

        let query = `
            SELECT
                fs.trace_id,
                fs.user_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.company_name,
                fs.submitter_phone,
                fs.project_id,
                p.project_name,
                fs.created_at as registration_time,
                cr.checkin_time,
                COUNT(DISTINCT gs.id) as game_sessions,
                MAX(gs.final_score) as highest_score,
                COUNT(DISTINCT vr.id) as vouchers_redeemed
            FROM form_submissions fs
            LEFT JOIN event_projects p ON fs.project_id = p.id
            LEFT JOIN checkin_records cr ON fs.trace_id = cr.trace_id
            LEFT JOIN game_sessions gs ON fs.trace_id = gs.trace_id
            LEFT JOIN voucher_redemptions vr ON fs.trace_id = vr.trace_id
            WHERE (
                DATE(fs.created_at) = ? OR
                DATE(cr.checkin_time) = ? OR
                DATE(gs.session_start) = ?
            )
        `;

        const params = [targetDate, targetDate, targetDate];

        if (project_id) {
            query += ' AND fs.project_id = ?';
            params.push(project_id);
        }

        query += ' GROUP BY fs.trace_id ORDER BY fs.created_at DESC';

        const users = await this.db.query(query, params);

        this.log('getDailyUsers', { date: targetDate, project_id, count: users.length });

        return {
            users,
            date: targetDate
        };
    }

    /**
     * 獲取用戶完整軌跡
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object>}
     */
    async getUserJourney(traceId) {
        // 1. 用戶基本資訊
        const userInfo = await this.db.get(`
            SELECT
                fs.trace_id,
                fs.user_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.company_name,
                fs.submitter_phone,
                fs.position,
                fs.project_id,
                p.project_name,
                fs.created_at as registration_time,
                cr.checkin_time
            FROM form_submissions fs
            LEFT JOIN event_projects p ON fs.project_id = p.id
            LEFT JOIN checkin_records cr ON fs.trace_id = cr.trace_id
            WHERE fs.trace_id = ?
        `, [traceId]);

        if (!userInfo) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '找不到用戶資料' });
        }

        // 2. 遊戲會話記錄
        const gameSessions = await this.db.query(`
            SELECT
                gs.id,
                gs.game_id,
                g.game_name_zh,
                g.game_name_en,
                gs.booth_id,
                b.booth_name,
                b.booth_code,
                gs.session_start,
                gs.session_end,
                gs.total_play_time,
                gs.final_score,
                gs.voucher_earned,
                v.voucher_name
            FROM game_sessions gs
            LEFT JOIN games g ON gs.game_id = g.id
            LEFT JOIN booths b ON gs.booth_id = b.id
            LEFT JOIN vouchers v ON gs.voucher_id = v.id
            WHERE gs.trace_id = ?
            ORDER BY gs.session_start ASC
        `, [traceId]);

        // 3. 兌換記錄
        const redemptions = await this.db.query(`
            SELECT
                vr.id,
                vr.voucher_id,
                v.voucher_name,
                v.vendor_name,
                v.voucher_value,
                vr.booth_id,
                b.booth_name,
                vr.redemption_code,
                vr.redeemed_at,
                vr.is_used,
                vr.used_at
            FROM voucher_redemptions vr
            LEFT JOIN vouchers v ON vr.voucher_id = v.id
            LEFT JOIN booths b ON vr.booth_id = b.id
            WHERE vr.trace_id = ?
            ORDER BY vr.redeemed_at ASC
        `, [traceId]);

        // 4. 參與者互動記錄
        const interactions = await this.db.query(`
            SELECT
                interaction_type,
                interaction_data,
                timestamp
            FROM participant_interactions
            WHERE trace_id = ?
            ORDER BY timestamp ASC
        `, [traceId]);

        // 5. 遊戲日誌（最近 20 筆）
        const gameLogs = await this.db.query(`
            SELECT
                gl.id,
                gl.game_id,
                g.game_name_zh,
                gl.booth_id,
                b.booth_name,
                gl.log_level,
                gl.message,
                gl.user_action,
                gl.score,
                gl.play_time,
                gl.created_at
            FROM game_logs gl
            LEFT JOIN games g ON gl.game_id = g.id
            LEFT JOIN booths b ON gl.booth_id = b.id
            WHERE gl.trace_id = ?
            ORDER BY gl.created_at DESC
            LIMIT 20
        `, [traceId]);

        this.log('getUserJourney', { traceId, sessions: gameSessions.length });

        return {
            user_info: userInfo,
            game_sessions: gameSessions,
            redemptions: redemptions,
            interactions: interactions,
            game_logs: gameLogs
        };
    }

    /**
     * 獲取高分排行榜
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getLeaderboard({ date, project_id, game_id, limit = 10 } = {}) {
        const targetDate = date || new Date().toISOString().split('T')[0];

        let query = `
            SELECT
                gs.trace_id,
                fs.user_id,
                fs.submitter_name,
                fs.company_name,
                gs.game_id,
                g.game_name_zh,
                gs.booth_id,
                b.booth_name,
                MAX(gs.final_score) as highest_score,
                gs.total_play_time,
                gs.session_start
            FROM game_sessions gs
            LEFT JOIN form_submissions fs ON gs.trace_id = fs.trace_id
            LEFT JOIN games g ON gs.game_id = g.id
            LEFT JOIN booths b ON gs.booth_id = b.id
            WHERE DATE(gs.session_start) = ?
        `;

        const params = [targetDate];

        if (project_id) {
            query += ' AND gs.project_id = ?';
            params.push(project_id);
        }

        if (game_id) {
            query += ' AND gs.game_id = ?';
            params.push(game_id);
        }

        query += `
            GROUP BY gs.trace_id, gs.game_id
            ORDER BY highest_score DESC
            LIMIT ?
        `;
        params.push(parseInt(limit));

        const leaderboard = await this.db.query(query, params);

        this.log('getLeaderboard', { date: targetDate, project_id, game_id, count: leaderboard.length });

        return {
            leaderboard,
            date: targetDate
        };
    }
}

module.exports = new GameService();
