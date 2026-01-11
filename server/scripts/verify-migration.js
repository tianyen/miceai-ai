#!/usr/env node
/**
 * 驗證 Repository 和 Service 方法是否存在
 * 用於 3-Tier Architecture Migration 驗證
 *
 * 使用方式: npm run verify:migration
 */

const path = require('path');
const fs = require('fs');

console.log('=== 3-Tier Architecture Migration 驗證 ===\n');

// 導入通用 Repository
const userRepository = require('../repositories/user.repository');

// 讀取 Service 文件內容用於殘留 DB 調用檢查
function readServiceFile(servicePath) {
  try {
    return fs.readFileSync(path.join(__dirname, servicePath), 'utf8');
  } catch {
    return '';
  }
}

// 驗證單個 Service 的方法
function verifyService(serviceName, repository, service, requiredRepoMethods, requiredServiceMethods) {
  console.log(`\n【${serviceName}】`);
  let allPassed = true;

  // 檢查 Repository 方法
  console.log(`  Repository 方法:`);
  for (const method of requiredRepoMethods) {
    if (typeof repository[method] === 'function') {
      console.log(`    ✅ ${method}`);
    } else {
      console.log(`    ❌ ${method} - 方法不存在!`);
      allPassed = false;
    }
  }

  // 檢查 Service 方法
  console.log(`  Service 方法:`);
  for (const method of requiredServiceMethods) {
    if (typeof service[method] === 'function') {
      console.log(`    ✅ ${method}`);
    } else {
      console.log(`    ❌ ${method} - 方法不存在!`);
      allPassed = false;
    }
  }

  return allPassed;
}

