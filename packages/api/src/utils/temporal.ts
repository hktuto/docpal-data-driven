// Temporal Client Utilities
// Handles connection to Temporal server and workflow operations

import { Client, Connection } from '@temporalio/client';
import { Worker, NativeConnection } from '@temporalio/worker';
import { getPool } from '../database/utils/database';
import { triggerWorkflowExecution } from '../services/workflow/workflow-execution-service';

interface TemporalConfig {
  address: string;
  namespace?: string;
  tls?: boolean;
}

// Global Temporal client
let temporalClient: Client | null = null;
let temporalConnection: NativeConnection | null = null;

// Event listener state
let eventListener: any = null;
let isListening = false;

/**
 * Initialize Temporal connection and client
 */
export const initializeTemporal = async (config: TemporalConfig): Promise<Client> => {
  if (temporalClient) {
    return temporalClient;
  }

  try {
    console.log(`🔄 Connecting to Temporal server at ${config.address}...`);
    
    // Create connection
    temporalConnection = await NativeConnection.connect({
      address: config.address,
      tls: config.tls || false,
    });

    // Create client
    temporalClient = new Client({
      connection: temporalConnection,
      namespace: config.namespace || 'default',
    });

    console.log(`✅ Connected to Temporal server successfully`);
    return temporalClient;
  } catch (error) {
    console.error('❌ Failed to connect to Temporal server:', error);
    throw new Error(`Failed to initialize Temporal: ${error}`);
  }
};

/**
 * Get the Temporal client instance
 */
export const getTemporalClient = (): Client => {
  if (!temporalClient) {
    throw new Error('Temporal client not initialized. Call initializeTemporal() first.');
  }
  return temporalClient;
};

/**
 * Create a Temporal worker
 */
export const createTemporalWorker = async (
  taskQueue: string,
  workflowsPath: string,
  activities?: any
): Promise<Worker> => {
  if (!temporalConnection) {
    throw new Error('Temporal connection not initialized. Call initializeTemporal() first.');
  }

  try {
    const worker = await Worker.create({
      connection: temporalConnection,
      namespace: 'default',
      taskQueue,
      workflowsPath,
      activities,
      // Worker options
      maxConcurrentActivityTaskExecutions: 10,
      maxConcurrentWorkflowTaskExecutions: 10,
    });

    console.log(`✅ Temporal worker created for task queue: ${taskQueue}`);
    return worker;
  } catch (error) {
    console.error('❌ Failed to create Temporal worker:', error);
    throw error;
  }
};

/**
 * Start a workflow execution
 */
export const startWorkflow = async (
  workflowType: string,
  workflowId: string,
  args: any[],
  options: {
    taskQueue: string;
    workflowExecutionTimeout?: string;
    workflowRunTimeout?: string;
    workflowTaskTimeout?: string;
  }
): Promise<{ workflowId: string; runId: string }> => {
  const client = getTemporalClient();
  
  try {
    const handle = await client.workflow.start(workflowType, {
      args,
      workflowId,
      taskQueue: options.taskQueue,
      // Use default timeouts for now
      // workflowExecutionTimeout: options.workflowExecutionTimeout,
      // workflowRunTimeout: options.workflowRunTimeout,
      // workflowTaskTimeout: options.workflowTaskTimeout,
    });

    console.log(`✅ Started workflow ${workflowType} with ID: ${workflowId}`);
    return {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
    };
  } catch (error) {
    console.error(`❌ Failed to start workflow ${workflowType}:`, error);
    throw error;
  }
};

/**
 * Get workflow execution status
 */
export const getWorkflowStatus = async (workflowId: string): Promise<any> => {
  const client = getTemporalClient();
  
  try {
    const handle = client.workflow.getHandle(workflowId);
    const description = await handle.describe();
    
    return {
      workflowId: workflowId,
      runId: description.runId,
      status: description.status,
      startTime: description.startTime,
      closeTime: description.closeTime,
      executionTime: description.executionTime,
      type: description.type,
      taskQueue: description.taskQueue,
    };
  } catch (error) {
    console.error(`❌ Failed to get workflow status for ${workflowId}:`, error);
    throw error;
  }
};

/**
 * Cancel a workflow execution
 */
export const cancelWorkflow = async (workflowId: string, reason?: string): Promise<void> => {
  const client = getTemporalClient();
  
  try {
    const handle = client.workflow.getHandle(workflowId);
    await handle.cancel();
    
    console.log(`✅ Cancelled workflow ${workflowId}`);
  } catch (error) {
    console.error(`❌ Failed to cancel workflow ${workflowId}:`, error);
    throw error;
  }
};

/**
 * Terminate a workflow execution
 */
export const terminateWorkflow = async (workflowId: string, reason?: string): Promise<void> => {
  const client = getTemporalClient();
  
  try {
    const handle = client.workflow.getHandle(workflowId);
    await handle.terminate(reason);
    
    console.log(`✅ Terminated workflow ${workflowId}`);
  } catch (error) {
    console.error(`❌ Failed to terminate workflow ${workflowId}:`, error);
    throw error;
  }
};

