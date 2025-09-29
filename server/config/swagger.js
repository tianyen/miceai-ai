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
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          username: { type: 'string', example: 'admin' },
          full_name: { type: 'string', example: '管理員' },
          email: { type: 'string', example: 'admin@example.com' },
          role: { type: 'string', example: 'admin', enum: ['admin', 'user', 'super_admin'] },
          status: { type: 'string', example: 'active', enum: ['active', 'inactive'] },
          created_at: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' }
        }
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          project_name: { type: 'string', example: '2024 年度研討會' },
          project_code: { type: 'string', example: 'CONF2024' },
          description: { type: 'string', example: '年度技術研討會邀請函' },
          event_date: { type: 'string', format: 'date-time', example: '2024-06-15T09:00:00.000Z' },
          event_location: { type: 'string', example: '台北國際會議中心' },
          event_type: { type: 'string', example: 'conference', enum: ['conference', 'seminar', 'workshop', 'exhibition', 'party', 'other'] },
          status: { type: 'string', example: 'active', enum: ['draft', 'active', 'completed', 'cancelled'] },
          max_participants: { type: 'integer', example: 200 },
          registration_deadline: { type: 'string', format: 'date-time', example: '2024-06-01T23:59:59.000Z' },
          created_by: { type: 'integer', example: 1 },
          created_at: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' }
        }
      },
      Submission: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          trace_id: { type: 'string', example: 'TRACE123456' },
          project_id: { type: 'integer', example: 1 },
          submitter_name: { type: 'string', example: '王小明' },
          submitter_email: { type: 'string', example: 'wang@example.com' },
          submitter_phone: { type: 'string', example: '0912345678' },
          company_name: { type: 'string', example: '範例公司' },
          position: { type: 'string', example: '工程師' },
          status: { type: 'string', example: 'pending', enum: ['pending', 'approved', 'rejected', 'confirmed', 'cancelled'] },
          checked_in_at: { type: 'string', format: 'date-time', nullable: true, example: null },
          created_at: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' }
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
  // 掃描包含 Swagger 註解的路由文件
  apis: [
    './routes/api/*.js',      // API 路由
    './routes/api/v1/*.js',   // API v1 路由
    './routes/admin/*.js',    // 管理路由
    './controllers/*.js'      // 控制器
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
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: '邀請函管理系統 API 文件',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true
    }
  };

  // 設置 Swagger UI 路由
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));

  // 提供原始 JSON 規格
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  console.log('✅ Swagger UI 已設置完成');
  console.log(`📚 API 文件網址: ${config.app.baseUrl}/api-docs`);
  console.log(`📄 API JSON 規格: ${config.app.baseUrl}/api-docs.json`);
}

module.exports = {
  specs,
  setupSwaggerUI
};