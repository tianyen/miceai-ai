/**
 * Booth Repository - 攤位資料存取
 *
 * 職責：
 * - 封裝 booths 表的所有 SQL 查詢
 * - 提供攤位特定的查詢方法
 *
 * @extends BaseRepository
 * @refactor 2025-12-01
 */

const BaseRepository = require('./base.repository');
const { getGMT8DateRange } = require('../utils/timezone');

function buildUnifiedBoothSessionsCTE() {
    return `
        WITH unified_sessions AS (
            SELECT
                'legacy:' || gs.id AS session_key,
                gs.booth_id,
                gs.trace_id,
                gs.session_start,
                gs.session_end,
                gs.total_play_time,
                gs.final_score,
                gs.voucher_earned
            FROM game_sessions gs

            UNION ALL

            SELECT
                'flow:' || gfs.id AS session_key,
                gfs.booth_id,
                gfs.trace_id,
                gfs.started_at AS session_start,
                gfs.ended_at AS session_end,
                CASE
                    WHEN gfs.ended_at IS NOT NULL THEN
                        CASE
                            WHEN CAST((julianday(gfs.ended_at) - julianday(gfs.started_at)) * 86400 AS INTEGER) > 0
                                THEN CAST((julianday(gfs.ended_at) - julianday(gfs.started_at)) * 86400 AS INTEGER)
                            ELSE 0
                        END
                    WHEN gfs.last_event_at IS NOT NULL THEN
                        CASE
                            WHEN CAST((julianday(gfs.last_event_at) - julianday(gfs.started_at)) * 86400 AS INTEGER) > 0
                                THEN CAST((julianday(gfs.last_event_at) - julianday(gfs.started_at)) * 86400 AS INTEGER)
                            ELSE 0
                        END
                    ELSE 0
                END AS total_play_time,
                0 AS final_score,
                0 AS voucher_earned
            FROM game_flow_sessions gfs
        )
    `;
}

class BoothRepository extends BaseRepository {
    constructor() {
        super('booths', 'id');
    }

    // ============================================================================
    // 查詢方法
    // ============================================================================

    /**
     * 取得攤位（含專案資訊）
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<Object|null>}
     */
    async findByIdWithProject(boothId) {
        const sql = `
            SELECT b.*, p.project_name
            FROM booths b
            LEFT JOIN event_projects p ON b.project_id = p.id
            WHERE b.id = ?
        `;
        return this.rawGet(sql, [boothId]);
    }

    /**
     * 取得所有攤位（含統計資訊）
     * @param {number|null} projectId - 專案 ID（可選）
     * @returns {Promise<Array>}
     */
    async findAllWithStats(projectId = null) {
        let sql = `
            ${buildUnifiedBoothSessionsCTE()}
            SELECT
                b.*,
                p.project_name,
                COUNT(DISTINCT us.session_key) as session_count,
                COUNT(DISTINCT us.trace_id) as player_count
            FROM booths b
            LEFT JOIN event_projects p ON b.project_id = p.id
            LEFT JOIN unified_sessions us ON b.id = us.booth_id
        `;

        const params = [];
        if (projectId) {
            sql += ' WHERE b.project_id = ?';
            params.push(projectId);
        }

        sql += ' GROUP BY b.id ORDER BY b.project_id ASC, b.booth_name ASC';

        return this.rawAll(sql, params);
    }

    /**
     * 依攤位代碼查詢
     * @param {string} boothCode - 攤位代碼
     * @param {number|null} projectId - 專案 ID（可選，建議提供）
     * @returns {Promise<Object|null>}
     */
    async findByCode(boothCode, projectId = null) {
        if (projectId) {
            return this.findOne({ booth_code: boothCode, project_id: projectId });
        }
        return this.findOne({ booth_code: boothCode });
    }

