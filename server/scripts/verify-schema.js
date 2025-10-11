#!/usr/bin/env node

/**
 * 驗證資料庫 Schema
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);

console.log('🔍 驗證資料庫 Schema...\n');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 無法連接到資料庫:', err.message);
        process.exit(1);
    }
});

// 檢查 invitation_projects 表結構
db.all("PRAGMA table_info(invitation_projects)", (err, rows) => {
    if (err) {
        console.error('❌ 查詢表結構失敗:', err.message);
        db.close();
        process.exit(1);
    }

    console.log('📋 invitation_projects 表結構:');
    console.log('─'.repeat(80));
    rows.forEach(row => {
        console.log(`  ${row.cid}. ${row.name.padEnd(25)} ${row.type.padEnd(15)} ${row.notnull ? 'NOT NULL' : ''} ${row.dflt_value ? 'DEFAULT ' + row.dflt_value : ''}`);
    });
    console.log('─'.repeat(80));

    // 檢查 template_id 欄位
    const hasTemplateId = rows.some(row => row.name === 'template_id');
    if (hasTemplateId) {
        console.log('✅ template_id 欄位存在\n');
    } else {
        console.log('❌ template_id 欄位不存在\n');
        db.close();
        process.exit(1);
    }

    // 檢查專案與模板關聯
    db.all(`
        SELECT p.id, p.project_name, p.project_code, p.template_id, t.template_name
        FROM invitation_projects p
        LEFT JOIN invitation_templates t ON p.template_id = t.id
    `, (err, projects) => {
        if (err) {
            console.error('❌ 查詢專案失敗:', err.message);
            db.close();
            process.exit(1);
        }

        console.log('📊 專案與模板關聯:');
        console.log('─'.repeat(80));
        projects.forEach(project => {
            const templateInfo = project.template_id 
                ? `模板 ID: ${project.template_id} (${project.template_name})`
                : '無模板';
            console.log(`  ${project.id}. ${project.project_name.padEnd(30)} ${templateInfo}`);
        });
        console.log('─'.repeat(80));

        // 檢查模板數量
        db.get('SELECT COUNT(*) as count FROM invitation_templates', (err, result) => {
            if (err) {
                console.error('❌ 查詢模板數量失敗:', err.message);
                db.close();
                process.exit(1);
            }

            console.log(`\n📄 模板總數: ${result.count}`);

            // 檢查 QR Code 表
            db.all("PRAGMA table_info(qr_codes)", (err, qrRows) => {
                if (err) {
                    console.error('❌ 查詢 qr_codes 表失敗:', err.message);
                    db.close();
                    process.exit(1);
                }

                console.log('\n📋 qr_codes 表結構:');
                console.log('─'.repeat(80));
                qrRows.forEach(row => {
                    console.log(`  ${row.cid}. ${row.name.padEnd(25)} ${row.type.padEnd(15)} ${row.notnull ? 'NOT NULL' : ''}`);
                });
                console.log('─'.repeat(80));

                // 檢查 qr_base64 欄位
                const hasQrBase64 = qrRows.some(row => row.name === 'qr_base64');
                if (hasQrBase64) {
                    console.log('✅ qr_base64 欄位存在\n');
                } else {
                    console.log('❌ qr_base64 欄位不存在\n');
                }

                console.log('🎉 Schema 驗證完成！');
                db.close();
            });
        });
    });
});

