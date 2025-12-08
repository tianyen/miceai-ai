#!/usr/bin/env node
/**
 * 顯示所有固定測試數據
 * 用於 Swagger 文檔範例更新
 */

const crypto = require('crypto');

// 使用與 db-seed.js 相同的邏輯生成 trace_id
function generateTraceId(index) {
    const hash = crypto.createHash('sha256')
        .update('mice-ai-2025-trace-' + index)
        .digest('hex');
    const timestamp = hash.substring(0, 8).toLowerCase();
    const random = hash.substring(8, 17).toLowerCase();
    return `MICE-${timestamp}-${random}`;
}

console.log('📊 固定測試數據清單（用於 Swagger 範例）');
console.log('='.repeat(70));

console.log('\n👥 測試報名用戶（精簡版，每個專案各一人）:');
console.log('  王大明 (registration_id=1, TECH2024):');
console.log('    - user_id: 1');
console.log('    - trace_id:', generateTraceId(1));
console.log('    - email: wang@example.com');
console.log('    - phone: 0934567890');

console.log('\n  福利團體1 (registration_id=2, MOON2025):');
console.log('    - user_id: 2');
console.log('    - trace_id:', generateTraceId(2));
console.log('    - email: test@test.com');
console.log('    - phone: 0900000000');
console.log('    - children_ages: { age_0_6: 1, age_6_12: 2, age_12_18: 0 }');

console.log('\n🎯 專案數據:');
console.log('  TECH2024:');
console.log('    - project_id: 1');
console.log('    - project_code: "TECH2024"');
console.log('    - project_name: "2024年度科技論壇"');

console.log('\n🎮 遊戲數據:');
console.log('  幸運飛鏢:');
console.log('    - game_id: 1');
console.log('    - game_name_zh: "幸運飛鏢"');
console.log('    - game_name_en: "Lucky Darts"');

console.log('\n🎁 兌換券數據:');
console.log('  星巴克咖啡券:');
console.log('    - voucher_id: 1');
console.log('    - voucher_name: "星巴克咖啡券"');
console.log('    - voucher_value: 100');

console.log('\n🏪 攤位數據:');
console.log('  A區攤位:');
console.log('    - booth_id: 1');
console.log('    - booth_code: "BOOTH-A1"');
console.log('    - booth_name: "A區攤位"');

console.log('\n📋 Swagger 範例格式:');
console.log('='.repeat(70));
console.log('\n報名 API 範例 (王大明):');
console.log(JSON.stringify({
    trace_id: generateTraceId(1),
    user_id: "1",
    project_id: 1,
    submitter_name: "王大明",
    submitter_email: "wang@example.com",
    submitter_phone: "0934567890"
}, null, 2));

console.log('\n遊戲 API 範例 (王大明):');
console.log(JSON.stringify({
    trace_id: generateTraceId(1),
    user_id: "1",
    project_id: 1,
    game_id: 1
}, null, 2));

console.log('\n='.repeat(70));
console.log('✅ 所有測試數據已列出');

