/**
 * 重新生成專案遊戲的 QR Code
 */
const QRCode = require('qrcode');
const database = require('../config/database');
const config = require('../config');

async function regenerateQRCode(bindingId) {
    try {
        const binding = await database.get(`
            SELECT 
                pg.id,
                pg.game_id,
                pg.project_id,
                g.game_name_zh,
                g.game_url,
                p.project_code
            FROM project_games pg
            LEFT JOIN games g ON pg.game_id = g.id
            LEFT JOIN event_projects p ON pg.project_id = p.id
            WHERE pg.id = ?
        `, [bindingId]);

        if (!binding) {
            console.error('❌ 找不到綁定 ID:', bindingId);
            process.exit(1);
        }

        const qrData = {
            type: 'game',
            project_id: binding.project_id,
            project_code: binding.project_code,
            game_id: binding.game_id,
            game_name: binding.game_name_zh,
            binding_id: binding.id,
            game_url: binding.game_url
        };

        const qrCodeUrl = `${config.app.baseUrl}/api/v1/game/start?data=${encodeURIComponent(JSON.stringify(qrData))}`;
        const qrCodeBase64 = await QRCode.toDataURL(qrCodeUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        await database.run(`
            UPDATE project_games
            SET qr_code_base64 = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [qrCodeBase64, bindingId]);

        console.log('✅ QR Code 已重新生成');
        console.log('綁定 ID:', bindingId);
        console.log('遊戲名稱:', binding.game_name_zh);
        console.log('專案代碼:', binding.project_code);
        console.log('QR Code URL:', qrCodeUrl);
        console.log('Base64 長度:', qrCodeBase64.length);

        return true;
    } catch (error) {
        console.error('❌ 重新生成 QR Code 失敗:', error);
        throw error;
    }
}

// 從命令列參數獲取綁定 ID，或重新生成所有
const bindingId = process.argv[2];

if (bindingId === 'all') {
    // 重新生成所有綁定的 QR Code
    (async () => {
        try {
            const bindings = await database.query('SELECT id FROM project_games');
            console.log(`🔄 找到 ${bindings.length} 個遊戲綁定`);

            for (const binding of bindings) {
                try {
                    await regenerateQRCode(binding.id);
                    console.log('---');
                } catch (error) {
                    console.error(`❌ 綁定 ID ${binding.id} 失敗:`, error.message);
                }
            }

            console.log('✅ 所有 QR Code 已重新生成');
            process.exit(0);
        } catch (error) {
            console.error('❌ 批次重新生成失敗:', error);
            process.exit(1);
        }
    })();
} else {
    regenerateQRCode(bindingId || 1)
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('錯誤:', error);
            process.exit(1);
        });
}

