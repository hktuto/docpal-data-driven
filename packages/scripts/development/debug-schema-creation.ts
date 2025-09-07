#!/usr/bin/env tsx

/**
 * Debug Script for Schema Creation
 * Minimal test to debug the schema creation issue
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

  console.log(`Making request to: ${API_BASE}${endpoint}`);
  console.log('Headers:', headers);
  if (options.body) {
    console.log('Body:', options.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));

  const data = await response.json().catch(() => null);
  console.log('Response data:', data);
  
  return { response, data };
};

/**
 * Create a test session by logging in
 */
const createTestSession = async (): Promise<string> => {
  console.log('🔐 Creating test session...');
  
  // First, register a test company and user
  const newCompanyName = `Debug Company ${Date.now()}`;
  const registerData = {
    name: newCompanyName,
    slug: newCompanyName.toLowerCase().replace(/ /g, '-'),
    admin: {      
      email: `debug-${Date.now()}@example.com`,
      password: 'testpassword123',
      profile: {
        name: 'Debug Admin',
        email: `debug-${Date.now()}@example.com`,
        phone: '1234567890',
      }
    }
  };

  const { response: registerResponse, data: registerData2 } = await makeRequest('/api/companies', {
    method: 'POST',
    body: JSON.stringify(registerData),
  });

  if (!registerResponse.ok) {
    throw new Error(`Failed to register company: ${JSON.stringify(registerData2)}`);
  }

  console.log('✅ Company registered successfully');

  // Login with the created user
  const loginData = {
    email: registerData.admin.email,
    password: registerData.admin.password,
  };

  const { response: loginResponse, data: loginResult } = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(loginData),
  });

  if (!loginResponse.ok) {
    throw new Error(`Failed to login: ${JSON.stringify(loginResult)}`);
  }

  const sessionCookie = loginResponse.headers.get('set-cookie') || '';
  console.log('✅ Login successful, session cookie:', sessionCookie);

  return sessionCookie;
};

/**
 * Test schema creation with detailed logging
 */
const testCreateSchema = async (sessionCookie: string) => {
  console.log('\n📋 Testing schema creation with debug...');

  const schemaData = {
    slug: 'debug_test',
    label: 'Debug Test',
    description: 'A debug test schema',
    columns: [
      {
        name: 'test_field',
        data_type: 'varchar',
        data_type_options: { length: 255 },
        nullable: false,
        view_type: 'text',
        view_editor: 'input',
        view_validation: { required: true, max_length: 255 }
      }
    ]
  };

  console.log('Schema data to create:', JSON.stringify(schemaData, null, 2));

  const { response, data } = await makeRequest('/api/schemas', {
    method: 'POST',
    body: JSON.stringify(schemaData),
  }, sessionCookie);

  if (!response.ok) {
    console.error('❌ Schema creation failed');
    console.error('Response status:', response.status);
    console.error('Response data:', data);
    throw new Error(`Schema creation failed: ${JSON.stringify(data)}`);
  }

  console.log('✅ Schema created successfully:', data);
  return data;
};

/**
 * Main debug function
 */
const runDebug = async () => {
  try {
    console.log('🚀 Starting Schema Creation Debug...\n');

    // Wait for API to be ready
    console.log('⏳ Waiting for API to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Create test session
    const sessionCookie = await createTestSession();

    // Test schema creation
    await testCreateSchema(sessionCookie);

    console.log('\n🎉 Debug completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
  }
};

// Run debug if this script is executed directly
if (require.main === module) {
  runDebug();
}

export { runDebug };
