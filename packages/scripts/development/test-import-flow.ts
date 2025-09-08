import { analyzeFile, confirmImport, generateImportId, storeImportFile } from '../../api/src/services/import/import_service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test script to verify the complete import flow
 */
async function testImportFlow() {
  console.log('🧪 Testing complete import flow...');
  
  try {
    // Create a test CSV file
    const testCsvContent = `name,email,age,is_active,created_date
John Doe,john@example.com,25,true,2023-01-15
Jane Smith,jane@example.com,30,false,2023-02-20
Bob Johnson,bob@example.com,35,true,2023-03-10`;
    
    const tempDir = path.join(process.cwd(), 'temp', 'import-test');
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    const testFilePath = path.join(tempDir, 'test-import.csv');
    await fs.promises.writeFile(testFilePath, testCsvContent);
    
    console.log('📁 Created test CSV file:', testFilePath);
    
    // Step 1: Generate import ID and store file
    const importId = generateImportId();
    const companyId = 'test-company-id';
    const fileName = 'test-import.csv';
    
    storeImportFile(importId, testFilePath, fileName, companyId);
    console.log('✅ Generated import ID:', importId);
    
    // Step 2: Analyze the file
    console.log('🔍 Analyzing file...');
    const analysisResult = await analyzeFile(importId, testFilePath, fileName, companyId);
    
    console.log('✅ File analysis completed:');
    console.log('   - Status:', analysisResult.status);
    console.log('   - Total rows:', analysisResult.totalRows);
    console.log('   - Columns found:', analysisResult.columns.length);
    console.log('   - Warnings:', analysisResult.warnings);
    console.log('   - Errors:', analysisResult.errors);
    
    if (analysisResult.columns.length > 0) {
      console.log('📊 Column analysis:');
      analysisResult.columns.forEach(col => {
        console.log(`   - ${col.originalName} → ${col.suggestedName} (${col.suggestedType}) [confidence: ${col.confidence}]`);
      });
    }
    
    // Step 3: Prepare confirmation request
    const columnMappings = analysisResult.columns.map(col => ({
      originalName: col.originalName,
      targetName: col.suggestedName,
      dataType: col.suggestedType,
      nullable: col.nullable,
      skip: false
    }));
    
    const confirmationRequest = {
      importId,
      columnMappings,
      schemaAction: {
        type: 'create' as const,
        slug: 'test_imported_data',
        label: 'Test Imported Data',
        description: 'Data imported from test CSV file'
      }
    };
    
    console.log('📝 Prepared confirmation request:');
    console.log('   - Schema slug:', confirmationRequest.schemaAction.slug);
    console.log('   - Column mappings:', columnMappings.length);
    
    // Note: We can't actually run confirmImport here because it requires database connection
    // and would try to create a real schema. This is just to show the structure.
    console.log('⚠️  Skipping confirmImport test (requires database connection)');
    console.log('   The confirmation request structure is ready for use.');
    
    // Cleanup
    await fs.promises.unlink(testFilePath);
    console.log('🧹 Cleaned up test file');
    
  } catch (error) {
    console.error('❌ Error testing import flow:');
    console.error('   Error:', error instanceof Error ? error.message : String(error));
  }
}

// Run the test
testImportFlow().catch(console.error);

