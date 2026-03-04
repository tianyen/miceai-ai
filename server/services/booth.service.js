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
const { parseDbDate, TAIPEI_TIMEZONE } = require('../utils/timezone');

const RETENTION_THRESHOLDS = [
    { label: '5 分鐘', seconds: 5 * 60 },
    { label: '15 分鐘', seconds: 15 * 60 },
    { label: '30 分鐘', seconds: 30 * 60 },
    { label: '1 天', seconds: 24 * 60 * 60 },
    { label: '1 星期', seconds: 7 * 24 * 60 * 60 }
];
const RETRY_STATUSES = new Set(['failed', 'abandoned', 'timeout']);
const MS_PER_SECOND = 1000;

function safeParseSchema(rawSchema) {
    if (!rawSchema) return null;
    try {
        return JSON.parse(rawSchema);
    } catch (error) {
        return null;
    }
}

function diffSeconds(startValue, endValue) {
    const start = parseDbDate(startValue);
    const end = parseDbDate(endValue);
    if (!start || !end) return 0;
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / MS_PER_SECOND));
}

function average(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, ratio) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
    return sorted[index];
}

function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
}

function formatHourGMT8(value) {
    const date = parseDbDate(value);
    if (!date) return null;
    const formatter = new Intl.DateTimeFormat('zh-TW', {
        timeZone: TAIPEI_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false
    });
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:00`;
}

function payloadHasOriginalEventType(event, eventType) {
    if (!event?.payload_json) return false;
    try {
        const payload = JSON.parse(event.payload_json);
        return payload?.original_event_type === eventType;
    } catch (error) {
        return false;
    }
}

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
        const existing = await this.repository.findByCode(booth_code, project_id);
        if (existing) {
            this.throwError(this.ErrorCodes.DUPLICATE_ENTRY, '該專案內攤位代碼已存在');
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
            const existing = await this.repository.findByCodeExcluding(booth_code, boothId, booth.project_id);
            if (existing) {
                this.throwError(this.ErrorCodes.DUPLICATE_ENTRY, '該專案內攤位代碼已存在');
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
        const analytics = await this._buildFlowAnalytics(boothId, date);

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
            hourly_stats: hourlyStats,
            analytics
        };
    }

    async _buildFlowAnalytics(boothId, date = null) {
        const [games, filteredSessions, allSessions, filteredEvents] = await Promise.all([
            this.repository.findFlowGamesByBooth(boothId),
            this.repository.getFlowSessions(boothId, date),
            this.repository.getFlowSessions(boothId, null),
            this.repository.getFlowEvents(boothId, date)
        ]);

        const flowGames = games
            .map((game) => ({
                ...game,
                flow_schema: safeParseSchema(game.schema_json)
            }))
            .filter((game) => game.flow_schema && Array.isArray(game.flow_schema.stages));

        const sessionsByGame = new Map();
        const eventsByGame = new Map();

        filteredSessions.forEach((session) => {
            const collection = sessionsByGame.get(session.game_id) || [];
            collection.push(session);
            sessionsByGame.set(session.game_id, collection);
        });

        filteredEvents.forEach((event) => {
            const collection = eventsByGame.get(event.game_id) || [];
            collection.push(event);
            eventsByGame.set(event.game_id, collection);
        });

        const funnelByGame = flowGames.map((game) => this._buildGameFunnel(game, sessionsByGame.get(game.game_id) || [], eventsByGame.get(game.game_id) || []));
        const dwellByGame = flowGames.map((game) => this._buildStageDwellAnalytics(game, sessionsByGame.get(game.game_id) || [], eventsByGame.get(game.game_id) || []));
        const conversionByGame = flowGames.map((game) => this._buildConversionAnalytics(game, sessionsByGame.get(game.game_id) || [], eventsByGame.get(game.game_id) || []));

        return {
            flow_games: flowGames.map((game) => ({
                game_id: game.game_id,
                game_code: game.game_code,
                game_name_zh: game.game_name_zh,
                schema_name: game.schema_name || null,
                schema_version: game.schema_version || null
            })),
            hourly_quality: this._buildHourlyQuality(filteredSessions),
            replay_retry: this._buildReplayRetryAnalytics(filteredSessions),
            retention: this._buildRetentionAnalytics(filteredSessions, allSessions),
            funnels: funnelByGame,
            stage_dwell: dwellByGame,
            conversions: conversionByGame
        };
    }

    _buildGameFunnel(game, sessions, events) {
        const flowSchema = game.flow_schema || {};
        const stageDefinitions = Array.isArray(flowSchema.stages) ? flowSchema.stages : [];
        const sessionIdsByStage = new Map();

        events.forEach((event) => {
            if (!sessionIdsByStage.has(event.stage_id)) {
                sessionIdsByStage.set(event.stage_id, new Set());
            }
            sessionIdsByStage.get(event.stage_id).add(event.flow_session_id);
        });

        const stages = stageDefinitions.map((stage, index) => {
            const reachedSessions = sessionIdsByStage.get(stage.id)?.size || 0;
            const previousReached = index === 0 ? sessions.length : (sessionIdsByStage.get(stageDefinitions[index - 1].id)?.size || 0);
            const dropOffCount = Math.max(previousReached - reachedSessions, 0);
            return {
                order: index + 1,
                stage_id: stage.id,
                page: stage.page || null,
                terminal: !!stage.terminal,
                reached_sessions: reachedSessions,
                reach_rate: sessions.length > 0 ? Math.round((reachedSessions / sessions.length) * 1000) / 10 : 0,
                drop_off_count: index === 0 ? 0 : dropOffCount,
                drop_off_rate_from_previous: index === 0 || previousReached === 0
                    ? 0
                    : Math.round((dropOffCount / previousReached) * 1000) / 10
            };
        });

        const largestDropStage = stages
            .slice(1)
            .reduce((current, stage) => {
                if (!current || stage.drop_off_count > current.drop_off_count) {
                    return stage;
                }
                return current;
            }, null);

        return {
            game_id: game.game_id,
            game_code: game.game_code,
            game_name_zh: game.game_name_zh,
            total_sessions: sessions.length,
            completed_sessions: sessions.filter((session) => session.status === 'completed').length,
            stages,
            largest_drop_stage: largestDropStage
                ? {
                    stage_id: largestDropStage.stage_id,
                    drop_off_count: largestDropStage.drop_off_count,
                    drop_off_rate_from_previous: largestDropStage.drop_off_rate_from_previous
                }
                : null
        };
    }

    _buildStageDwellAnalytics(game, sessions, events) {
        const flowSchema = game.flow_schema || {};
        const stageDefinitions = Array.isArray(flowSchema.stages) ? flowSchema.stages : [];
        const stageOrder = new Map(stageDefinitions.map((stage, index) => [stage.id, index]));
        const sessionEndMap = new Map(sessions.map((session) => [
            session.flow_session_id,
            session.ended_at || session.last_event_at || session.started_at
        ]));
        const firstStageTimestamps = new Map();

        events.forEach((event) => {
            if (!stageOrder.has(event.stage_id)) return;
            const sessionStageKey = `${event.flow_session_id}:${event.stage_id}`;
            if (!firstStageTimestamps.has(sessionStageKey)) {
                firstStageTimestamps.set(sessionStageKey, event.created_at);
            }
        });

        const stageDurations = new Map(stageDefinitions.map((stage) => [stage.id, []]));

        sessions.forEach((session) => {
            const reachedStages = stageDefinitions
                .map((stage) => ({
                    stage_id: stage.id,
                    entered_at: firstStageTimestamps.get(`${session.flow_session_id}:${stage.id}`) || null
                }))
                .filter((stage) => stage.entered_at);

            reachedStages.forEach((stage, index) => {
                const nextStage = reachedStages[index + 1] || null;
                const endAt = nextStage?.entered_at || sessionEndMap.get(session.flow_session_id) || null;
                const seconds = diffSeconds(stage.entered_at, endAt);
                if (seconds > 0) {
                    stageDurations.get(stage.stage_id).push(seconds);
                }
            });
        });

        return {
            game_id: game.game_id,
            game_code: game.game_code,
            game_name_zh: game.game_name_zh,
            stages: stageDefinitions.map((stage, index) => {
                const values = stageDurations.get(stage.id) || [];
                return {
                    order: index + 1,
                    stage_id: stage.id,
                    sample_count: values.length,
                    avg_seconds: Math.round(average(values) * 10) / 10,
                    median_seconds: Math.round(median(values) * 10) / 10,
                    p95_seconds: Math.round(percentile(values, 0.95) * 10) / 10
                };
            })
        };
    }

    _buildReplayRetryAnalytics(sessions) {
        const sessionsByTrace = new Map();
        sessions.forEach((session) => {
            const collection = sessionsByTrace.get(session.trace_id) || [];
            collection.push(session);
            sessionsByTrace.set(session.trace_id, collection);
        });

        let replayPlayers = 0;
        let retryAfterDropPlayers = 0;
        let repeatSessions = 0;

        sessionsByTrace.forEach((traceSessions) => {
            const ordered = [...traceSessions].sort((a, b) => parseDbDate(a.started_at) - parseDbDate(b.started_at));
            if (ordered.length > 1) {
                replayPlayers += 1;
                repeatSessions += ordered.length - 1;
            }

            const retriedAfterDrop = ordered.some((session, index) => {
                if (!RETRY_STATUSES.has(session.status)) return false;
                return ordered.slice(index + 1).length > 0;
            });

            if (retriedAfterDrop) {
                retryAfterDropPlayers += 1;
            }
        });

        const uniquePlayers = sessionsByTrace.size;
        const totalSessions = sessions.length;

        return {
            unique_players: uniquePlayers,
            total_sessions: totalSessions,
            replay_players: replayPlayers,
            replay_rate: uniquePlayers > 0 ? Math.round((replayPlayers / uniquePlayers) * 1000) / 10 : 0,
            retry_after_drop_players: retryAfterDropPlayers,
            retry_after_drop_rate: uniquePlayers > 0 ? Math.round((retryAfterDropPlayers / uniquePlayers) * 1000) / 10 : 0,
            average_sessions_per_player: uniquePlayers > 0 ? Math.round((totalSessions / uniquePlayers) * 100) / 100 : 0,
            repeat_sessions: repeatSessions
        };
    }

    _buildRetentionAnalytics(filteredSessions, allSessions) {
        const cohortFirstSeen = new Map();
        filteredSessions.forEach((session) => {
            const current = cohortFirstSeen.get(session.trace_id);
            if (!current || parseDbDate(session.started_at) < parseDbDate(current)) {
                cohortFirstSeen.set(session.trace_id, session.started_at);
            }
        });

        const latestSeenByTrace = new Map();
        allSessions.forEach((session) => {
            if (!cohortFirstSeen.has(session.trace_id)) return;
            const endedAt = session.ended_at || session.last_event_at || session.started_at;
            const current = latestSeenByTrace.get(session.trace_id);
            if (!current || parseDbDate(endedAt) > parseDbDate(current)) {
                latestSeenByTrace.set(session.trace_id, endedAt);
            }
        });

        const cohortSize = cohortFirstSeen.size;

        return {
            cohort_size: cohortSize,
            buckets: RETENTION_THRESHOLDS.map((threshold) => {
                const retainedUsers = [...cohortFirstSeen.entries()].filter(([traceId, firstSeen]) => {
                    const latestSeen = latestSeenByTrace.get(traceId);
                    return diffSeconds(firstSeen, latestSeen) >= threshold.seconds;
                }).length;

                return {
                    label: threshold.label,
                    retained_users: retainedUsers,
                    retention_rate: cohortSize > 0 ? Math.round((retainedUsers / cohortSize) * 1000) / 10 : 0
                };
            })
        };
    }

    _buildHourlyQuality(sessions) {
        const hourlyMap = new Map();

        sessions.forEach((session) => {
            const hour = formatHourGMT8(session.started_at);
            if (!hour) return;

            if (!hourlyMap.has(hour)) {
                hourlyMap.set(hour, {
                    hour,
                    traces: new Set(),
                    total_sessions: 0,
                    total_play_time: 0,
                    completed_sessions: 0
                });
            }

            const bucket = hourlyMap.get(hour);
            bucket.traces.add(session.trace_id);
            bucket.total_sessions += 1;
            bucket.total_play_time += diffSeconds(session.started_at, session.ended_at || session.last_event_at || session.started_at);
            if (session.status === 'completed') {
                bucket.completed_sessions += 1;
            }
        });

        return [...hourlyMap.values()]
            .sort((a, b) => a.hour.localeCompare(b.hour))
            .map((bucket) => ({
                hour: bucket.hour,
                unique_players: bucket.traces.size,
                total_sessions: bucket.total_sessions,
                avg_play_time: bucket.total_sessions > 0 ? Math.round((bucket.total_play_time / bucket.total_sessions) * 10) / 10 : 0,
                completed_sessions: bucket.completed_sessions,
                completion_rate: bucket.total_sessions > 0 ? Math.round((bucket.completed_sessions / bucket.total_sessions) * 1000) / 10 : 0
            }));
    }

    _buildConversionAnalytics(game, sessions, events) {
        const flowSchema = game.flow_schema || {};
        const terminalStageIds = new Set(
            (flowSchema.stages || [])
                .filter((stage) => stage.terminal)
                .map((stage) => stage.id)
        );

        const uploadSuccessSessions = new Set();
        const thankYouSessions = new Set();

        events.forEach((event) => {
            const isUploadSuccess = event.event_type === 'upload_success' || payloadHasOriginalEventType(event, 'upload_success');
            const isCompleteView = event.event_type === 'complete_view' || terminalStageIds.has(event.stage_id);

            if (isUploadSuccess) {
                uploadSuccessSessions.add(event.flow_session_id);
            }
            if (isCompleteView) {
                thankYouSessions.add(event.flow_session_id);
            }
        });

        const totalSessions = sessions.length;
        const completedSessions = sessions.filter((session) => session.status === 'completed').length;

        return {
            game_id: game.game_id,
            game_code: game.game_code,
            game_name_zh: game.game_name_zh,
            total_sessions: totalSessions,
            completed_sessions: completedSessions,
            upload_success_sessions: uploadSuccessSessions.size,
            thank_you_sessions: thankYouSessions.size,
            completion_rate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 1000) / 10 : 0,
            upload_success_rate: totalSessions > 0 ? Math.round((uploadSuccessSessions.size / totalSessions) * 1000) / 10 : 0,
            thank_you_rate: totalSessions > 0 ? Math.round((thankYouSessions.size / totalSessions) * 1000) / 10 : 0
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
        const games = await this.repository.findBoothGames(boothId);

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
        const booth = await this.repository.findById(boothId);
        if (!booth) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '找不到攤位' });
        }

        // 檢查遊戲是否存在
        const game = await this.repository.findGameById(game_id);
        if (!game) {
            this.throwError(this.ErrorCodes.GAME_NOT_FOUND);
        }

        // 檢查是否已綁定
        const existing = await this.repository.findBindingByBoothAndGame(boothId, game_id);
        if (existing) {
            this.throwError(this.ErrorCodes.DUPLICATE_ENTRY, { message: '此遊戲已綁定到該攤位' });
        }

        // 如果有兌換券，檢查兌換券是否存在
        if (voucher_id) {
            const voucher = await this.repository.findVoucherById(voucher_id);
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
        const result = await this.repository.createGameBinding(boothId, game_id, voucher_id, qrCodeBase64);

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
        const binding = await this.repository.findBindingById(bindingId, boothId);
        if (!binding) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '找不到遊戲綁定' });
        }

        // 更新綁定
        await this.repository.updateBinding(bindingId, { voucher_id, is_active });

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
        const binding = await this.repository.findBindingById(bindingId, boothId);
        if (!binding) {
            this.throwError(this.ErrorCodes.NOT_FOUND, { message: '找不到遊戲綁定' });
        }

        // 刪除綁定
        await this.repository.deleteBinding(bindingId, boothId);

        this.log('unbindGame', { boothId, bindingId });

        return { deleted: true };
    }
}

// Singleton pattern
module.exports = new BoothService();
