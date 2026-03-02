/**
 * Game Flow Service - tolerant telemetry ingestion for mobile HTML games
 */
const BaseService = require('./base.service');
const gameFlowRepository = require('../repositories/game-flow.repository');
const { validateTraceId } = require('../utils/traceId');

const SESSION_END_STATUSES = new Set(['completed', 'failed', 'timeout', 'abandoned']);
const DEFAULT_ALLOWED_EVENT_TYPES = new Set([
    'page_view',
    'session_start',
    'session_end',
    'stage_enter',
    'stage_submit',
    'select_case',
    'pray_attempt',
    'pray_result',
    'reveal_start',
    'camera_switch',
    'template_browse',
    'throw_start',
    'throw_success',
    'upload_attempt',
    'upload_success',
    'upload_fail',
    'complete_view'
]);
const FRONTEND_EVENT_TYPE_ALIASES = Object.freeze({
    stage_view: { eventType: 'stage_enter' },
    intro_open: { eventType: 'page_view' },
    flow_start: { eventType: 'session_start' },
    money_ready: { eventType: 'page_view' },
    money_continue: { eventType: 'stage_submit' },
    case_select: { eventType: 'select_case' },
    pray_success_continue: { eventType: 'stage_submit' },
    flow_retry: { eventType: 'session_end', sessionStatus: 'failed' },
    lucky_start: { eventType: 'reveal_start' },
    lucky_next: { eventType: 'stage_submit' },
    color_select: { eventType: 'stage_submit' },
    submit: { eventType: 'stage_submit' },
    complete_restart: { eventType: 'complete_view' },
    template_select: { eventType: 'stage_submit' },
    capture_confirm: { eventType: 'stage_submit' },
    capture_back: { eventType: 'page_view' },
    preview_next: { eventType: 'stage_submit' },
    throw_back: { eventType: 'page_view' },
    preview_restart: { eventType: 'session_end', sessionStatus: 'abandoned' }
});
const STAGE_ALIASES_BY_GAME = Object.freeze({
    'tiger-mobile': Object.freeze({
        intro: 'tiger_intro',
        complete: 'tiger_complete'
    }),
    'lantern-mobile': Object.freeze({
        intro: 'lantern_intro',
        complete: 'lantern_complete'
    })
});

class GameFlowService extends BaseService {
    constructor() {
        super('GameFlowService');
        this.gameFlowRepo = gameFlowRepository;
    }

    async trackEvent(eventData, clientContext = {}) {
        return this.withErrorHandling(async () => {
            const normalized = this._normalizeEvent(eventData);
            const existingSession = await this.gameFlowRepo.findFlowSessionByFlowSessionId(normalized.flowSessionId);
            const resolvedContext = await this._resolveTrackContext(normalized, existingSession);
            const compatibleEvent = this._applyFrontendCompatibility(normalized, resolvedContext);

            this._assertExistingSessionContext(existingSession, resolvedContext, compatibleEvent);
            this._validateSchemaPayload(resolvedContext.flowDefinition, compatibleEvent);

            const session = existingSession || await this._createImplicitSession(
                resolvedContext,
                compatibleEvent,
                clientContext
            );

            const duplicateEvent = await this.gameFlowRepo.findStageEventByClientEventId(compatibleEvent.clientEventId);
            if (!duplicateEvent) {
                await this.gameFlowRepo.createStageEvent({
                    clientEventId: compatibleEvent.clientEventId,
                    sessionId: session.id,
                    projectId: resolvedContext.project.id,
                    boothId: resolvedContext.booth.id,
                    gameId: resolvedContext.game.id,
                    traceId: compatibleEvent.traceId,
                    flowSessionId: compatibleEvent.flowSessionId,
                    stageId: compatibleEvent.stageId,
                    eventType: compatibleEvent.eventType,
                    durationMs: compatibleEvent.durationMs,
                    payloadJson: compatibleEvent.payloadJson
                });
            }

            const sessionPatch = this._buildSessionPatch(session, compatibleEvent, clientContext, resolvedContext);
            if (Object.keys(sessionPatch).length > 0) {
                await this.gameFlowRepo.updateFlowSession(session.id, sessionPatch);
            }

            const updatedSession = await this.gameFlowRepo.findFlowSessionByFlowSessionId(compatibleEvent.flowSessionId);

            this.log('trackEvent', {
                flow_session_id: compatibleEvent.flowSessionId,
                trace_id: compatibleEvent.traceId,
                event_type: compatibleEvent.eventType,
                stage_id: compatibleEvent.stageId,
                original_event_type: compatibleEvent.originalEventType || null,
                original_stage_id: compatibleEvent.originalStageId || null,
                duplicate: !!duplicateEvent
            });

            return {
                session: {
                    id: updatedSession.id,
                    flow_session_id: updatedSession.flow_session_id,
                    status: updatedSession.status,
                    trace_id: updatedSession.trace_id,
                    project_id: updatedSession.project_id,
                    booth_id: updatedSession.booth_id,
                    game_id: updatedSession.game_id
                },
                schema: this._buildSchemaResponse(resolvedContext.schema),
                duplicate_event: !!duplicateEvent
            };
        }, 'trackEvent');
    }

