import { parseFile, analyzeColumns } from '../../api/src/services/import/file_parser';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test script to verify file parsing functionality
 */
async function testFileParsing() {
  console.log('🧪 Testing file parsing functionality...');
  
  try {
    // Create a test CSV file
    const testCsvContent = `name,email,age,is_active,created_date
John Doe,john@example.com,25,true,2023-01-15
Jane Smith,jane@example.com,30,false,2023-02-20
Bob Johnson,bob@example.com,35,true,2023-03-10`;
    
    const tempDir = path.join(process.cwd(), 'temp', 'test');
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    const testFilePath = path.join(tempDir, 'test.csv');
    await fs.promises.writeFile(testFilePath, testCsvContent);
    
    console.log('📁 Created test CSV file:', testFilePath);
    
    // Parse the file
    console.log('🔍 Parsing file...');
    const parsedData = await parseFile(testFilePath);
    
    console.log('✅ File parsed successfully:');
    console.log('   - Columns:', parsedData.columns);
    console.log('   - Total rows:', parsedData.totalRows);
    console.log('   - Sample data:', parsedData.rows.slice(0, 2));
    
    // Analyze columns
    console.log('🔍 Analyzing columns...');
    const columnAnalysis = analyzeColumns(parsedData);
    
    console.log('✅ Column analysis completed:');
    columnAnalysis.forEach(col => {
      console.log(`   - ${col.originalName} → ${col.suggestedName} (${col.suggestedType}) [confidence: ${col.confidence}]`);
      if (col.issues.length > 0) {
        console.log(`     Issues: ${col.issues.join(', ')}`);
      }
      console.log(`     Sample values: ${col.sampleValues.slice(0, 3).join(', ')}`);
    });
    
    // Cleanup
    await fs.promises.unlink(testFilePath);
    console.log('🧹 Cleaned up test file');
    
  } catch (error) {
    console.error('❌ Error testing file parsing:');
    console.error('   Error:', error instanceof Error ? error.message : String(error));
  }
}

// Run the test
testFileParsing().catch(console.error);
