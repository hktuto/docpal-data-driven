import { analyzeFile, confirmImport, generateImportId, storeImportFile } from '../../api/src/services/import/import_service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Basic Import Functionality Tests
 * Tests the core import functionality with various file types and scenarios
 */

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const testResults: TestResult[] = [];

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

async function createTestFile(filename: string, content: string): Promise<string> {
  const tempDir = path.join(process.cwd(), 'temp', 'test-data');
  await fs.promises.mkdir(tempDir, { recursive: true });
  const filePath = path.join(tempDir, filename);
  await fs.promises.writeFile(filePath, content);
  return filePath;
}

async function cleanupTestFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Test Cases
async function testBasicCSVParsing() {
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'simple.csv');
  
  try {
    const importId = generateImportId();
    const companyId = 'test-company';
    
    storeImportFile(importId, filePath, 'simple.csv', companyId);
    const result = await analyzeFile(importId, filePath, 'simple.csv', companyId);
    
    if (result.status !== 'completed') {
      throw new Error(`Expected status 'completed', got '${result.status}'`);
    }
    
    if (result.totalRows !== 5) {
      throw new Error(`Expected 5 rows, got ${result.totalRows}`);
    }
    
    if (result.columns.length !== 5) {
      throw new Error(`Expected 5 columns, got ${result.columns.length}`);
    }
    
    // Check specific column detection
    const nameColumn = result.columns.find(col => col.originalName === 'name');
    if (!nameColumn || nameColumn.suggestedType !== 'varchar') {
      throw new Error('Name column type detection failed');
    }
    
    const emailColumn = result.columns.find(col => col.originalName === 'email');
    if (!emailColumn || emailColumn.suggestedType !== 'varchar') {
      throw new Error('Email column type detection failed');
    }
    
    const ageColumn = result.columns.find(col => col.originalName === 'age');
    if (!ageColumn || ageColumn.suggestedType !== 'int') {
      throw new Error('Age column type detection failed');
    }
    
    const activeColumn = result.columns.find(col => col.originalName === 'is_active');
    if (!activeColumn || activeColumn.suggestedType !== 'boolean') {
      throw new Error('Boolean column type detection failed');
    }
    
  } finally {
    await cleanupTestFile(filePath);
  }
}

async function testEmptyFile() {
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'empty.csv');
  
  try {
    const importId = generateImportId();
    const companyId = 'test-company';
    
    storeImportFile(importId, filePath, 'empty.csv', companyId);
    const result = await analyzeFile(importId, filePath, 'empty.csv', companyId);
    
    // Empty files might be handled differently - let's check what actually happens
    if (result.status === 'error' && result.errors.length > 0) {
      console.log(`   - Empty file correctly caused error: ${result.errors.join(', ')}`);
    } else if (result.status === 'completed' && result.totalRows === 0) {
      console.log(`   - Empty file handled gracefully with 0 rows`);
    } else {
      throw new Error(`Unexpected empty file handling: status=${result.status}, rows=${result.totalRows}, errors=${result.errors.length}`);
    }
    
  } finally {
    await cleanupTestFile(filePath);
  }
}

async function testMalformedCSV() {
  const malformedContent = `name,email,age
John Doe,john@example.com,25
Jane Smith,jane@example.com,30,extra_column
Bob Johnson,bob@example.com`;

  const filePath = await createTestFile('test-malformed.csv', malformedContent);
  
  try {
    const importId = generateImportId();
    const companyId = 'test-company';
    
    storeImportFile(importId, filePath, 'test-malformed.csv', companyId);
    const result = await analyzeFile(importId, filePath, 'test-malformed.csv', companyId);
    
    // Should still parse - malformed CSV might be handled gracefully
    if (result.status !== 'completed') {
      throw new Error(`Expected status 'completed' for malformed CSV, got '${result.status}'`);
    }
    
    console.log(`   - Malformed CSV parsed with ${result.totalRows} rows`);
    if (result.warnings.length > 0) {
      console.log(`   - Warnings: ${result.warnings.join(', ')}`);
    } else {
      console.log(`   - No warnings (CSV parsed successfully despite malformation)`);
    }
    
  } finally {
    await cleanupTestFile(filePath);
  }
}

