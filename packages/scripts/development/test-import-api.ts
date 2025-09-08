import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import axios, { AxiosInstance } from 'axios';

/**
 * API Integration Tests for Import Feature
 * Tests the complete import flow through HTTP endpoints
 */

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  duration: number;
}

interface AuthResponse {
  user: {
    id: string;
    companyId: string;
    email: string;
    role: string;
  };
  sessionToken: string;
}

interface CompanyResponse {
  id: string;
  name: string;
  slug: string;
  adminUserId: string;
}

interface ImportAnalysisResponse {
  importId: string;
  status: 'analyzing' | 'completed' | 'error';
  fileName: string;
  totalRows: number;
  columns: Array<{
    originalName: string;
    suggestedName: string;
    suggestedType: string;
    confidence: number;
    sampleValues: string[];
    issues: string[];
    nullable: boolean;
  }>;
  sampleData: Record<string, any>[];
  warnings: string[];
  errors: string[];
  createdAt: string;
  expiresAt: string;
}

interface ImportConfirmationRequest {
  importId: string;
  columnMappings: Array<{
    originalName: string;
    targetName: string;
    dataType: string;
    nullable: boolean;
    skip: boolean;
  }>;
  schemaAction: {
    type: 'create';
    slug: string;
    label: string;
    description: string;
  };
}

interface ImportConfirmationResponse {
  success: boolean;
  schemaSlug: string;
  importedRows: number;
  errors: string[];
  warnings: string[];
}

const testResults: TestResult[] = [];
let apiClient: AxiosInstance;
let authData: AuthResponse | null = null;