// 驗證殘留 DB 調用
function checkResidualDbCalls(serviceName, servicePath) {
  const code = readServiceFile(servicePath);
  const dbCalls = (code.match(/this\.db\.(get|all|run)\(/g) || []).length;
  const transactionCalls = (code.match(/this\.db\.(beginTransaction|commit|rollback)/g) || []).length;

  if (dbCalls > 0) {
    console.log(`  ⚠️ 發現 ${dbCalls} 個直接 DB 調用`);
    return false;
  } else {
    console.log(`  ✅ 無殘留的直接 DB 調用`);
    if (transactionCalls > 0) {
      console.log(`  ℹ️  transaction 控制保留: ${transactionCalls} 個 (合理設計)`);
    }
    return true;
  }
}

let allPassed = true;

// ============================================================================
// Project Service 驗證
// ============================================================================
try {
  const projectRepository = require('../repositories/project.repository');
  const projectService = require('../services/project.service');

  allPassed &= verifyService('Project Service', projectRepository, projectService,
    // Repository 方法
    [
      'findByCreatorId', 'findUserPermission', 'findAdminPermission',
      'createWithCreator', 'updateById', 'deleteProjectCascade', 'duplicate', 'updateStatus',
      'getPermissions', 'upsertPermission', 'updatePermission', 'deletePermission',
      'getListWithPermissionFilter', 'searchWithPermissionFilter', 'getRecentProjectsWithFilter',
      'getFullDetail', 'getScannerInfo', 'exportSubmissions'
    ],
    // Service 方法
    [
      'checkProjectPermission', 'checkAdminPermission',
      'createProject', 'updateProject', 'deleteProject', 'duplicateProject', 'updateStatus',
      'getProjectPermissions', 'addPermission', 'updatePermission', 'removePermission',
      'getProjectsList', 'searchProjectsAdmin', 'getRecentProjects',
      'getProjectFullDetail', 'getScannerUrl', 'exportProjectSubmissions', 'updateFormConfig'
    ]
  );

  allPassed &= checkResidualDbCalls('Project', './services/project.service.js');
} catch (e) {
  console.log('\n❌ Project Service 加載失敗:', e.message);
  allPassed = false;
}

// ============================================================================
// Checkin Service 驗證
// ============================================================================
try {
  const checkinRepository = require('../repositories/checkin.repository');
  const checkinService = require('../services/checkin.service');

  allPassed &= verifyService('Checkin Service', checkinRepository, checkinService,
    // Repository 方法
    [
      'findParticipant', 'searchParticipants', 'bulkCheckin', 'createCheckinRecord',
      'getProjectCheckinRecords', 'getProjectCheckinStats', 'getTodayStats',
      'getScanHistory', 'recordInteraction', 'hasCheckinRecord',
      'getParticipantWithProject', 'getNotCheckedInParticipants', 'updateParticipantCheckinStatus',
      'clearCheckinStatus', 'deleteCheckinRecord',
      // V1 API 方法
      'findRegistrationWithProject', 'incrementQrCodeScanCount', 'insertScanHistory',
      // 權限檢查方法
      'findProjectByCreator', 'findUserPermission',
      // Admin Panel 方法
      'findActiveProject', 'findSubmissionByIdAndProject', 'findCheckinBySubmissionOrTrace',
      'createCheckinRecordAdmin',
      // 報到記錄查詢（帶權限過濾）
      'getRecentCheckinsWithFilter', 'getCheckinDetail',
      // 統計查詢（帶權限過濾）
      'getTotalSubmissions', 'getTotalCheckins', 'getTodayCheckins', 'getRecentCheckinsList',
      // 參與者列表查詢
      'getParticipantsListWithFilter',
      // 匯出查詢
      'exportCheckinsWithFilter', 'findProjectName', 'findCheckinRecordByTraceId'
    ],
    // Service 方法
    [
      'checkProjectPermission', 'findParticipant', 'searchParticipants',
      'bulkCheckin', 'manualCheckin', 'performCheckin', 'qrScannerCheckin',
      'cancelCheckin', 'isAlreadyCheckedIn', 'getCheckinDetail',
      'getProjectCheckinStats', 'getTodayStats', 'getRecentCheckins',
      'getScanHistory', 'recordInteraction', 'exportCheckins',
      'getParticipantsList', 'getCheckinStatsAdmin', 'createCheckinAdmin'
    ]
  );

  allPassed &= checkResidualDbCalls('Checkin', './services/checkin.service.js');
} catch (e) {
  console.log('\n❌ Checkin Service 加載失敗:', e.message);
  allPassed = false;
}

// ============================================================================
// Voucher Service 驗證
// ============================================================================
try {
  const voucherRepository = require('../repositories/voucher.repository');
  const voucherService = require('../services/voucher.service');

  allPassed &= verifyService('Voucher Service', voucherRepository, voucherService,
    // Repository 方法
    [
      'findById', 'findAll', 'findAvailable', 'findByRedemptionCode',
      'findRedemptions', 'createRedemption', 'getStats', 'decrementStock', 'markRedeemed',
      // 統計查詢（帶專案過濾）
      'getRedemptionSummary', 'getVoucherStatsByProject', 'getDailyRedemptionTrend', 'getTopVouchers',
      'getInventoryStats',
      // 兌換券 CRUD
      'findVouchersWithFilter', 'findVoucherByIdWithConditions', 'createVoucher', 'updateVoucher', 'softDeleteVoucher',
      // 掃描和兌換
      'findRedemptionByCodeOrTrace', 'markRedemptionUsed', 'markRedemptionUsedByCode',
      'getRedemptionsWithVouchers', 'findLastRedemptionByTraceId'
    ],
    // Service 方法
    [
      'getById', 'getVoucherById', 'getList', 'getAvailableVouchers',
      'getStats', 'getInventoryStats', 'getRedemptions',
      'create', 'update', 'delete', 'issueVoucher',
      'redeemVoucher', 'scanVoucher', 'markRedemptionUsed', 'getByRedemptionCode'
    ]
  );

  allPassed &= checkResidualDbCalls('Voucher', './services/voucher.service.js');
} catch (e) {
  console.log('\n❌ Voucher Service 加載失敗:', e.message);
  allPassed = false;
}

// ============================================================================
// Game Service 驗證
// ============================================================================
try {
  const gameRepository = require('../repositories/game.repository');
  const gameService = require('../services/game.service');

  allPassed &= verifyService('Game Service', gameRepository, gameService,
    // Repository 方法
    [
      'findById', 'findAll', 'findByProject', 'findActiveGame',
      'findSessionById', 'findActiveSession', 'createSession', 'endSession',
      'getGameStats', 'findLogs', 'createLog', 'findBoothGameBinding',
      'findGameBinding', 'findBoothGameBindingByProject', 'updateSessionVoucher'
    ],
    // Service 方法
    [
      'getById', 'getGameById', 'getGameInfo', 'getList', 'listGames',
      'getGamesByProject', 'getGameStats', 'getAdminGameStats', 'getDailyUsers',
      'create', 'update', 'delete', 'startSession', 'endSession',
      'getSession', 'getSessions', 'getLeaderboard', 'getUserJourney',
      'logEvent', 'getGameBinding'
    ]
  );

  allPassed &= checkResidualDbCalls('Game', './services/game.service.js');
} catch (e) {
  console.log('\n❌ Game Service 加載失敗:', e.message);
  allPassed = false;
}

// ============================================================================
// Business Card Service 驗證
// ============================================================================
try {
  const businessCardRepository = require('../repositories/business-card.repository');
  const businessCardService = require('../services/business-card.service');

  allPassed &= verifyService('Business Card Service', businessCardRepository, businessCardService,
    // Repository 方法
    [
      'findByCardIdWithProject', 'findByCardId', 'findByProjectId',
      'incrementScanCount', 'getStats',
      // 遷移新增
      'findByProjectWithStatus', 'findByProjectWithSearch', 'countByProject',
      'findBasicByCardId', 'updateByCardId', 'deleteByCardId', 'create'
    ],
    // Service 方法
    [
      'createCard', 'getCardsByProject', 'getCardById', 'toggleStatus', 'deleteCard'
    ]
  );

  allPassed &= checkResidualDbCalls('Business Card', './services/business-card.service.js');
} catch (e) {
  console.log('\n❌ Business Card Service 加載失敗:', e.message);
  allPassed = false;
}

// ============================================================================
// Booth Service 驗證
// ============================================================================
try {
  const boothRepository = require('../repositories/booth.repository');
  const boothService = require('../services/booth.service');

  allPassed &= verifyService('Booth Service', boothRepository, boothService,
    // Repository 方法
    [
      'findById', 'findByIdWithProject', 'findByIdAndProject', 'findAll',
      'findByProjectWithGameCount', 'findFirstByProject', 'findByCode', 'findByCodeExcluding',
      'findAllWithStats', 'createBooth', 'updateBooth', 'deleteBooth',
      'deleteWithRelated', 'getStatsSummary', 'getHourlyStats', 'hasGameSessions'
    ],
    // Service 方法
    [
      'getById', 'getDetail', 'getAll', 'exists',
      'getStats', 'getBoothGames', 'create', 'update', 'delete',
      'bindGame', 'unbindGame', 'updateBinding'
    ]
  );

  allPassed &= checkResidualDbCalls('Booth', './services/booth.service.js');
} catch (e) {
  console.log('\n❌ Booth Service 加載失敗:', e.message);
  allPassed = false;
}

// ============================================================================
// Submission Service 驗證
// ============================================================================
try {
  const submissionRepository = require('../repositories/submission.repository');
  const submissionService = require('../services/submission.service');

  allPassed &= verifyService('Submission Service', submissionRepository, submissionService,
    // Repository 方法
    [
      'findByTraceId', 'findByIdWithProject', 'findGroupMembers', 'search',
      'findByProject', 'findCheckedIn', 'findNotCheckedIn',
      'updateCheckinStatus', 'bulkUpdateCheckin', 'updateSubmission',
      'getCheckinStats', 'getTodayStats', 'countByStatus', 'deleteWithRelated',
      'findByProjectAndEmail', 'countByProject', 'traceIdExists',
      'createRegistration', 'findByPassCode', 'findByPassCodeAndProjectCode',
      'createLegacyRegistration', 'findRegistrationByTraceId',
      // 遷移新增
      'findUserProjectPermission', 'findUserProjectWritePermission', 'findByIdWithCreator',
      'findWithPermissionFilter', 'findRecentWithPermissionFilter',
      'getStatsWithPermission', 'exportWithPermission', 'updateStatus', 'deleteById'
    ],
    // Service 方法
    [
      'buildSubmissionFilter', 'checkReadPermission', 'checkWritePermission', 'checkDeletePermission',
      'getSubmissionsList', 'getRecentSubmissions', 'getSubmissionDetail',
      'updateStatus', 'updateSubmission', 'deleteSubmission',
      'getStats', 'exportSubmissions', 'formatStatusText',
      'search', 'getPagination', 'getById', 'update', 'delete',
      'getCheckinStats', 'getTodayStats', 'formatStatus'
    ]
  );

  allPassed &= checkResidualDbCalls('Submission', './services/submission.service.js');
} catch (e) {
  console.log('\n❌ Submission Service 加載失敗:', e.message);
  allPassed = false;
}

// ============================================================================
// Auth Service 驗證
// ============================================================================
try {
  const authService = require('../services/auth.service');

  allPassed &= verifyService('Auth Service', userRepository, authService,
    // Repository 方法 (user.repository.js)
    [
      'findByUsernameOrEmail', 'createUser', 'updatePassword'
    ],
    // Service 方法
    [
      'findActiveUserByUsername', 'verifyPassword', 'hashPassword',
      'updateLastLogin', 'validateLogin', 'validateAdminLogin',
      'registerUser', 'changePassword'
    ]
  );

  allPassed &= checkResidualDbCalls('Auth', './services/auth.service.js');
} catch (e) {
  console.log('\n❌ Auth Service 加載失敗:', e.message);
  allPassed = false;
}

// ============================================================================
// Event Service 驗證
// ============================================================================
try {
  const eventRepository = require('../repositories/event.repository');
  const eventService = require('../services/event.service');

  allPassed &= verifyService('Event Service', eventRepository, eventService,
    // Repository 方法
    [
      'getEventListWithPagination', 'findByIdWithParticipants', 'findByCodeWithParticipants',
      'getEventData', 'getEventTemplate', 'findByStatus', 'findByEventType', 'search'
    ],
    // Service 方法
    [
      'getEventList', 'getEventByCode', 'getEventById'
    ]
  );

  allPassed &= checkResidualDbCalls('Event', './services/event.service.js');
} catch (e) {
  console.log('\n❌ Event Service 加載失敗:', e.message);
  allPassed = false;
}

// ============================================================================
// WishTree Service 驗證
// ============================================================================
try {
  const wishTreeRepository = require('../repositories/wish-tree.repository');
  const wishTreeService = require('../services/wish-tree.service');

  allPassed &= verifyService('WishTree Service', wishTreeRepository, wishTreeService,
    // Repository 方法
    [
      'createWish', 'findByIdWithImage', 'findRecentWishes',
      'getStats', 'countWithConditions', 'getHourlyDistribution',
      'getDailyDistribution', 'getPeakHours',
      'countByProject', 'findByProjectWithBooth', 'findAllByProjectForExport'
    ],
    // Service 方法
    [
      'submitWish', 'getStats', 'getRecentWishes', 'getWishById'
    ]
  );

  allPassed &= checkResidualDbCalls('WishTree', './services/wish-tree.service.js');
} catch (e) {
  console.log('\n❌ WishTree Service 加載失敗:', e.message);
  allPassed = false;
}

// ============================================================================
// Questionnaire Service 驗證 (2026-01-08)
// ============================================================================
try {
  const questionnaireRepository = require('../repositories/questionnaire.repository');
  const questionnaireService = require('../services/questionnaire.service');

  allPassed &= verifyService('Questionnaire Service', questionnaireRepository, questionnaireService,
    // Repository 方法 (新增跨表方法)
    [
      'createWithQuestions', 'updateWithQuestions', 'deleteCascadeFull', 'duplicateWithQuestions',
      // 現有方法
      'findById', 'findByProjectId', 'getDetail', 'getQuestions',
      'createQuestionnaire', 'createQuestion', 'createQuestionsBulk',
      'updateQuestionnaire', 'deleteQuestions', 'deleteResponses', 'deleteViews', 'deleteCascade',
      'toggleActive', 'duplicate', 'getOverviewStats', 'getResponseStats',
      'getResponses', 'countResponses', 'createResponse', 'submitResponse',
      'getListWithStats', 'getCountWithFilters', 'checkProjectPermission',
      'getBasicStats', 'getRecentResponses', 'getQuestionnaireWithProject',
      'getPublicQuestionnaire', 'checkExistingSubmission', 'logInteraction',
      'logView', 'getQRCode', 'updateQRCode', 'createQRCode', 'incrementQRScanCount',
      'getDetailedStats', 'getQuestionAnalysisData', 'getQuestionsForValidation',
      'getPublicQuestionnaireFull', 'findSubmissionByTraceId'
    ],
    // Service 方法
    [
      'getOverviewStats', 'getQuestionnaireStats', 'exportResponses', 'getQrCodeInfo', 'getById',
      'getStatsData', 'getList', 'getPaginationInfo', 'getUserProjects', 'getQuestionnaireWithProject',
      'checkUserAccess', 'getQuestionnaireDetail',
      'createQuestionnaire', 'updateQuestionnaire', 'deleteQuestionnaire', 'duplicateQuestionnaire', 'toggleStatus',
      'getDetailedStats', 'getAnalysis',
      'generateQRCode', 'getQRCode', 'recordQRScan',
      'getPublicQuestionnaire', 'submitResponse', 'recordView'
    ]
  );

  allPassed &= checkResidualDbCalls('Questionnaire', './services/questionnaire.service.js');
} catch (e) {
  console.log('\n❌ Questionnaire Service 加載失敗:', e.message);
  allPassed = false;
}

// ============================================================================
// Registration Service 驗證 (2026-01-08)
// ============================================================================
try {
  const submissionRepository = require('../repositories/submission.repository');
  const registrationService = require('../services/registration.service');

  allPassed &= verifyService('Registration Service', submissionRepository, registrationService,
    // Repository 方法 (新增 logInteraction)
    [
      'logInteraction',
      // 現有方法
      'findByTraceId', 'findByIdWithProject', 'findGroupMembers', 'search',
      'findByProject', 'findCheckedIn', 'findNotCheckedIn',
      'updateCheckinStatus', 'bulkUpdateCheckin', 'updateSubmission',
      'getCheckinStats', 'getTodayStats', 'countByStatus', 'deleteWithRelated',
      'findByProjectAndEmail', 'countByProject', 'traceIdExists',
      'createRegistration', 'findByPassCode', 'findByPassCodeAndProjectCode',
      'createLegacyRegistration', 'findRegistrationByTraceId',
      'findUserProjectPermission', 'findUserProjectWritePermission', 'findByIdWithCreator',
      'findWithPermissionFilter', 'findRecentWithPermissionFilter',
      'getStatsWithPermission', 'exportWithPermission', 'updateStatus', 'deleteById'
    ],
    // Service 方法
    [
      'submitRegistration', 'submitBatchRegistration',
      'verifyPassCode', 'getRegistrationStatus',
      'getQrCodeImage', 'getQrCodeData',
      'resendInvitationEmail'
    ]
  );

  allPassed &= checkResidualDbCalls('Registration', './services/registration.service.js');
} catch (e) {
  console.log('\n❌ Registration Service 加載失敗:', e.message);
  allPassed = false;
}

// 總結
console.log('\n=== 驗證結果 ===');
if (allPassed) {
  console.log('✅ 所有檢查通過! Migration 狀態正常。');
  process.exit(0);
} else {
  console.log('❌ 有檢查未通過，請修復後重新驗證。');
  process.exit(1);
}
