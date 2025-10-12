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
    description: config.swagger.description,
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
      }
    }
  }
};

// Swagger 選項配置
const options = {
  swaggerDefinition,
  // 掃描包含 Swagger 註解的路由文件（僅前端 API v1）
  apis: [
    './routes/api/v1/*.js'   // API v1 路由（前端串接使用）
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