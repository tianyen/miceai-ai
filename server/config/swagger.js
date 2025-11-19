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
      '- **管理員**: `admin` / `admin123`\n' +
      '- **廠商**: `vendor1` / `vendor123`\n' +
      '- **專案經理**: `pm1` / `pm123`\n\n' +
      '### 3. 測試資料\n\n' +
      '執行 `npm run setup` 後，系統會自動創建確定性測試資料（每次執行產生相同的 ID 和 trace_id）：\n\n' +
      '- **活動專案**: TECH2024, WORKSHOP2024, INFO2024\n' +
      '- **測試 trace_id**: `MICE-d074dd3e-e3e27b6b0`, `MICE-05207cf7-199967c04`, `MICE-8c4c3742-5c8b4a8e3`\n' +
      '- **攤位**: 7 個攤位分佈在 3 個專案中\n' +
      '- **遊戲**: Loki 飛鏢遊戲、測試遊戲\n' +
      '- **兌換券**: 咖啡券、紀念品券、折扣券\n\n' +
      '### 4. 完整文檔\n\n' +
      '詳細的測試資料、使用範例和 Schema 說明請參考：\n' +
      '- [Swagger 對接指南](https://github.com/your-repo/blob/master/claude/docs/SWAGGER_INTEGRATION_GUIDE.md)\n' +
      '- [系統技術規格](https://github.com/your-repo/blob/master/claude/docs/spec.md)\n' +
      '- [用戶旅程文檔](https://github.com/your-repo/blob/master/claude/docs/user-journey.md)\n\n' +
      '---\n\n' +
      '**注意事項：**\n' +
      '- 本文件僅包含前端串接使用的 API v1 路由（`/api/v1/`）\n' +
      '- 後台管理功能（如攤位管理、兌換券管理等）位於 `/admin/` 路由，為管理 UI 使用，不包含於此 API 文檔中\n' +
      '- 後台管理功能需要登入驗證，請直接透過管理介面操作\n' +
      '- 所有 API 回應使用統一格式：`{ success: true/false, message, data/error }`',
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
                password: { type: 'string', example: 'admin123' },
                role: { type: 'string', example: 'super_admin' }
              }
            },
            example: [
              { id: 1, username: 'admin', password: 'admin123', role: 'super_admin' },
              { id: 2, username: 'vendor1', password: 'vendor123', role: 'vendor' },
              { id: 3, username: 'pm1', password: 'pm123', role: 'project_manager' }
            ]
          },
          events: {
            type: 'array',
            items: { $ref: '#/components/schemas/Event' },
            example: [
              { id: 1, project_code: 'TECH2024', project_name: '2024 科技論壇', status: 'active' },
              { id: 2, project_code: 'WORKSHOP2024', project_name: '2024 技術工作坊', status: 'active' },
              { id: 3, project_code: 'INFO2024', project_name: '2024 資訊月', status: 'active' }
            ]
          },
          trace_ids: {
            type: 'array',
            description: '確定性生成的 trace_id（每次 npm run setup 都相同）',
            items: { type: 'string' },
            example: [
              'MICE-d074dd3e-e3e27b6b0',
              'MICE-05207cf7-199967c04',
              'MICE-8c4c3742-5c8b4a8e3'
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