async function testSpecialCharacters() {
  const specialContent = `"Name with spaces","Email@domain.com","Age (years)","Is Active?"
"John O'Connor","john@example.com","25","Yes"
"Jane Smith-Jones","jane@example.com","30","No"`;

  const filePath = await createTestFile('test-special.csv', specialContent);
  
  try {
    const importId = generateImportId();
    const companyId = 'test-company';
    
    storeImportFile(importId, filePath, 'test-special.csv', companyId);
    const result = await analyzeFile(importId, filePath, 'test-special.csv', companyId);
    
    if (result.status !== 'completed') {
      throw new Error(`Expected status 'completed', got '${result.status}'`);
    }
    
    // Check column name sanitization
    const nameColumn = result.columns.find(col => col.originalName === 'Name with spaces');
    if (!nameColumn) {
      throw new Error('Column with spaces not found');
    }
    
    if (nameColumn.suggestedName !== 'name_with_spaces') {
      throw new Error(`Expected sanitized name 'name_with_spaces', got '${nameColumn.suggestedName}'`);
    }
    
  } finally {
    await cleanupTestFile(filePath);
  }
}

async function testLargeFile() {
  // Generate a large CSV file
  const headers = 'name,email,age,department,salary\n';
  const rows = Array.from({ length: 100 }, (_, i) => 
    `Employee ${i},employee${i}@company.com,${20 + (i % 40)},Dept${i % 10},${30000 + (i * 1000)}\n`
  ).join('');
  
  const largeContent = headers + rows;
  const filePath = await createTestFile('test-large.csv', largeContent);
  
  try {
    const importId = generateImportId();
    const companyId = 'test-company';
    
    storeImportFile(importId, filePath, 'test-large.csv', companyId);
    const startTime = Date.now();
    const result = await analyzeFile(importId, filePath, 'test-large.csv', companyId);
    const duration = Date.now() - startTime;
    
    if (result.status !== 'completed') {
      throw new Error(`Expected status 'completed', got '${result.status}'`);
    }
    
    if (result.totalRows !== 100) {
      throw new Error(`Expected 100 rows, got ${result.totalRows}`);
    }
    
    if (duration > 5000) { // 5 seconds
      throw new Error(`Analysis took too long: ${duration}ms`);
    }
    
  } finally {
    await cleanupTestFile(filePath);
  }
}

async function testColumnTypeDetection() {
  const typeTestContent = `uuid_field,email_field,date_field,number_field,boolean_field,json_field
550e8400-e29b-41d4-a716-446655440000,test@example.com,2023-01-15,123.45,true,"{""key"": ""value""}"
550e8400-e29b-41d4-a716-446655440001,user@domain.org,2023-02-20,67.89,false,"{""id"": 123}"`;

  const filePath = await createTestFile('test-types.csv', typeTestContent);
  
  try {
    const importId = generateImportId();
    const companyId = 'test-company';
    
    storeImportFile(importId, filePath, 'test-types.csv', companyId);
    const result = await analyzeFile(importId, filePath, 'test-types.csv', companyId);
    
    if (result.status !== 'completed') {
      throw new Error(`Expected status 'completed', got '${result.status}'`);
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
    
    const dateColumn = result.columns.find(col => col.originalName === 'date_field');
    if (!dateColumn || !['date', 'timestamp'].includes(dateColumn.suggestedType)) {
      throw new Error('Date type detection failed');
    }
    
    const numberColumn = result.columns.find(col => col.originalName === 'number_field');
    if (!numberColumn || !['decimal', 'float'].includes(numberColumn.suggestedType)) {
      throw new Error('Number type detection failed');
    }
    
    const booleanColumn = result.columns.find(col => col.originalName === 'boolean_field');
    if (!booleanColumn || booleanColumn.suggestedType !== 'boolean') {
      throw new Error('Boolean type detection failed');
    }
    
    const jsonColumn = result.columns.find(col => col.originalName === 'json_field');
    if (!jsonColumn || jsonColumn.suggestedType !== 'jsonb') {
      throw new Error('JSON type detection failed');
    }
    
  } finally {
    await cleanupTestFile(filePath);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Import Feature Basic Tests...\n');
  
  await runTest('Basic CSV Parsing', testBasicCSVParsing);
  await runTest('Empty File Handling', testEmptyFile);
  await runTest('Malformed CSV Handling', testMalformedCSV);
  await runTest('Special Characters', testSpecialCharacters);
  await runTest('Large File Processing', testLargeFile);
  await runTest('Column Type Detection', testColumnTypeDetection);
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
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
  
  console.log('\n' + (failed === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed.'));
  
  return failed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests };
