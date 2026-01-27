/**
 * User Query Service - V1 用戶查詢業務邏輯
 *
 * @description 處理 v1 API 的用戶查詢功能（form_submissions 相關）
 * @note 與 user.service.js (admin 後台用戶管理) 不同
 */
const BaseService = require('./base.service');
const { submissionRepository, gameRepository, voucherRepository } = require('../repositories');
const { formatGMT8Time } = require('../utils/timezone');

class UserQueryService extends BaseService {
    constructor() {
        super('UserQueryService');
    }

    /**
     * 透過 Email 查詢報名記錄
     * @param {string} email - 用戶 email
     * @returns {Promise<Object>}
     */
    async findByEmail(email) {
        const registrations = await submissionRepository.findByEmail(email);

        if (!registrations || registrations.length === 0) {
            return { found: false, data: null };
        }

        const formattedRegistrations = registrations.map(r => ({
            trace_id: r.trace_id,
            name: r.submitter_name,
            project_name: r.project_name,
            project_code: r.project_code,
            status: r.status,
            registered_at: formatGMT8Time(r.created_at, 'datetime')
        }));

        return {
            found: true,
            data: {
                email,
                registrations: formattedRegistrations,
                total: formattedRegistrations.length
            }
        };
    }

    /**
     * 透過 trace_id 查詢用戶基本資料
     * @param {string} traceId - 用戶追蹤 ID
     * @returns {Promise<Object>}
     */
    async getUserInfo(traceId) {
        const userInfo = await gameRepository.findUserInfoByTraceId(traceId);

        if (!userInfo) {
            return { found: false, data: null };
        }

        return {
            found: true,
            data: {
                trace_id: userInfo.trace_id,
                name: userInfo.submitter_name,
                email: userInfo.submitter_email,
                phone: userInfo.submitter_phone,
                company: userInfo.company_name,
                position: userInfo.position,
                project: {
                    id: userInfo.project_id,
                    name: userInfo.project_name
                },
                registration: {
                    status: userInfo.status || 'pending',
                    registered_at: formatGMT8Time(userInfo.registration_time, 'datetime')
                },
                checkin: {
                    checked_in: !!userInfo.checkin_time,
                    checked_in_at: userInfo.checkin_time ? formatGMT8Time(userInfo.checkin_time, 'datetime') : null
                }
            }
        };
    }

    /**
     * 查詢用戶完整旅程
     * @param {string} traceId - 用戶追蹤 ID
     * @returns {Promise<Object>}
     */
    async getUserJourney(traceId) {
        const [userInfo, gameSessions, voucherRedemptions] = await Promise.all([
            gameRepository.findUserInfoByTraceId(traceId),
            gameRepository.findUserGameSessions(traceId),
            voucherRepository.findAllRedemptionsByTraceId(traceId)
        ]);

        if (!userInfo) {
            return { found: false, data: null };
        }

        const timeline = this._buildTimeline(userInfo, gameSessions, voucherRedemptions);
        const summary = this._buildSummary(gameSessions, voucherRedemptions);

        return {
            found: true,
            data: {
                user: {
                    trace_id: userInfo.trace_id,
                    name: userInfo.submitter_name,
                    email: userInfo.submitter_email,
                    company: userInfo.company_name,
                    phone: userInfo.submitter_phone
                },
                timeline,
                summary
            }
        };
    }

    /**
     * 建構時間軸
     * @private
     */
    _buildTimeline(userInfo, gameSessions, voucherRedemptions) {
        const timeline = [];

        // 報名事件
        if (userInfo.registration_time) {
            timeline.push({
                event: 'registration',
                time: formatGMT8Time(userInfo.registration_time, 'datetime'),
                time_sort: new Date(userInfo.registration_time).getTime(),
                details: {
                    project_name: userInfo.project_name,
                    status: userInfo.status || 'pending'
                }
            });
        }

        // 報到事件
        if (userInfo.checkin_time) {
            timeline.push({
                event: 'checkin',
                time: formatGMT8Time(userInfo.checkin_time, 'datetime'),
                time_sort: new Date(userInfo.checkin_time).getTime(),
                details: {}
            });
        }

        // 遊戲事件
        for (const session of gameSessions) {
            if (session.session_start) {
                timeline.push({
                    event: 'game_start',
                    time: formatGMT8Time(session.session_start, 'datetime'),
                    time_sort: new Date(session.session_start).getTime(),
                    details: {
                        game_id: session.game_id,
                        game_name: session.game_name_zh,
                        booth_id: session.booth_id,
                        booth_name: session.booth_name,
                        booth_code: session.booth_code
                    }
                });
            }

            if (session.session_end) {
                const gameWon = session.voucher_earned === 1;
                timeline.push({
                    event: 'game_end',
                    time: formatGMT8Time(session.session_end, 'datetime'),
                    time_sort: new Date(session.session_end).getTime(),
                    details: {
                        game_id: session.game_id,
                        game_name: session.game_name_zh,
                        booth_name: session.booth_name,
                        score: session.final_score,
                        play_time_seconds: session.total_play_time,
                        status: gameWon ? 'won' : 'completed',
                        voucher_earned: gameWon,
                        voucher_name: gameWon ? session.voucher_name : null
                    }
                });
            }
        }

        // 兌換券事件
        for (const redemption of voucherRedemptions) {
            if (redemption.redeemed_at) {
                timeline.push({
                    event: 'voucher_received',
                    time: formatGMT8Time(redemption.redeemed_at, 'datetime'),
                    time_sort: new Date(redemption.redeemed_at).getTime(),
                    details: {
                        redemption_code: redemption.redemption_code,
                        voucher_name: redemption.voucher_name,
                        voucher_value: redemption.voucher_value,
                        vendor_name: redemption.vendor_name,
                        category: redemption.category
                    }
                });
            }

            if (redemption.is_used === 1 && redemption.used_at) {
                timeline.push({
                    event: 'voucher_used',
                    time: formatGMT8Time(redemption.used_at, 'datetime'),
                    time_sort: new Date(redemption.used_at).getTime(),
                    details: {
                        redemption_code: redemption.redemption_code,
                        voucher_name: redemption.voucher_name,
                        voucher_value: redemption.voucher_value,
                        vendor_name: redemption.vendor_name
                    }
                });
            }
        }

        // 按時間排序並移除排序欄位
        timeline.sort((a, b) => a.time_sort - b.time_sort);
        timeline.forEach(item => delete item.time_sort);

        return timeline;
    }

    /**
     * 建構統計摘要
     * @private
     */
    _buildSummary(gameSessions, voucherRedemptions) {
        return {
            games_played: gameSessions.filter(s => s.session_end).length,
            games_won: gameSessions.filter(s => s.voucher_earned === 1).length,
            vouchers_total: voucherRedemptions.length,
            vouchers_used: voucherRedemptions.filter(v => v.is_used === 1).length
        };
    }
}

module.exports = new UserQueryService();