    async getStartContext(queryData = {}) {
        return this.withErrorHandling(async () => {
            const normalized = this._normalizeStartPayload(queryData);
            const resolvedContext = await this._resolveStartContext(normalized);

            return {
                project: {
                    id: resolvedContext.project.id,
                    code: resolvedContext.project.project_code,
                    name: resolvedContext.project.project_name
                },
                booth: {
                    id: resolvedContext.booth.id,
                    code: resolvedContext.booth.booth_code,
                    name: resolvedContext.booth.booth_name
                },
                game: {
                    id: resolvedContext.game.id,
                    code: resolvedContext.game.game_code,
                    name_zh: resolvedContext.game.game_name_zh,
                    name_en: resolvedContext.game.game_name_en,
                    url: resolvedContext.game.game_url
                },
                binding: {
                    id: resolvedContext.binding.id,
                    is_active: !!resolvedContext.binding.is_active
                },
                schema: resolvedContext.flowDefinition,
                telemetry: {
                    track_endpoint: '/api/v1/game-flows/track',
                    timeout_minutes: resolvedContext.flowDefinition.timeout_minutes || 15,
                    accepted_stage_aliases: this._getAcceptedStageAliases(resolvedContext.game.game_code),
                    accepted_event_aliases: this._getAcceptedEventAliases()
                }
            };
        }, 'getStartContext');
    }

    async getAnalyticsStats(filterData = {}) {
        return this.withErrorHandling(async () => {
            const normalized = this._normalizeAnalyticsFilters(filterData);
            const resolvedContext = await this._resolveAnalyticsContext(normalized);
            const [summary, breakdown] = await Promise.all([
                this.gameFlowRepo.getAnalyticsSummary({
                    projectId: resolvedContext.project.id,
                    gameId: resolvedContext.game?.id || null,
                    boothId: resolvedContext.booth?.id || null,
                    startedAtFrom: normalized.startedAtFrom,
                    startedAtTo: normalized.startedAtTo
                }),
                this.gameFlowRepo.getAnalyticsBreakdown({
                    projectId: resolvedContext.project.id,
                    gameId: resolvedContext.game?.id || null,
                    boothId: resolvedContext.booth?.id || null,
                    startedAtFrom: normalized.startedAtFrom,
                    startedAtTo: normalized.startedAtTo
                })
            ]);

            return {
                window: normalized.window,
                date_range: {
                    from: normalized.dateFrom,
                    to: normalized.dateTo
                },
                filters: {
                    project_id: resolvedContext.project.id,
                    project_code: resolvedContext.project.project_code,
                    game_id: resolvedContext.game?.id || null,
                    game_code: resolvedContext.game?.game_code || null,
                    booth_id: resolvedContext.booth?.id || null,
                    booth_code: resolvedContext.booth?.booth_code || null
                },
                summary: {
                    unique_players: summary?.unique_players || 0,
                    started_sessions: summary?.started_sessions || 0,
                    active_sessions: summary?.active_sessions || 0,
                    completed_sessions: summary?.completed_sessions || 0,
                    failed_sessions: summary?.failed_sessions || 0,
                    timeout_sessions: summary?.timeout_sessions || 0,
                    abandoned_sessions: summary?.abandoned_sessions || 0
                },
                breakdown: breakdown.map((item) => ({
                    game_id: item.game_id,
                    game_code: item.game_code,
                    game_name_zh: item.game_name_zh,
                    booth_id: item.booth_id,
                    booth_code: item.booth_code,
                    booth_name: item.booth_name,
                    unique_players: item.unique_players || 0,
                    started_sessions: item.started_sessions || 0,
                    completed_sessions: item.completed_sessions || 0,
                    failed_sessions: item.failed_sessions || 0,
                    timeout_sessions: item.timeout_sessions || 0,
                    abandoned_sessions: item.abandoned_sessions || 0
                }))
            };
        }, 'getAnalyticsStats');
    }

