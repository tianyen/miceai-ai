/**
 * 生成測試用 QR Code HTML 檔案
 * 用於測試兌換券掃描功能
 */

const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// 測試資料
const testData = {
    redemption_code: 'GAME-2025-ABC123',
    trace_id: 'MICE-TEST-SCAN-001',
    voucher_id: 1,
    voucher_name: '星巴克咖啡券'
};

async function generateQRCode() {
    try {
        console.log('🎯 生成測試 QR Code...');
        console.log('📋 測試資料:', JSON.stringify(testData, null, 2));

        // 生成 QR Code Base64
        const qrCodeData = JSON.stringify(testData);
        const qrCodeBase64 = await QRCode.toDataURL(qrCodeData, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            width: 400,
            margin: 2
        });

        // 生成 HTML 檔案
        const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>測試 QR Code - 星巴克咖啡券</title>
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
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
        }
        
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 16px;
        }
        
        .qr-code {
            background: white;
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            margin-bottom: 30px;
            display: inline-block;
        }
        
        .qr-code img {
            display: block;
            width: 100%;
            max-width: 400px;
            height: auto;
        }
        
        .info {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            text-align: left;
        }
        
        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e9ecef;
        }
        
        .info-item:last-child {
            border-bottom: none;
        }
        
        .info-label {
            font-weight: 600;
            color: #495057;
        }
        
        .info-value {
            color: #6c757d;
            font-family: 'Courier New', monospace;
            word-break: break-all;
        }
        
        .instructions {
            background: #e7f3ff;
            border-left: 4px solid #2196F3;
            padding: 15px;
            border-radius: 5px;
            text-align: left;
            margin-top: 20px;
        }
        
        .instructions h3 {
            color: #1976D2;
            margin-bottom: 10px;
            font-size: 16px;
        }
        
        .instructions ol {
            margin-left: 20px;
            color: #555;
        }
        
        .instructions li {
            margin: 5px 0;
        }
        
        .badge {
            display: inline-block;
            background: #28a745;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 14px;
            margin-bottom: 20px;
        }
        
        .copy-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 10px;
            transition: background 0.3s;
        }
        
        .copy-btn:hover {
            background: #5568d3;
        }
        
        .copy-btn:active {
            background: #4451b8;
        }
        
        #jsonData {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            padding: 10px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            word-break: break-all;
            margin-top: 10px;
            text-align: left;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎁 兌換券 QR Code</h1>
        <p class="subtitle">請使用掃描頁面掃描此 QR Code</p>
        
        <div class="badge">測試用兌換券</div>
        
        <div class="qr-code">
            <img src="${qrCodeBase64}" alt="QR Code">
        </div>
        
        <div class="info">
            <div class="info-item">
                <span class="info-label">兌換券名稱:</span>
                <span class="info-value">${testData.voucher_name}</span>
            </div>
            <div class="info-item">
                <span class="info-label">兌換碼:</span>
                <span class="info-value">${testData.redemption_code}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Trace ID:</span>
                <span class="info-value">${testData.trace_id}</span>
            </div>
            <div class="info-item">
                <span class="info-label">兌換券 ID:</span>
                <span class="info-value">${testData.voucher_id}</span>
            </div>
        </div>
        
        <div class="instructions">
            <h3>📱 測試步驟</h3>
            <ol>
                <li>開啟掃描頁面: <code>http://localhost:3000/admin/vouchers/scanner</code></li>
                <li>使用手機或 webcam 掃描上方 QR Code</li>
                <li>或直接複製下方 JSON 資料貼到掃描頁面</li>
                <li>驗證掃描結果是否正確顯示兌換券資訊</li>
            </ol>
        </div>
        
        <button class="copy-btn" onclick="copyJSON()">📋 複製 JSON 資料</button>
        
        <div id="jsonData">${qrCodeData}</div>
    </div>
    
    <script>
        function copyJSON() {
            const jsonData = ${JSON.stringify(qrCodeData)};
            navigator.clipboard.writeText(jsonData).then(() => {
                alert('✅ JSON 資料已複製到剪貼簿！');
            }).catch(err => {
                console.error('複製失敗:', err);
                alert('❌ 複製失敗，請手動複製');
            });
        }
    </script>
</body>
</html>`;

        // 儲存 HTML 檔案
        const outputPath = path.join(__dirname, '../../test-qrcode.html');
        fs.writeFileSync(outputPath, html, 'utf8');

        console.log('✅ QR Code HTML 已生成！');
        console.log('📁 檔案位置:', outputPath);
        console.log('🌐 請在瀏覽器開啟:', `file://${outputPath}`);
        console.log('\n📋 QR Code 包含的資料:');
        console.log(qrCodeData);
        console.log('\n🎯 下一步:');
        console.log('1. 在瀏覽器開啟上述 HTML 檔案');
        console.log('2. 啟動伺服器: cd server && npm run dev');
        console.log('3. 開啟掃描頁面: http://localhost:3000/admin/vouchers/scanner');
        console.log('4. 使用 webcam 掃描 QR Code 或複製 JSON 資料');

    } catch (error) {
        console.error('❌ 生成 QR Code 失敗:', error);
        process.exit(1);
    }
}

generateQRCode();

