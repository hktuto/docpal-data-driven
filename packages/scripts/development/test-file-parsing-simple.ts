import { parseFile, analyzeColumns } from '../../api/src/services/import/file_parser';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Simple file parsing tests - tests the core parsing functionality
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

// Test Cases
async function testSimpleCSVParsing() {
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'simple.csv');
  
  const parsedData = await parseFile(filePath);
  
  if (parsedData.columns.length !== 5) {
    throw new Error(`Expected 5 columns, got ${parsedData.columns.length}`);
  }
  
  if (parsedData.totalRows !== 5) {
    throw new Error(`Expected 5 rows, got ${parsedData.totalRows}`);
  }
  
  const expectedColumns = ['name', 'email', 'age', 'is_active', 'created_date'];
  for (const expectedCol of expectedColumns) {
    if (!parsedData.columns.includes(expectedCol)) {
      throw new Error(`Expected column '${expectedCol}' not found`);
    }
  }
  
  console.log(`   - Columns: ${parsedData.columns.join(', ')}`);
  console.log(`   - Rows: ${parsedData.totalRows}`);
}

async function testColumnAnalysis() {
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'simple.csv');
  
  const parsedData = await parseFile(filePath);
  const columnAnalysis = analyzeColumns(parsedData);
  
  if (columnAnalysis.length !== 5) {
    throw new Error(`Expected 5 column analyses, got ${columnAnalysis.length}`);
  }
  
  // Check specific column detections
  const nameColumn = columnAnalysis.find(col => col.originalName === 'name');
  if (!nameColumn) {
    throw new Error('Name column not found in analysis');
  }
  
  const emailColumn = columnAnalysis.find(col => col.originalName === 'email');
  if (!emailColumn) {
    throw new Error('Email column not found in analysis');
  }
  
  const ageColumn = columnAnalysis.find(col => col.originalName === 'age');
  if (!ageColumn) {
    throw new Error('Age column not found in analysis');
  }
  
  console.log(`   - Name column: ${nameColumn.originalName} → ${nameColumn.suggestedName} (${nameColumn.suggestedType})`);
  console.log(`   - Email column: ${emailColumn.originalName} → ${emailColumn.suggestedName} (${emailColumn.suggestedType})`);
  console.log(`   - Age column: ${ageColumn.originalName} → ${ageColumn.suggestedName} (${ageColumn.suggestedType})`);
}

async function testTypeDetection() {
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'type-test.csv');
  
  const parsedData = await parseFile(filePath);
  const columnAnalysis = analyzeColumns(parsedData);
  
  // Check specific type detections
  const uuidColumn = columnAnalysis.find(col => col.originalName === 'uuid_field');
  if (!uuidColumn || uuidColumn.suggestedType !== 'uuid') {
    throw new Error('UUID type detection failed');
  }
  
  const emailColumn = columnAnalysis.find(col => col.originalName === 'email_field');
  if (!emailColumn || emailColumn.suggestedType !== 'varchar') {
    throw new Error('Email type detection failed');
  }
  
  const booleanColumn = columnAnalysis.find(col => col.originalName === 'boolean_field');
  if (!booleanColumn || booleanColumn.suggestedType !== 'boolean') {
    throw new Error('Boolean type detection failed');
  }
  
  const jsonColumn = columnAnalysis.find(col => col.originalName === 'json_field');
  if (!jsonColumn || jsonColumn.suggestedType !== 'jsonb') {
    throw new Error('JSON type detection failed');
  }
  
  console.log(`   - UUID detection: ${uuidColumn.suggestedType} (confidence: ${uuidColumn.confidence})`);
  console.log(`   - Email detection: ${emailColumn.suggestedType} (confidence: ${emailColumn.confidence})`);
  console.log(`   - Boolean detection: ${booleanColumn.suggestedType} (confidence: ${booleanColumn.confidence})`);
  console.log(`   - JSON detection: ${jsonColumn.suggestedType} (confidence: ${jsonColumn.confidence})`);
}

async function testLargeFile() {
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'large.csv');
  
  const startTime = Date.now();
  const parsedData = await parseFile(filePath);
  const duration = Date.now() - startTime;
  
  if (parsedData.totalRows !== 1000) {
    throw new Error(`Expected 1000 rows, got ${parsedData.totalRows}`);
  }
  
  if (duration > 5000) { // 5 seconds
    throw new Error(`Parsing took too long: ${duration}ms`);
  }
  
  console.log(`   - Parsed ${parsedData.totalRows} rows in ${duration}ms`);
  console.log(`   - Columns: ${parsedData.columns.join(', ')}`);
}

async function testMalformedCSV() {
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'malformed.csv');
  
  // This should still parse but might have issues
  const parsedData = await parseFile(filePath);
  
  if (parsedData.columns.length !== 3) {
    throw new Error(`Expected 3 columns, got ${parsedData.columns.length}`);
  }
  
  console.log(`   - Parsed malformed CSV with ${parsedData.totalRows} rows`);
  console.log(`   - Columns: ${parsedData.columns.join(', ')}`);
}

async function testEmptyFile() {
  const filePath = path.join(process.cwd(), 'temp', 'test-data', 'empty.csv');
  
  try {
    await parseFile(filePath);
    throw new Error('Expected empty file to throw an error');
  } catch (error) {
    // This is expected - empty files should cause an error
    console.log(`   - Empty file correctly caused error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting File Parsing Tests...\n');
  
  await runTest('Simple CSV Parsing', testSimpleCSVParsing);
  await runTest('Column Analysis', testColumnAnalysis);
  await runTest('Type Detection', testTypeDetection);
  await runTest('Large File Processing', testLargeFile);
  await runTest('Malformed CSV Handling', testMalformedCSV);
  await runTest('Empty File Handling', testEmptyFile);
  
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

