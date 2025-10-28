/**
 * 生成測試用報到 QR Code HTML 檔案
 * 用於測試報到掃描功能
 */

const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// 測試資料 - 報到 QR Code 格式
const testData = {
    submissionId: 1,  // 假設第一個報名記錄
    traceId: 'MICE-TEST-001'
};

async function generateQRCode() {
    try {
        console.log('🎯 生成測試報到 QR Code...');
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
    <title>測試報到 QR Code</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft JhengHei', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 600px;
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
        
        .qr-wrapper {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            display: inline-block;
        }
        
        .qr-code {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .info-box {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin: 20px 0;
            text-align: left;
            border-radius: 5px;
        }
        
        .info-box h3 {
            color: #1976d2;
            margin-bottom: 10px;
            font-size: 18px;
        }
        
        .info-box p {
            color: #555;
            line-height: 1.6;
            margin: 5px 0;
        }
        
        .instructions {
            background: #fff3e0;
            border-left: 4px solid #ff9800;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
            border-radius: 5px;
        }
        
        .instructions h3 {
            color: #f57c00;
            margin-bottom: 15px;
            font-size: 18px;
        }
        
        .instructions ol {
            margin-left: 20px;
            color: #555;
        }
        
        .instructions li {
            margin: 10px 0;
            line-height: 1.6;
        }
        
        .instructions code {
            background: #fff;
            padding: 2px 8px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            color: #d32f2f;
            font-size: 14px;
        }
        
        .copy-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 40px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        
        .copy-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        
        .copy-btn:active {
            transform: translateY(0);
        }
        
        #jsonData {
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            color: #333;
            word-break: break-all;
            text-align: left;
        }
        
        .badge {
            display: inline-block;
            background: #4caf50;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎫 測試報到 QR Code</h1>
        <p class="subtitle">用於測試 Webcam 掃描器報到功能</p>
        <span class="badge">✅ 測試環境</span>
        
        <div class="qr-wrapper">
            <img src="${qrCodeBase64}" alt="報到 QR Code" class="qr-code">
        </div>
        
        <div class="info-box">
            <h3>📋 QR Code 資訊</h3>
            <p><strong>Submission ID:</strong> ${testData.submissionId}</p>
            <p><strong>Trace ID:</strong> ${testData.traceId}</p>
            <p><strong>用途:</strong> 報到掃描測試</p>
        </div>
        
        <div class="instructions">
            <h3>📱 測試步驟</h3>
            <ol>
                <li>開啟報到管理頁面: <code>http://localhost:3000/admin/checkin-management</code></li>
                <li>點擊「Webcam 掃描器」按鈕</li>
                <li>使用 webcam 掃描上方 QR Code</li>
                <li>或直接複製下方 JSON 資料貼到掃描頁面</li>
                <li>驗證報到是否成功</li>
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
        const outputPath = path.join(__dirname, '../../test-checkin-qrcode.html');
        fs.writeFileSync(outputPath, html, 'utf8');

        console.log('✅ 報到 QR Code HTML 已生成！');
        console.log('📁 檔案位置:', outputPath);
        console.log('🌐 請在瀏覽器開啟:', `file://${outputPath}`);
        console.log('\n📋 QR Code 包含的資料:');
        console.log(qrCodeData);
        console.log('\n🎯 下一步:');
        console.log('1. 在瀏覽器開啟上述 HTML 檔案');
        console.log('2. 啟動伺服器: cd server && npm run dev');
        console.log('3. 開啟報到管理: http://localhost:3000/admin/checkin-management');
        console.log('4. 點擊「Webcam 掃描器」按鈕');
        console.log('5. 使用 webcam 掃描 QR Code 或複製 JSON 資料');

    } catch (error) {
        console.error('❌ 生成 QR Code 失敗:', error);
        process.exit(1);
    }
}

generateQRCode();

