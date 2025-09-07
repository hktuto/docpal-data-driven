#!/usr/bin/env tsx
/**
 * Temporal Worker for DocPal Workflows
 * Runs workflow activities and handles workflow execution
 */

import { Worker } from '@temporalio/worker';
import { loadConfig } from '../../api/src/config';
import { initializeDatabaseWithSetup } from '../../api/src/database/utils/database';
import { initializeOpenFGA } from '../../api/src/utils/openfga';
import { initializeMinIO } from '../../api/src/utils/minio';
import { initializeTemporal } from '../../api/src/utils/temporal';
import * as activities from '../../api/src/workflows/activities';

async function main() {
  console.log('🔧 Starting Temporal Worker for DocPal Workflows');
  console.log('================================================\n');

  try {
    // Load configuration
    const config = loadConfig();
    console.log('✅ Configuration loaded');

    // Initialize services
    await initializeDatabaseWithSetup(config.database);
    console.log('✅ Database initialized');

    initializeOpenFGA(config.openfga);
    console.log('✅ OpenFGA initialized');

    initializeMinIO(config.minio);
    console.log('✅ MinIO initialized');

    // Initialize Temporal
    await initializeTemporal(config.temporal);
    console.log('✅ Temporal client initialized');

    // Create and start worker
    console.log('\n🚀 Creating Temporal worker...');
    
    const worker = await Worker.create({
      workflowsPath: require.resolve('../../api/src/workflows/dynamic-workflow'),
      activitiesPath: require.resolve('../../api/src/workflows/activities'),
      taskQueue: 'docpal-workflows',
      // Worker configuration
      maxConcurrentActivityTaskExecutions: 10,
      maxConcurrentWorkflowTaskExecutions: 10,
    });

    console.log('✅ Temporal worker created');
    console.log('📋 Worker configuration:');
    console.log(`   Task Queue: docpal-workflows`);
    console.log(`   Max Concurrent Activities: 10`);
    console.log(`   Max Concurrent Workflows: 10`);

    // Start the worker
    console.log('\n🏃 Starting worker...');
    await worker.run();

  } catch (error) {
    console.error('❌ Worker failed to start:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('connection')) {
        console.log('\n💡 Troubleshooting:');
        console.log('   1. Make sure Temporal server is running');
        console.log('   2. Check TEMPORAL_ADDRESS environment variable');
        console.log('   3. Verify Docker containers are up: docker-compose ps');
      }
    }
    
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down worker gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down worker gracefully...');
  process.exit(0);
});

// Run the worker
if (require.main === module) {
  main().catch(console.error);
}
