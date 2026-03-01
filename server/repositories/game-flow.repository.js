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
                  AND (? IS NULL OR project_id = ?)
                LIMIT 1
            `, [boothId, projectId, projectId]);
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

    async findBindingsByProjectAndGame(projectId, gameId) {
        return this.rawAll(`
            SELECT
                bg.id,
                bg.booth_id,
                bg.game_id,
                bg.is_active,
                b.project_id,
                b.booth_name,
                b.booth_code,
                b.is_active AS booth_is_active
            FROM booth_games bg
            INNER JOIN booths b ON b.id = bg.booth_id
            WHERE b.project_id = ? AND bg.game_id = ?
            ORDER BY b.id ASC
        `, [projectId, gameId]);
    }

    async findBindingContext({ projectId, boothId, gameId }) {
        return this.rawGet(`
            SELECT
                bg.id,
                bg.booth_id,
                bg.game_id,
                bg.is_active,
                b.project_id,
                b.booth_name,
                b.booth_code,
                b.is_active AS booth_is_active
            FROM booth_games bg
            INNER JOIN booths b ON b.id = bg.booth_id
            WHERE b.project_id = ? AND b.id = ? AND bg.game_id = ?
            LIMIT 1
        `, [projectId, boothId, gameId]);
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

    async getAnalyticsSummary({ projectId, gameId = null, boothId = null, startedAtFrom = null, startedAtTo = null }) {
        const where = ['s.project_id = ?'];
        const params = [projectId];

        if (gameId) {
            where.push('s.game_id = ?');
            params.push(gameId);
        }

        if (boothId) {
            where.push('s.booth_id = ?');
            params.push(boothId);
        }

        if (startedAtFrom) {
            where.push(`DATETIME(s.started_at, 'localtime') >= ?`);
            params.push(startedAtFrom);
        }

        if (startedAtTo) {
            where.push(`DATETIME(s.started_at, 'localtime') < ?`);
            params.push(startedAtTo);
        }

        return this.rawGet(`
            SELECT
                COUNT(DISTINCT s.flow_session_id) AS started_sessions,
                COUNT(DISTINCT s.trace_id) AS unique_players,
                SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) AS completed_sessions,
                SUM(CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END) AS failed_sessions,
                SUM(CASE WHEN s.status = 'abandoned' THEN 1 ELSE 0 END) AS abandoned_sessions,
                SUM(CASE
                    WHEN s.status = 'timeout'
                        OR (
                            s.status = 'active'
                            AND DATETIME(
                                s.last_event_at,
                                'localtime',
                                '+' || COALESCE(CAST(json_extract(gfs.schema_json, '$.timeout_minutes') AS INTEGER), 15) || ' minutes'
                            ) < DATETIME('now', 'localtime')
                        )
                    THEN 1 ELSE 0
                END) AS timeout_sessions,
                SUM(CASE
                    WHEN s.status = 'active'
                        AND DATETIME(
                            s.last_event_at,
                            'localtime',
                            '+' || COALESCE(CAST(json_extract(gfs.schema_json, '$.timeout_minutes') AS INTEGER), 15) || ' minutes'
                        ) >= DATETIME('now', 'localtime')
                    THEN 1 ELSE 0
                END) AS active_sessions
            FROM game_flow_sessions s
            LEFT JOIN game_flow_schemas gfs
                ON gfs.project_id = s.project_id
               AND gfs.game_id = s.game_id
               AND gfs.is_active = 1
            WHERE ${where.join(' AND ')}
        `, params);
    }

    async getAnalyticsBreakdown({ projectId, gameId = null, boothId = null, startedAtFrom = null, startedAtTo = null }) {
        const where = ['s.project_id = ?'];
        const params = [projectId];

        if (gameId) {
            where.push('s.game_id = ?');
            params.push(gameId);
        }

        if (boothId) {
            where.push('s.booth_id = ?');
            params.push(boothId);
        }

        if (startedAtFrom) {
            where.push(`DATETIME(s.started_at, 'localtime') >= ?`);
            params.push(startedAtFrom);
        }

        if (startedAtTo) {
            where.push(`DATETIME(s.started_at, 'localtime') < ?`);
            params.push(startedAtTo);
        }

        return this.rawAll(`
            SELECT
                s.game_id,
                g.game_code,
                g.game_name_zh,
                s.booth_id,
                b.booth_code,
                b.booth_name,
                COUNT(DISTINCT s.flow_session_id) AS started_sessions,
                COUNT(DISTINCT s.trace_id) AS unique_players,
                SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) AS completed_sessions,
                SUM(CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END) AS failed_sessions,
                SUM(CASE WHEN s.status = 'abandoned' THEN 1 ELSE 0 END) AS abandoned_sessions,
                SUM(CASE
                    WHEN s.status = 'timeout'
                        OR (
                            s.status = 'active'
                            AND DATETIME(
                                s.last_event_at,
                                'localtime',
                                '+' || COALESCE(CAST(json_extract(gfs.schema_json, '$.timeout_minutes') AS INTEGER), 15) || ' minutes'
                            ) < DATETIME('now', 'localtime')
                        )
                    THEN 1 ELSE 0
                END) AS timeout_sessions
            FROM game_flow_sessions s
            INNER JOIN games g ON g.id = s.game_id
            LEFT JOIN booths b ON b.id = s.booth_id
            LEFT JOIN game_flow_schemas gfs
                ON gfs.project_id = s.project_id
               AND gfs.game_id = s.game_id
               AND gfs.is_active = 1
            WHERE ${where.join(' AND ')}
            GROUP BY s.game_id, g.game_code, g.game_name_zh, s.booth_id, b.booth_code, b.booth_name
            ORDER BY g.game_name_zh ASC, b.booth_name ASC
        `, params);
    }

    async getStageCounts({ projectId, gameId, boothId = null, startedAtFrom = null, startedAtTo = null }) {
        const where = ['s.project_id = ?', 's.game_id = ?'];
        const params = [projectId, gameId];

        if (boothId) {
            where.push('s.booth_id = ?');
            params.push(boothId);
        }

        if (startedAtFrom) {
            where.push(`DATETIME(s.started_at, 'localtime') >= ?`);
            params.push(startedAtFrom);
        }

        if (startedAtTo) {
            where.push(`DATETIME(s.started_at, 'localtime') < ?`);
            params.push(startedAtTo);
        }

        return this.rawAll(`
            SELECT
                e.stage_id,
                COUNT(DISTINCT e.flow_session_id) AS reached_sessions,
                COUNT(DISTINCT CASE
                    WHEN e.event_type IN ('stage_submit', 'session_end')
                    THEN e.flow_session_id
                END) AS submitted_sessions,
                COUNT(*) AS event_count,
                MIN(e.created_at) AS first_seen_at,
                MAX(e.created_at) AS last_seen_at
            FROM game_stage_events e
            INNER JOIN game_flow_sessions s ON s.id = e.session_id
            WHERE ${where.join(' AND ')}
            GROUP BY e.stage_id
            ORDER BY MIN(e.created_at) ASC, e.stage_id ASC
        `, params);
    }
}

module.exports = new GameFlowRepository();
