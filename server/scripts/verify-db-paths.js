#!/usr/bin/env node

/**
 * 驗證所有腳本的資料庫路徑配置
 * 確保所有腳本都指向同一個資料庫文件
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 開始驗證資料庫路徑配置...\n');

// 1. 檢查環境變數配置
console.log('📋 步驟 1: 檢查環境變數配置');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const config = require('../config');

const expectedPath = path.resolve(__dirname, '..', config.database.path);
console.log(`   環境變數 DATABASE_PATH: ${process.env.DATABASE_PATH || '(未設定)'}`);
console.log(`   Config 路徑: ${config.database.path}`);
console.log(`   解析後絕對路徑: ${expectedPath}`);

// 2. 檢查資料庫文件是否存在
console.log('\n📋 步驟 2: 檢查資料庫文件');
if (fs.existsSync(expectedPath)) {
    const stats = fs.statSync(expectedPath);
    console.log(`   ✅ 資料庫文件存在`);
    console.log(`   檔案大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   最後修改: ${stats.mtime.toLocaleString('zh-TW')}`);
} else {
    console.log(`   ❌ 資料庫文件不存在！`);
    console.log(`   請執行: npm run setup`);
    process.exit(1);
}

// 3. 檢查錯誤位置是否有資料庫文件
console.log('\n📋 步驟 3: 檢查錯誤位置');
const wrongPaths = [
    path.join(__dirname, '../database/mice.db'),
    path.join(__dirname, '../database/mice_ai.db'),
    path.join(__dirname, '../mice.db'),
    path.join(__dirname, '../mice_ai.db'),
];

let foundWrongDb = false;
wrongPaths.forEach(wrongPath => {
    if (fs.existsSync(wrongPath)) {
        console.log(`   ❌ 發現錯誤位置的資料庫: ${wrongPath}`);
        foundWrongDb = true;
    }
});

if (!foundWrongDb) {
    console.log(`   ✅ 沒有發現錯誤位置的資料庫文件`);
}

// 4. 測試 db-path 模組
console.log('\n📋 步驟 4: 測試 db-path 模組');
try {
    const { getDbPath, getDbRelativePath } = require('./db-path');
    const dbPath = getDbPath();
    const relativePath = getDbRelativePath();
    
    console.log(`   相對路徑: ${relativePath}`);
    console.log(`   絕對路徑: ${dbPath}`);
    
    if (dbPath === expectedPath) {
        console.log(`   ✅ db-path 模組返回正確路徑`);
    } else {
        console.log(`   ❌ db-path 模組路徑不一致！`);
        console.log(`   預期: ${expectedPath}`);
        console.log(`   實際: ${dbPath}`);
    }
} catch (error) {
    console.log(`   ❌ db-path 模組測試失敗: ${error.message}`);
}

// 5. 掃描所有腳本的路徑配置
console.log('\n📋 步驟 5: 掃描腳本路徑配置');
const scriptsDir = __dirname;
const scriptFiles = fs.readdirSync(scriptsDir)
    .filter(file => file.endsWith('.js') && file !== 'verify-db-paths.js');

const pathPatterns = {
    config: /const\s+dbPath\s*=\s*path\.resolve\(config\.database\.path\)/,
    dbPathModule: /const\s+{\s*getDbPath\s*}\s*=\s*require\(['"]\.\/db-path['"]\)/,
    hardcoded: /const\s+dbPath\s*=\s*path\.join\(__dirname,\s*['"]\.\.\/data\/mice_ai\.db['"]\)/,
    wrong: /new\s+sqlite3\.Database\(['"](?!.*mice_ai\.db)/
};

const results = {
    config: [],
    dbPathModule: [],
    hardcoded: [],
    unknown: [],
    noDb: []
};

scriptFiles.forEach(file => {
    const filePath = path.join(scriptsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 檢查是否使用 sqlite3
    if (!content.includes('sqlite3')) {
        results.noDb.push(file);
        return;
    }
    
    // 檢查路徑配置方式
    if (pathPatterns.config.test(content)) {
        results.config.push(file);
    } else if (pathPatterns.dbPathModule.test(content)) {
        results.dbPathModule.push(file);
    } else if (pathPatterns.hardcoded.test(content)) {
        results.hardcoded.push(file);
    } else {
        results.unknown.push(file);
    }
});

console.log(`\n   使用 config 模組: ${results.config.length} 個`);
results.config.forEach(file => console.log(`      ✅ ${file}`));

console.log(`\n   使用 db-path 模組: ${results.dbPathModule.length} 個`);
results.dbPathModule.forEach(file => console.log(`      ✅ ${file}`));

console.log(`\n   使用硬編碼（正確路徑）: ${results.hardcoded.length} 個`);
results.hardcoded.forEach(file => console.log(`      ⚠️  ${file}`));

if (results.unknown.length > 0) {
    console.log(`\n   未知配置方式: ${results.unknown.length} 個`);
    results.unknown.forEach(file => console.log(`      ❓ ${file}`));
}

console.log(`\n   不使用資料庫: ${results.noDb.length} 個`);

// 6. 總結
console.log('\n' + '='.repeat(60));
console.log('📊 驗證總結');
console.log('='.repeat(60));

const totalDbScripts = results.config.length + results.dbPathModule.length + results.hardcoded.length + results.unknown.length;
const correctScripts = results.config.length + results.dbPathModule.length + results.hardcoded.length;

console.log(`總共掃描: ${scriptFiles.length} 個腳本`);
console.log(`使用資料庫: ${totalDbScripts} 個`);
console.log(`路徑正確: ${correctScripts} 個`);
console.log(`路徑錯誤: ${results.unknown.length} 個`);

if (results.unknown.length === 0 && !foundWrongDb) {
    console.log('\n✅ 所有檢查通過！資料庫路徑配置正確。');
    process.exit(0);
} else {
    console.log('\n⚠️  發現問題，請檢查上述錯誤。');
    process.exit(1);
}

