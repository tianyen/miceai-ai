/**
 * 生成許願樹 QR Code
 * 用於讓參與者掃描進入許願樹頁面
 */

const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// 許願樹 URL
const WISH_TREE_URL = 'https://tianyen-service.com:4037/openingpic/2_light0.html';

async function generateWishTreeQRCode() {
    try {
        console.log('🎯 生成許願樹 QR Code...');
        console.log('📋 URL:', WISH_TREE_URL);

        // 生成 QR Code Base64
        const qrCodeBase64 = await QRCode.toDataURL(WISH_TREE_URL, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 600,
            margin: 2,
            color: {
                dark: '#1a1a1a',
                light: '#ffffff'
            }
        });

        // 生成 HTML 檔案
        const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>資訊月互動許願樹 - QR Code</title>
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
            max-width: 600px;
            width: 100%;
            text-align: center;
        }

        .header {
            margin-bottom: 30px;
        }

        h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 10px;
            font-weight: 700;
        }

        .subtitle {
            color: #666;
            font-size: 16px;
            margin-bottom: 20px;
        }

        .qr-container {
            background: #f5f5f5;
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
            display: inline-block;
        }

        .qr-code {
            max-width: 100%;
            height: auto;
            border-radius: 10px;
        }

        .info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-top: 20px;
        }

        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
        }

        .info-item:last-child {
            border-bottom: none;
        }

        .info-label {
            font-weight: 600;
            color: #555;
        }

        .info-value {
            color: #333;
        }

        .instructions {
            background: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 10px;
            padding: 20px;
            margin-top: 20px;
            text-align: left;
        }

        .instructions h3 {
            color: #856404;
            margin-bottom: 15px;
            font-size: 18px;
        }

        .instructions ol {
            padding-left: 20px;
            color: #856404;
        }

        .instructions li {
            margin-bottom: 10px;
            line-height: 1.6;
        }

        .footer {
            margin-top: 30px;
            color: #999;
            font-size: 14px;
        }

        @media print {
            body {
                background: white;
            }

            .container {
                box-shadow: none;
                max-width: 100%;
            }
        }

        .print-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 20px;
            transition: background 0.3s;
        }

        .print-btn:hover {
            background: #5568d3;
        }

        @media print {
            .print-btn {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌳 資訊月互動許願樹</h1>
            <p class="subtitle">掃描 QR Code 開始許願</p>
        </div>

        <div class="qr-container">
            <img src="${qrCodeBase64}" alt="許願樹 QR Code" class="qr-code">
        </div>

        <div class="info">
            <div class="info-item">
                <span class="info-label">📱 活動名稱</span>
                <span class="info-value">資訊月互動許願樹</span>
            </div>
            <div class="info-item">
                <span class="info-label">📍 攤位</span>
                <span class="info-value">主舞台</span>
            </div>
            <div class="info-item">
                <span class="info-label">🔗 網址</span>
                <span class="info-value" style="font-size: 12px; word-break: break-all;">${WISH_TREE_URL}</span>
            </div>
            <div class="info-item">
                <span class="info-label">🎫 專案 ID</span>
                <span class="info-value">5</span>
            </div>
        </div>

        <div class="instructions">
            <h3>📖 使用說明</h3>
            <ol>
                <li>使用手機掃描上方 QR Code</li>
                <li>進入許願樹頁面</li>
                <li>填寫您的願望文字</li>
                <li>點擊「許願」按鈕</li>
                <li>觀看您的願望燈籠飄向天空 ✨</li>
            </ol>
        </div>

        <button class="print-btn" onclick="window.print()">🖨️ 列印 QR Code</button>

        <div class="footer">
            生成時間: ${new Date().toLocaleString('zh-TW')}
        </div>
    </div>
</body>
</html>`;

        // 確保 public 目錄存在
        const publicDir = path.join(__dirname, '../public');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }

        // 寫入 HTML 文件
        const outputPath = path.join(publicDir, 'wish-tree-qrcode.html');
        fs.writeFileSync(outputPath, html, 'utf8');

        console.log('✅ QR Code 生成成功！');
        console.log('📄 HTML 檔案:', outputPath);

    } catch (error) {
        console.error('❌ 生成 QR Code 失敗:', error);
        process.exit(1);
    }
}

// 執行生成
generateWishTreeQRCode();
