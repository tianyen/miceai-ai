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
        const result = await this.gameRepo.findGamesWithFilter({ page, limit, search, is_active });

        this.log('getList', { page, limit, search, is_active, total: result.pagination.total_items, count: result.games.length });

        return result;
    }

    /**
     * 根據 ID 獲取遊戲（Admin API）
     * @param {number} gameId - 遊戲 ID
     * @returns {Promise<Object>}
     */
    async getById(gameId) {
        const game = await this.gameRepo.findById(gameId);

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

        const result = await this.gameRepo.createGame({
            game_name_zh,
            game_name_en,
            game_url,
            game_version,
            description,
            is_active
        });

        const game = await this.gameRepo.findById(result.lastID);

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
        const game = await this.gameRepo.findById(gameId);

        if (!game) {
            this.throwError(this.ErrorCodes.GAME_NOT_FOUND);
        }

        await this.gameRepo.updateGame(gameId, data);

        const updatedGame = await this.gameRepo.findById(gameId);

        this.log('update', { game_id: gameId, updates: Object.keys(data) });

        return { game: updatedGame };
    }

    /**
     * 刪除遊戲（軟刪除）
     * @param {number} gameId - 遊戲 ID
     * @returns {Promise<Object>}
     */
    async delete(gameId) {
        const game = await this.gameRepo.findById(gameId);

        if (!game) {
            this.throwError(this.ErrorCodes.GAME_NOT_FOUND);
        }

        await this.gameRepo.softDeleteGame(gameId);

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
        const result = await this.gameRepo.findSessionsWithFilter(gameId, { page, limit, trace_id });

        this.log('getSessions', { game_id: gameId, page, limit, trace_id, total: result.pagination.total_items, count: result.sessions.length });

        return result;
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
        const voucher = await this.gameRepo.findActiveVoucher(voucherId);

        if (!voucher) {
            return { earned: false, reason: '兌換券不存在或未啟用' };
        }

        // 查詢兌換條件
        const conditions = await this.gameRepo.findVoucherConditions(voucherId);

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
                const voucher = await this.gameRepo.findBoothVoucherWithConditions(binding.booth_id, gameId);

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
        return this.gameRepo.getSummaryStats(whereClause, params);
    }

    /**
     * 獲取每小時統計
     * @private
     */
    async _getHourlyStats(whereClause, params) {
        return this.gameRepo.getHourlyStats(whereClause, params);
    }

    /**
     * 獲取最快完成玩家
     * @private
     */
    async _getFastestPlayers(whereClause, params) {
        return this.gameRepo.getFastestPlayers(whereClause, params);
    }

    /**
     * 獲取最高分玩家
     * @private
     */
    async _getTopScores(whereClause, params) {
        return this.gameRepo.getTopScores(whereClause, params);
    }

    // ==================== 遊戲分析 API ====================

    /**
     * 獲取當天活動用戶列表
     * @param {Object} options - 查詢選項
     * @returns {Promise<Object>}
     */
    async getDailyUsers({ date, project_id } = {}) {
        const targetDate = date || new Date().toISOString().split('T')[0];

        const result = await this.gameRepo.getDailyUsers(targetDate, project_id);

        this.log('getDailyUsers', { date: targetDate, project_id, count: result.users.length });

        return result;
    }

    /**
     * 獲取用戶完整軌跡
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object>}
     */
    async getUserJourney(traceId) {
        // 並行查詢用戶資訊和遊戲會話
        const [userInfo, gameSessions, redemptions, interactions, gameLogs] = await Promise.all([
            this.gameRepo.findUserInfoByTraceId(traceId),
            this.gameRepo.findUserGameSessions(traceId),
            this.voucherRepo.findRedemptions({ traceId }),
            this.gameRepo.findUserInteractions(traceId),
            this.gameRepo.findUserGameLogs(traceId)
        ]);

        if (!userInfo) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '找不到用戶資料' });
        }

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

        const result = await this.gameRepo.getLeaderboard(targetDate, project_id, game_id, limit);

        this.log('getLeaderboard', { date: targetDate, project_id, game_id, count: result.leaderboard.length });

        return result;
    }
}

module.exports = new GameService();
