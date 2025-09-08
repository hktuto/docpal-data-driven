#!/usr/bin/env tsx

/**
 * Import Feature Test Runner
 * Orchestrates the complete testing of the import feature
 */

import { generateAllTestData } from './generate-test-data';
import { runAllTests } from './test-import-basic';

async function runImportTests() {
  console.log('🚀 DocPal Import Feature Test Suite');
  console.log('=====================================\n');
  
  try {
    // Step 1: Generate test data
    console.log('📁 Step 1: Generating test data files...');
    await generateAllTestData();
    console.log('');
    
    // Step 2: Run basic functionality tests
    console.log('🧪 Step 2: Running basic functionality tests...');
    const basicTestsPassed = await runAllTests();
    console.log('');
    
    // Step 3: Summary
    console.log('📊 Test Suite Summary');
    console.log('====================');
    
    if (basicTestsPassed) {
      console.log('✅ All basic tests passed!');
      console.log('🎯 Import feature is ready for integration testing.');
    } else {
      console.log('❌ Some basic tests failed.');
      console.log('🔧 Please fix the failing tests before proceeding.');
    }
    
    console.log('\n📋 Next Steps:');
    console.log('1. Run integration tests with real API endpoints');
    console.log('2. Test with actual database connections');
    console.log('3. Perform load testing with large files');
    console.log('4. Test error scenarios and edge cases');
    console.log('5. Validate user experience and error messages');
    
    return basicTestsPassed;
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    return false;
  }
}

// Run the test suite
if (require.main === module) {
  runImportTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runImportTests };
