#!/usr/bin/env tsx

/**
 * Test Script for Tuple Cleanup
 * Verifies that OpenFGA tuples are properly cleaned up when schemas are deleted
 */

import { loadConfig } from '../../api/src/config';
import { initializeDatabase } from '../../api/src/database/utils/database';
import { initializeOpenFGA } from '../../api/src/utils/openfga';
import { initializeValkey } from '../../api/src/utils/valkey';
import { initializeMinIO } from '../../api/src/utils/minio';

// Load configuration
const config = loadConfig();

// Initialize services
initializeDatabase(config.database);
initializeOpenFGA(config.openfga);
initializeValkey(config.valkey);
initializeMinIO(config.minio);

const API_BASE = `http://localhost:${config.port}`;

/**
 * Test helper functions
 */
const makeRequest = async (endpoint: string, options: RequestInit = {}, sessionCookie?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (sessionCookie) {
    headers['Cookie'] = sessionCookie;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);
  return { response, data };
};

/**
 * Create a test session by logging in
 */
const createTestSession = async (): Promise<string> => {
  console.log('🔐 Creating test session...');
  
  // Register a test company and user
  const newCompanyName = `Tuple Test Company ${Date.now()}`;
  const registerData = {
    name: newCompanyName,
    slug: newCompanyName.toLowerCase().replace(/ /g, '-'),
    admin: {      
      email: `tuple-test-${Date.now()}@example.com`,
      password: 'testpassword123',
      profile: {
        name: 'Tuple Test Admin',
        email: `tuple-test-${Date.now()}@example.com`,
        phone: '1234567890',
      }
    }
  };

  const { response: registerResponse } = await makeRequest('/api/companies', {
    method: 'POST',
    body: JSON.stringify(registerData),
  });

  if (!registerResponse.ok) {
    throw new Error('Failed to register company');
  }

  console.log('✅ Company registered successfully');

  // Login
  const loginData = {
    email: registerData.admin.email,
    password: registerData.admin.password,
  };

  const { response: loginResponse } = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(loginData),
  });

  if (!loginResponse.ok) {
    throw new Error('Failed to login');
  }

  const sessionCookie = loginResponse.headers.get('set-cookie') || '';
  console.log('✅ Login successful');

  return sessionCookie;
};

/**
 * Test tuple cleanup
 */
const testTupleCleanup = async (sessionCookie: string) => {
  console.log('\n📋 Testing tuple cleanup...');

  // Create a schema
  const schemaData = {
    slug: 'cleanup_test_table',
    label: 'Cleanup Test Table',
    description: 'A test schema for tuple cleanup',
    columns: [
      {
        name: 'test_field',
        data_type: 'varchar',
        data_type_options: { length: 255 },
        nullable: false,
        view_type: 'text',
        view_editor: 'input'
      }
    ]
  };

  console.log('Creating schema:', schemaData.slug);
  const { response: createResponse, data: createdSchema } = await makeRequest('/api/schemas', {
    method: 'POST',
    body: JSON.stringify(schemaData),
  }, sessionCookie);

  if (!createResponse.ok) {
    throw new Error(`Schema creation failed: ${JSON.stringify(createdSchema)}`);
  }

  console.log('✅ Schema created successfully');
  console.log('Schema ID:', createdSchema.id);

  // Wait a moment to ensure permissions are set up
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Delete the schema (this should trigger tuple cleanup)
  console.log('\nDeleting schema to test tuple cleanup...');
  const { response: deleteResponse, data: deleteData } = await makeRequest(`/api/schemas/${schemaData.slug}`, {
    method: 'DELETE',
    body: JSON.stringify({}),
  }, sessionCookie);

  if (!deleteResponse.ok) {
    console.error('Delete response status:', deleteResponse.status);
    console.error('Delete response data:', deleteData);
    throw new Error(`Schema deletion failed: ${JSON.stringify(deleteData)}`);
  }

  console.log('✅ Schema deleted successfully');
  console.log('📝 Check the API logs above to see tuple cleanup messages');

  // Verify schema is gone
  const { response: verifyResponse } = await makeRequest(`/api/schemas/${schemaData.slug}`, {
    method: 'GET',
  }, sessionCookie);

  if (verifyResponse.status === 404) {
    console.log('✅ Schema deletion verified - schema no longer exists');
  } else {
    console.error('❌ Schema still exists after deletion');
  }
};

/**
 * Main test function
 */
const runTest = async () => {
  try {
    console.log('🚀 Starting Tuple Cleanup Test...\n');

    // Wait for API to be ready
    console.log('⏳ Waiting for API to be ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create test session
    const sessionCookie = await createTestSession();

    // Test tuple cleanup
    await testTupleCleanup(sessionCookie);

    console.log('\n🎉 Tuple cleanup test completed successfully!');
    console.log('💡 Check the API server logs to see the tuple cleanup messages');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
};

// Run test if this script is executed directly
if (require.main === module) {
  runTest();
}

export { runTest };
