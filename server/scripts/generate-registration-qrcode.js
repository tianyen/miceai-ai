#!/usr/bin/env node
/**
 * 生成報名成功後的 QR Code 測試頁面
 * 用於測試活動報到 webcam 掃描功能
 *
 * 使用方式:
 * node server/scripts/generate-registration-qrcode.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

// 載入環境變數
require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);
const outputPath = path.resolve(__dirname, '../../registration-qrcode.html');

console.log('🎫 生成報名成功後的 QR Code 測試頁面...\n');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 資料庫連接失敗:', err.message);
        process.exit(1);
    }
    console.log('✅ 資料庫連接成功');
});

// 查詢第一筆報名記錄（未報到的）
db.get(`
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
`, async (err, row) => {
    if (err) {
        console.error('❌ 查詢失敗:', err.message);
        db.close();
        process.exit(1);
    }

    if (!row) {
        console.error('❌ 找不到未報到的報名記錄');
        console.log('💡 提示: 請先執行 npm run db:seed 創建測試資料');
        db.close();
        process.exit(1);
    }

    console.log('\n📋 找到報名記錄:');
    console.log(`   ID: ${row.id}`);
    console.log(`   Trace ID: ${row.trace_id}`);
    console.log(`   姓名: ${row.submitter_name}`);
    console.log(`   Email: ${row.submitter_email}`);
    console.log(`   活動: ${row.project_name}`);
    console.log(`   狀態: ${row.status}`);

    // 生成 QR Code (使用純 trace_id，與前端 API 一致)
    const qrData = row.trace_id;
    
    let qrBase64;
    if (row.qr_base64) {
        qrBase64 = row.qr_base64;
        console.log('\n✅ 使用資料庫中的 QR Code Base64');
    } else {
        qrBase64 = await QRCode.toDataURL(qrData, {
            type: 'image/png',
            width: 400,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        console.log('\n✅ 生成新的 QR Code Base64');
    }

    // 生成 HTML 頁面
    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>報名成功 - QR Code 測試</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 100%;
            padding: 40px;
            text-align: center;
        }
        .success-icon {
            width: 80px;
            height: 80px;
            background: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            animation: scaleIn 0.5s ease-out;
        }
        .success-icon::after {
            content: "✓";
            color: white;
            font-size: 48px;
            font-weight: bold;
        }
        @keyframes scaleIn {
            from {
                transform: scale(0);
            }
            to {
                transform: scale(1);
            }
        }
        h1 {
            color: #1f2937;
            font-size: 28px;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #6b7280;
            font-size: 16px;
            margin-bottom: 30px;
        }
        .info-section {
            background: #f9fafb;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
            text-align: left;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .info-label {
            color: #6b7280;
            font-size: 14px;
        }
        .info-value {
            color: #1f2937;
            font-weight: 600;
            font-size: 14px;
        }
        .qr-section {
            margin: 30px 0;
        }
        .qr-title {
            color: #1f2937;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 15px;
        }
        .qr-code {
            background: white;
            padding: 20px;
            border-radius: 12px;
            border: 2px solid #e5e7eb;
            display: inline-block;
            margin-bottom: 15px;
        }
        .qr-code img {
            display: block;
            width: 300px;
            height: 300px;
        }
        .trace-id {
            background: #f3f4f6;
            padding: 12px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 14px;
            color: #374151;
            word-break: break-all;
            margin-bottom: 15px;
        }
        .buttons {
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            text-decoration: none;
            display: inline-block;
        }
        .btn-primary {
            background: #667eea;
            color: white;
        }
        .btn-primary:hover {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .btn-secondary {
            background: #f3f4f6;
            color: #374151;
        }
        .btn-secondary:hover {
            background: #e5e7eb;
        }
        .note {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            border-radius: 8px;
            margin-top: 30px;
            text-align: left;
        }
        .note-title {
            color: #92400e;
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .note-text {
            color: #78350f;
            font-size: 13px;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon"></div>
        <h1>報名成功！</h1>
        <p class="subtitle">您的活動報名已確認</p>

        <div class="info-section">
            <div class="info-row">
                <span class="info-label">活動名稱</span>
                <span class="info-value">${row.project_name}</span>
            </div>
            <div class="info-row">
                <span class="info-label">參加者</span>
                <span class="info-value">${row.submitter_name}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Email</span>
                <span class="info-value">${row.submitter_email}</span>
            </div>
            <div class="info-row">
                <span class="info-label">公司</span>
                <span class="info-value">${row.company_name || '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">職位</span>
                <span class="info-value">${row.position || '-'}</span>
            </div>
        </div>

        <div class="qr-section">
            <div class="qr-title">📱 您的報到 QR Code</div>
            <div class="qr-code">
                <img src="${qrBase64}" alt="QR Code">
            </div>
            <div class="trace-id" id="trace-id">${qrData}</div>
            <div class="buttons">
                <button class="btn btn-primary" onclick="copyTraceId()">📋 複製 Trace ID</button>
                <button class="btn btn-secondary" onclick="downloadQR()">💾 下載 QR Code</button>
                <a href="http://localhost:3000/admin/checkin/camera-scanner" target="_blank" class="btn btn-primary">
                    📷 開啟掃描器
                </a>
            </div>
        </div>

        <div class="note">
            <div class="note-title">🧪 測試說明</div>
            <div class="note-text">
                1. 此 QR Code 使用純 trace_id 格式（與前端 API v1 一致）<br>
                2. 可被後端活動報到掃描器正常識別<br>
                3. 點擊「開啟掃描器」按鈕測試 webcam 掃描功能<br>
                4. 或複製 Trace ID 手動貼到掃描頁面測試
            </div>
        </div>
    </div>

    <script>
        function copyTraceId() {
            const traceId = document.getElementById('trace-id').textContent;
            navigator.clipboard.writeText(traceId).then(() => {
                alert('✅ Trace ID 已複製到剪貼簿！\\n\\n' + traceId);
            }).catch(err => {
                console.error('複製失敗:', err);
                alert('❌ 複製失敗，請手動複製');
            });
        }

        function downloadQR() {
            const link = document.createElement('a');
            link.href = '${qrBase64}';
            link.download = 'registration-qrcode-${row.trace_id}.png';
            link.click();
        }
    </script>
</body>
</html>`;

    // 寫入檔案
    fs.writeFileSync(outputPath, html, 'utf8');

    console.log('\n✅ QR Code 測試頁面已生成！');
    console.log(`📁 檔案位置: ${outputPath}`);
    console.log('\n🌐 請在瀏覽器中開啟此檔案進行測試');
    console.log('📷 或點擊頁面上的「開啟掃描器」按鈕直接測試\n');

    console.log('📊 QR Code 資料格式:');
    console.log(`   格式: 純 trace_id 字串`);
    console.log(`   內容: ${qrData}`);
    console.log(`   長度: ${qrData.length} 字元\n`);

    console.log('🔍 與 API 規格對照:');
    console.log('   ✅ 前端 API v1 報名: 使用純 trace_id');
    console.log('   ✅ 後端掃描器: 支援純 trace_id 和 JSON 格式');
    console.log('   ✅ DB Seed: 使用確定性 trace_id\n');

    db.close();
});