    /**
     * 檢查攤位代碼是否存在（排除指定 ID）
     * @param {string} boothCode - 攤位代碼
     * @param {number|null} excludeId - 排除的 ID
     * @param {number|null} projectId - 專案 ID（可選，建議提供）
     * @returns {Promise<Object|null>}
     */
    async findByCodeExcluding(boothCode, excludeId, projectId = null) {
        if (projectId) {
            const sql = `
                SELECT id
                FROM booths
                WHERE booth_code = ? AND id != ? AND project_id = ?
            `;
            return this.rawGet(sql, [boothCode, excludeId, projectId]);
        }

        const sql = `SELECT id FROM booths WHERE booth_code = ? AND id != ?`;
        return this.rawGet(sql, [boothCode, excludeId]);
    }

    // ============================================================================
    // 統計方法
    // ============================================================================

    /**
     * 取得攤位統計總覽
     * @param {number} boothId - 攤位 ID
     * @param {string|null} date - 日期篩選（可選）
     * @returns {Promise<Object>}
     */
    async getStatsSummary(boothId, date = null) {
        const dateRange = date ? getGMT8DateRange(date) : { startUtc: null, endUtc: null };
        let sql = `
            ${buildUnifiedBoothSessionsCTE()}
            SELECT
                COUNT(DISTINCT us.trace_id) as total_players,
                COUNT(us.session_key) as total_sessions,
                AVG(us.final_score) as avg_score,
                MAX(us.final_score) as max_score,
                AVG(us.total_play_time) as avg_play_time,
                SUM(us.voucher_earned) as vouchers_earned
            FROM unified_sessions us
            WHERE us.booth_id = ?
        `;
        const params = [boothId];

        if (dateRange.startUtc && dateRange.endUtc) {
            sql += ' AND us.session_start >= ? AND us.session_start < ?';
            params.push(dateRange.startUtc, dateRange.endUtc);
        }

        const result = await this.rawGet(sql, params);
        return result || {
            total_players: 0,
            total_sessions: 0,
            avg_score: 0,
            max_score: 0,
            avg_play_time: 0,
            vouchers_earned: 0
        };
    }

    /**
     * 取得每小時統計
     * @param {number} boothId - 攤位 ID
     * @param {string|null} date - 日期篩選（可選）
     * @returns {Promise<Array>}
     */
    async getHourlyStats(boothId, date = null) {
        const dateRange = date ? getGMT8DateRange(date) : { startUtc: null, endUtc: null };
        let sql = `
            ${buildUnifiedBoothSessionsCTE()}
            SELECT
                strftime('%Y-%m-%d %H:00', datetime(us.session_start, '+8 hours')) as hour,
                COUNT(DISTINCT us.trace_id) as player_count,
                COUNT(us.session_key) as session_count,
                AVG(us.final_score) as avg_score
            FROM unified_sessions us
            WHERE us.booth_id = ?
        `;
        const params = [boothId];

        if (dateRange.startUtc && dateRange.endUtc) {
            sql += ' AND us.session_start >= ? AND us.session_start < ?';
            params.push(dateRange.startUtc, dateRange.endUtc);
        }

        sql += `
            GROUP BY hour
            ORDER BY hour DESC
            LIMIT 24
        `;

        return this.rawAll(sql, params);
    }

    async findFlowGamesByBooth(boothId) {
        return this.rawAll(`
            SELECT DISTINCT
                g.id AS game_id,
                g.game_code,
                g.game_name_zh,
                gfs.schema_name,
                gfs.schema_version,
                gfs.schema_json
            FROM booth_games bg
            INNER JOIN booths b ON b.id = bg.booth_id
            INNER JOIN games g ON g.id = bg.game_id
            LEFT JOIN game_flow_schemas gfs
                ON gfs.project_id = b.project_id
               AND gfs.game_id = g.id
               AND gfs.is_active = 1
            WHERE bg.booth_id = ?
              AND bg.is_active = 1
            ORDER BY g.id ASC
        `, [boothId]);
    }

