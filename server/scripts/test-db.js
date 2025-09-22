#!/usr/bin/env node
/**
 * 數據庫連接測試腳本
 */
const database = require('../config/database');

async function testDatabase() {
    try {
        console.log('🔍 測試數據庫連接...');
        
        // 測試基本查詢
        const users = await database.query('SELECT id, username, role FROM users LIMIT 3');
        console.log('✅ 數據庫查詢成功');
        console.log('用戶列表:', users);
        
        // 測試單條查詢
        const admin = await database.get('SELECT * FROM users WHERE username = ?', ['admin']);
        console.log('✅ 單條查詢成功');
        console.log('管理員用戶:', admin ? { id: admin.id, username: admin.username, role: admin.role } : '未找到');
        
        console.log('🎉 數據庫連接測試完成！');
        
    } catch (error) {
        console.error('❌ 數據庫測試失敗:', error);
        process.exit(1);
    }
}

testDatabase();