async function runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
  const startTime = Date.now();
  try {
    console.log(`🧪 Running test: ${testName}`);
    await testFn();
    const duration = Date.now() - startTime;
    testResults.push({ testName, passed: true, duration });
    console.log(`✅ ${testName} - PASSED (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    testResults.push({ testName, passed: false, error: errorMessage, duration });
    console.log(`❌ ${testName} - FAILED (${duration}ms): ${errorMessage}`);
  }
}

async function setupAPIClient() {
  const baseURL = process.env.API_URL || 'http://localhost:3333';
  
  apiClient = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add request interceptor to include auth token
  apiClient.interceptors.request.use((config) => {
    if (authData?.sessionToken) {
      config.headers.Cookie = `sessionId=${authData.sessionToken}`;
      console.log(`🔐 Adding session cookie: sessionId=${authData.sessionToken}`);
    } else {
      console.log(`❌ No session token available for request to ${config.url}`);
    }
    return config;
  });

  console.log(`🔗 API Client configured for: ${baseURL}`);
}

async function createCompanyAndAuthenticate(): Promise<void> {
  try {
    const email = `admin-${Date.now()}@test.com`;
    const companyName = `Test Company ${Date.now()}`;
    const companySlug = companyName.toLowerCase().replaceAll(' ', '-');
      // Step 1: Create a new company with admin user
      const companyData = {
        name: companyName,
        slug: companySlug,
        admin: {
          email: email,
          password: 'TestPassword123!',
          profile: {
            name: 'Test Admin',
            email: email,
            phone: '1234567890',
            address: '123 Main St',
            preferences: {}
          }
        }
      };

    console.log(`🏢 Creating company: ${companyData.name}`);
    const companyResponse = await apiClient.post('/api/companies', companyData);

    if (companyResponse.status !== 201) {
      throw new Error(`Company creation failed with status ${companyResponse.status}: ${JSON.stringify(companyResponse.data)}`);
    }

    console.log(`🔍 Company response data:`, JSON.stringify(companyResponse.data, null, 2));
    const companyResponseData = companyResponse.data;
    const company = companyResponseData.company;
    console.log(`✅ Company created: ${company.name} (ID: ${company.id})`);

    // Step 2: Login as the admin user
    const loginData = {
      email: companyData.admin.email,
      password: companyData.admin.password,
      companyId: company.id
    };

    console.log(`🔐 Logging in as admin user: ${loginData.email}`);
    const loginResponse = await apiClient.post('/api/auth/login', loginData);

    if (loginResponse.status !== 200) {
      throw new Error(`Login failed with status ${loginResponse.status}: ${JSON.stringify(loginResponse.data)}`);
    }

    // Extract session token from cookies
    const cookies = loginResponse.headers['set-cookie'];
    let sessionToken = '';
    if (cookies) {
      const sessionCookie = cookies.find(cookie => cookie.startsWith('sessionId='));
      if (sessionCookie) {
        sessionToken = sessionCookie.split('=')[1].split(';')[0];
      }
    }

    authData = {
      user: {
        id: companyResponseData.user.id,
        companyId: company.id,
        email: companyData.admin.email,
        role: 'admin'
      },
      sessionToken
    };

    console.log(`✅ Authenticated as admin user: ${authData.user.email} (ID: ${authData.user.id})`);
    console.log(`🏢 Company context: ${company.name} (ID: ${company.id})`);

  } catch (error) {
    console.error('❌ Company creation and authentication failed:', error);
    throw error;
  }
}

async function uploadAndAnalyzeFile(filePath: string, fileName: string): Promise<ImportAnalysisResponse> {
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  formData.append('file', fileBuffer, {
    filename: fileName,
    contentType: 'text/csv'
  });
  
  console.log(`📁 Uploading file: ${fileName} (${fileBuffer.length} bytes)`);
  console.log(`📁 File path: ${filePath}`);
  console.log(`📁 FormData headers:`, formData.getHeaders());

  let response;
  try {
    response = await apiClient.post('/api/schemas/import/analyze', formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });
  } catch (error: any) {
    console.log(`❌ Upload request failed:`, error.response?.data || error.message);
    throw new Error(`Upload request failed: ${JSON.stringify(error.response?.data || error.message)}`);
  }

  if (response.status !== 200) {
    console.log(`❌ Upload failed with status ${response.status}:`, JSON.stringify(response.data, null, 2));
    throw new Error(`Upload failed with status ${response.status}: ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

async function getImportAnalysis(importId: string): Promise<ImportAnalysisResponse> {
  const response = await apiClient.get(`/api/schemas/import/${importId}`);
  
  if (response.status !== 200) {
    throw new Error(`Get analysis failed with status ${response.status}: ${response.data}`);
  }

  return response.data;
}

async function confirmImport(request: ImportConfirmationRequest): Promise<ImportConfirmationResponse> {
  const response = await apiClient.post('/api/schemas/import/confirm', request);
  
  if (response.status !== 200) {
    console.log(`❌ Confirm import failed with status ${response.status}:`, JSON.stringify(response.data, null, 2));
    throw new Error(`Confirm import failed with status ${response.status}: ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

async function verifySchemaExists(schemaSlug: string): Promise<boolean> {
  try {
    const response = await apiClient.get(`/api/schemas/${schemaSlug}`);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Test Cases
async function testCreateFirstSchema() {
  // Step 2: Create a schema first
  const schemaData = {
    slug: `first_schema_${Date.now()}`,
    label: 'First Test Schema',
    description: 'Schema created before import test',
    columns: [
      {
        name: 'name',
        data_type: 'varchar',
        nullable: false,
        view_type: 'text',
        view_editor: 'input',
        data_type_options: { length: 255 },
        is_relation: false
      },
      {
        name: 'email',
        data_type: 'varchar',
        nullable: false,
        view_type: 'text',
        view_editor: 'input',
        data_type_options: { length: 255 },
        is_relation: false
      },
      {
        name: 'age',
        data_type: 'int',
        nullable: true,
        view_type: 'number',
        view_editor: 'input',
        data_type_options: {},
        is_relation: false
      }
    ]
  };

  const response = await apiClient.post('/api/schemas', schemaData);
  
  if (response.status !== 201) {
    throw new Error(`Schema creation failed with status ${response.status}: ${JSON.stringify(response.data)}`);
  }

  const schema = response.data;
  console.log(`   - First schema created: ${schema.slug} (ID: ${schema.id})`);
  console.log(`   - Columns: ${schema.columns.length}`);
  
  return schema;
}

async function testVerifyFirstSchema(schema: any) {
  // Step 3: Verify the first schema exists
  const response = await apiClient.get(`/api/schemas/${schema.slug}`);
  
  if (response.status !== 200) {
    throw new Error(`Schema verification failed with status ${response.status}`);
  }

  const retrievedSchema = response.data;
  
  if (retrievedSchema.slug !== schema.slug) {
    throw new Error(`Schema slug mismatch: expected ${schema.slug}, got ${retrievedSchema.slug}`);
  }

  if (retrievedSchema.columns.length !== 3) {
    throw new Error(`Expected 3 columns, got ${retrievedSchema.columns.length}`);
  }

  console.log(`   - Schema verified: ${retrievedSchema.slug}`);
  console.log(`   - Label: ${retrievedSchema.label}`);
  console.log(`   - Columns: ${retrievedSchema.columns.map((c: any) => c.name).join(', ')}`);
  
  return retrievedSchema;
}

async function testImportToNewSchema() {
  // Step 4: Import data to create a new schema
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'simple.csv');
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Test file not found: ${filePath}`);
  }

  // Upload and analyze
  const analysisResult = await uploadAndAnalyzeFile(filePath, 'simple.csv');
  
  // Prepare confirmation request to create new schema
  const columnMappings = analysisResult.columns.map(col => ({
    originalName: col.originalName,
    targetName: col.suggestedName,
    dataType: col.suggestedType,
    nullable: col.nullable,
    skip: false
  }));
  
  const confirmationRequest: ImportConfirmationRequest = {
    importId: analysisResult.importId,
    columnMappings,
    schemaAction: {
      type: 'create',
      slug: `imported_schema_${Date.now()}`,
      label: 'Imported Schema',
      description: 'Schema created from import test'
    }
  };
  
  // Confirm import (creates new schema)
  const importResult = await confirmImport(confirmationRequest);
  
  if (!importResult.success) {
    throw new Error(`Import failed: ${importResult.errors.join(', ')}`);
  }
  
  console.log(`   - New schema created: ${importResult.schemaSlug}`);
  console.log(`   - Rows imported: ${importResult.importedRows}`);
  
  return importResult;
}

async function testReviewImportData(importResult: any) {
  // Step 5: Review the imported data by checking the schema
  const response = await apiClient.get(`/api/schemas/${importResult.schemaSlug}`);
  
  if (response.status !== 200) {
    throw new Error(`Failed to retrieve imported schema: ${response.status}`);
  }

  const schema = response.data;
  
  console.log(`   - Imported schema: ${schema.slug}`);
  console.log(`   - Label: ${schema.label}`);
  console.log(`   - Description: ${schema.description}`);
  console.log(`   - Columns: ${schema.columns.length}`);
  console.log(`   - Column names: ${schema.columns.map((c: any) => c.name).join(', ')}`);
  
  return schema;
}

async function testCreateSecondSchema() {
  // Step 6: Create another schema
  const schemaData = {
    slug: `second_schema_${Date.now()}`,
    label: 'Second Test Schema',
    description: 'Second schema for import test',
    columns: [
      {
        name: 'product_name',
        data_type: 'varchar',
        nullable: false,
        view_type: 'text',
        view_editor: 'input',
        data_type_options: { length: 255 },
        is_relation: false
      },
      {
        name: 'price',
        data_type: 'decimal',
        nullable: false,
        view_type: 'number',
        view_editor: 'input',
        data_type_options: { precision: 10, scale: 2 },
        is_relation: false
      }
    ]
  };

  const response = await apiClient.post('/api/schemas', schemaData);
  
  if (response.status !== 201) {
    throw new Error(`Second schema creation failed with status ${response.status}: ${JSON.stringify(response.data)}`);
  }

  const schema = response.data;
  console.log(`   - Second schema created: ${schema.slug} (ID: ${schema.id})`);
  console.log(`   - Columns: ${schema.columns.length}`);
  
  return schema;
}

async function testImportToExistingSchema(existingSchema: any) {
  // Step 7: Import data to the existing schema
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'simple.csv');
  
  // Upload and analyze
  const analysisResult = await uploadAndAnalyzeFile(filePath, 'simple.csv');
  
  // Map columns to existing schema structure
  const columnMappings = analysisResult.columns.map(col => ({
    originalName: col.originalName,
    targetName: col.suggestedName, // This should match existing schema columns
    dataType: col.suggestedType,
    nullable: col.nullable,
    skip: false
  }));
  
  const confirmationRequest: ImportConfirmationRequest = {
    importId: analysisResult.importId,
    columnMappings,
    schemaAction: {
      type: 'update',
      existingSlug: existingSchema.slug
    }
  };
  
  // Confirm import to existing schema
  const importResult = await confirmImport(confirmationRequest);
  
  if (!importResult.success) {
    throw new Error(`Import to existing schema failed: ${importResult.errors.join(', ')}`);
  }
  
  console.log(`   - Data imported to existing schema: ${importResult.schemaSlug}`);
  console.log(`   - Rows imported: ${importResult.importedRows}`);
  console.log(`   - Warnings: ${importResult.warnings.length}`);
  
  return importResult;
}

async function testReviewExistingSchemaData(importResult: any) {
  // Step 9: Review data in the existing schema
  const response = await apiClient.get(`/api/schemas/${importResult.schemaSlug}`);
  
  if (response.status !== 200) {
    throw new Error(`Failed to retrieve existing schema: ${response.status}`);
  }

  const schema = response.data;
  
  console.log(`   - Existing schema: ${schema.slug}`);
  console.log(`   - Label: ${schema.label}`);
  console.log(`   - Columns: ${schema.columns.length}`);
  console.log(`   - Column names: ${schema.columns.map((c: any) => c.name).join(', ')}`);
  
  return schema;
}

async function testFileUploadAndAnalysis() {
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'simple.csv');
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Test file not found: ${filePath}`);
  }

  const result = await uploadAndAnalyzeFile(filePath, 'simple.csv');
  
  // Validate response structure
  if (!result.importId) {
    throw new Error('Missing importId in response');
  }
  
  if (result.status !== 'completed') {
    throw new Error(`Expected status 'completed', got '${result.status}'`);
  }
  
  if (result.fileName !== 'simple.csv') {
    throw new Error(`Expected fileName 'simple.csv', got '${result.fileName}'`);
  }
  
  if (result.totalRows !== 5) {
    throw new Error(`Expected 5 rows, got ${result.totalRows}`);
  }
  
  if (result.columns.length !== 5) {
    throw new Error(`Expected 5 columns, got ${result.columns.length}`);
  }
  
  // Check specific columns
  const nameColumn = result.columns.find(col => col.originalName === 'name');
  if (!nameColumn) {
    throw new Error('Name column not found in analysis');
  }
  
  const emailColumn = result.columns.find(col => col.originalName === 'email');
  if (!emailColumn) {
    throw new Error('Email column not found in analysis');
  }
  
  console.log(`   - Import ID: ${result.importId}`);
  console.log(`   - File: ${result.fileName}`);
  console.log(`   - Rows: ${result.totalRows}`);
  console.log(`   - Columns: ${result.columns.length}`);
  console.log(`   - Name column: ${nameColumn.originalName} → ${nameColumn.suggestedName} (${nameColumn.suggestedType})`);
  console.log(`   - Email column: ${emailColumn.originalName} → ${emailColumn.suggestedName} (${emailColumn.suggestedType})`);
  
  return result;
}

async function testGetImportAnalysis() {
  // First upload a file to get an import ID
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'simple.csv');
  const uploadResult = await uploadAndAnalyzeFile(filePath, 'simple.csv');
  
  // Now test retrieving the analysis
  const result = await getImportAnalysis(uploadResult.importId);
  
  // Validate the retrieved data matches the uploaded data
  if (result.importId !== uploadResult.importId) {
    throw new Error(`Import ID mismatch: expected ${uploadResult.importId}, got ${result.importId}`);
  }
  
  if (result.status !== 'completed') {
    throw new Error(`Expected status 'completed', got '${result.status}'`);
  }
  
  if (result.totalRows !== uploadResult.totalRows) {
    throw new Error(`Row count mismatch: expected ${uploadResult.totalRows}, got ${result.totalRows}`);
  }
  
  console.log(`   - Retrieved analysis for import ID: ${result.importId}`);
  console.log(`   - Status: ${result.status}`);
  console.log(`   - Rows: ${result.totalRows}`);
  console.log(`   - Columns: ${result.columns.length}`);
}

async function testCompleteImportFlow() {
  // Step 1: Upload and analyze
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'simple.csv');
  const analysisResult = await uploadAndAnalyzeFile(filePath, 'simple.csv');
  
  // Step 2: Prepare confirmation request
  const columnMappings = analysisResult.columns.map(col => ({
    originalName: col.originalName,
    targetName: col.suggestedName,
    dataType: col.suggestedType,
    nullable: col.nullable,
    skip: false
  }));
  
  const confirmationRequest: ImportConfirmationRequest = {
    importId: analysisResult.importId,
    columnMappings,
    schemaAction: {
      type: 'create',
      slug: `test_import_${Date.now()}`,
      label: 'Test Import Schema',
      description: 'Schema created from API test'
    }
  };
  
  // Step 3: Confirm import
  const importResult = await confirmImport(confirmationRequest);
  
  if (!importResult.success) {
    throw new Error(`Import failed: ${importResult.errors.join(', ')}`);
  }
  
  if (importResult.importedRows !== analysisResult.totalRows) {
    throw new Error(`Row count mismatch: expected ${analysisResult.totalRows}, got ${importResult.importedRows}`);
  }
  
  // Step 4: Verify schema exists
  const schemaExists = await verifySchemaExists(importResult.schemaSlug);
  if (!schemaExists) {
    throw new Error(`Schema ${importResult.schemaSlug} was not created`);
  }
  
  console.log(`   - Schema created: ${importResult.schemaSlug}`);
  console.log(`   - Rows imported: ${importResult.importedRows}`);
  console.log(`   - Warnings: ${importResult.warnings.length}`);
  console.log(`   - Errors: ${importResult.errors.length}`);
  
  return importResult;
}

async function testInvalidFileType() {
  // Create a temporary text file
  const tempFilePath = path.join(process.cwd(), 'temp', 'invalid.txt');
  fs.writeFileSync(tempFilePath, 'This is not a CSV file');
  
  try {
    await uploadAndAnalyzeFile(tempFilePath, 'invalid.txt');
    throw new Error('Expected upload to fail for invalid file type');
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 400) {
      console.log(`   - Correctly rejected invalid file type: ${error.response.data.error}`);
    } else {
      throw error;
    }
  } finally {
    // Cleanup
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

async function testLargeFile() {
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'large.csv');
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Large test file not found: ${filePath}`);
  }

  const startTime = Date.now();
  const result = await uploadAndAnalyzeFile(filePath, 'large.csv');
  const duration = Date.now() - startTime;
  
  if (result.status !== 'completed') {
    throw new Error(`Expected status 'completed', got '${result.status}'`);
  }
  
  if (result.totalRows !== 1000) {
    throw new Error(`Expected 1000 rows, got ${result.totalRows}`);
  }
  
  if (duration > 10000) { // 10 seconds
    throw new Error(`Analysis took too long: ${duration}ms`);
  }
  
  console.log(`   - Large file processed: ${result.totalRows} rows`);
  console.log(`   - Duration: ${duration}ms`);
  console.log(`   - Columns: ${result.columns.length}`);
}

