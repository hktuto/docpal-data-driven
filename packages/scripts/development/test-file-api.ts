// Test script for the simplified file management API
// Tests upload, get, and delete operations

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3333/api';

// Test configuration
const testConfig = {
  email: 'filetest@example.com',
  password: 'password123',
  companyId: '', // Will be set after login
  tableName: 'test_documents', // Will be created during test
  rowId: '', // Will be created during test
};

let sessionCookie = '';

/**
 * Helper function to make authenticated requests
 */
const makeRequest = async (method: string, url: string, data?: any, headers?: any) => {
  try {
    const response = await axios({
      method,
      url: `${API_BASE}${url}`,
      data,
      headers: {
        'Cookie': sessionCookie,
        ...headers
      },
      maxRedirects: 0,
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });
    return response;
  } catch (error: any) {
    console.error(`Request failed: ${method} ${url}`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * Step 1: Create company (which returns admin session)
 */
const createCompany = async () => {
  console.log('🏢 Creating company...');
  
  const companyName = 'Test File Company ' + new Date().getTime();
  
  const createCompanyResponse = await makeRequest('POST', '/companies', {
    name: companyName,
    slug: companyName.toLowerCase().replace(/\s+/g, '-'),
    admin: {
      email: testConfig.email,
      password: testConfig.password,
      name: 'Test Admin',
      profile: {
        name: 'Test Admin',
        email: testConfig.email,
        phone: '1234567890',
        address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345',
        preferences: {}
      }
    }
  });
  
  sessionCookie = createCompanyResponse.headers['set-cookie']?.[0] || '';
  testConfig.companyId = createCompanyResponse.data.company.id;
  
  console.log(`✅ Company created: ${companyName} (${testConfig.companyId})`);
  console.log('✅ Admin session established');
};



/**
 * Step 2: Create test schema
 */
const createTestSchema = async () => {
  console.log('📋 Creating test schema...');
  
  try {
    const createSchemaResponse = await makeRequest('POST', '/schemas', {
      slug: testConfig.tableName,
      label: 'Test Documents',
      description: 'Table for testing file uploads',
      columns: [
        {
          name: 'title',
          data_type: 'varchar',
          data_type_options: { length: 255 },
          nullable: false,
          view_type: 'text',
          view_editor: 'input'
        },
        {
          name: 'document_file',
          data_type: 'text',
          nullable: true,
          view_type: 'text',
          view_editor: 'input'
        },
        {
          name: 'file_metadata',
          data_type: 'jsonb',
          nullable: true,
          view_type: 'json',
          view_editor: 'json_editor'
        }
      ]
    });
    
    console.log(`✅ Test schema created: ${testConfig.tableName}`);
  } catch (error: any) {
    if (error.response?.status === 409) {
      console.log(`✅ Using existing schema: ${testConfig.tableName}`);
    } else {
      throw error;
    }
  }
};

/**
 * Step 3: Create test record
 */
const createTestRecord = async () => {
  console.log('📝 Creating test record...');
  
  const createRecordResponse = await makeRequest('POST', `/records/${testConfig.tableName}`, {
    title: 'Test Document Record for File Upload'
  });
  
  testConfig.rowId = createRecordResponse.data.id;
  console.log(`✅ Test record created: ${testConfig.rowId}`);
};

/**
 * Step 4: Test file upload
 */
const testFileUpload = async () => {
  console.log('📤 Testing file upload...');
  
  // Create a test file
  const testContent = 'This is a test file for DocPal file management system.\nCreated at: ' + new Date().toISOString();
  const testFilePath = path.join(__dirname, 'test-file.txt');
  fs.writeFileSync(testFilePath, testContent);
  
  // Create form data
  const formData = new FormData();
  formData.append('file', fs.createReadStream(testFilePath));
  formData.append('table', testConfig.tableName);
  formData.append('column', 'document_file');
  formData.append('row', testConfig.rowId);
  formData.append('metadataField', 'file_metadata');
  formData.append('additionalData', JSON.stringify({
    title: 'Updated with file upload'
  }));
  
  const response = await axios.post(`${API_BASE}/files/upload`, formData, {
    headers: {
      'Cookie': sessionCookie,
      ...formData.getHeaders()
    }
  });
  
  // Update session cookie if a new one was set
  const setCookieHeader = response.headers['set-cookie'];
  if (setCookieHeader && setCookieHeader.length > 0) {
    // Find the sessionId cookie specifically
    const sessionIdCookie = setCookieHeader.find(cookie => cookie.startsWith('sessionId='));
    if (sessionIdCookie) {
      sessionCookie = sessionIdCookie.split(';')[0];
      console.log('Updated session cookie:', sessionCookie);
    }
  }
  
  // Clean up test file
  fs.unlinkSync(testFilePath);
  
  if (response.status !== 201) {
    throw new Error(`File upload failed: ${response.status} ${response.data?.error}`);
  }
  
  console.log('✅ File uploaded successfully');
  console.log('📁 File path:', response.data.filePath);
  console.log('📊 Metadata:', response.data.metadata);
  
  return response.data.filePath;
};

/**
 * Step 5: Test file download
 */
const testFileDownload = async (filePath: string) => {
  console.log('📥 Testing file download...');
  
  const response = await makeRequest('GET', `/files/${encodeURIComponent(filePath)}`);
  
  if (response.status !== 200) {
    throw new Error(`File download failed: ${response.status} ${response.data?.error}`);
  }
  
  console.log('✅ File downloaded successfully');
  console.log('📄 Content-Type:', response.headers['content-type']);
  console.log('📏 Content-Length:', response.headers['content-length']);
  console.log('📝 Content preview:', response.data.substring(0, 100) + '...');
};

/**
 * Step 6: Test file deletion
 */
const testFileDelete = async (filePath: string) => {
  console.log('🗑️ Testing file deletion...');
  console.log('Delete parameters:', {
    filePath,
    table: testConfig.tableName,
    column: 'document_file',
    row: testConfig.rowId,
    metadataField: 'file_metadata'
  });
  
  const response = await makeRequest('POST', `/files/${encodeURIComponent(filePath)}/delete`, {
    table: testConfig.tableName,
    column: 'document_file',
    row: testConfig.rowId,
    metadataField: 'file_metadata'
  });
  
  console.log('Delete response status:', response.status);
  console.log('Delete response data:', response.data);
  
  if (response.status !== 200) {
    throw new Error(`File deletion failed: ${response.status} ${response.data?.error || 'Unknown error'}`);
  }
  
  console.log('✅ File deleted successfully');
};

/**
 * Step 7: Verify record was updated
 */
const verifyRecordBeforeDeletion = async () => {
  console.log('🔍 Verifying record before deletion...');
  
  const response = await makeRequest('GET', `/records/${testConfig.tableName}/${testConfig.rowId}`);
  
  if (response.status !== 200) {
    throw new Error(`Failed to get record: ${response.status} ${response.data?.error}`);
  }
  
  console.log('✅ Record verification complete');
  console.log('📋 Record data before deletion:', JSON.stringify(response.data, null, 2));
  return response.data;
};

const verifyRecordUpdate = async () => {
  console.log('🔍 Verifying record updates after deletion...');
  
  const response = await makeRequest('GET', `/records/${testConfig.tableName}/${testConfig.rowId}`);
  
  if (response.status !== 200) {
    throw new Error(`Failed to get record: ${response.status} ${response.data?.error}`);
  }
  
  console.log('✅ Record verification complete');
  console.log('📋 Record data after deletion:', JSON.stringify(response.data, null, 2));
};

/**
 * Main test function
 */
const runFileTests = async () => {
  try {
    console.log('🚀 Starting File Management API Tests\n');
    
    await createCompany();
    await createTestSchema();
    await createTestRecord();
    
    const filePath = await testFileUpload();
    await testFileDownload(filePath);
    await verifyRecordBeforeDeletion();
    await testFileDelete(filePath);
    await verifyRecordUpdate();
    
    console.log('\n✅ All file management tests completed successfully!');
    process.exit(1);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
};

// Run tests if this script is executed directly
if (require.main === module) {
  runFileTests();
}

export { runFileTests };
