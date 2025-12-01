#!/usr/bin/env node
/**
 * QuestionnaireService 單元測試
 * 驗證 Service 層方法正確性
 *
 * 使用方式：
 * node scripts/test-questionnaire-service.js
 */

require('dotenv').config();

// 測試結果
const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
};

/**
 * 測試方法
 */
async function test(name, fn) {
    results.total++;
    try {
        await fn();
        console.log(`✅ ${name}`);
        results.passed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   錯誤: ${error.message}\n`);
        results.failed++;
        results.errors.push({ name, error: error.message });
    }
}

/**
 * 斷言函數
 */
function assert(condition, message) {
    if (!condition) throw new Error(message);
}

/**
 * 執行測試
 */
async function runTests() {
    console.log('🧪 開始 QuestionnaireService 單元測試...\n');

    // 載入 Service
    const { questionnaireService } = require('../services');
    const questionnaireRepository = require('../repositories/questionnaire.repository');

    console.log('📋 測試 Service 載入\n');

    await test('questionnaireService 應該正確載入', () => {
        assert(questionnaireService, 'questionnaireService 為 undefined');
        assert(questionnaireService.repository, 'repository 屬性缺失');
    });

    await test('questionnaireRepository 應該正確載入', () => {
        assert(questionnaireRepository, 'questionnaireRepository 為 undefined');
    });

    console.log('\n📋 測試 Repository 方法存在\n');

    const repoMethods = [
        'getOverviewStats',
        'findById',
        'getResponses',
        'getBasicStats',
        'getRecentResponses',
        'getQuestionnaireWithProject',
        'getListWithStats',
        'getCountWithFilters',
        'getUserAccessibleProjects',
        'checkProjectPermission'
    ];

    for (const method of repoMethods) {
        await test(`Repository.${method}() 方法應該存在`, () => {
            assert(
                typeof questionnaireRepository[method] === 'function',
                `${method} 不是函數`
            );
        });
    }

    console.log('\n📋 測試 Service 方法存在\n');

    const serviceMethods = [
        'getOverviewStats',
        'getQuestionnaireStats',
        'exportResponses',
        'getQrCodeInfo',
        'getById',
        'getStatsData',
        'getList',
        'getPaginationInfo',
        'getUserProjects',
        'getQuestionnaireWithProject',
        'checkUserAccess'
    ];

    for (const method of serviceMethods) {
        await test(`Service.${method}() 方法應該存在`, () => {
            assert(
                typeof questionnaireService[method] === 'function',
                `${method} 不是函數`
            );
        });
    }

    console.log('\n📋 測試 Service 方法執行\n');

    // 測試 getOverviewStats
    await test('getOverviewStats() 應該返回統計物件', async () => {
        const stats = await questionnaireService.getOverviewStats();
        assert(typeof stats === 'object', '返回值不是物件');
        assert('totalSubmissions' in stats, '缺少 totalSubmissions');
        assert('totalQuestionnaires' in stats, '缺少 totalQuestionnaires');
    });

    // 測試 getById (不存在的 ID)
    await test('getById(999999) 應該返回 falsy 值', async () => {
        const result = await questionnaireService.getById(999999);
        assert(!result, '不存在的 ID 應該返回 falsy 值 (null/undefined)');
    });

    // 測試 getUserProjects (模擬 super_admin)
    await test('getUserProjects() 應該返回專案陣列', async () => {
        const mockUser = { id: 1, role: 'super_admin' };
        const projects = await questionnaireService.getUserProjects(mockUser);
        assert(Array.isArray(projects), '返回值不是陣列');
    });

    // 測試 getList (模擬 super_admin)
    await test('getList() 應該返回分頁結果', async () => {
        const mockUser = { id: 1, role: 'super_admin' };
        const result = await questionnaireService.getList(
            { page: 1, limit: 10 },
            mockUser
        );
        assert(typeof result === 'object', '返回值不是物件');
        assert(Array.isArray(result.questionnaires), 'questionnaires 不是陣列');
        assert(typeof result.pagination === 'object', 'pagination 不是物件');
    });

    // 測試 getPaginationInfo
    await test('getPaginationInfo() 應該返回分頁資訊', async () => {
        const mockUser = { id: 1, role: 'super_admin' };
        const result = await questionnaireService.getPaginationInfo(
            { page: 1, limit: 10 },
            mockUser
        );
        assert(typeof result === 'object', '返回值不是物件');
        assert('total' in result, '缺少 total');
        assert('pages' in result, '缺少 pages');
    });

    // 測試 checkUserAccess (不存在的問卷)
    await test('checkUserAccess() 對不存在問卷應該返回 not_found', async () => {
        const mockUser = { id: 1, role: 'super_admin' };
        const result = await questionnaireService.checkUserAccess(999999, mockUser);
        assert(result.error === 'not_found', '錯誤類型應該是 not_found');
        assert(result.hasAccess === false, 'hasAccess 應該是 false');
    });

    // 測試 getStatsData (不存在的問卷)
    await test('getStatsData() 對不存在問卷應該返回 not_found', async () => {
        const mockUser = { id: 1, role: 'super_admin' };
        const result = await questionnaireService.getStatsData(999999, mockUser);
        assert(result.error === 'not_found', '錯誤類型應該是 not_found');
    });

    // 顯示結果
    console.log('\n' + '='.repeat(80));
    console.log('📊 單元測試結果\n');
    console.log(`總測試數: ${results.total}`);
    console.log(`✅ 通過: ${results.passed}`);
    console.log(`❌ 失敗: ${results.failed}`);
    console.log(`通過率: ${((results.passed / results.total) * 100).toFixed(1)}%`);

    if (results.failed > 0) {
        console.log('\n❌ 失敗的測試:\n');
        results.errors.forEach((err, index) => {
            console.log(`${index + 1}. ${err.name}`);
            console.log(`   ${err.error}\n`);
        });
    }

    console.log('='.repeat(80) + '\n');

    process.exit(results.failed > 0 ? 1 : 0);
}

// 主程式
runTests().catch(error => {
    console.error('❌ 測試執行失敗:', error);
    process.exit(1);
});
