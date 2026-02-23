/**
 * Migration: 報名表單配置功能
 *
 * 1. form_submissions 表新增: gender, title, notes
 * 2. event_projects 表新增: form_config (JSON)
 */

require('dotenv').config();
const { createDb, columnExists, addColumnIfNotExists } = require('./utils/db');

const db = createDb();

console.log('🔄 開始執行 Migration: 報名表單配置...\n');

// 同步版本的輔助函數
const all = (sql, params = []) => db.prepare(sql).all(...params);
const run = (sql, params = []) => {
    const result = db.prepare(sql).run(...params);
    return { changes: result.changes, lastID: result.lastInsertRowid };
};

// 輔助函數：添加欄位
function addColumn(tableName, columnName, columnDef) {
    return addColumnIfNotExists(db, tableName, columnName, columnDef);
}

function migrate() {
    try {
        // Step 1: form_submissions 新增欄位
        console.log('📋 Step 1: form_submissions 表新增欄位');
        console.log('─'.repeat(40));

        addColumn('form_submissions', 'gender', "VARCHAR(10)");           // 性別
        addColumn('form_submissions', 'title', "VARCHAR(20)");            // 尊稱
        addColumn('form_submissions', 'notes', "TEXT");                   // 留言備註

        console.log('');

        // Step 2: event_projects 新增 form_config
        console.log('📋 Step 2: event_projects 表新增 form_config');
        console.log('─'.repeat(40));

        addColumn('event_projects', 'form_config', "TEXT");

        // 設定預設值
        const defaultConfig = JSON.stringify({
            required_fields: ['name', 'email', 'phone', 'data_consent'],
            optional_fields: [
                'company',
                'position',
                'gender',
                'title',
                'notes',
                'adult_age',
                'children_ages',
                'children_count',
                'marketing_consent'
            ],
            field_labels: {
                name: '姓名',
                email: '電子郵件',
                phone: '手機號碼',
                company: '公司名稱',
                position: '職位',
                gender: '性別',
                title: '尊稱',
                notes: '留言備註',
                adult_age: '成人年齡',
                children_ages: '小孩年齡區間',
                children_count: '小孩人數（自動計算）',
                data_consent: '資料使用同意',
                marketing_consent: '行銷同意'
            },
            gender_options: ['男', '女', '其他'],
            title_options: ['先生', '女士', '博士', '教授'],
            feature_toggles: {
                show_event_info: true,
                show_booth_info: false,
                show_voucher_info: false,
                show_vendor_info: false,
                show_inventory_info: false
            }
        });

        // 更新現有專案的預設配置
        const updateResult = run(`
            UPDATE event_projects
            SET form_config = ?
            WHERE form_config IS NULL
        `, [defaultConfig]);

        console.log(`  📝 已更新 ${updateResult.changes} 個專案的預設表單配置`);

        console.log('');

        // Step 3: 驗證結果
        console.log('📋 Step 3: 驗證結果');
        console.log('─'.repeat(40));

        // 檢查 form_submissions
        const fsColumns = all(`PRAGMA table_info(form_submissions)`);
        const newFsColumns = ['gender', 'title', 'notes'];
        for (const col of newFsColumns) {
            const exists = fsColumns.some(c => c.name === col);
            console.log(`  form_submissions.${col}: ${exists ? '✅' : '❌'}`);
        }

        // 檢查 event_projects
        const epColumns = all(`PRAGMA table_info(event_projects)`);
        const hasFormConfig = epColumns.some(c => c.name === 'form_config');
        console.log(`  event_projects.form_config: ${hasFormConfig ? '✅' : '❌'}`);

        console.log('');
        console.log('✅ Migration 完成！');

    } catch (error) {
        console.error('❌ Migration 失敗:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

migrate();