    async getFlowSessions(boothId, date = null) {
        const dateRange = date ? getGMT8DateRange(date) : { startUtc: null, endUtc: null };
        let sql = `
            SELECT
                gfs.id,
                gfs.flow_session_id,
                gfs.project_id,
                gfs.booth_id,
                gfs.game_id,
                g.game_code,
                g.game_name_zh,
                gfs.trace_id,
                gfs.status,
                gfs.started_at,
                gfs.ended_at,
                gfs.last_event_at,
                gfs.completion_stage_id
            FROM game_flow_sessions gfs
            INNER JOIN games g ON g.id = gfs.game_id
            WHERE gfs.booth_id = ?
        `;
        const params = [boothId];

        if (dateRange.startUtc && dateRange.endUtc) {
            sql += ' AND gfs.started_at >= ? AND gfs.started_at < ?';
            params.push(dateRange.startUtc, dateRange.endUtc);
        }

        sql += ' ORDER BY gfs.started_at ASC, gfs.id ASC';
        return this.rawAll(sql, params);
    }

    async getFlowEvents(boothId, date = null) {
        const dateRange = date ? getGMT8DateRange(date) : { startUtc: null, endUtc: null };
        let sql = `
            SELECT
                e.id,
                e.session_id,
                e.flow_session_id,
                e.project_id,
                e.booth_id,
                e.game_id,
                g.game_code,
                e.trace_id,
                e.stage_id,
                e.event_type,
                e.duration_ms,
                e.payload_json,
                e.created_at
            FROM game_stage_events e
            INNER JOIN game_flow_sessions gfs ON gfs.id = e.session_id
            INNER JOIN games g ON g.id = e.game_id
            WHERE gfs.booth_id = ?
        `;
        const params = [boothId];

        if (dateRange.startUtc && dateRange.endUtc) {
            sql += ' AND gfs.started_at >= ? AND gfs.started_at < ?';
            params.push(dateRange.startUtc, dateRange.endUtc);
        }

        sql += ' ORDER BY e.flow_session_id ASC, e.created_at ASC, e.id ASC';
        return this.rawAll(sql, params);
    }

    /**
     * 檢查攤位是否有遊戲記錄
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<boolean>}
     */
    async hasGameSessions(boothId) {
        const result = await this.rawGet(
            'SELECT COUNT(*) as count FROM game_sessions WHERE booth_id = ?',
            [boothId]
        );
        return (result?.count || 0) > 0;
    }

    // ============================================================================
    // CRUD 方法
    // ============================================================================

