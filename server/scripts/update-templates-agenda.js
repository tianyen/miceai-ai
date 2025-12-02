#!/usr/bin/env node
const Database = require('better-sqlite3');
const { getDbPath } = require('./db-path');

const dbPath = getDbPath();
console.log('🔄 更新模板添加 agenda 欄位...');
console.log(`📁 資料庫路徑: ${dbPath}`);

const db = new Database(dbPath);

const content = JSON.stringify({
    schedule: {
        type: 'single_day',
        date: '2025-09-15',
        sessions: [
            { time: '09:00-09:30', title: '報到與茶點', speaker: '', location: '大廳' },
            { time: '09:30-10:30', title: '開幕致詞', speaker: '主辦單位', location: '主會場' },
            { time: '10:30-12:00', title: '主題演講：科技趨勢展望', speaker: '專業講師', location: '主會場' },
            { time: '12:00-13:30', title: '午餐時間', speaker: '', location: '餐廳' },
            { time: '13:30-15:00', title: '分組討論', speaker: '各組主持人', location: '分會場' },
            { time: '15:00-15:30', title: '茶點時間', speaker: '', location: '大廳' },
            { time: '15:30-17:00', title: '綜合座談', speaker: '全體與會者', location: '主會場' },
            { time: '17:00-17:30', title: '閉幕與合影', speaker: '', location: '主會場' }
        ]
    },
    agenda: [
        { order: '1', title: '大咖雲集', content: '200+ 知識學者和企業的行銷資訊，討論業界動態' },
        { order: '2', title: '專家分享', content: '業界專家分享最新科技趨勢與實務經驗' },
        { order: '3', title: '互動交流', content: '提供充分的交流與合作機會' }
    ]
});

try {
    db.prepare('UPDATE invitation_templates SET template_content = ? WHERE id = 3').run(content);
    console.log('✅ 更新模板 3: 科技論壇活動模板');

    db.prepare('UPDATE event_projects SET template_id = 3 WHERE project_code = ?').run('TECH2024');
    console.log('✅ 更新 TECH2024 專案使用模板 3');

    console.log('\n✅ 更新完成！');
} catch (err) {
    console.error('❌ 更新失敗:', err);
} finally {
    db.close();
    console.log('✅ 資料庫連接已關閉');
}
