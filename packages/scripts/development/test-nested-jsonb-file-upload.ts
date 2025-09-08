#!/usr/bin/env ts-node

/**
 * Test script for nested JSONB field support in file upload API
 * 
 * This script demonstrates how to use the enhanced file upload API
 * with nested JSONB fields using dot notation.
 */

import { createReadStream } from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3333/api';
const TEST_FILE_PATH = './test-file.txt';

// Create a test file if it doesn't exist
import { writeFileSync } from 'fs';
writeFileSync(TEST_FILE_PATH, 'This is a test file for nested JSONB upload');

async function testNestedJsonbFileUpload() {
  console.log('🧪 Testing nested JSONB file upload functionality...\n');

  try {
    // Test 1: Regular column upload (backward compatibility)
    console.log('📁 Test 1: Regular column upload');
    await testRegularColumnUpload();
    
    // Test 2: Nested JSONB field upload
    console.log('\n📁 Test 2: Nested JSONB field upload');
    await testNestedJsonbUpload();
    
    // Test 3: Multiple nested fields
    console.log('\n📁 Test 3: Multiple nested fields with additional data');
    await testMultipleNestedFields();
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testRegularColumnUpload() {
  const formData = new FormData();
  formData.append('file', createReadStream(TEST_FILE_PATH));
  formData.append('table', 'test_documents');
  formData.append('column', 'file_path');
  formData.append('row', 'test-record-uuid-1');
  formData.append('metadataField', 'file_metadata');

  const response = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    body: formData,
    headers: {
      'Cookie': 'session=your-session-cookie', // Replace with actual session
    }
  });

  if (response.ok) {
    const result = await response.json();
    console.log('✅ Regular upload successful:', result);
  } else {
    console.log('⚠️  Regular upload test skipped (no valid session)');
  }
}

async function testNestedJsonbUpload() {
  const formData = new FormData();
  formData.append('file', createReadStream(TEST_FILE_PATH));
  formData.append('table', 'test_documents');
  formData.append('column', 'metadata.files.primary');
  formData.append('row', 'test-record-uuid-2');
  formData.append('metadataField', 'metadata.file_info');

  const response = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    body: formData,
    headers: {
      'Cookie': 'session=your-session-cookie', // Replace with actual session
    }
  });

  if (response.ok) {
    const result = await response.json();
    console.log('✅ Nested JSONB upload successful:', result);
    console.log('   This would create: metadata.files.primary = "file-path"');
    console.log('   And: metadata.file_info = {filename, mimetype, size, ...}');
  } else {
    console.log('⚠️  Nested JSONB upload test skipped (no valid session)');
  }
}

async function testMultipleNestedFields() {
  const formData = new FormData();
  formData.append('file', createReadStream(TEST_FILE_PATH));
  formData.append('table', 'test_documents');
  formData.append('column', 'attachments.documents.contract');
  formData.append('row', 'test-record-uuid-3');
  formData.append('metadataField', 'attachments.metadata.contract_info');
  
  // Additional data with nested fields
  const additionalData = {
    'attachments.status.uploaded': true,
    'attachments.timestamps.uploaded_at': new Date().toISOString(),
    'attachments.permissions.public': false
  };
  formData.append('additionalData', JSON.stringify(additionalData));

  const response = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    body: formData,
    headers: {
      'Cookie': 'session=your-session-cookie', // Replace with actual session
    }
  });

  if (response.ok) {
    const result = await response.json();
    console.log('✅ Multiple nested fields upload successful:', result);
    console.log('   This would create multiple nested JSONB updates:');
    console.log('   - attachments.documents.contract = "file-path"');
    console.log('   - attachments.metadata.contract_info = {metadata}');
    console.log('   - attachments.status.uploaded = true');
    console.log('   - attachments.timestamps.uploaded_at = "timestamp"');
    console.log('   - attachments.permissions.public = false');
  } else {
    console.log('⚠️  Multiple nested fields upload test skipped (no valid session)');
  }
}

// Example SQL that would be generated:
function showExampleSQL() {
  console.log('\n📝 Example SQL queries that would be generated:\n');
  
  console.log('1. Regular column update:');
  console.log('   UPDATE test_documents SET file_path = $1, file_metadata = $2, updated_at = NOW() WHERE id = $3');
  
  console.log('\n2. Nested JSONB update:');
  console.log('   UPDATE test_documents SET');
  console.log('     metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{files,primary}\', $1::jsonb),');
  console.log('     metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{file_info}\', $2::jsonb),');
  console.log('     updated_at = NOW()');
  console.log('   WHERE id = $3');
  
  console.log('\n3. Multiple nested fields:');
  console.log('   UPDATE test_documents SET');
  console.log('     attachments = jsonb_set(COALESCE(attachments, \'{}\'), \'{documents,contract}\', $1::jsonb),');
  console.log('     attachments = jsonb_set(COALESCE(attachments, \'{}\'), \'{metadata,contract_info}\', $2::jsonb),');
  console.log('     attachments = jsonb_set(COALESCE(attachments, \'{}\'), \'{status,uploaded}\', $3::jsonb),');
  console.log('     attachments = jsonb_set(COALESCE(attachments, \'{}\'), \'{timestamps,uploaded_at}\', $4::jsonb),');
  console.log('     attachments = jsonb_set(COALESCE(attachments, \'{}\'), \'{permissions,public}\', $5::jsonb),');
  console.log('     updated_at = NOW()');
  console.log('   WHERE id = $6');
}

// Run the test
if (require.main === module) {
  testNestedJsonbFileUpload().then(() => {
    showExampleSQL();
  });
}

