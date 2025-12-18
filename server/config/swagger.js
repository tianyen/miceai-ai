/**
 * Swagger 配置文件
 * API 文件生成配置
 */
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const config = require('./index');

// Swagger 基本配置
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: config.swagger.title,
    version: config.swagger.version,
    description: config.swagger.description + '\n\n' +
      '## 📋 快速開始\n\n' +
      '### 1. 初始化測試環境\n\n' +
      '```bash\n' +
      'npm run setup  # 重置資料庫並載入測試資料\n' +
      'npm start      # 啟動開發服務器\n' +
      '```\n\n' +
      '### 2. 測試帳號\n\n' +
      '| 角色 | 帳號 | 密碼 |\n' +
      '|------|------|------|\n' +
      '| 超級管理員 | `admin` | `Admin1qa` |\n' +
      '| 專案管理員 | `manager` | `Mngr2wsX` |\n' +
      '| 項目用戶 | `user` | `User3edC` |\n' +
      '| 廠商用戶 | `vendor` | `Vndr4rfV` |\n\n' +
      '### 3. 測試專案\n\n' +
      '| ID | 專案代碼 | 名稱 | 狀態 | 日期 |\n' +
      '|----|----------|------|------|------|\n' +
      '| 1 | `TECH2024` | 2024 資訊月互動許願樹 | 已完成 | 2024-12-01 ~ 12-03 |\n' +
      '| 2 | `MOON2025` | 平安夜公益活動X沉浸式露天電影院 | 進行中 | 2025-12-24 |\n\n' +
      '---\n\n' +
      '## 📝 報名 API 完整教學\n\n' +
      '### 報名欄位說明\n\n' +
      '| 欄位 | 類型 | 必填 | 說明 | 範例 |\n' +
      '|------|------|:----:|------|------|\n' +
      '| `name` | string | ✅ | 姓名 (2-50字) | `"王大明"` |\n' +
      '| `email` | string | ✅ | 電子郵件 | `"wang@example.com"` |\n' +
      '| `phone` | string | ✅ | 手機號碼 (8-20字) | `"0912345678"` |\n' +
      '| `data_consent` | boolean | ✅ | 資料使用同意 (必須為 true) | `true` |\n' +
      '| `company` | string | ⭕ | 公司名稱 (最多100字) | `"ABC科技公司"` |\n' +
      '| `position` | string | ⭕ | 職位 (最多50字) | `"工程師"` |\n' +
      '| `gender` | string | ⭕ | 性別 | `"男"` / `"女"` / `"其他"` |\n' +
      '| `title` | string | ⭕ | 尊稱 | `"先生"` / `"女士"` / `"博士"` / `"教授"` |\n' +
      '| `notes` | string | ⭕ | 留言備註 (最多500字) | `"需要素食餐點"` |\n' +
      '| `marketing_consent` | boolean | ⭕ | 行銷推廣同意 | `false` |\n' +
      '| `adult_age` | integer | ⭕ | 成人年齡 (18-120) | `35` |\n' +
      '| `children_ages` | object | ⭕ | 小孩年齡區間人數 | `{ "age_0_6": 1, "age_6_12": 2, "age_12_18": 0 }` |\n\n' +
      '---\n\n' +
      '### 方式一：單人報名\n\n' +
      '**端點：** `POST /api/v1/events/{eventId}/registrations`\n\n' +
      '```javascript\n' +
      '// 步驟 1：查詢活動 ID\n' +
      'const eventRes = await fetch(\'/api/v1/events/code/TECH2024\');\n' +
      'const { data: event } = await eventRes.json();\n' +
      'const eventId = event.id;  // 獲取活動 ID\n\n' +
      '// 步驟 2：提交報名\n' +
      'const response = await fetch(`/api/v1/events/${eventId}/registrations`, {\n' +
      '  method: \'POST\',\n' +
      '  headers: { \'Content-Type\': \'application/json\' },\n' +
      '  body: JSON.stringify({\n' +
      '    // ✅ 必填欄位\n' +
      '    name: \'王大明\',\n' +
      '    email: \'wang@example.com\',\n' +
      '    phone: \'0912345678\',\n' +
      '    data_consent: true,\n' +
      '    // ⭕ 選填欄位\n' +
      '    company: \'科技公司\',\n' +
      '    position: \'工程師\',\n' +
      '    gender: \'男\',\n' +
      '    title: \'先生\',\n' +
      '    notes: \'需要素食餐點\',\n' +
      '    marketing_consent: false,\n' +
      '    adult_age: 35,\n' +
      '    children_ages: { age_0_6: 1, age_6_12: 2, age_12_18: 0 }  // 0-6歲1人, 6-12歲2人\n' +
      '  })\n' +
      '});\n\n' +
      '// 步驟 3：處理回應\n' +
      'const result = await response.json();\n' +
      'if (result.success) {\n' +
      '  const { trace_id, user_id, pass_code, qr_code } = result.data;\n' +
      '  console.log(\'報名成功！\', { trace_id, user_id, pass_code });\n' +
      '  // 顯示 QR Code：document.getElementById(\'qr\').src = qr_code.base64;\n' +
      '}\n' +
      '```\n\n' +
      '---\n\n' +
      '### 方式二：團體報名 (最多 5 人)\n\n' +
      '**端點：** `POST /api/v1/events/{eventId}/registrations/batch`\n\n' +
      '```javascript\n' +
      'const response = await fetch(`/api/v1/events/${eventId}/registrations/batch`, {\n' +
      '  method: \'POST\',\n' +
      '  headers: { \'Content-Type\': \'application/json\' },\n' +
      '  body: JSON.stringify({\n' +
      '    // 主報名人\n' +
      '    primaryParticipant: {\n' +
      '      // ✅ 必填\n' +
      '      name: \'王大明\',\n' +
      '      email: \'wang@example.com\',\n' +
      '      phone: \'0912345678\',\n' +
      '      data_consent: true,\n' +
      '      // ⭕ 選填\n' +
      '      company: \'ABC 科技公司\',\n' +
      '      position: \'經理\',\n' +
      '      gender: \'男\',\n' +
      '      title: \'先生\',\n' +
      '      notes: \'團體報名\',\n' +
      '      marketing_consent: false,\n' +
      '      adult_age: 40,\n' +
      '      children_ages: { age_0_6: 0, age_6_12: 1, age_12_18: 0 }  // 6-12歲1人\n' +
      '    },\n' +
      '    // 同行者 (最多 4 人)\n' +
      '    participants: [\n' +
      '      {\n' +
      '        name: \'李小華\',           // ✅ 必填\n' +
      '        // ⭕ 以下皆選填\n' +
      '        email: \'li@example.com\', // 空白則使用主報名人 Email\n' +
      '        phone: \'0987654321\',\n' +
      '        company: \'ABC 科技公司\',\n' +
      '        position: \'工程師\',\n' +
      '        gender: \'女\',\n' +
      '        title: \'女士\'\n' +
      '      },\n' +
      '      { name: \'張三\' }  // 最簡形式：只需 name\n' +
      '    ]\n' +
      '  })\n' +
      '});\n\n' +
      'const result = await response.json();\n' +
      'if (result.success) {\n' +
      '  console.log(`團體報名成功！共 ${result.data.count} 人`);\n' +
      '  console.log(\'Group ID:\', result.data.groupId);\n' +
      '  result.data.registrations.forEach(r => {\n' +
      '    console.log(`${r.name}: trace_id=${r.trace_id}, user_id=${r.user_id}`);\n' +
      '  });\n' +
      '}\n' +
      '```\n\n' +
      '---\n\n' +
      '### 報名後續操作\n\n' +
      '| 操作 | 端點 | 說明 |\n' +
      '|------|------|------|\n' +
      '| 查詢報名狀態 | `GET /api/v1/registrations/{traceId}` | 取得報名詳情、QR Code、報到狀態 |\n' +
      '| 取得 QR Code 圖片 | `GET /api/v1/qr-codes/{traceId}` | 直接返回 PNG 圖片 |\n' +
      '| 取得 QR Code Base64 | `GET /api/v1/qr-codes/{traceId}/data` | 返回 Base64 編碼 |\n' +
      '| 重寄邀請信 | `POST /api/v1/registrations/{traceId}/resend-email` | 重新發送確認郵件 |\n' +
      '| 驗證通行碼 | `POST /api/v1/verify-pass-code` | 用 6 位數通行碼恢復 trace_id |\n\n' +
      '---\n\n' +
      '### 4. 完整串接流程\n\n' +
      '```\n' +
      '1. GET /api/v1/events/code/{projectCode} → 取得活動資訊和 eventId\n' +
      '2. POST /api/v1/events/{eventId}/registrations → 報名取得 trace_id、user_id\n' +
      '   或 POST /api/v1/events/{eventId}/registrations/batch → 團體報名\n' +
      '3. POST /api/v1/games/{gameId}/start → 開始遊戲 (傳入 user_id)\n' +
      '4. POST /api/v1/games/{gameId}/end → 結束遊戲取得兌換券 QR Code\n' +
      '```\n\n' +
      '---\n\n' +
      '**注意事項：**\n' +
      '- 本文件僅包含前端串接使用的 API v1 路由（`/api/v1/`）\n' +
      '- 後台管理功能位於 `/admin/` 路由，需登入驗證\n' +
      '- 所有 API 回應格式：`{ success: true/false, message, data/error }`',
  },
  servers: [
    {
      url: config.app.baseUrl,
      description: '開發環境'
    },
    {
      url: config.app.productionDomain,
      description: '生產環境'
    }
  ],
  components: {
    securitySchemes: {
      sessionAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'connect.sid',
        description: '基於 session 的認證，需要管理員登入'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          message: {
            type: 'string',
            example: '錯誤訊息'
          },
          error: {
            type: 'string',
            example: '詳細錯誤資訊'
          }
        }
      },
      Success: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          message: {
            type: 'string',
            example: '操作成功'
          },
          data: {
            type: 'object',
            description: '回傳資料'
          }
        }
      },
      BusinessCard: {
        type: 'object',
        properties: {
          card_id: { type: 'string', example: 'BCMG5FIQ3PAD7036' },
          project_id: { type: 'integer', example: 1 },
          project_name: { type: 'string', example: '2024年度科技論壇' },
          name: { type: 'string', example: '資料庫測試' },
          title: { type: 'string', example: '測試工程師' },
          company: { type: 'string', example: 'MICE AI' },
          contact_info: {
            type: 'object',
            properties: {
              phone: { type: 'string', example: '0900-000-000' },
              email: { type: 'string', example: 'db-test@mice-ai.com' },
              address: { type: 'string', example: '台北市信義區信義路五段7號' },
              website: { type: 'string', example: 'https://techcompany.com' }
            }
          },
          social_media: {
            type: 'object',
            properties: {
              linkedin: { type: 'string', example: 'https://linkedin.com/in/chang-tech' },
              wechat: { type: 'string', example: 'chang_tech_2024' },
              facebook: { type: 'string', nullable: true, example: null },
              twitter: { type: 'string', nullable: true, example: null },
              instagram: { type: 'string', nullable: true, example: null }
            }
          },
          qr_code: {
            type: 'object',
            properties: {
              base64: { type: 'string', example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...' },
              data: { type: 'string', example: `${config.app.baseUrl}/business-card/BCMG5FIQ3PAD7036` }
            }
          },
          created_at: { type: 'string', format: 'date-time', example: '2025-09-29T09:30:00.000Z' }
        }
      },
      BusinessCardDetail: {
        allOf: [
          { $ref: '#/components/schemas/BusinessCard' },
          {
            type: 'object',
            properties: {
              statistics: {
                type: 'object',
                properties: {
                  scan_count: { type: 'integer', example: 6 },
                  last_scanned_at: { type: 'string', format: 'date-time', example: '2025-09-29T09:31:00.000Z' }
                }
              }
            }
          }
        ]
      },
      BusinessCardList: {
        type: 'object',
        properties: {
          project_id: { type: 'string', example: '1' },
          project_name: { type: 'string', example: '2024年度科技論壇' },
          cards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                card_id: { type: 'string', example: 'BCMG5FIQ3PAD7036' },
                name: { type: 'string', example: '資料庫測試' },
                title: { type: 'string', example: '測試工程師' },
                company: { type: 'string', example: 'MICE AI' },
                email: { type: 'string', example: 'db-test@mice-ai.com' },
                phone: { type: 'string', example: '0900-000-000' },
                scan_count: { type: 'integer', example: 15 },
                created_at: { type: 'string', example: '2025-09-29 09:31:35' },
                is_active: { type: 'integer', example: 1 }
              }
            }
          },
          pagination: {
            type: 'object',
            properties: {
              current_page: { type: 'integer', example: 1 },
              total_pages: { type: 'integer', example: 1 },
              total_items: { type: 'integer', example: 7 },
              items_per_page: { type: 'integer', example: 20 },
              has_next: { type: 'boolean', example: false },
              has_prev: { type: 'boolean', example: false }
            }
          }
        }
      },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          project_name: { type: 'string', example: '2024 科技論壇' },
          project_code: { type: 'string', example: 'TECH2024' },
          event_start_date: { type: 'string', format: 'date', example: '2025-09-15' },
          event_end_date: { type: 'string', format: 'date', example: '2025-09-15' },
          event_location: { type: 'string', example: '台北國際會議中心' },
          contact_person: { type: 'string', example: '張經理' },
          contact_phone: { type: 'string', example: '02-12345678' },
          contact_email: { type: 'string', example: 'tech2024@example.com' },
          status: { type: 'string', enum: ['draft', 'active', 'completed', 'cancelled'], example: 'active' }
        }
      },
      Registration: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          trace_id: { type: 'string', example: 'MICE-d074dd3e-e3e27b6b0', description: '確定性生成的追蹤 ID（每次 npm run setup 都相同）' },
          project_id: { type: 'integer', example: 1 },
          user_id: { type: 'string', example: 'user123' },
          submitter_name: { type: 'string', example: '張志明' },
          submitter_email: { type: 'string', example: 'chang@example.com' },
          submitter_phone: { type: 'string', example: '0912345678' },
          company_name: { type: 'string', example: '科技創新公司' },
          position: { type: 'string', example: '技術總監' },
          adult_age: { type: 'integer', example: 35, description: '成人年齡 (18-120)' },
          children_count: { type: 'integer', example: 3, description: '小孩總人數（自動計算）' },
          children_ages: {
            type: 'object',
            properties: {
              age_0_6: { type: 'integer', example: 1, description: '0-6歲人數' },
              age_6_12: { type: 'integer', example: 2, description: '6-12歲人數' },
              age_12_18: { type: 'integer', example: 0, description: '12-18歲人數' }
            },
            example: { age_0_6: 1, age_6_12: 2, age_12_18: 0 },
            description: '小孩年齡區間人數'
          },
          status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled'], example: 'confirmed' },
          qr_code_base64: { type: 'string', example: 'data:image/png;base64,iVBORw0KG...' },
          created_at: { type: 'string', format: 'date-time', example: '2025-11-13T10:00:00.000Z' }
        }
      },
      CheckIn: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          trace_id: { type: 'string', example: 'MICE-d074dd3e-e3e27b6b0' },
          project_id: { type: 'integer', example: 1 },
          attendee_name: { type: 'string', example: '張志明' },
          company_name: { type: 'string', example: '科技創新公司' },
          phone_number: { type: 'string', example: '0912345678' },
          scanner_location: { type: 'string', example: '會場入口A' },
          checkin_time: { type: 'string', format: 'date-time', example: '2025-11-17T09:00:00.000Z' }
        }
      },
      GameSession: {
        type: 'object',
        properties: {
          session_id: { type: 'integer', example: 1 },
          game_id: { type: 'integer', example: 1 },
          trace_id: { type: 'string', example: 'MICE-d074dd3e-e3e27b6b0' },
          project_id: { type: 'integer', example: 1 },
          booth_id: { type: 'integer', example: 1 },
          user_id: { type: 'string', example: 'user123' },
          session_start: { type: 'string', format: 'date-time', example: '2025-11-18T10:00:00.000Z' },
          session_end: { type: 'string', format: 'date-time', nullable: true, example: null },
          final_score: { type: 'integer', nullable: true, example: null },
          total_play_time: { type: 'integer', nullable: true, example: null }
        }
      },
      Voucher: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          voucher_name: { type: 'string', example: '咖啡券' },
          voucher_value: { type: 'string', example: '一杯咖啡' },
          total_quantity: { type: 'integer', example: 100 },
          remaining_quantity: { type: 'integer', example: 95 },
          redemption_code: { type: 'string', example: 'GAME-2025-123456' },
          qr_code_base64: { type: 'string', example: 'data:image/png;base64,iVBORw0KG...' }
        }
      },
      TestData: {
        type: 'object',
        description: '測試資料快速參考（執行 npm run setup 後可用）',
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer', example: 1 },
                username: { type: 'string', example: 'admin' },
                password: { type: 'string', example: 'Admin1qa' },
                role: { type: 'string', example: 'super_admin' }
              }
            },
            example: [
              { id: 1, username: 'admin', password: 'Admin1qa', role: 'super_admin' },
              { id: 2, username: 'manager', password: 'Mngr2wsX', role: 'project_manager' },
              { id: 3, username: 'user', password: 'User3edC', role: 'project_user' },
              { id: 4, username: 'vendor', password: 'Vndr4rfV', role: 'vendor' }
            ]
          },
          events: {
            type: 'array',
            items: { $ref: '#/components/schemas/Event' },
            example: [
              { id: 1, project_code: 'TECH2024', project_name: '2024 資訊月互動許願樹', status: 'completed', date: '2024-12-01 ~ 12-03' },
              { id: 2, project_code: 'MOON2025', project_name: '平安夜公益活動X沉浸式露天電影院', status: 'active', date: '2025-12-24' }
            ]
          },
          booths: {
            type: 'array',
            description: '攤位資料',
            items: { type: 'object' },
            example: [
              { id: 1, project_id: 1, booth_code: 'BOOTH-A1', booth_name: 'A區攤位' },
              { id: 2, project_id: 1, booth_code: 'BOOTH-B1', booth_name: 'B區攤位' },
              { id: 3, project_id: 2, booth_code: 'MOON-B1', booth_name: 'B1戶外空地' }
            ]
          }
        }
      }
    }
  }
};

