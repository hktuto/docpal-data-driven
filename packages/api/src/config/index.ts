// Configuration management for DocPal API

export interface AppConfig {
  // Server
  port: number;
  host: string;
  
  // Database
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
  };
  
  // Valkey (Redis)
  valkey: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  
  // OpenFGA
  openfga: {
    apiUrl: string;
    storeId?: string;
    authorizationModelId?: string;
  };
  
  // MinIO
  minio: {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
  };
  
  // Temporal
  temporal: {
    address: string;
    namespace?: string;
    tls?: boolean;
  };
  
  // Session
  session: {
    secret: string;
    maxAge: number; // in seconds
    secure: boolean;
  };
}

/**
 * Load configuration from environment variables
 */
export const loadConfig = (): AppConfig => {
  return {
    port: parseInt(process.env.PORT || '3333'),
    host: process.env.HOST || 'localhost',
    
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'docpal_dev',
      user: process.env.DB_USER || 'docpal_user',
      password: process.env.DB_PASSWORD || 'docpal_password_dev_123',
      ssl: process.env.DB_SSL === 'true',
    },
    
    valkey: {
      host: process.env.VALKEY_HOST || 'localhost',
      port: parseInt(process.env.VALKEY_PORT || '6379'),
      password: process.env.VALKEY_PASSWORD || 'valkey_password_dev_123',
      db: parseInt(process.env.VALKEY_DB || '0'),
    },
    
    openfga: {
      apiUrl: process.env.OPENFGA_API_URL || 'http://localhost:8080',
      storeId: process.env.OPENFGA_STORE_ID,
      authorizationModelId: process.env.OPENFGA_MODEL_ID,
    },
    
    minio: {
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
    },
    
    temporal: {
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
      tls: process.env.TEMPORAL_TLS === 'true',
    },
    
    session: {
      secret: process.env.SESSION_SECRET || 'docpal-dev-secret-change-in-production',
      maxAge: parseInt(process.env.SESSION_MAX_AGE || '3600'), // 1 hour
      secure: process.env.NODE_ENV === 'production',
    },
  };
};