/**
 * Signal a workflow
 */
export const signalWorkflow = async (
  workflowId: string,
  signalName: string,
  args: any[]
): Promise<void> => {
  const client = getTemporalClient();
  
  try {
    const handle = client.workflow.getHandle(workflowId);
    await handle.signal(signalName, ...args);
    
    console.log(`✅ Sent signal ${signalName} to workflow ${workflowId}`);
  } catch (error) {
    console.error(`❌ Failed to signal workflow ${workflowId}:`, error);
    throw error;
  }
};

/**
 * Query a workflow
 */
export const queryWorkflow = async (
  workflowId: string,
  queryName: string,
  args: any[] = []
): Promise<any> => {
  const client = getTemporalClient();
  
  try {
    const handle = client.workflow.getHandle(workflowId);
    const result = await handle.query(queryName, ...args);
    
    console.log(`✅ Queried workflow ${workflowId} with ${queryName}`);
    return result;
  } catch (error) {
    console.error(`❌ Failed to query workflow ${workflowId}:`, error);
    throw error;
  }
};

/**
 * Close Temporal connection
 */
export const closeTemporal = async (): Promise<void> => {
  try {
    // Stop event listener first
    await stopWorkflowEventListener();
    
    if (temporalConnection) {
      await temporalConnection.close();
      temporalConnection = null;
      temporalClient = null;
      console.log('✅ Temporal connection closed');
    }
  } catch (error) {
    console.error('❌ Error closing Temporal connection:', error);
  }
};

/**
 * Start listening for workflow events from PostgreSQL
 */
export const startWorkflowEventListener = async (): Promise<void> => {
  if (isListening) {
    console.log('🔄 Workflow event listener already running');
    return;
  }
  console.log('🔄 Starting workflow event listener');
  try {
    const pool = getPool();
    eventListener = await pool.connect();
    
    // Listen for workflow_events notifications
    await eventListener.query('LISTEN workflow_events');
    
    eventListener.on('notification', async (msg: any) => {
      console.log('🔔 ---Received workflow event:', msg);
      if (msg.channel === 'workflow_events') {
        try {
          const eventData = JSON.parse(msg.payload);
          await processWorkflowEvent(eventData);
        } catch (error) {
          console.error('❌ Error processing workflow event:', error);
        }
      }
    });

    eventListener.on('error', (error: any) => {
      console.error('❌ PostgreSQL event listener error:', error);
      // Attempt to reconnect
      setTimeout(() => {
        if (isListening) {
          console.log('🔄 Attempting to reconnect event listener...');
          startWorkflowEventListener();
        }
      }, 5000);
    });

    isListening = true;
    console.log('✅ Workflow event listener started');
  } catch (error) {
    console.error('❌ Failed to start workflow event listener:', error);
    throw error;
  }
};

/**
 * Stop the workflow event listener
 */
export const stopWorkflowEventListener = async (): Promise<void> => {
  if (!isListening || !eventListener) {
    return;
  }

  try {
    await eventListener.query('UNLISTEN workflow_events');
    eventListener.release();
    eventListener = null;
    isListening = false;
    console.log('✅ Workflow event listener stopped');
  } catch (error) {
    console.error('❌ Error stopping workflow event listener:', error);
  }
};

/**
 * Process a workflow event and trigger workflows if configured
 */
const processWorkflowEvent = async (eventData: any): Promise<void> => {
  try {
    console.log('🔔 Received workflow event:', {
      eventType: eventData.event_type,
      tableName: eventData.table_name,
      companyId: eventData.company_id,
      recordId: eventData.record_id,
      hasTriggerConfig: !!eventData.trigger_config
    });

    const { schema_events, trigger_config, company_id, event_type, table_name, record_id, new_data, old_data, user_id, session_id } = eventData;
    
    // Validate required data
    if (!schema_events || !trigger_config) {
      console.log('📝 No workflow trigger configuration found for table:', table_name);
      return;
    }
    
    if (!trigger_config.workflow_slug) {
      console.log('❌ No workflow_slug specified in trigger configuration for table:', table_name);
      return;
    }

    console.log(`🎯 Processing trigger for workflow: ${trigger_config.workflow_slug}`);

    try {
      console.log('🚀 Triggering workflow:', trigger_config.workflow_slug);
      
      // Prepare trigger data
      const triggerData = {
        event_type: event_type.toLowerCase(),
        table_name,
        record_id,
        new_data,
        old_data,
        user_id,
        session_id,
        trigger_config,
        timestamp: new Date().toISOString()
      };
      console.log('🚀 workflow trigger data', triggerData);
      // Trigger the workflow
      await triggerWorkflowExecution(
        company_id,
        user_id || 'system',
        {
          workflowSlug: trigger_config.workflow_slug,
          triggerData: triggerData,
          userId: user_id
        }
      );

      console.log('✅ Successfully triggered workflow:', trigger_config.workflow_slug);
    } catch (error) {
      console.error(`❌ ------Failed to trigger workflow ${trigger_config.workflow_slug}:`, error);
    }
  } catch (error) {
    console.error('❌ Error processing workflow event:', error);
  }
};