    async getStageFunnel(filterData = {}) {
        return this.withErrorHandling(async () => {
            const normalized = this._normalizeAnalyticsFilters(filterData, { requireGame: true });
            const resolvedContext = await this._resolveAnalyticsContext(normalized, { requireSchema: true });
            const stageCounts = await this.gameFlowRepo.getStageCounts({
                projectId: resolvedContext.project.id,
                gameId: resolvedContext.game.id,
                boothId: resolvedContext.booth?.id || null,
                startedAtFrom: normalized.startedAtFrom,
                startedAtTo: normalized.startedAtTo
            });

            const countMap = new Map(stageCounts.map((item) => [item.stage_id, item]));
            const stages = (resolvedContext.flowDefinition.stages || []).map((stage, index) => {
                const counts = countMap.get(stage.id);
                return {
                    order: index + 1,
                    stage_id: stage.id,
                    page: stage.page || null,
                    terminal: !!stage.terminal,
                    reached_sessions: counts?.reached_sessions || 0,
                    submitted_sessions: counts?.submitted_sessions || 0,
                    event_count: counts?.event_count || 0
                };
            });

            return {
                window: normalized.window,
                date_range: {
                    from: normalized.dateFrom,
                    to: normalized.dateTo
                },
                filters: {
                    project_id: resolvedContext.project.id,
                    project_code: resolvedContext.project.project_code,
                    game_id: resolvedContext.game.id,
                    game_code: resolvedContext.game.game_code,
                    booth_id: resolvedContext.booth?.id || null,
                    booth_code: resolvedContext.booth?.booth_code || null
                },
                schema: {
                    name: resolvedContext.schema.schema_name,
                    version: resolvedContext.schema.schema_version
                },
                stages
            };
        }, 'getStageFunnel');
    }

