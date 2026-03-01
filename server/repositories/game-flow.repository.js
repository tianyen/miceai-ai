/**
 * Game Flow Repository - mobile game telemetry persistence
 *
 * @description Handles tolerant session/event storage for mobile HTML game flows.
 */
const BaseRepository = require('./base.repository');

class GameFlowRepository extends BaseRepository {
    constructor() {
        super('game_flow_sessions');
    }

    async findProjectContext({ projectId = null, projectCode = null } = {}) {
        if (projectId) {
            return this.rawGet(`
                SELECT id, project_name, project_code, status
                FROM event_projects
                WHERE id = ?
                LIMIT 1
            `, [projectId]);
        }

        if (projectCode) {
            return this.rawGet(`
                SELECT id, project_name, project_code, status
                FROM event_projects
                WHERE project_code = ?
                LIMIT 1
            `, [projectCode]);
        }

        return null;
    }

    async findGameContext({ gameId = null, gameCode = null } = {}) {
        if (gameId) {
            return this.rawGet(`
                SELECT id, game_name_zh, game_name_en, game_code, is_active
                FROM games
                WHERE id = ?
                LIMIT 1
            `, [gameId]);
        }

        if (gameCode) {
            return this.rawGet(`
                SELECT id, game_name_zh, game_name_en, game_code, is_active
                FROM games
                WHERE game_code = ?
                LIMIT 1
            `, [gameCode]);
        }

        return null;
    }

    async findBoothContext({ projectId = null, boothId = null, boothCode = null } = {}) {
        if (boothId) {
            return this.rawGet(`
                SELECT id, project_id, booth_name, booth_code, is_active
                FROM booths
                WHERE id = ?
                LIMIT 1
            `, [boothId]);
        }

        if (projectId && boothCode) {
            return this.rawGet(`
                SELECT id, project_id, booth_name, booth_code, is_active
                FROM booths
                WHERE project_id = ? AND booth_code = ?
                LIMIT 1
            `, [projectId, boothCode]);
        }

        return null;
    }

    async findFlowSchema(projectId, gameId) {
        return this.rawGet(`
            SELECT id, schema_name, schema_version, schema_json
            FROM game_flow_schemas
            WHERE project_id = ? AND game_id = ? AND is_active = 1
            ORDER BY id DESC
            LIMIT 1
        `, [projectId, gameId]);
    }

    async findFlowSessionByFlowSessionId(flowSessionId) {
        return this.rawGet(`
            SELECT *
            FROM game_flow_sessions
            WHERE flow_session_id = ?
            LIMIT 1
        `, [flowSessionId]);
    }

    async createFlowSession(sessionData) {
        const {
            projectId,
            boothId,
            gameId,
            traceId,
            flowSessionId,
            status = 'active',
            entryStageId = null,
            exitStageId = null,
            completionStageId = null,
            ipAddress = null,
            userAgent = null,
            metadataJson = null
        } = sessionData;

        return this.rawRun(`
            INSERT INTO game_flow_sessions (
                project_id, booth_id, game_id, trace_id, flow_session_id, status,
                entry_stage_id, exit_stage_id, completion_stage_id,
                ip_address, user_agent, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            projectId,
            boothId || null,
            gameId,
            traceId,
            flowSessionId,
            status,
            entryStageId,
            exitStageId,
            completionStageId,
            ipAddress,
            userAgent,
            metadataJson
        ]);
    }

    async updateFlowSession(sessionId, patch = {}) {
        const updates = [];
        const params = [];

        const columnMap = {
            boothId: 'booth_id',
            status: 'status',
            entryStageId: 'entry_stage_id',
            exitStageId: 'exit_stage_id',
            completionStageId: 'completion_stage_id',
            ipAddress: 'ip_address',
            userAgent: 'user_agent',
            metadataJson: 'metadata_json'
        };

        for (const [key, column] of Object.entries(columnMap)) {
            if (patch[key] !== undefined) {
                updates.push(`${column} = ?`);
                params.push(patch[key]);
            }
        }

        if (patch.touchLastEventAt !== false) {
            updates.push('last_event_at = CURRENT_TIMESTAMP');
        }

        if (patch.markEnded) {
            updates.push('ended_at = CURRENT_TIMESTAMP');
        }

        if (updates.length === 0) {
            return { changes: 0 };
        }

        params.push(sessionId);

        return this.rawRun(`
            UPDATE game_flow_sessions
            SET ${updates.join(', ')}
            WHERE id = ?
        `, params);
    }

    async findStageEventByClientEventId(clientEventId) {
        if (!clientEventId) return null;

        return this.rawGet(`
            SELECT *
            FROM game_stage_events
            WHERE client_event_id = ?
            LIMIT 1
        `, [clientEventId]);
    }

    async createStageEvent(eventData) {
        const {
            clientEventId = null,
            sessionId = null,
            projectId,
            boothId = null,
            gameId,
            traceId,
            flowSessionId,
            stageId,
            eventType,
            durationMs = null,
            payloadJson = null
        } = eventData;

        return this.rawRun(`
            INSERT INTO game_stage_events (
                client_event_id, session_id, project_id, booth_id, game_id,
                trace_id, flow_session_id, stage_id, event_type, duration_ms, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            clientEventId,
            sessionId,
            projectId,
            boothId,
            gameId,
            traceId,
            flowSessionId,
            stageId,
            eventType,
            durationMs,
            payloadJson
        ]);
    }
}

module.exports = new GameFlowRepository();
