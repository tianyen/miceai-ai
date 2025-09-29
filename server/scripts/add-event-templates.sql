-- 添加活動模板數據

-- 科技論壇活動模板
INSERT INTO invitation_templates (
    template_name, 
    template_type, 
    template_content, 
    is_default, 
    created_by
) VALUES (
    '科技論壇活動模板',
    'event',
    '{"schedule":{"type":"single_day","date":"2024-12-15","sessions":[{"time":"09:00-09:30","title":"報到與茶點","speaker":"","location":"大廳"},{"time":"09:30-10:30","title":"開幕致詞","speaker":"主辦單位","location":"主會場"},{"time":"10:30-12:00","title":"主題演講：科技趨勢展望","speaker":"專業講師","location":"主會場"},{"time":"12:00-13:30","title":"午餐時間","speaker":"","location":"餐廳"},{"time":"13:30-15:00","title":"分組討論","speaker":"各組主持人","location":"分會場"},{"time":"15:00-15:30","title":"茶點時間","speaker":"","location":"大廳"},{"time":"15:30-17:00","title":"綜合座談","speaker":"全體與會者","location":"主會場"},{"time":"17:00-17:30","title":"閉幕與合影","speaker":"","location":"主會場"}]},"introduction":"本次科技論壇旨在探討最新的科技趨勢，邀請業界專家分享經驗，促進產學交流與合作。活動將涵蓋人工智慧、區塊鏈、物聯網等熱門議題，為參與者提供豐富的學習機會。","process":[{"step":1,"title":"線上報名","description":"填寫報名表單，提供基本資料","duration":"即日起至活動前一週"},{"step":2,"title":"報名確認","description":"收到確認信件及 QR Code","duration":"報名後 24 小時內"},{"step":3,"title":"活動當日報到","description":"出示 QR Code 完成報到手續","duration":"活動當日 09:00-09:30"},{"step":4,"title":"參與活動","description":"依照時程表參與各項議程","duration":"09:30-17:30"},{"step":5,"title":"問卷填寫","description":"活動結束後填寫滿意度問卷","duration":"活動結束後一週內"}],"additional_info":{"dress_code":"商務休閒","parking":"會場提供免費停車位，數量有限，建議搭乘大眾運輸","materials":"會場提供筆記本、筆及相關資料","networking":"活動期間安排茶點時間，歡迎與會者交流","certificates":"全程參與者將獲得研習證書","contact":"如有任何問題，請聯繫主辦單位"}}',
    0,
    1
);

-- 研討會活動模板
INSERT INTO invitation_templates (
    template_name, 
    template_type, 
    template_content, 
    is_default, 
    created_by
) VALUES (
    '研討會活動模板',
    'event',
    '{"schedule":{"type":"single_day","date":"2024-11-30","sessions":[{"time":"08:30-09:00","title":"報到","speaker":"","location":"接待處"},{"time":"09:00-09:15","title":"開場致詞","speaker":"主辦單位","location":"會議室 A"},{"time":"09:15-10:45","title":"專題演講","speaker":"主講人","location":"會議室 A"},{"time":"10:45-11:00","title":"休息時間","speaker":"","location":"休息區"},{"time":"11:00-12:30","title":"小組討論","speaker":"各組主持人","location":"分組會議室"},{"time":"12:30-13:30","title":"午餐","speaker":"","location":"餐廳"},{"time":"13:30-15:00","title":"案例分享","speaker":"業界專家","location":"會議室 A"},{"time":"15:00-15:15","title":"茶點時間","speaker":"","location":"休息區"},{"time":"15:15-16:30","title":"綜合討論","speaker":"全體參與者","location":"會議室 A"},{"time":"16:30-17:00","title":"總結與閉幕","speaker":"主辦單位","location":"會議室 A"}]},"introduction":"本研討會專注於特定領域的深度探討，邀請專家學者分享最新研究成果與實務經驗，促進學術與產業的交流合作。","process":[{"step":1,"title":"報名申請","description":"線上填寫報名資料","duration":"開放報名期間"},{"step":2,"title":"資格審核","description":"主辦單位審核報名資格","duration":"報名截止後 3 個工作日"},{"step":3,"title":"錄取通知","description":"發送錄取通知及相關資訊","duration":"審核完成後 2 個工作日"},{"step":4,"title":"活動參與","description":"按時出席並積極參與討論","duration":"活動當日"},{"step":5,"title":"後續追蹤","description":"填寫回饋問卷及後續聯繫","duration":"活動結束後"}],"additional_info":{"target_audience":"相關領域專業人士、研究人員、學生","prerequisites":"具備基礎專業知識","materials":"會前提供相關資料，請事先閱讀","interaction":"鼓勵提問與討論","follow_up":"會後提供簡報資料及聯絡方式"}}',
    0,
    1
);

-- 工作坊活動模板
INSERT INTO invitation_templates (
    template_name, 
    template_type, 
    template_content, 
    is_default, 
    created_by
) VALUES (
    '工作坊活動模板',
    'event',
    '{"schedule":{"type":"single_day","date":"2024-11-20","sessions":[{"time":"09:00-09:30","title":"報到與歡迎","speaker":"","location":"工作坊教室"},{"time":"09:30-10:00","title":"開場與介紹","speaker":"講師","location":"工作坊教室"},{"time":"10:00-11:30","title":"理論講解","speaker":"主講師","location":"工作坊教室"},{"time":"11:30-11:45","title":"休息時間","speaker":"","location":"休息區"},{"time":"11:45-12:30","title":"實作練習 (第一部分)","speaker":"講師團隊","location":"工作坊教室"},{"time":"12:30-13:30","title":"午餐時間","speaker":"","location":"餐廳"},{"time":"13:30-15:00","title":"實作練習 (第二部分)","speaker":"講師團隊","location":"工作坊教室"},{"time":"15:00-15:15","title":"茶點時間","speaker":"","location":"休息區"},{"time":"15:15-16:30","title":"成果展示與討論","speaker":"全體學員","location":"工作坊教室"},{"time":"16:30-17:00","title":"總結與回饋","speaker":"講師","location":"工作坊教室"}]},"introduction":"本工作坊採用理論與實作並重的方式，讓參與者透過動手操作深入理解相關技能，適合希望快速上手的學習者。","process":[{"step":1,"title":"報名登記","description":"填寫報名表並繳交費用","duration":"報名開放期間"},{"step":2,"title":"行前準備","description":"收到行前通知及準備事項","duration":"活動前一週"},{"step":3,"title":"工作坊參與","description":"全程參與理論講解與實作練習","duration":"活動當日"},{"step":4,"title":"作品完成","description":"完成指定作品或練習","duration":"活動期間"},{"step":5,"title":"證書頒發","description":"獲得完成證書","duration":"活動結束時"}],"additional_info":{"class_size":"限額 20 人，小班教學","equipment":"會場提供電腦及相關設備","bring_items":"請攜帶筆記本及個人用品","skill_level":"適合初學者至中級程度","certification":"完成者將獲得參與證書","support":"課後提供線上支援"}}',
    0,
    1
);

-- 更新現有專案的模板關聯
UPDATE invitation_projects SET template_id = 3 WHERE project_name = '2024年度科技論壇';
UPDATE invitation_projects SET template_id = 4 WHERE project_name = '企業數位轉型研討會';
UPDATE invitation_projects SET template_id = 5 WHERE project_name = 'AI產業交流會';