    _normalizeEvent(eventData = {}) {
        const traceId = typeof eventData.trace_id === 'string' ? eventData.trace_id.trim() : '';
        const flowSessionId = typeof eventData.flow_session_id === 'string' ? eventData.flow_session_id.trim() : '';
        const stageId = typeof eventData.stage_id === 'string' ? eventData.stage_id.trim() : '';
        const eventType = typeof eventData.event_type === 'string' ? eventData.event_type.trim().toLowerCase() : '';

        if (!traceId || !validateTraceId(traceId)) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, { message: '缺少或無效的 trace_id' });
        }

        if (!flowSessionId) {
            this.throwError(this.ErrorCodes.MISSING_REQUIRED_FIELD, { message: '缺少 flow_session_id' });
        }

        if (!stageId) {
            this.throwError(this.ErrorCodes.MISSING_REQUIRED_FIELD, { message: '缺少 stage_id' });
        }

        if (!eventType) {
            this.throwError(this.ErrorCodes.MISSING_REQUIRED_FIELD, { message: '缺少 event_type' });
        }

        let payload = eventData.payload;
        if (payload === undefined || payload === null) {
            payload = {};
        }
        if (typeof payload !== 'object' || Array.isArray(payload)) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, { message: 'payload 必須為物件' });
        }

        let durationMs = null;
        if (eventData.duration_ms !== undefined && eventData.duration_ms !== null && eventData.duration_ms !== '') {
            durationMs = Number(eventData.duration_ms);
            if (!Number.isFinite(durationMs) || durationMs < 0) {
                this.throwError(this.ErrorCodes.VALIDATION_ERROR, { message: 'duration_ms 必須為非負數' });
            }
        }

        const sessionStatus = typeof eventData.session_status === 'string'
            ? eventData.session_status.trim().toLowerCase()
            : null;

        if (sessionStatus && !SESSION_END_STATUSES.has(sessionStatus) && sessionStatus !== 'active') {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, { message: 'session_status 無效' });
        }

        return {
            traceId,
            flowSessionId,
            stageId,
            eventType,
            durationMs,
            payloadJson: JSON.stringify(payload),
            payload,
            clientEventId: typeof eventData.client_event_id === 'string' ? eventData.client_event_id.trim() : null,
            sessionStatus,
            projectId: this._toPositiveInt(eventData.project_id),
            gameId: this._toPositiveInt(eventData.game_id),
            boothId: this._toPositiveInt(eventData.booth_id),
            projectCode: typeof eventData.project_code === 'string' ? eventData.project_code.trim() : null,
            gameCode: typeof eventData.game_code === 'string' ? eventData.game_code.trim() : null,
            boothCode: typeof eventData.booth_code === 'string' ? eventData.booth_code.trim() : null
        };
    }

    _normalizeStartPayload(queryData = {}) {
        let parsed = queryData?.data ?? queryData;

        if (typeof parsed === 'string') {
            try {
                parsed = JSON.parse(parsed);
            } catch (error) {
                this.throwError(this.ErrorCodes.VALIDATION_ERROR, { message: 'QR start data 格式無效' });
            }
        }

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, { message: '缺少有效的 QR start data' });
        }

        return {
            projectId: this._toPositiveInt(parsed.project_id),
            projectCode: typeof parsed.project_code === 'string' ? parsed.project_code.trim() : null,
            gameId: this._toPositiveInt(parsed.game_id),
            gameCode: typeof parsed.game_code === 'string' ? parsed.game_code.trim() : null,
            boothId: this._toPositiveInt(parsed.booth_id),
            boothCode: typeof parsed.booth_code === 'string' ? parsed.booth_code.trim() : null
        };
    }

    _normalizeAnalyticsFilters(filterData = {}, options = {}) {
        const { requireGame = false } = options;
        const window = typeof filterData.window === 'string'
            ? filterData.window.trim().toLowerCase()
            : 'today';

        const dateRange = this._resolveDateRange({
            window,
            dateFrom: typeof filterData.date_from === 'string' ? filterData.date_from.trim() : null,
            dateTo: typeof filterData.date_to === 'string' ? filterData.date_to.trim() : null
        });

        const normalized = {
            window: dateRange.window,
            dateFrom: dateRange.dateFrom,
            dateTo: dateRange.dateTo,
            startedAtFrom: dateRange.startedAtFrom,
            startedAtTo: dateRange.startedAtTo,
            projectId: this._toPositiveInt(filterData.project_id),
            gameId: this._toPositiveInt(filterData.game_id),
            boothId: this._toPositiveInt(filterData.booth_id),
            projectCode: typeof filterData.project_code === 'string' ? filterData.project_code.trim() : null,
            gameCode: typeof filterData.game_code === 'string' ? filterData.game_code.trim() : null,
            boothCode: typeof filterData.booth_code === 'string' ? filterData.booth_code.trim() : null
        };

        if (!normalized.projectId && !normalized.projectCode) {
            this.throwError(this.ErrorCodes.MISSING_REQUIRED_FIELD, { message: '缺少 project_id 或 project_code' });
        }

        if (requireGame && !normalized.gameId && !normalized.gameCode) {
            this.throwError(this.ErrorCodes.MISSING_REQUIRED_FIELD, { message: '缺少 game_id 或 game_code' });
        }

        return normalized;
    }

    async _resolveTrackContext(normalized, existingSession = null) {
        const context = await this._resolveContext(normalized, {
            existingSession,
            requireActiveProject: true,
            requireActiveGame: true,
            requireSchema: true,
            inferBooth: true
        });

        if (!context.booth || !context.booth.is_active) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, { message: '攤位不存在或未啟用' });
        }

        if (!context.binding || !context.binding.is_active) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, { message: 'project / booth / game 綁定不存在或未啟用' });
        }

        return context;
    }

    async _resolveStartContext(normalized) {
        return this._resolveContext(normalized, {
            requireActiveProject: true,
            requireActiveGame: true,
            requireSchema: true,
            inferBooth: true
        });
    }

    async _resolveAnalyticsContext(normalized, options = {}) {
        return this._resolveContext(normalized, {
            requireGame: !!options.requireSchema,
            requireActiveProject: false,
            requireActiveGame: false,
            requireSchema: !!options.requireSchema,
            inferBooth: !!normalized.gameId || !!normalized.gameCode
        });
    }

    async _resolveContext(normalized, options = {}) {
        const {
            existingSession = null,
            requireGame = true,
            requireActiveProject = true,
            requireActiveGame = true,
            requireSchema = false,
            inferBooth = false
        } = options;

        const project = await this.gameFlowRepo.findProjectContext({
            projectId: normalized.projectId || existingSession?.project_id || null,
            projectCode: normalized.projectCode || null
        });

        if (!project) {
            this.throwError(this.ErrorCodes.PROJECT_NOT_FOUND);
        }

        if (requireActiveProject && project.status !== 'active') {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, { message: '專案不存在或未啟用' });
        }

        const resolvedGameId = normalized.gameId || existingSession?.game_id || null;
        const resolvedGameCode = normalized.gameCode || null;
        let game = null;

        if (requireGame || resolvedGameId || resolvedGameCode) {
            game = await this.gameFlowRepo.findGameContext({
                gameId: resolvedGameId,
                gameCode: resolvedGameCode
            });

            if (!game) {
                this.throwError(this.ErrorCodes.GAME_NOT_FOUND);
            }

            if (requireActiveGame && !game.is_active) {
                this.throwError(this.ErrorCodes.VALIDATION_ERROR, { message: '遊戲不存在或未啟用' });
            }
        }

        const requestedBoothId = normalized.boothId || existingSession?.booth_id || null;
        const requestedBoothCode = normalized.boothCode || null;

        let booth = null;
        if (requestedBoothId || requestedBoothCode) {
            booth = await this.gameFlowRepo.findBoothContext({
                projectId: project.id,
                boothId: requestedBoothId,
                boothCode: requestedBoothCode
            });

            if (!booth) {
                this.throwError(this.ErrorCodes.BOOTH_NOT_FOUND);
            }
        } else if (inferBooth && game) {
            const bindings = await this.gameFlowRepo.findBindingsByProjectAndGame(project.id, game.id);
            const activeBindings = bindings.filter((item) => item.is_active && item.booth_is_active);

            if (activeBindings.length === 0) {
                this.throwError(this.ErrorCodes.VALIDATION_ERROR, { message: '找不到有效的 project / booth / game 綁定' });
            }

            if (activeBindings.length > 1) {
                this.throwError(this.ErrorCodes.VALIDATION_ERROR, { message: '同一 project/game 對應多個攤位，請明確提供 booth_id 或 booth_code' });
            }

            booth = {
                id: activeBindings[0].booth_id,
                project_id: activeBindings[0].project_id,
                booth_name: activeBindings[0].booth_name,
                booth_code: activeBindings[0].booth_code,
                is_active: activeBindings[0].booth_is_active
            };
        }

        let binding = null;
        if (booth) {
            binding = await this.gameFlowRepo.findBindingContext({
                projectId: project.id,
                boothId: booth.id,
                gameId: game.id
            });
        }

        if (booth && game && (!binding || !binding.is_active || !booth.is_active)) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, { message: 'project / booth / game 綁定不存在或未啟用' });
        }

        let schema = null;
        let flowDefinition = null;

        if (requireSchema) {
            if (!game) {
                this.throwError(this.ErrorCodes.MISSING_REQUIRED_FIELD, { message: '需要 game_id 或 game_code 才能解析 flow schema' });
            }
            schema = await this.gameFlowRepo.findFlowSchema(project.id, game.id);
            if (!schema) {
                this.throwError(this.ErrorCodes.VALIDATION_ERROR, { message: '找不到啟用中的 game flow schema' });
            }

            flowDefinition = this._parseFlowSchema(schema.schema_json);
        }

        return { project, game, booth, binding, schema, flowDefinition };
    }

    _assertExistingSessionContext(existingSession, resolvedContext, normalized) {
        if (!existingSession) return;

        if (existingSession.trace_id !== normalized.traceId) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: 'flow_session_id 與 trace_id 不一致'
            });
        }

        if (resolvedContext.project.id !== existingSession.project_id || resolvedContext.game.id !== existingSession.game_id) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: 'flow_session_id 與 project/game 不一致'
            });
        }

        if (resolvedContext.booth && existingSession.booth_id && resolvedContext.booth.id !== existingSession.booth_id) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: 'flow_session_id 與 booth 不一致'
            });
        }
    }

    async _createImplicitSession(resolvedContext, normalized, clientContext) {
        const initialStatus = this._inferInitialStatus(normalized, resolvedContext.flowDefinition);
        const createResult = await this.gameFlowRepo.createFlowSession({
            projectId: resolvedContext.project.id,
            boothId: resolvedContext.booth?.id || null,
            gameId: resolvedContext.game.id,
            traceId: normalized.traceId,
            flowSessionId: normalized.flowSessionId,
            status: initialStatus,
            entryStageId: normalized.stageId,
            exitStageId: normalized.stageId,
            completionStageId: initialStatus === 'completed' ? normalized.stageId : null,
            ipAddress: clientContext.ipAddress || null,
            userAgent: clientContext.userAgent || null,
            metadataJson: this._buildSessionMetadataJson(normalized, clientContext, resolvedContext)
        });

        return this.gameFlowRepo.findById(createResult.lastID);
    }

    _buildSessionPatch(session, normalized, clientContext, resolvedContext) {
        const patch = {};

        if (!session.booth_id && resolvedContext.booth?.id) {
            patch.boothId = resolvedContext.booth.id;
        }

        if (!session.entry_stage_id) {
            patch.entryStageId = normalized.stageId;
        }

        patch.exitStageId = normalized.stageId;

        if (!session.ip_address && clientContext.ipAddress) {
            patch.ipAddress = clientContext.ipAddress;
        }

        if (!session.user_agent && clientContext.userAgent) {
            patch.userAgent = clientContext.userAgent;
        }

        const nextStatus = this._inferStatus(normalized, session.status, resolvedContext.flowDefinition);
        if (nextStatus && nextStatus !== session.status) {
            patch.status = nextStatus;
        }

        if (nextStatus === 'completed') {
            patch.completionStageId = normalized.stageId;
        }

        if (this._isTerminalStatus(nextStatus)) {
            patch.markEnded = true;
        }

        return patch;
    }

    _validateSchemaPayload(flowDefinition, normalized) {
        const stages = Array.isArray(flowDefinition?.stages) ? flowDefinition.stages : [];
        const stageIds = new Set(stages.map((stage) => stage.id));
        if (!stageIds.has(normalized.stageId)) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: `stage_id 不存在於啟用中的 flow schema: ${normalized.stageId}`
            });
        }

        const allowedEventTypes = Array.isArray(flowDefinition?.allowed_event_types)
            ? new Set(flowDefinition.allowed_event_types)
            : DEFAULT_ALLOWED_EVENT_TYPES;

        if (!allowedEventTypes.has(normalized.eventType)) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: `event_type 不存在於允許清單: ${normalized.eventType}`
            });
        }
    }

    _applyFrontendCompatibility(normalized, resolvedContext) {
        const normalizedStageId = this._normalizeStageAlias(resolvedContext.game?.game_code, normalized.stageId);
        const eventCompatibility = this._normalizeEventAlias(normalized.eventType);
        const payload = { ...(normalized.payload || {}) };
        const stageChanged = normalizedStageId !== normalized.stageId;
        const eventChanged = eventCompatibility.eventType !== normalized.eventType;

        if (stageChanged) {
            payload.original_stage_id = normalized.stageId;
        }

        if (eventChanged) {
            payload.original_event_type = normalized.eventType;
        }

        return {
            ...normalized,
            stageId: normalizedStageId,
            eventType: eventCompatibility.eventType,
            sessionStatus: normalized.sessionStatus || eventCompatibility.sessionStatus || null,
            payload,
            payloadJson: JSON.stringify(payload),
            originalStageId: stageChanged ? normalized.stageId : null,
            originalEventType: eventChanged ? normalized.eventType : null
        };
    }

    _normalizeEventAlias(eventType) {
        return FRONTEND_EVENT_TYPE_ALIASES[eventType] || { eventType };
    }

    _normalizeStageAlias(gameCode, stageId) {
        const aliasMap = STAGE_ALIASES_BY_GAME[gameCode] || null;
        if (!aliasMap) {
            return stageId;
        }

        return aliasMap[stageId] || stageId;
    }

    _inferInitialStatus(normalized, flowDefinition = null) {
        if (this._isTerminalStatus(normalized.sessionStatus)) {
            return normalized.sessionStatus;
        }

        if (normalized.eventType === 'session_end') {
            return normalized.sessionStatus || 'completed';
        }

        if (this._shouldMarkCompleted(normalized, flowDefinition)) {
            return 'completed';
        }

        return 'active';
    }

    _inferStatus(normalized, currentStatus, flowDefinition = null) {
        if (this._isTerminalStatus(currentStatus)) {
            return currentStatus;
        }

        if (this._isTerminalStatus(normalized.sessionStatus)) {
            return normalized.sessionStatus;
        }

        if (normalized.eventType === 'session_end') {
            return normalized.sessionStatus || 'completed';
        }

        if (this._shouldMarkCompleted(normalized, flowDefinition)) {
            return 'completed';
        }

        if (normalized.eventType === 'session_start') {
            return 'active';
        }

        return currentStatus || 'active';
    }

    _isTerminalStatus(status) {
        return SESSION_END_STATUSES.has(status);
    }

    _buildSessionMetadataJson(normalized, clientContext, resolvedContext) {
        return JSON.stringify({
            source: 'game-flow-track',
            first_event_type: normalized.eventType,
            first_stage_id: normalized.stageId,
            project_code: resolvedContext.project.project_code,
            game_code: resolvedContext.game.game_code || normalized.gameCode || null,
            booth_code: resolvedContext.booth?.booth_code || normalized.boothCode || null,
            ip_address: clientContext.ipAddress || null
        });
    }

    _shouldMarkCompleted(normalized, flowDefinition = null) {
        const completionStage = flowDefinition?.completion_stage || null;

        if (normalized.sessionStatus === 'completed') {
            return true;
        }

        if (!completionStage || normalized.stageId !== completionStage) {
            return false;
        }

        if (normalized.eventType === 'throw_success') {
            return true;
        }

        if (normalized.eventType === 'stage_submit') {
            return true;
        }

        return false;
    }

    _getAcceptedStageAliases(gameCode) {
        return STAGE_ALIASES_BY_GAME[gameCode] || {};
    }

    _getAcceptedEventAliases() {
        return Object.entries(FRONTEND_EVENT_TYPE_ALIASES).reduce((result, [alias, config]) => {
            result[alias] = {
                event_type: config.eventType,
                session_status: config.sessionStatus || null
            };
            return result;
        }, {});
    }

    _buildSchemaResponse(schema) {
        if (!schema) return null;

        return {
            id: schema.id,
            name: schema.schema_name,
            version: schema.schema_version
        };
    }

    _parseFlowSchema(rawSchemaJson) {
        try {
            const parsed = JSON.parse(rawSchemaJson);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('schema root must be object');
            }
            return parsed;
        } catch (error) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: 'game flow schema JSON 無效'
            });
        }
    }

    _resolveDateRange({ window, dateFrom = null, dateTo = null }) {
        if (dateFrom || dateTo) {
            const from = dateFrom || dateTo;
            const to = dateTo || dateFrom;
            const startedAtFrom = `${from} 00:00:00`;
            const startedAtTo = this._formatDateTimeBoundary(this._addDays(to, 1));
            return {
                window: 'custom',
                dateFrom: from,
                dateTo: to,
                startedAtFrom,
                startedAtTo
            };
        }

        const today = this._formatDateOnly(new Date());

        if (window === 'yesterday') {
            const yesterday = this._addDays(today, -1);
            return {
                window,
                dateFrom: yesterday,
                dateTo: yesterday,
                startedAtFrom: `${yesterday} 00:00:00`,
                startedAtTo: `${today} 00:00:00`
            };
        }

        if (window === 'week') {
            const weekStart = this._addDays(today, -6);
            return {
                window,
                dateFrom: weekStart,
                dateTo: today,
                startedAtFrom: `${weekStart} 00:00:00`,
                startedAtTo: this._formatDateTimeBoundary(this._addDays(today, 1))
            };
        }

        return {
            window: 'today',
            dateFrom: today,
            dateTo: today,
            startedAtFrom: `${today} 00:00:00`,
            startedAtTo: this._formatDateTimeBoundary(this._addDays(today, 1))
        };
    }

    _formatDateOnly(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    _formatDateTimeBoundary(dateString) {
        return `${dateString} 00:00:00`;
    }

    _addDays(dateInput, amount) {
        const date = typeof dateInput === 'string'
            ? new Date(`${dateInput}T00:00:00`)
            : new Date(dateInput);
        date.setDate(date.getDate() + amount);
        return this._formatDateOnly(date);
    }

    _toPositiveInt(value) {
        if (value === undefined || value === null || value === '') return null;
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed <= 0) return null;
        return parsed;
    }
}

module.exports = new GameFlowService();
