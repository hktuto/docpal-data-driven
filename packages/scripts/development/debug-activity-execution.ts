#!/usr/bin/env tsx

/**
 * Debug activity execution by calling updateRecord directly
 */

import { loadConfig } from '../../api/src/config';
import { initializeDatabaseWithSetup } from '../../api/src/database/utils/database';
import { updateRecord } from '../../api/src/workflows/activities';

const config = loadConfig();

async function debugActivityExecution() {
  try {
    await initializeDatabaseWithSetup(config.database);
    
    console.log('🔍 Testing updateRecord activity directly...');
    
    const context = {
      companyId: 'bd0cd27c-ae6b-4eee-add3-912f38fca0dd',
      userId: 'system',
      sessionId: null
    };
    
    const tableName = 'test_products';
    const recordId = 'e4d1d97f-d289-4b4f-a61f-62a5a52113be';
    const data = {
      status: 'processed',
      auto_updated: true
    };
    
    console.log('📋 Activity parameters:');
    console.log('   Context:', context);
    console.log('   Table:', tableName);
    console.log('   Record ID:', recordId);
    console.log('   Data:', data);
    
    const result = await updateRecord(context, tableName, recordId, data);
    
    console.log('✅ Activity completed successfully!');
    console.log('📋 Result:', result);
    
  } catch (error) {
    console.error('❌ Activity failed:', error);
  }
}

debugActivityExecution();
