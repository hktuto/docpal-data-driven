// DocPal API Main Application

import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import { loadConfig } from './config';
import { initializeDatabaseWithSetup } from './database/utils/database';
import { initializeValkey } from './utils/valkey';
import { initializeOpenFGA } from './utils/openfga';
import { initializeMinIO } from './utils/minio';
import { initializeTemporal, startWorkflowEventListener, createTemporalWorker } from './utils/temporal';
import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts'

// Load configuration
const config = loadConfig();

/**
 * Create and configure Fastify application
 */
const createApp = async () => {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          colorize: true,
        },
      } : undefined,
      enabled: true // process.env.NODE_ENV === 'development',
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: () => crypto.randomUUID(),
    disableRequestLogging: false,
    trustProxy: true,
  }).withTypeProvider<JsonSchemaToTsProvider>();
  // Register CORS


  // Register cookie support
  await app.register(cookie);

   // CORS
   await app.register(import('@fastify/cors'), {
    origin: ["http://localhost:3033","http://localhost:3001","http://localhost:3000"],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Company-ID',
      'X-Request-ID',
    ],
  });

  // Register multipart support for file uploads
  await app.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 52428800,
      files: 10, // Max 10 files per request
    },
    attachFieldsToBody: true,
  });

  // Initialize Valkey for sessions
  const valkeyClient = initializeValkey(config.valkey);

  // Register session support with Valkey store
  // await app.register(session, {
  //   secret: config.session.secret,
  //   cookie: {
  //     secure: config.session.secure,
  //     maxAge: config.session.maxAge * 1000, // Convert to milliseconds
  //     httpOnly: true,
  //     path: '/',
  //   },
  //   store: {
  //     set: (sessionId: string, session: any, callback: any) => {
  //       valkeyClient.setex(`session:${sessionId}`, config.session.maxAge, JSON.stringify(session))
  //         .then(() => callback())
  //         .catch(callback);
  //     },
  //     get: (sessionId: string, callback: any) => {
  //       valkeyClient.get(`session:${sessionId}`)
  //         .then(data => callback(null, data ? JSON.parse(data) : null))
  //         .catch(callback);
  //     },
  //     destroy: (sessionId: string, callback: any) => {
  //       valkeyClient.del(`session:${sessionId}`)
  //         .then(() => callback())
  //         .catch(callback);
  //     },
  //   },
  // });

  // Swagger documentation
  await app.register(import('@fastify/swagger'), {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'DocPal API',
        description: 'Multi-tenant document management platform API',
        version: process.env.API_VERSION || '1.0.0',
        contact: {
          name: 'DocPal Team',
          email: 'support@docpal.com',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: process.env.API_URL || 'http://localhost:3333',
          description: 'API Server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'session',
          },
        },
      },
      security: [
        { bearerAuth: [] },
        { cookieAuth: [] },
      ],
    },
  });
  // Swagger UI
  if (process.env.NODE_ENV !== 'production') {
    await app.register(import('@fastify/swagger-ui'), {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
      uiHooks: {
        onRequest: function (request, reply, next) {
          next();
        },
        preHandler: function (request, reply, next) {
          next();
        },
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
    });
  }

  // Initialize external services with automatic setup
  await initializeDatabaseWithSetup(config.database);
  initializeOpenFGA(config.openfga);
  initializeMinIO(config.minio);
  
  // Initialize Temporal (optional - will log error if not available)
  try {
    await initializeTemporal(config.temporal);
    
    // Start Temporal worker
    const worker = await createTemporalWorker(
      'docpal-workflows',
      require.resolve('./workflows/dynamic-workflow'),
      await import('./workflows/activities')
    );
    
    // Start the worker in the background
    worker.run().catch((error) => {
      console.error('❌ Temporal worker error:', error);
    });
    console.log('✅ Temporal worker started successfully');
    
    // Start workflow event listener
    await startWorkflowEventListener();
    console.log('✅ Workflow event listener started successfully');
  } catch (error) {
    console.warn('⚠️  Temporal not available, workflow features will be limited:', error);
  }

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    };
  });

  // API routes
  await app.register(async (fastify) => {
    // API info endpoint
    fastify.get('/api', async () => {
      return {
        message: 'DocPal API v1',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          auth: '/api/auth',
          companies: '/api/companies',
          users: '/api/users',
          roles: '/api/roles',
          groups: '/api/groups',
          schemas: '/api/schemas',
          'schema-import': '/api/schemas/import',
          'data-views': '/api/views/:table_slug',
          records: '/api/records',
          files: '/api/files',
          workflows: '/api/workflows',
          'user-tasks': '/api/user-tasks',
          docs: '/docs',
        },
      };
    });
    
    // Register auth routes
    const { registerAuthRoutes } = await import('./services/auth/auth_route');
    await fastify.register(registerAuthRoutes, { prefix: '/api/auth' });
    
    // Register company routes
    const { registerCompanyRoutes } = await import('./services/company/company_route');
    await fastify.register(registerCompanyRoutes, { prefix: '/api' });

    // Register schema routes
    const { registerSchemaRoutes } = await import('./services/schema/schema_route');
    await fastify.register(registerSchemaRoutes, { prefix: '/api/schemas' });

    // Register import routes
    const { registerImportRoutes } = await import('./services/import/import_route');
    await fastify.register(registerImportRoutes, { prefix: '/api/schemas/import' });

    // Register record routes
    const { registerRecordRoutes } = await import('./services/record/record_route');
    await fastify.register(registerRecordRoutes, { prefix: '/api' });

    // Register file routes
    const { registerFileRoutes } = await import('./services/file/file_route');
    await fastify.register(registerFileRoutes, { prefix: '/api' });

    // Register workflow routes
    const { workflowRoutes } = await import('./services/workflow/workflow-route');
    await fastify.register(workflowRoutes, { prefix: '/api' });

    // Register user profile routes
    const { registerUserRoutes } = await import('./services/user/user_route');
    await fastify.register(registerUserRoutes, { prefix: '/api' });

    // Register role routes
    const { registerRoleRoutes } = await import('./services/role/role_route');
    await fastify.register(registerRoleRoutes, { prefix: '/api' });

    // Register group routes
    const { registerGroupRoutes } = await import('./services/group/group_route');
    await fastify.register(registerGroupRoutes, { prefix: '/api' });

    // Register data view routes
    const { registerDataViewRoutes } = await import('./services/dataview/dataview_route');
    await fastify.register(registerDataViewRoutes, { prefix: '/api' });

  });
 
  return app;
};

