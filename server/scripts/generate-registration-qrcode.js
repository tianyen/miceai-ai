#!/usr/bin/env node
/**
 * 生成報名成功後的 QR Code 測試頁面
 * 用於測試活動報到 webcam 掃描功能
 *
 * 使用方式:
 * node server/scripts/generate-registration-qrcode.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

// 載入環境變數
require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);
const outputPath = path.resolve(__dirname, '../../registration-qrcode.html');

console.log('🎫 生成報名成功後的 QR Code 測試頁面...\n');

const db = new Database(dbPath);
console.log('✅ 資料庫連接成功');

// 查詢第一筆報名記錄（未報到的）
const row = db.prepare(`
    SELECT
        fs.id,
        fs.trace_id,
        fs.submitter_name,
        fs.submitter_email,
        fs.submitter_phone,
        fs.company_name,
        fs.position,
        fs.status,
        fs.created_at,
        p.project_name,
        p.event_date,
        p.event_location,
        qr.qr_base64
    FROM form_submissions fs
    JOIN event_projects p ON fs.project_id = p.id
    LEFT JOIN qr_codes qr ON fs.id = qr.submission_id
    LEFT JOIN checkin_records cr ON fs.id = cr.submission_id
    WHERE cr.id IS NULL
    ORDER BY fs.created_at DESC
    LIMIT 1
`).get();

async function generate() {
    try {
        if (!row) {
            console.log('⚠️  找不到未報到的報名記錄');
            console.log('💡 請先執行 npm run db:seed 添加測試資料');
            process.exit(1);
        }

        console.log(`📋 找到報名記錄: ${row.submitter_name} (${row.trace_id})`);

        // 生成 QR Code
        const qrData = row.trace_id;
        const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
        });

        // 生成 HTML
        const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>報名成功 - ${row.project_name}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .card { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { color: #2c3e50; margin: 0; font-size: 24px; }
        .header p { color: #7f8c8d; margin: 10px 0 0; }
        .qr-container { text-align: center; margin: 30px 0; }
        .qr-container img { border: 3px solid #3498db; border-radius: 8px; }
        .info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #7f8c8d; }
        .info-value { color: #2c3e50; font-weight: 500; }
        .trace-id { font-family: monospace; background: #e8f4f8; padding: 10px; border-radius: 4px; text-align: center; margin: 20px 0; font-size: 14px; }
        .footer { text-align: center; color: #95a5a6; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h1>🎉 報名成功</h1>
            <p>${row.project_name}</p>
        </div>
        <div class="qr-container">
            <img src="${qrCodeDataUrl}" alt="QR Code">
            <p style="color: #7f8c8d; font-size: 14px;">請於活動當天出示此 QR Code 報到</p>
        </div>
        <div class="info">
            <div class="info-row"><span class="info-label">姓名</span><span class="info-value">${row.submitter_name}</span></div>
            <div class="info-row"><span class="info-label">Email</span><span class="info-value">${row.submitter_email}</span></div>
            <div class="info-row"><span class="info-label">電話</span><span class="info-value">${row.submitter_phone}</span></div>
            <div class="info-row"><span class="info-label">公司</span><span class="info-value">${row.company_name || '-'}</span></div>
            <div class="info-row"><span class="info-label">職位</span><span class="info-value">${row.position || '-'}</span></div>
            <div class="info-row"><span class="info-label">活動日期</span><span class="info-value">${row.event_date}</span></div>
            <div class="info-row"><span class="info-label">活動地點</span><span class="info-value">${row.event_location}</span></div>
        </div>
        <div class="trace-id">Trace ID: ${row.trace_id}</div>
        <div class="footer">
            <p>此 QR Code 僅供活動報到使用</p>
        </div>
    </div>
</body>
</html>`;

        fs.writeFileSync(outputPath, html);
        console.log(`\n✅ QR Code HTML 已生成！`);
        console.log(`📁 檔案位置: ${outputPath}`);
        console.log(`🌐 請在瀏覽器開啟: file://${outputPath}`);
        console.log(`\n📋 QR Code 包含的資料: ${qrData}`);
        console.log(`\n🎯 下一步:`);
        console.log(`1. 在瀏覽器開啟上述 HTML 檔案`);
        console.log(`2. 啟動伺服器: cd server && npm run dev`);
        console.log(`3. 開啟報到頁面: http://localhost:3000/admin/checkin`);
        console.log(`4. 使用 webcam 掃描 QR Code`);

    } catch (error) {
        console.error('❌ 生成失敗:', error);
        process.exit(1);
    } finally {
        db.close();
        console.log('✅ 資料庫連接已關閉');
    }
}

generate();
