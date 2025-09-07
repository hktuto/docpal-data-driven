#!/usr/bin/env tsx
// API Flow Test Script for DocPal

import fetch from 'node-fetch';

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3333';
const TEST_USER = {
  email: 'test-user@docpal.com',
  password: 'TestPassword123!',
  profile: {
    name: 'Test User',
    email: 'test-user@docpal.com',
    phone: '+1234567890',
    address: '123 Test Street',
    city: 'Test City',
    preferences: {
      theme: 'light',
      notifications: true
    }
  }
};

const TEST_COMPANY = {
  name: 'Test Company Ltd',
  slug: 'test-company-ltd',
  description: 'A test company for API testing',
  settings: {
    timezone: 'UTC',
    currency: 'USD'
  }
};

// Helper function for API calls
const apiCall = async (
  endpoint: string, 
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  sessionId?: string
): Promise<{ status: number; data: any; headers: any }> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: any = {
    'Content-Type': 'application/json',
  };
  
  if (sessionId) {
    headers['Cookie'] = `sessionId=${sessionId}`;
  }
  
  console.log(`\n🔄 ${method} ${endpoint}`);
  if (body) {
    console.log('📤 Request Body:', JSON.stringify(body, null, 2));
  }
  
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const data = await response.json();
    const responseHeaders = Object.fromEntries(response.headers.entries());
    
    console.log(`📊 Status: ${response.status}`);
    console.log('📥 Response:', JSON.stringify(data, null, 2));
    
    return {
      status: response.status,
      data,
      headers: responseHeaders
    };
  } catch (error) {
    console.error('❌ API Call Error:', error);
    throw error;
  }
};

// Extract session token from Set-Cookie header
const extractsessionId = (headers: any): string | null => {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return null;
  
  const sessionCookie = setCookie.find((cookie: string) => 
    cookie.startsWith('sessionId=')
  );
  
  if (!sessionCookie) return null;
  
  const match = sessionCookie.match(/sessionId=([^;]+)/);
  return match ? match[1] : null;
};

// Test functions
const testHealthCheck = async (): Promise<void> => {
  console.log('\n🏥 === HEALTH CHECK ===');
  const result = await apiCall('/health');
  
  if (result.status === 200) {
    console.log('✅ Health check passed');
  } else {
    throw new Error(`❌ Health check failed: ${result.status}`);
  }
};

const testCreateCompany = async (): Promise<{ company: any; user: any; sessionId: string }> => {
  console.log('\n🏢 === CREATE COMPANY WITH ADMIN USER ===');
  
  const requestBody = {
    ...TEST_COMPANY,
    admin: {
      email: TEST_USER.email,
      password: TEST_USER.password,
      profile: TEST_USER.profile
    }
  };
  
  const result = await apiCall('/api/companies', 'POST', requestBody);
  
  if (result.status === 201) {
    console.log('✅ Company created successfully');
    console.log(`📋 Company ID: ${result.data.company.id}`);
    console.log(`👤 User ID: ${result.data.user.id}`);
    console.log(`🔑 Session Token: ${result.data.sessionId}`);
    
    return {
      company: result.data.company,
      user: result.data.user,
      sessionId: result.data.sessionId
    };
  } else {
    throw new Error(`❌ Company creation failed: ${result.status} - ${result.data.error}`);
  }
};

const testGetSession = async (sessionId: string): Promise<void> => {
  console.log('\n🔍 === GET SESSION ===');
  
  const result = await apiCall('/api/auth/session', 'GET', undefined, sessionId);
  
  if (result.status === 200) {
    console.log('✅ Session retrieved successfully');
    console.log(`👤 User: ${result.data.user.email}`);
    console.log(`🏢 Company: ${result.data.company?.name || 'None'}`);
  } else {
    throw new Error(`❌ Get session failed: ${result.status} - ${result.data.error}`);
  }
};

const testLogout = async (sessionId: string): Promise<void> => {
  console.log('\n🚪 === LOGOUT ===');
  
  const result = await apiCall('/api/auth/logout', 'POST', {}, sessionId);
  
  if (result.status === 200) {
    console.log('✅ Logout successful');
  } else {
    throw new Error(`❌ Logout failed: ${result.status} - ${result.data.error}`);
  }
};