async function testTypeDetection() {
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'type-test.csv');
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Type test file not found: ${filePath}`);
  }

  const result = await uploadAndAnalyzeFile(filePath, 'type-test.csv');
  
  if (result.status !== 'completed') {
    throw new Error(`Expected status 'completed', got '${result.status}`);
  }
  
  // Check specific type detections
  const uuidColumn = result.columns.find(col => col.originalName === 'uuid_field');
  if (!uuidColumn || uuidColumn.suggestedType !== 'uuid') {
    throw new Error('UUID type detection failed');
  }
  
  const emailColumn = result.columns.find(col => col.originalName === 'email_field');
  if (!emailColumn || emailColumn.suggestedType !== 'varchar') {
    throw new Error('Email type detection failed');
  }
  
  const booleanColumn = result.columns.find(col => col.originalName === 'boolean_field');
  if (!booleanColumn || booleanColumn.suggestedType !== 'boolean') {
    throw new Error('Boolean type detection failed');
  }
  
  const jsonColumn = result.columns.find(col => col.originalName === 'json_field');
  if (!jsonColumn || jsonColumn.suggestedType !== 'jsonb') {
    throw new Error('JSON type detection failed');
  }
  
  console.log(`   - UUID detection: ${uuidColumn.suggestedType} (confidence: ${uuidColumn.confidence})`);
  console.log(`   - Email detection: ${emailColumn.suggestedType} (confidence: ${emailColumn.confidence})`);
  console.log(`   - Boolean detection: ${booleanColumn.suggestedType} (confidence: ${booleanColumn.confidence})`);
  console.log(`   - JSON detection: ${jsonColumn.suggestedType} (confidence: ${jsonColumn.confidence})`);
}

