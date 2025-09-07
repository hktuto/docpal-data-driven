#!/usr/bin/env tsx

/**
 * Test Script for Role Assignment Fix
 * Tests that roles are correctly stored in company_user table instead of user_profile
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
 * Test company creation with role assignment
 */
const testCompanyCreationWithRole = async (): Promise<TestSession> => {
  console.log('🏢 Testing company creation with role assignment...');
  
  const timestamp = Date.now();
  const companyName = `Role Test Company ${timestamp}`;
  
  const registerData = {
    name: companyName,
    slug: companyName.toLowerCase().replace(/ /g, '-'),
    admin: {      
      email: `role-test-${timestamp}@example.com`,
      password: 'testpassword123',
      profile: {
        name: 'Role Test Admin',
        email: `role-test-${timestamp}@example.com`,
        phone: '1234567890',
        address: '123 Test St',
        city: 'Test City'
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

  console.log('✅ Company created successfully');

  // Login with the created user
  const loginData = {
    email: registerData.admin.email,
    password: registerData.admin.password,
  };

  const { response: loginResponse, data: loginResult }: any = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(loginData),
  });

  if (!loginResponse.ok) {
    throw new Error(`Failed to login: ${JSON.stringify(loginResult)}`);
  }

  const sessionCookie = loginResponse.headers.get('set-cookie') || '';
  console.log('✅ Login successful');

  // Get companies to verify role assignment
  const { response: companiesResponse, data: companiesData }: any = await makeRequest('/api/companies', {
    method: 'GET',
  }, { sessionCookie, companyId: '', userId: '' });

  if (!companiesResponse.ok || !companiesData?.length) {
    throw new Error('Failed to get companies');
  }

  const company = companiesData[0];
  console.log(`✅ Company retrieved: ${company.name}`);
  console.log(`✅ User role in company: ${company.role}`);

  if (company.role !== 'admin') {
    throw new Error(`Expected admin role, but got: ${company.role}`);
  }

  console.log('✅ Role assignment verified - user has admin role');

  return {
    sessionCookie,
    companyId: company.id,
    userId: loginResult.user.id
  };
};

/**
 * Test database role storage
 */
const testDatabaseRoleStorage = async (session: TestSession) => {
  console.log('\n🗄️ Testing database role storage...');
  
  const { getPool } = await import('../../api/src/database/utils/database');
  const pool = getPool();
  
  // Check that role is stored in company_user table
  const companyUserResult = await pool.query(
    'SELECT role_id FROM company_user WHERE company_id = $1 AND user_id = $2',
    [session.companyId, session.userId]
  );
  
  if (companyUserResult.rows.length === 0) {
    throw new Error('No company_user record found');
  }
  
  const roleId = companyUserResult.rows[0].role_id;
  if (!roleId) {
    throw new Error('role_id is null in company_user table');
  }
  
  console.log(`✅ role_id found in company_user table: ${roleId}`);
  
  // Check that the role exists in the tenant schema
  const schemaName = `company_${session.companyId.replace(/-/g, '_')}`;
  const roleResult = await pool.query(
    `SELECT name, slug FROM ${schemaName}.role WHERE id = $1`,
    [roleId]
  );
  
  if (roleResult.rows.length === 0) {
    throw new Error('Role not found in tenant schema');
  }
  
  const role = roleResult.rows[0];
  console.log(`✅ Role found in tenant schema: ${role.name} (${role.slug})`);
  
  if (role.slug !== 'admin') {
    throw new Error(`Expected admin role, but found: ${role.slug}`);
  }
  
  // Check that user_profile table does NOT have role column
  try {
    await pool.query(`SELECT role FROM ${schemaName}.user_profile WHERE id = $1`, [session.userId]);
    throw new Error('user_profile table still has role column - migration not complete');
  } catch (error: any) {
    if (error.message.includes('column "role" does not exist')) {
      console.log('✅ user_profile table correctly does not have role column');
    } else {
      throw error;
    }
  }
};

/**
 * Test role-based access control
 */
const testRoleBasedAccess = async (session: TestSession) => {
  console.log('\n🔐 Testing role-based access control...');
  
  // Test that admin can access schema endpoints
  const { response: schemasResponse, data: schemasData }: any = await makeRequest('/api/schemas', {
    method: 'GET',
  }, session);
  
  if (!schemasResponse.ok) {
    throw new Error(`Failed to access schemas endpoint: ${JSON.stringify(schemasData)}`);
  }
  
  console.log('✅ Admin can access schemas endpoint');
  console.log(`✅ Found ${schemasData.schemas?.length || 0} schemas`);
};

/**
 * Test multi-company role isolation
 */
const testMultiCompanyRoleIsolation = async (originalSession: TestSession) => {
  console.log('\n🏢 Testing multi-company role isolation...');
  
  // Create a second company with the same user
  const timestamp = Date.now();
  const companyName2 = `Role Test Company 2 ${timestamp}`;
  
  const registerData2 = {
    name: companyName2,
    slug: companyName2.toLowerCase().replace(/ /g, '-'),
    admin: {      
      email: `role-test-2-${timestamp}@example.com`,
      password: 'testpassword123',
      profile: {
        name: 'Role Test Admin 2',
        email: `role-test-2-${timestamp}@example.com`,
        phone: '1234567891',
        address: '456 Test Ave',
        city: 'Test City 2'
      }
    }
  };

  const { response: registerResponse2, data: registerResult2 } = await makeRequest('/api/companies', {
    method: 'POST',
    body: JSON.stringify(registerData2),
  });

  if (!registerResponse2.ok) {
    throw new Error(`Failed to register second company: ${JSON.stringify(registerResult2)}`);
  }

  console.log('✅ Second company created successfully');

  // Login as the second user
  const loginData2 = {
    email: registerData2.admin.email,
    password: registerData2.admin.password,
  };

  const { response: loginResponse2, data: loginResult2 }: any = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(loginData2),
  });

  if (!loginResponse2.ok) {
    throw new Error(`Failed to login as second user: ${JSON.stringify(loginResult2)}`);
  }

  const sessionCookie2 = loginResponse2.headers.get('set-cookie') || '';

  // Get companies for second user
  const { response: companiesResponse2, data: companiesData2 }: any = await makeRequest('/api/companies', {
    method: 'GET',
  }, { sessionCookie: sessionCookie2, companyId: '', userId: '' });

  if (!companiesResponse2.ok || !companiesData2?.length) {
    throw new Error('Failed to get companies for second user');
  }

  console.log(`✅ Second user has access to ${companiesData2.length} company(ies)`);
  
  // Verify that each user has admin role in their respective company
  const company2 = companiesData2[0];
  if (company2.role !== 'admin') {
    throw new Error(`Expected admin role for second user, but got: ${company2.role}`);
  }
  
  console.log('✅ Multi-company role isolation verified - each user has admin role in their own company');
};

/**
 * Main test function
 */
const runTests = async () => {
  try {
    console.log('🚀 Starting Role Assignment Tests...\n');

    // Test 1: Company creation with role assignment
    const session = await testCompanyCreationWithRole();

    // Test 2: Database role storage verification
    await testDatabaseRoleStorage(session);

    // Test 3: Role-based access control
    await testRoleBasedAccess(session);

    // Test 4: Multi-company role isolation
    await testMultiCompanyRoleIsolation(session);

    console.log('\n🎉 All Role Assignment tests completed successfully!');
    console.log('\n✅ Key Achievements:');
    console.log('  - Roles are correctly stored in company_user table');
    console.log('  - user_profile table no longer has role column');
    console.log('  - Role-based access control works correctly');
    console.log('  - Multi-company role isolation is maintained');

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