const testGetUserCompanies = async (): Promise<any[]> => {
  console.log('\n🏢 === GET USER COMPANIES ===');
  
  const requestBody = {
    email: TEST_USER.email,
    password: TEST_USER.password
  };
  
  const result = await apiCall('/api/auth/companies', 'POST', requestBody);
  
  if (result.status === 200) {
    console.log('✅ User companies retrieved successfully');
    console.log(`📊 Found ${result.data.length} companies`);
    
    result.data.forEach((company: any, index: number) => {
      console.log(`  ${index + 1}. ${company.name} (${company.role}) - ${company.slug}`);
    });
    
    return result.data;
  } else {
    throw new Error(`❌ Get user companies failed: ${result.status} - ${result.data.error}`);
  }
};

const testLogin = async (companyId?: string): Promise<string> => {
  console.log('\n🔐 === LOGIN ===');
  
  const requestBody: any = {
    email: TEST_USER.email,
    password: TEST_USER.password
  };
  
  if (companyId) {
    requestBody.companyId = companyId;
    console.log(`🏢 Logging in with company: ${companyId}`);
  }
  
  const result = await apiCall('/api/auth/login', 'POST', requestBody);
  
  if (result.status === 200) {
    console.log('✅ Login successful');
    
    // Extract session token from Set-Cookie header
    const sessionId = extractsessionId(result.headers);
    if (!sessionId) {
      throw new Error('❌ No session token found in response headers');
    }
    
    console.log(`🔑 Session Token: ${sessionId}`);
    console.log(`👤 User: ${result.data.user.email}`);
    console.log(`🏢 Company: ${result.data.company?.name || 'None'}`);
    
    return sessionId;
  } else {
    throw new Error(`❌ Login failed: ${result.status} - ${result.data.error}`);
  }
};

const testVerifySessionAfterLogin = async (sessionId: string): Promise<void> => {
  console.log('\n✅ === VERIFY SESSION AFTER LOGIN ===');
  
  const result = await apiCall('/api/auth/session', 'GET', undefined, sessionId);
  
  if (result.status === 200) {
    console.log('✅ Session verification successful');
    console.log(`👤 User: ${result.data.user.email}`);
    console.log(`🏢 Company: ${result.data.company?.name || 'None'}`);
  } else {
    throw new Error(`❌ Session verification failed: ${result.status} - ${result.data.error}`);
  }
};

// Main test flow
const runTests = async (): Promise<void> => {
  console.log('🚀 Starting DocPal API Flow Tests');
  console.log(`🌐 API Base URL: ${API_BASE_URL}`);
  console.log(`📧 Test User: ${TEST_USER.email}`);
  console.log(`🏢 Test Company: ${TEST_COMPANY.name}`);
  
  try {
    // Step 1: Health check
    await testHealthCheck();
    
    // Step 2: Create company with admin user (auto-login)
    const { company, user, sessionId: initialsessionId } = await testCreateCompany();
    
    // Step 3: Test session after company creation
    await testGetSession(initialsessionId);
    
    // Step 4: Test logout
    await testLogout(initialsessionId);
    
    // Step 5: Test get user companies (by email/password)
    const companies = await testGetUserCompanies();
    
    // Step 6: Test login with company context
    const companyId = companies.length > 0 ? companies[0].id : undefined;
    const newsessionId = await testLogin(companyId);
    
    // Step 7: Verify session after login
    await testVerifySessionAfterLogin(newsessionId);
    
    console.log('\n🎉 === ALL TESTS PASSED ===');
    console.log('✅ Company creation with admin user');
    console.log('✅ Session management');
    console.log('✅ Logout functionality');
    console.log('✅ Get user companies by credentials');
    console.log('✅ Login with company context');
    console.log('✅ Session verification');
    
  } catch (error) {
    console.error('\n💥 === TEST FAILED ===');
    console.error(error);
    process.exit(1);
  }
};

// Cleanup function (optional)
const cleanup = async (): Promise<void> => {
  console.log('\n🧹 === CLEANUP ===');
  console.log('ℹ️  Note: This is a test environment. In production, you might want to clean up test data.');
  // In a real scenario, you might want to delete the test company and user
  // For now, we'll just log this message
};

// Run the tests
if (require.main === module) {
  runTests()
    .then(() => cleanup())
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { runTests, cleanup };
