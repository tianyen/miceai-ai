const { resolveApiV1BaseUrl } = require('./utils/api-base-url');
const API_URL = resolveApiV1BaseUrl();
const EVENT_ID = 1;

async function testBatchRegistration() {
    try {
        console.log('🚀 開始測試團體報名 API...');

        const payload = {
            primaryParticipant: {
                name: "團體主報名人",
                email: `leader_${Date.now()}@test.com`,
                phone: "0911111111",
                data_consent: true,
                marketing_consent: true,
                company: "測試集團",
                position: "領隊"
            },
            participants: [
                {
                    name: "同行者A",
                    phone: "0922222222"
                },
                {
                    name: "同行者B",
                    email: `member_b_${Date.now()}@test.com`,
                    phone: "0933333333"
                }
            ]
        };

        console.log('📦 發送 payload:', JSON.stringify(payload, null, 2));

        const response = await fetch(`${API_URL}/events/${EVENT_ID}/registrations/batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (response.ok && data.success) {
            const { groupId, registrations } = data.data;
            console.log(`\n✅ 報名成功！`);
            console.log(`🏷️  Group ID: ${groupId}`);
            console.log(`👥 總人數: ${registrations.length}`);
            
            registrations.forEach((reg, index) => {
                console.log(`   ${index + 1}. ${reg.name} (${reg.isPrimary ? '主' : '從'}) - Trace: ${reg.traceId}`);
            });
        } else {
            console.error('❌ 報名失敗');
        }

    } catch (error) {
        console.error('❌ 測試發生錯誤:', error);
    }
}

testBatchRegistration();