// Swagger 選項配置
const options = {
  swaggerDefinition,
  // 掃描包含 Swagger 註解的路由文件
  // P1-7: 新增後台管理 API 路由掃描
  apis: [
    './routes/api/v1/*.js',      // API v1 路由（前端串接使用）
    './routes/api/admin/*.js'    // Admin API 路由（後台管理 RESTful API）
  ]
};

// 生成 Swagger 規格
const specs = swaggerJsdoc(options);

/**
 * 設置 Swagger UI 中介軟體
 */
function setupSwaggerUI(app) {
  // Swagger UI 基本配置
  const swaggerUiOptions = {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none }
    `,
    customSiteTitle: 'MICE-AI  API 文件',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true
    },
    customJs: '/swagger-custom.js'
  };

  // 提供自訂 JavaScript
  app.get('/swagger-custom.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
      // 添加快速登入按鈕點擊事件
      window.addEventListener('load', function() {
        setTimeout(function() {
          const titleElement = document.querySelector('.swagger-ui .info .title');
          if (titleElement) {
            // 創建登入按鈕
            const loginBtn = document.createElement('a');
            loginBtn.href = '/swagger-login';
            loginBtn.target = '_blank';
            loginBtn.style.cssText = \`
              display: block;
              margin-top: 20px;
              padding: 15px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border-radius: 8px;
              font-size: 14px;
              font-weight: normal;
              text-align: center;
              cursor: pointer;
              transition: all 0.3s;
              text-decoration: none;
            \`;
            loginBtn.textContent = '🔐 需要測試認證 API？點擊這裡快速登入';
            loginBtn.onmouseover = function() {
              this.style.transform = 'translateY(-2px)';
              this.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
            };
            loginBtn.onmouseout = function() {
              this.style.transform = 'translateY(0)';
              this.style.boxShadow = 'none';
            };

            // 插入到標題後面
            titleElement.parentNode.insertBefore(loginBtn, titleElement.nextSibling);
          }
        }, 500);
      });
    `);
  });

  // 設置 Swagger UI 路由
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));

  // 提供原始 JSON 規格
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  console.log('✅ Swagger UI 已設置完成');
  console.log(`📚 API 文件網址: ${config.app.baseUrl}/api-docs`);
  console.log(`🔐 快速登入頁面: ${config.app.baseUrl}/swagger-login`);
  console.log(`📄 API JSON 規格: ${config.app.baseUrl}/api-docs.json`);
}

module.exports = {
  specs,
  setupSwaggerUI
};