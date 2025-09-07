// Test script for external services connectivity

import { initializeOpenFGA, testOpenFGAConnection } from '../../api/src/utils/openfga';
import { initializeMinIO, testMinIOConnection } from '../../api/src/utils/minio';
import { initializeValkey, testValkeyConnection } from '../../api/src/utils/valkey';

/**
 * Test all external services connectivity
 */
const testAllServices = async (): Promise<void> => {
  console.log('🔍 Testing external services connectivity...\n');

  let allPassed = true;

  // Test OpenFGA
  try {
    console.log('📋 Testing OpenFGA...');
    initializeOpenFGA({
      apiUrl: process.env.OPENFGA_API_URL || 'http://localhost:8080',
    });
    
    const fgaResult = await testOpenFGAConnection();
    if (fgaResult) {
      console.log('✅ OpenFGA connection successful');
    } else {
      console.log('❌ OpenFGA connection failed');
      allPassed = false;
    }
  } catch (error) {
    console.log('❌ OpenFGA connection failed:', error);
    allPassed = false;
  }

  console.log('');

  // Test MinIO
  try {
    console.log('📁 Testing MinIO...');
    initializeMinIO({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
    });
    
    const minioResult = await testMinIOConnection();
    if (minioResult) {
      console.log('✅ MinIO connection successful');
    } else {
      console.log('❌ MinIO connection failed');
      allPassed = false;
    }
  } catch (error) {
    console.log('❌ MinIO connection failed:', error);
    allPassed = false;
  }

  console.log('');

  // Test Valkey
  try {
    console.log('🔄 Testing Valkey...');
    initializeValkey({
      host: process.env.VALKEY_HOST || 'localhost',
      port: parseInt(process.env.VALKEY_PORT || '6379'),
      password: process.env.VALKEY_PASSWORD || 'valkey_password_dev_123',
    });
    
    const valkeyResult = await testValkeyConnection();
    if (valkeyResult) {
      console.log('✅ Valkey connection successful');
    } else {
      console.log('❌ Valkey connection failed');
      allPassed = false;
    }
  } catch (error) {
    console.log('❌ Valkey connection failed:', error);
    allPassed = false;
  }

  console.log('');

  // Final result
  if (allPassed) {
    console.log('🎉 All external services are working correctly!');
    process.exit(0);
  } else {
    console.log('💥 Some services failed. Please check the logs above.');
    process.exit(1);
  }
};

/**
 * Test individual service
 */
const testIndividualService = async (serviceName: string): Promise<void> => {
  switch (serviceName.toLowerCase()) {
    case 'openfga':
      console.log('📋 Testing OpenFGA only...');
      try {
        initializeOpenFGA({
          apiUrl: process.env.OPENFGA_API_URL || 'http://localhost:8080',
        });
        const result = await testOpenFGAConnection();
        console.log(result ? '✅ OpenFGA OK' : '❌ OpenFGA Failed');
      } catch (error) {
        console.log('❌ OpenFGA Failed:', error);
      }
      break;

    case 'minio':
      console.log('📁 Testing MinIO only...');
      try {
        initializeMinIO({
          endPoint: process.env.MINIO_ENDPOINT || 'localhost',
          port: parseInt(process.env.MINIO_PORT || '9000'),
          useSSL: false,
          accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
          secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
        });
        const result = await testMinIOConnection();
        console.log(result ? '✅ MinIO OK' : '❌ MinIO Failed');
      } catch (error) {
        console.log('❌ MinIO Failed:', error);
      }
      break;

    case 'valkey':
      console.log('🔄 Testing Valkey only...');
      try {
        initializeValkey({
          host: process.env.VALKEY_HOST || 'localhost',
          port: parseInt(process.env.VALKEY_PORT || '6379'),
          password: process.env.VALKEY_PASSWORD || 'valkey_password_dev_123',
        });
        const result = await testValkeyConnection();
        console.log(result ? '✅ Valkey OK' : '❌ Valkey Failed');
      } catch (error) {
        console.log('❌ Valkey Failed:', error);
      }
      break;

    default:
      console.log('❌ Unknown service. Available: openfga, minio, valkey');
      process.exit(1);
  }
};

// Main execution
const main = async (): Promise<void> => {
  const serviceName = process.argv[2];
  
  if (serviceName) {
    await testIndividualService(serviceName);
  } else {
    await testAllServices();
  }
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { testAllServices, testIndividualService };
