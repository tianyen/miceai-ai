/**
 * Game Flow Service - tolerant telemetry ingestion for mobile HTML games
 */
const BaseService = require('./base.service');
const gameFlowRepository = require('../repositories/game-flow.repository');
const { validateTraceId } = require('../utils/traceId');

const SESSION_END_STATUSES = new Set(['completed', 'failed', 'timeout', 'abandoned']);

class GameFlowService extends BaseService {
    constructor() {
        super('GameFlowService');
        this.gameFlowRepo = gameFlowRepository;
    }

    async trackEvent(eventData, clientContext = {}) {
        return this.withErrorHandling(async () => {
            const normalized = this._normalizeEvent(eventData);
            const resolvedContext = await this._resolveContext(normalized);
            const existingSession = await this.gameFlowRepo.findFlowSessionByFlowSessionId(normalized.flowSessionId);

            this._assertExistingSessionContext(existingSession, resolvedContext, normalized);

            const session = existingSession || await this._createImplicitSession(
                resolvedContext,
                normalized,
                clientContext
            );

            const duplicateEvent = await this.gameFlowRepo.findStageEventByClientEventId(normalized.clientEventId);
            if (!duplicateEvent) {
                await this.gameFlowRepo.createStageEvent({
                    clientEventId: normalized.clientEventId,
                    sessionId: session.id,
                    projectId: resolvedContext.project.id,
                    boothId: resolvedContext.booth?.id || session.booth_id || null,
                    gameId: resolvedContext.game.id,
                    traceId: normalized.traceId,
                    flowSessionId: normalized.flowSessionId,
                    stageId: normalized.stageId,
                    eventType: normalized.eventType,
                    durationMs: normalized.durationMs,
                    payloadJson: normalized.payloadJson
                });
            }

            const sessionPatch = this._buildSessionPatch(session, normalized, clientContext);
            if (Object.keys(sessionPatch).length > 0) {
                await this.gameFlowRepo.updateFlowSession(session.id, sessionPatch);
            }

            const updatedSession = await this.gameFlowRepo.findFlowSessionByFlowSessionId(normalized.flowSessionId);
            const schema = await this.gameFlowRepo.findFlowSchema(updatedSession.project_id, updatedSession.game_id);

            this.log('trackEvent', {
                flow_session_id: normalized.flowSessionId,
                trace_id: normalized.traceId,
                event_type: normalized.eventType,
                stage_id: normalized.stageId,
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
                schema: schema
                    ? {
                        id: schema.id,
                        name: schema.schema_name,
                        version: schema.schema_version
                    }
                    : null,
                duplicate_event: !!duplicateEvent
            };
        }, 'trackEvent');
    }

    _normalizeEvent(eventData = {}) {
        const traceId = typeof eventData.trace_id === 'string' ? eventData.trace_id.trim() : '';
        const flowSessionId = typeof eventData.flow_session_id === 'string' ? eventData.flow_session_id.trim() : '';
        const stageId = typeof eventData.stage_id === 'string' ? eventData.stage_id.trim() : '';
        const eventType = typeof eventData.event_type === 'string' ? eventData.event_type.trim() : '';

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

    async _resolveContext(normalized) {
        const project = await this.gameFlowRepo.findProjectContext({
            projectId: normalized.projectId,
            projectCode: normalized.projectCode
        });

        const game = await this.gameFlowRepo.findGameContext({
            gameId: normalized.gameId,
            gameCode: normalized.gameCode
        });

        if (!project) {
            this.throwError(this.ErrorCodes.PROJECT_NOT_FOUND);
        }

        if (!game) {
            this.throwError(this.ErrorCodes.GAME_NOT_FOUND);
        }

        let booth = null;
        if (normalized.boothId || normalized.boothCode) {
            booth = await this.gameFlowRepo.findBoothContext({
                projectId: project.id,
                boothId: normalized.boothId,
                boothCode: normalized.boothCode
            });

            if (!booth) {
                this.throwError(this.ErrorCodes.BOOTH_NOT_FOUND);
            }
        }

        return { project, game, booth };
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
        const createResult = await this.gameFlowRepo.createFlowSession({
            projectId: resolvedContext.project.id,
            boothId: resolvedContext.booth?.id || null,
            gameId: resolvedContext.game.id,
            traceId: normalized.traceId,
            flowSessionId: normalized.flowSessionId,
            status: this._inferInitialStatus(normalized),
            entryStageId: normalized.stageId,
            exitStageId: normalized.stageId,
            completionStageId: this._isTerminalStatus(normalized.sessionStatus) ? normalized.stageId : null,
            ipAddress: clientContext.ipAddress || null,
            userAgent: clientContext.userAgent || null,
            metadataJson: this._buildSessionMetadataJson(normalized, clientContext)
        });

        return this.gameFlowRepo.findById(createResult.lastID);
    }

    _buildSessionPatch(session, normalized, clientContext) {
        const patch = {};

        if (!session.booth_id && normalized.boothId) {
            patch.boothId = normalized.boothId;
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

        const nextStatus = this._inferStatus(normalized, session.status);
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

    _inferInitialStatus(normalized) {
        if (this._isTerminalStatus(normalized.sessionStatus)) {
            return normalized.sessionStatus;
        }

        if (normalized.eventType === 'session_end') {
            return normalized.sessionStatus || 'completed';
        }

        return 'active';
    }

    _inferStatus(normalized, currentStatus) {
        if (this._isTerminalStatus(currentStatus)) {
            return currentStatus;
        }

        if (this._isTerminalStatus(normalized.sessionStatus)) {
            return normalized.sessionStatus;
        }

        if (normalized.eventType === 'session_end') {
            return normalized.sessionStatus || 'completed';
        }

        if (normalized.eventType === 'session_start') {
            return 'active';
        }

        return currentStatus || 'active';
    }

    _isTerminalStatus(status) {
        return SESSION_END_STATUSES.has(status);
    }

    _buildSessionMetadataJson(normalized, clientContext) {
        return JSON.stringify({
            source: 'game-flow-track',
            first_event_type: normalized.eventType,
            first_stage_id: normalized.stageId,
            project_code: normalized.projectCode || null,
            game_code: normalized.gameCode || null,
            booth_code: normalized.boothCode || null,
            ip_address: clientContext.ipAddress || null
        });
    }

    _toPositiveInt(value) {
        if (value === undefined || value === null || value === '') return null;
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed <= 0) return null;
        return parsed;
    }
}

module.exports = new GameFlowService();
