#!/usr/bin/env node

/**
 * DB migration 已淘汰：
 * - 新環境一律由 database/schema.sql 建立完整結構
 * - setup 不再執行任何 db:migrate:* 指令
 */

const command = process.argv[2] || 'db:migrate';

console.log(`⚠️ ${command} 已淘汰（deprecated）。`);
console.log('ℹ️ 請改用：npm run db:reset && npm run db:seed');
console.log('ℹ️ 資料庫結構來源：server/database/schema.sql');
process.exit(0);
