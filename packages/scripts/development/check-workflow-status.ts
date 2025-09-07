#!/usr/bin/env tsx

/**
 * Check workflow execution status
 */

import { loadConfig } from '../../api/src/config';
import { initializeDatabaseWithSetup } from '../../api/src/database/utils/database';
import { getWorkflowExecutions } from '../../api/src/services/workflow/workflow-service';

const config = loadConfig();

async function checkWorkflowStatus() {
  try {
    await initializeDatabaseWithSetup(config.database);
    
    // Use a recent company ID from the test
    const companyId = 'bd0cd27c-ae6b-4eee-add3-912f38fca0dd';
    const workflowSlug = 'auto-update-product';
    
    console.log('🔍 Checking workflow executions...');
    const executions = await getWorkflowExecutions(companyId, workflowSlug);
    
    console.log(`📋 Found ${executions.length} executions:`);
    
    for (const execution of executions.slice(0, 3)) { // Show latest 3
      console.log(`   ID: ${execution.id}`);
      console.log(`   Status: ${execution.status}`);
      console.log(`   Started: ${execution.started_at}`);
      console.log(`   Completed: ${execution.completed_at || 'Still running'}`);
      console.log(`   Result: ${execution.result || 'No result yet'}`);
      console.log(`   Error: ${execution.error || 'No error'}`);
      console.log('   ---');
    }
    
  } catch (error) {
    console.error('❌ Error checking workflow status:', error);
  }
}

checkWorkflowStatus();
