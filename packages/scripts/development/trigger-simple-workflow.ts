#!/usr/bin/env tsx

/**
 * Trigger a simple workflow to test Temporal worker
 */

import { loadConfig } from '../../api/src/config';
import { initializeDatabaseWithSetup } from '../../api/src/database/utils/database';
import { initializeTemporal } from '../../api/src/utils/temporal';
import { triggerWorkflowExecution } from '../../api/src/services/workflow/workflow-execution-service';

const config = loadConfig();

async function triggerSimpleWorkflow() {
  try {
    await initializeDatabaseWithSetup(config.database);
    await initializeTemporal(config.temporal);
    
    console.log('🚀 Triggering simple workflow...');
    
    const companyId = 'bd0cd27c-ae6b-4eee-add3-912f38fca0dd';
    const userId = 'system';
    
    const request = {
      workflowSlug: 'auto-update-product',
      triggerData: {
        event_type: 'insert',
        table_name: 'test_products',
        record_id: 'e4d1d97f-d289-4b4f-a61f-62a5a52113be',
        new_data: {
          id: 'e4d1d97f-d289-4b4f-a61f-62a5a52113be',
          name: 'Test Product',
          status: 'pending',
          auto_updated: false
        },
        user_id: userId
      },
      userId
    };
    
    console.log('📋 Request:', JSON.stringify(request, null, 2));
    
    const result = await triggerWorkflowExecution(companyId, userId, request);
    
    console.log('✅ Workflow triggered successfully:', result);
    
    // Wait a bit to see logs
    console.log('⏳ Waiting 10 seconds to see execution logs...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ Error triggering workflow:', error);
  }
}

triggerSimpleWorkflow();
