#!/usr/bin/env tsx

/**
 * Test Script for Schema API
 * Tests the dynamic schema management functionality
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

interface TestSession {
  sessionCookie: string;
  companyId: string;
  userId: string;
}

/**
 * Test helper functions
 */
const makeRequest = async (endpoint: string, options: RequestInit = {}, session?: TestSession) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (session?.sessionCookie) {
    headers['Cookie'] = session.sessionCookie;
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
const createTestSession = async (): Promise<TestSession> => {
  console.log('🔐 Creating test session...');
  
  // First, register a test company and user
  const newCompanyName = `Test Schema Company ${Date.now()}`;
  const registerData = {
    name: newCompanyName,
    slug: newCompanyName.toLowerCase().replace(/ /g, '-') ,
    admin: {      
      email: `schema-test-${Date.now()}@example.com`,
      password: 'testpassword123',
      profile:{
        name: 'Schema Test Admin',
        email: `schema-test-${Date.now()}@example.com`,
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

  const { response: loginResponse, data: loginResult } : any = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(loginData),
  });

  if (!loginResponse.ok) {
    throw new Error(`Failed to login: ${JSON.stringify(loginResult)}`);
  }

  const sessionCookie = loginResponse.headers.get('set-cookie') || '';
  console.log('✅ Login successful');

  // Select the company
  const { response: companiesResponse, data: companiesData } : any = await makeRequest('/api/companies', {
    method: 'GET',
  }, { sessionCookie, companyId: '', userId: '' });

  if (!companiesResponse.ok || !companiesData?.length) {
    throw new Error('Failed to get companies');
  }

  const companyId = companiesData[0].id;
  const userId = loginResult.user.id;


  return { sessionCookie, companyId, userId };
};

/**
 * Test schema creation
 */
const testCreateSchema = async (session: TestSession) => {
  console.log('\n📋 Testing schema creation...');

  const schemaData = {
    slug: 'test_products',
    label: 'Test Products',
    description: 'A test schema for products',
    columns: [
      {
        name: 'product_name',
        data_type: 'varchar',
        data_type_options: { length: 255 },
        nullable: false,
        view_type: 'text',
        view_editor: 'input',
        view_validation: { required: true, max_length: 255 }
      },
      {
        name: 'price',
        data_type: 'decimal',
        data_type_options: { precision: 10, scale: 2 },
        nullable: false,
        view_type: 'number',
        view_editor: 'input',
        view_validation: { required: true, min: 0 }
      },
      {
        name: 'description',
        data_type: 'text',
        nullable: true,
        view_type: 'text',
        view_editor: 'textarea'
      },
      {
        name: 'is_active',
        data_type: 'boolean',
        nullable: false,
        default: true,
        view_type: 'boolean',
        view_editor: 'checkbox'
      },
      {
        name: 'created_date',
        data_type: 'timestamp',
        nullable: false,
        default: 'NOW()',
        view_type: 'datetime',
        view_editor: 'datetime'
      }
    ]
  };

  const { response, data }:any = await makeRequest('/api/schemas', {
    method: 'POST',
    body: JSON.stringify(schemaData),
  }, session);

  if (!response.ok) {
    console.error('❌ Schema creation failed:', data);
    throw new Error(`Schema creation failed: ${JSON.stringify(data)}`);
  }

  console.log('✅ Schema created successfully:', data);
  return data;
};

/**
 * Test schema listing
 */
const testListSchemas = async (session: TestSession) => {
  console.log('\n📋 Testing schema listing...');

  const { response, data }:any = await makeRequest('/api/schemas', {
    method: 'GET',
  }, session);

  if (!response.ok) {
    console.error('❌ Schema listing failed:', data);
    throw new Error(`Schema listing failed: ${JSON.stringify(data)}`);
  }

  console.log(`✅ Found ${data.length} schemas`);
  data.forEach((schema: any) => {
    console.log(`  - ${schema.slug}: ${schema.label} (${schema.columns.length} columns)`);
  });

  return data;
};

/**
 * Test schema retrieval by slug
 */
const testGetSchema = async (session: TestSession, slug: string) => {
  console.log(`\n📋 Testing schema retrieval for: ${slug}...`);

  const { response, data }:any = await makeRequest(`/api/schemas/${slug}`, {
    method: 'GET',
  }, session);

  if (!response.ok) {
    console.error('❌ Schema retrieval failed:', data);
    throw new Error(`Schema retrieval failed: ${JSON.stringify(data)}`);
  }
  console.log('---------------data', data);
  console.log('✅ Schema retrieved successfully');
  console.log(`  - Label: ${data.label}`);
  console.log(`  - Description: ${data.description}`);
  console.log(`  - Columns: ${data.columns.length}`);

  return data;
};

/**
 * Test schema update
 */
const testUpdateSchema = async (session: TestSession, slug: string) => {
  console.log(`\n📋 Testing schema update for: ${slug}...`);

  const updateData = {
    label: 'Updated Test Products',
    description: 'An updated test schema for products',
    columns: [
      {
        name: 'product_name',
        data_type: 'varchar',
        data_type_options: { length: 255 },
        nullable: false,
        view_type: 'text',
        view_editor: 'input',
        view_validation: { required: true, max_length: 255 }
      },
      {
        name: 'price',
        data_type: 'decimal',
        data_type_options: { precision: 10, scale: 2 },
        nullable: false,
        view_type: 'number',
        view_editor: 'input',
        view_validation: { required: true, min: 0 }
      },
      {
        name: 'description',
        data_type: 'text',
        nullable: true,
        view_type: 'text',
        view_editor: 'textarea'
      },
      {
        name: 'is_active',
        data_type: 'boolean',
        nullable: false,
        default: true,
        view_type: 'boolean',
        view_editor: 'checkbox'
      },
      {
        name: 'created_date',
        data_type: 'timestamp',
        nullable: false,
        default: 'NOW()',
        view_type: 'datetime',
        view_editor: 'datetime'
      },
      // Add a new column
      {
        name: 'category',
        data_type: 'varchar',
        data_type_options: { length: 100 },
        nullable: true,
        view_type: 'text',
        view_editor: 'input'
      }
    ]
  };

  const { response, data }:any = await makeRequest(`/api/schemas/${slug}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  }, session);

  if (!response.ok) {
    console.error('❌ Schema update failed:', data);
    throw new Error(`Schema update failed: ${JSON.stringify(data)}`);
  }

  console.log('✅ Schema updated successfully');
  console.log(`  - New label: ${data.label}`);
  console.log(`  - New column count: ${data.columns.length}`);

  return data;
};

/**
 * Test schema deletion
 */
const testDeleteSchema = async (session: TestSession, slug: string) => {
  console.log(`\n📋 Testing schema deletion for: ${slug}...`);

  const { response, data } = await makeRequest(`/api/schemas/${slug}`, {
    method: 'DELETE',
    body: JSON.stringify({}),
  }, session);

  if (!response.ok) {
    console.error('❌ Schema deletion failed:', data);
    throw new Error(`Schema deletion failed: ${JSON.stringify(data)}`);
  }

  console.log('✅ Schema deleted successfully');
};

/**
 * Test validation errors
 */
const testValidationErrors = async (session: TestSession) => {
  console.log('\n📋 Testing validation errors...');

  // Test invalid slug
  const invalidSlugData = {
    slug: 'Invalid-Slug!',
    label: 'Invalid Schema',
    description: 'This should fail',
    columns: [
      {
        name: 'test_field',
        data_type: 'varchar',
        nullable: false,
        view_type: 'text',
        view_editor: 'input'
      }
    ]
  };

  const { response: slugResponse, data: slugData } = await makeRequest('/api/schemas', {
    method: 'POST',
    body: JSON.stringify(invalidSlugData),
  }, session);

  if (slugResponse.ok) {
    console.error('❌ Expected validation error for invalid slug');
  } else {
    console.log('✅ Correctly rejected invalid slug');
  }

  // Test incompatible data type and view type
  const incompatibleTypeData = {
    slug: 'test_incompatible',
    label: 'Incompatible Types',
    description: 'This should fail',
    columns: [
      {
        name: 'test_field',
        data_type: 'boolean',
        nullable: false,
        view_type: 'datetime', // Incompatible with boolean
        view_editor: 'date'
      }
    ]
  };

  const { response: typeResponse, data: typeData } = await makeRequest('/api/schemas', {
    method: 'POST',
    body: JSON.stringify(incompatibleTypeData),
  }, session);

  if (typeResponse.ok) {
    console.error('❌ Expected validation error for incompatible types');
  } else {
    console.log('✅ Correctly rejected incompatible data type and view type');
  }
};

/**
 * Main test function
 */
const runTests = async () => {
  try {
    console.log('🚀 Starting Schema API Tests...\n');

    // Create test session
    const session = await createTestSession();

    // Test schema creation
    const createdSchema = await testCreateSchema(session);

    // Test schema listing
    await testListSchemas(session);

    // Test schema retrieval
    await testGetSchema(session, createdSchema.slug);

    // Test schema update
    await testUpdateSchema(session, createdSchema.slug);

    // Test validation errors
    await testValidationErrors(session);

    // Test schema deletion
    await testDeleteSchema(session, createdSchema.slug);

    // Verify deletion
    const { response: verifyResponse } = await makeRequest(`/api/schemas/${createdSchema.slug}`, {
      method: 'GET',
    }, session);

    if (verifyResponse.status === 404) {
      console.log('✅ Schema deletion verified');
    } else {
      console.error('❌ Schema still exists after deletion');
    }

    console.log('\n🎉 All Schema API tests completed successfully!');
    process.exit(1);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
};

// Run tests if this script is executed directly
if (require.main === module) {
  runTests();
}

export { runTests };