    /**
     * 建立攤位
     * @param {Object} data - 攤位資料
     * @returns {Promise<Object>}
     */
    async createBooth({ project_id, booth_name, booth_code, location, description }) {
        const sql = `
            INSERT INTO booths (project_id, booth_name, booth_code, location, description, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        return this.rawRun(sql, [
            project_id,
            booth_name,
            booth_code,
            location || '',
            description || '',
            1
        ]);
    }

    /**
     * 更新攤位
     * @param {number} boothId - 攤位 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async updateBooth(boothId, data) {
        const updates = [];
        const params = [];

        if (data.booth_name !== undefined) {
            updates.push('booth_name = ?');
            params.push(data.booth_name);
        }
        if (data.booth_code !== undefined) {
            updates.push('booth_code = ?');
            params.push(data.booth_code);
        }
        if (data.location !== undefined) {
            updates.push('location = ?');
            params.push(data.location);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (data.is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(data.is_active ? 1 : 0);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(boothId);

        const sql = `UPDATE booths SET ${updates.join(', ')} WHERE id = ?`;
        return this.rawRun(sql, params);
    }

    /**
     * 刪除攤位
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<Object>}
     */
    async deleteBooth(boothId) {
        return this.rawRun('DELETE FROM booths WHERE id = ?', [boothId]);
    }

    /**
     * 取得專案第一個攤位
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findFirstByProject(projectId) {
        const sql = `SELECT * FROM booths WHERE project_id = ? LIMIT 1`;
        return this.rawGet(sql, [projectId]);
    }

    /**
     * 取得專案攤位列表（含遊戲數量）
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async findByProjectWithGameCount(projectId) {
        const sql = `
            SELECT b.*,
                   (SELECT COUNT(*) FROM booth_games bg WHERE bg.booth_id = b.id) as game_count
            FROM booths b
            WHERE b.project_id = ?
            ORDER BY b.id
        `;
        return this.rawAll(sql, [projectId]);
    }

    /**
     * 驗證攤位屬於專案
     * @param {number} boothId - 攤位 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findByIdAndProject(boothId, projectId) {
        const sql = `SELECT id FROM booths WHERE id = ? AND project_id = ?`;
        return this.rawGet(sql, [boothId, projectId]);
    }

    /**
     * 刪除攤位及相關遊戲綁定
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<void>}
     */
    async deleteWithRelated(boothId) {
        // 刪除相關的遊戲綁定
        await this.rawRun('DELETE FROM booth_games WHERE booth_id = ?', [boothId]);
        // 刪除攤位
        return this.rawRun('DELETE FROM booths WHERE id = ?', [boothId]);
    }

    // ============================================================================
    // 遊戲綁定相關方法
    // ============================================================================

    /**
     * 查詢攤位綁定的遊戲列表
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<Array>}
     */
    async findBoothGames(boothId) {
        const sql = `
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
        `;
        return this.rawAll(sql, [boothId]);
    }

    /**
     * 查詢遊戲是否存在
     * @param {number} gameId - 遊戲 ID
     * @returns {Promise<Object|null>}
     */
    async findGameById(gameId) {
        return this.rawGet('SELECT * FROM games WHERE id = ?', [gameId]);
    }

    /**
     * 檢查遊戲是否已綁定到攤位
     * @param {number} boothId - 攤位 ID
     * @param {number} gameId - 遊戲 ID
     * @returns {Promise<Object|null>}
     */
    async findBindingByBoothAndGame(boothId, gameId) {
        return this.rawGet(
            'SELECT * FROM booth_games WHERE booth_id = ? AND game_id = ?',
            [boothId, gameId]
        );
    }

    /**
     * 查詢兌換券是否存在
     * @param {number} voucherId - 兌換券 ID
     * @returns {Promise<Object|null>}
     */
    async findVoucherById(voucherId) {
        return this.rawGet('SELECT * FROM vouchers WHERE id = ?', [voucherId]);
    }

    /**
     * 創建遊戲綁定
     * @param {number} boothId - 攤位 ID
     * @param {number} gameId - 遊戲 ID
     * @param {number|null} voucherId - 兌換券 ID
     * @param {string} qrCodeBase64 - QR Code 圖片
     * @returns {Promise<Object>}
     */
    async createGameBinding(boothId, gameId, voucherId, qrCodeBase64) {
        return this.rawRun(
            `INSERT INTO booth_games (booth_id, game_id, voucher_id, qr_code_base64)
             VALUES (?, ?, ?, ?)`,
            [boothId, gameId, voucherId || null, qrCodeBase64]
        );
    }

    /**
     * 查詢綁定記錄
     * @param {number} bindingId - 綁定 ID
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<Object|null>}
     */
    async findBindingById(bindingId, boothId) {
        return this.rawGet(
            'SELECT * FROM booth_games WHERE id = ? AND booth_id = ?',
            [bindingId, boothId]
        );
    }

    /**
     * 更新遊戲綁定
     * @param {number} bindingId - 綁定 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async updateBinding(bindingId, data) {
        const updates = [];
        const params = [];

        if (data.voucher_id !== undefined) {
            updates.push('voucher_id = ?');
            params.push(data.voucher_id || null);
        }

        if (data.is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(data.is_active ? 1 : 0);
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            params.push(bindingId);

            return this.rawRun(
                `UPDATE booth_games SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }
        return { changes: 0 };
    }

    /**
     * 刪除遊戲綁定
     * @param {number} bindingId - 綁定 ID
     * @param {number} boothId - 攤位 ID
     * @returns {Promise<Object>}
     */
    async deleteBinding(bindingId, boothId) {
        return this.rawRun(
            'DELETE FROM booth_games WHERE id = ? AND booth_id = ?',
            [bindingId, boothId]
        );
    }
}

// 單例模式
module.exports = new BoothRepository();