// Main test runner
async function runAPITests() {
  console.log('🚀 Starting Import Feature API Tests...\n');
  
  try {
    // Step 1: Setup and create company
    await setupAPIClient();
    await createCompanyAndAuthenticate();
    
    // Step 2: Create first schema
    let firstSchema: any;
    await runTest('Create First Schema', async () => {
      firstSchema = await testCreateFirstSchema();
    });
    
    // Step 3: Verify first schema
    await runTest('Verify First Schema', async () => {
      await testVerifyFirstSchema(firstSchema);
    });
    
    // Step 4: Import to create new schema
    let importResult1: any;
    await runTest('Import to New Schema', async () => {
      importResult1 = await testImportToNewSchema();
    });
    
    // Step 5: Review import data
    await runTest('Review Import Data', async () => {
      await testReviewImportData(importResult1);
    });
    
    // Step 6: Create second schema
    let secondSchema: any;
    await runTest('Create Second Schema', async () => {
      secondSchema = await testCreateSecondSchema();
    });
    
    // Step 7: Import to existing schema
    let importResult2: any;
    await runTest('Import to Existing Schema', async () => {
      importResult2 = await testImportToExistingSchema(secondSchema);
    });
    
    // Step 8: Confirm import (already done in step 7)
    console.log('✅ Import to existing schema confirmed');
    
    // Step 9: Review data in existing schema
    await runTest('Review Existing Schema Data', async () => {
      await testReviewExistingSchemaData(importResult2);
    });
    
    // Additional tests
    await runTest('Invalid File Type Handling', testInvalidFileType);
    await runTest('Large File Processing', testLargeFile);
    await runTest('Type Detection', testTypeDetection);
    
    // Summary
    console.log('\n📊 API Test Results Summary:');
    console.log('============================');
    
    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;
    const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`Total Tests: ${testResults.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Average Duration: ${Math.round(totalDuration / testResults.length)}ms`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.testName}: ${r.error}`);
      });
    }
    
    console.log('\n' + (failed === 0 ? '🎉 All API tests passed!' : '⚠️  Some API tests failed.'));
    
    return failed === 0;
    
  } catch (error) {
    console.error('❌ API test suite failed:', error);
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAPITests().catch(console.error);
}

export { runAPITests };
