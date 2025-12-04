/**
 * 名片展示頁面路由
 * 用於 QR Code 掃描後顯示名片資訊
 *
 * @refactor 2025-12-04: 使用 Repository 層
 */

const express = require('express');
const router = express.Router();
const businessCardRepository = require('../repositories/business-card.repository');

/**
 * 顯示名片頁面
 * GET /business-card/:cardId
 */
router.get('/:cardId', async (req, res) => {
    try {
        const { cardId } = req.params;
        
        // 使用 Repository 查詢名片資料
        const card = await businessCardRepository.findByCardIdWithProject(cardId);
        
        if (!card) {
            return res.status(404).render('error', {
                title: '名片不存在',
                message: '找不到此名片或名片已停用',
                layout: 'main'
            });
        }
        
        // 使用 Repository 更新掃描統計
        await businessCardRepository.incrementScanCount(cardId);
        
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
