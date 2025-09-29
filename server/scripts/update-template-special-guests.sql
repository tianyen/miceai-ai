-- 更新科技論壇活動模板，添加特別嘉賓欄位

UPDATE invitation_templates 
SET template_content = '{
    "schedule": {
        "type": "single_day",
        "sessions": [
            {
                "time": "09:00-09:30",
                "title": "報到與茶點",
                "speaker": "",
                "location": "大廳"
            },
            {
                "time": "09:30-10:30",
                "title": "開幕致詞",
                "speaker": "主辦單位",
                "location": "主會場"
            },
            {
                "time": "10:30-12:00",
                "title": "主題演講：科技趨勢展望",
                "speaker": "專業講師",
                "location": "主會場"
            },
            {
                "time": "13:30-14:30",
                "title": "AI 的未來發展",
                "speaker": "張科技博士",
                "location": "主會場"
            },
            {
                "time": "14:30-15:30",
                "title": "企業數位轉型實務分享",
                "speaker": "李創新女士",
                "location": "主會場"
            }
        ]
    },
    "introduction": "本次科技論壇旨在探討最新的科技趨勢，邀請業界專家分享經驗，促進產學交流與合作。我們特別邀請了多位重量級嘉賓，分享他們在各自領域的深度見解。",
    "process": [
        {
            "step": 1,
            "title": "線上報名",
            "description": "填寫報名表單，提供基本資料",
            "duration": "即日起至活動前一週"
        },
        {
            "step": 2,
            "title": "報名確認",
            "description": "收到確認信件及 QR Code",
            "duration": "報名後 24 小時內"
        },
        {
            "step": 3,
            "title": "活動當天",
            "description": "憑 QR Code 報到參加活動",
            "duration": "活動當天 09:00 開始"
        }
    ],
    "special_guests": [
        {
            "name": "張科技博士",
            "title": "AI 研究院院長",
            "company": "台灣科技大學",
            "bio": "專精於人工智慧與機器學習領域，擁有 20 年研究經驗，發表超過 100 篇國際期刊論文",
            "photo_url": "/images/guests/zhang-tech.jpg",
            "session": "AI 的未來發展",
            "expertise": ["人工智慧", "機器學習", "深度學習"]
        },
        {
            "name": "李創新女士",
            "title": "技術長",
            "company": "創新科技股份有限公司",
            "bio": "致力於推動企業數位轉型，曾獲得多項創新獎項，協助超過 50 家企業成功轉型",
            "photo_url": "/images/guests/lee-innovation.jpg",
            "session": "企業數位轉型實務分享",
            "expertise": ["數位轉型", "企業創新", "技術管理"]
        },
        {
            "name": "王區塊先生",
            "title": "區塊鏈技術專家",
            "company": "未來金融科技公司",
            "bio": "區塊鏈技術先驅，參與多個大型區塊鏈專案開發，擁有豐富的實務經驗",
            "photo_url": "/images/guests/wang-blockchain.jpg",
            "session": "區塊鏈技術應用與趨勢",
            "expertise": ["區塊鏈", "加密貨幣", "金融科技"]
        }
    ],
    "additional_info": {
        "dress_code": "商務休閒",
        "parking": "會場提供免費停車位，數量有限，建議搭乘大眾運輸",
        "materials": "會場提供筆記本、筆及相關資料",
        "certificates": "全程參與者將獲得研習證書",
        "networking": "活動結束後將有茶點交流時間，歡迎與講師及其他參與者交流",
        "target_audience": "科技業從業人員、學者、學生、對科技趨勢有興趣者",
        "prerequisites": "無特殊要求，歡迎對科技趨勢有興趣者參加",
        "interaction": "現場提供 Q&A 時間，歡迎踴躍提問",
        "follow_up": "會後提供簡報資料及講師聯絡方式"
    }
}',
updated_at = CURRENT_TIMESTAMP
WHERE template_name = '科技論壇活動模板';

-- 驗證更新結果
SELECT id, template_name, updated_at FROM invitation_templates WHERE template_name = '科技論壇活動模板';
