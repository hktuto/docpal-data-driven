import { createSchema } from '../../api/src/services/schema/schema_service';

/**
 * Test script to verify that schema creation works with empty columns array
 */
async function testEmptyColumnsSchema() {
  console.log('🧪 Testing schema creation with empty columns array...');
  
  try {
    // Test data with empty columns array
    const schemaData = {
      slug: 'test_empty_columns',
      label: 'Test Empty Columns',
      description: 'A test table with no custom columns',
      columns: [] // Empty array - this should now work
    };
    
    // Mock company and user IDs for testing
    const companyId = 'test-company-id';
    const userId = 'test-user-id';
    
    console.log('📝 Schema data:', JSON.stringify(schemaData, null, 2));
    
    // This should not throw an error anymore
    const result = await createSchema(companyId, userId, schemaData);
    
    console.log('✅ Success! Schema created with empty columns:');
    console.log('   - ID:', result.id);
    console.log('   - Slug:', result.slug);
    console.log('   - Columns count:', result.columns.length);
    console.log('   - System columns will be: id, created_at, updated_at, created_by');
    
  } catch (error) {
    console.error('❌ Error creating schema with empty columns:');
    console.error('   Error:', error instanceof Error ? error.message : String(error));
  }
}

// Run the test
testEmptyColumnsSchema().catch(console.error);