/**
 * Start the application
 */
const start = async () => {
  try {
    const app = await createApp();
    
    await app.listen({
      port: config.port,
      host: config.host,
    });
    
    console.log(`🚀 DocPal API running on http://${config.host}:${config.port}`);
    console.log(`📊 Health check: http://${config.host}:${config.port}/health`);
    console.log(`🔗 API docs: http://${config.host}:${config.port}/docs`);
    
    // Schedule cleanup of expired imports every hour
    const { cleanupExpiredImports } = await import('./services/import/import_service');
    const cleanupInterval = setInterval(() => {
      console.log('🧹 Running scheduled cleanup of expired imports...');
      cleanupExpiredImports();
    }, 60 * 60 * 1000); // Every hour
    
    // Store interval reference for cleanup
    (global as any).cleanupInterval = cleanupInterval;
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  
  // Clear cleanup interval
  if ((global as any).cleanupInterval) {
    clearInterval((global as any).cleanupInterval);
    console.log('🧹 Cleared import cleanup interval');
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  
  // Clear cleanup interval
  if ((global as any).cleanupInterval) {
    clearInterval((global as any).cleanupInterval);
    console.log('🧹 Cleared import cleanup interval');
  }
  
  process.exit(0);
});

// Start the server
if (require.main === module) {
  start();
}

export { createApp, start };
