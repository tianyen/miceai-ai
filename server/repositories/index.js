/**
 * Repositories Index - 統一匯出所有 Repository
 *
 * 使用方式：
 * const { projectRepository, submissionRepository } = require('./repositories');
 *
 * 或單獨引入：
 * const projectRepository = require('./repositories/project.repository');
 *
 * @description Repository Pattern - 資料存取層
 * @see @refactor/ARCHITECTURE.md
 */

const BaseRepository = require('./base.repository');
const projectRepository = require('./project.repository');
const submissionRepository = require('./submission.repository');
const userRepository = require('./user.repository');
const checkinRepository = require('./checkin.repository');
const qrCodeRepository = require('./qr-code.repository');
const logRepository = require('./log.repository');
const questionnaireRepository = require('./questionnaire.repository');
const boothRepository = require('./booth.repository');
const gameRepository = require('./game.repository');
const voucherRepository = require('./voucher.repository');
const businessCardRepository = require('./business-card.repository');
const wishTreeRepository = require('./wish-tree.repository');
const trackingRepository = require('./tracking.repository');

module.exports = {
    BaseRepository,
    projectRepository,
    submissionRepository,
    userRepository,
    checkinRepository,
    qrCodeRepository,
    logRepository,
    questionnaireRepository,
    boothRepository,
    gameRepository,
    voucherRepository,
    businessCardRepository,
    wishTreeRepository,
    trackingRepository
};
