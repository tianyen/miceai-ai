/**
 * 名片展示頁面路由
 * 用於 QR Code 掃描後顯示名片資訊
 */

const express = require('express');
const router = express.Router();
const database = require('../config/database');

/**
 * 顯示名片頁面
 * GET /business-card/:cardId
 */
router.get('/:cardId', async (req, res) => {
    try {
        const { cardId } = req.params;
        
        // 查詢名片資料
        const card = await database.get(`
            SELECT
                bc.*,
                ip.project_name,
                ip.event_date,
                ip.event_location
            FROM business_cards bc
            LEFT JOIN event_projects ip ON bc.project_id = ip.id
            WHERE bc.card_id = ? AND bc.is_active = 1
        `, [cardId]);
        
        if (!card) {
            return res.status(404).render('error', {
                title: '名片不存在',
                message: '找不到此名片或名片已停用',
                layout: 'main'
            });
        }
        
        // 更新掃描統計
        await database.run(`
            UPDATE business_cards 
            SET scan_count = scan_count + 1, 
                last_scanned_at = CURRENT_TIMESTAMP 
            WHERE card_id = ?
        `, [cardId]);
        
        // 格式化名片資料
        const cardData = {
            card_id: card.card_id,
            name: card.name,
            title: card.title,
            company: card.company,
            contact_info: {
                phone: card.phone,
                email: card.email,
                address: card.address,
                website: card.website
            },
            social_media: {
                linkedin: card.linkedin,
                wechat: card.wechat,
                facebook: card.facebook,
                twitter: card.twitter,
                instagram: card.instagram
            },
            project: {
                name: card.project_name,
                event_date: card.event_date,
                location: card.event_location
            },
            scan_count: card.scan_count + 1,
            created_at: card.created_at
        };
        
        // 渲染名片頁面
        res.render('business-card', {
            title: `${card.name} - 數位名片`,
            card: cardData,
            layout: 'business-card'
        });
        
    } catch (error) {
        console.error('獲取名片失敗:', error);
        res.status(500).render('error', {
            title: '系統錯誤',
            message: '無法載入名片資訊，請稍後再試',
            layout: 'main'
        });
    }
});



module.exports = router;
