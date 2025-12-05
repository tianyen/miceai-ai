/**
 * Services Index - 統一匯出所有 Service
 *
 * 使用方式：
 * const { checkinService, projectService } = require('./services');
 *
 * 或單獨引入：
 * const checkinService = require('./services/checkin.service');
 */

const authService = require('./auth.service');
const checkinService = require('./checkin.service');
const projectService = require('./project.service');
const qrCodeService = require('./qr-code.service');
const profileService = require('./profile.service');
const logService = require('./log.service');
const submissionService = require('./submission.service');
const questionnaireService = require('./questionnaire.service');
const boothService = require('./booth.service');
const gameService = require('./game.service');
const voucherService = require('./voucher.service');
const registrationService = require('./registration.service');
const eventService = require('./event.service');
const businessCardService = require('./business-card.service');
const templateService = require('./template.service');
const userService = require('./user.service');
const wishTreeService = require('./wish-tree.service');
const emailService = require('./email.service');

module.exports = {
    authService,
    checkinService,
    projectService,
    qrCodeService,
    profileService,
    logService,
    submissionService,
    questionnaireService,
    boothService,
    gameService,
    voucherService,
    registrationService,
    eventService,
    businessCardService,
    templateService,
    userService,
    wishTreeService,
    emailService
};
