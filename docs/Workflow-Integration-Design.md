# Workflow Integration Design Document

## 📋 Overview

This document outlines the design and implementation plan for integrating workflow automation with DocPal's custom data schema system. The feature will allow users to create configurable workflows that are triggered by data events (create, update, field changes) and manual user actions.

## 🎯 Goals

- **Configurable Workflows**: Users can create custom workflows using a visual drag-and-drop builder
- **Event-Driven Automation**: Workflows trigger automatically based on data changes
- **Manual Triggers**: Users can manually trigger workflows when needed
- **Temporal Integration**: Use Temporal as the reliable workflow engine
- **JSON-Based Definitions**: Flexible, serializable workflow configurations
- **Parallel & User Tasks**: Support complex workflow patterns including parallel execution and human tasks

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   UI Builder    │    │  Workflow API    │    │ Temporal Engine │
│                 │    │                  │    │                 │
│ • Drag & Drop   │───▶│ • JSON Schema    │───▶│ • Execution     │
│ • Visual Editor │    │ • Validation     │    │ • State Mgmt    │
│ • Manual Trigger│    │ • Event Routing  │    │ • Reliability   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌──────────────────┐             │
         │              │  Event System    │             │
         │              │                  │             │
         └──────────────│ • DB Triggers    │◀────────────┘
                        │ • Audit Hook     │
                        │ • Notifications  │
                        └──────────────────┘
```

## 📊 Workflow Steps Reference

### 1. Available Step Types

#### **Activity Step**
Executes a predefined activity/function.

```json
{
  "step_id": {
    "type": "activity",
    "activity": "updateRecord",
    "params": {
      "recordId": "{{trigger.recordId}}",
      "updates": {"status": "approved"}
    },
    "outputPath": "update_result",
    "success": "next_step_id",
    "error": "error_step_id",
    "retryPolicy": {
      "maxAttempts": 3,
      "initialInterval": "1s",
      "backoffMultiplier": 2
    }
  }
}
```

**Common Fields:**
- `activity` (required): Name of the activity to execute
- `params` (required): Parameters passed to the activity
- `outputPath` (optional): Where to store the activity result in workflow state
- `success` (optional): Next step ID on success
- `error` (optional): Next step ID on error
- `retryPolicy` (optional): Retry configuration

#### **Condition Step**
Branches workflow based on condition evaluation.

```json
{
  "check_amount": {
    "type": "condition",
    "condition": "{{state.validation_result.amount}} > 1000",
    "onTrue": "manager_approval",
    "onFalse": "auto_approve"
  }
}
```

**Fields:**
- `condition` (required): Expression to evaluate (supports state interpolation)
- `onTrue` (required): Step ID if condition is true
- `onFalse` (required): Step ID if condition is false

#### **User Task Step**
Waits for human interaction/approval.

```json
{
  "manager_approval": {
    "type": "user_task",
    "taskType": "approval",
    "assignee": "{{record.manager_id}}",
    "timeout": "3 days",
    "form": {
      "title": "Approval Required",
      "fields": [
        {"name": "approved", "type": "boolean", "required": true},
        {"name": "comments", "type": "text", "required": false}
      ]
    },
    "outputPath": "approval_decision",
    "success": "process_approval",
    "timeout_action": "escalate_approval",
    "error": "approval_failed"
  }
}
```

**Fields:**
- `taskType` (required): Type of user task
- `assignee` (required): User ID or email to assign task to
- `timeout` (optional): How long to wait (e.g., "3 days", "2 hours")
- `form` (required): Form definition for user input
- `timeout_action` (optional): Step ID if task times out
- `success`, `error`: Standard routing fields

#### **Parallel Step**
Executes multiple branches simultaneously.

```json
{
  "parallel_processing": {
    "type": "parallel",
    "branches": {
      "notification_branch": {
        "initialStep": "send_notification",
        "steps": {
          "send_notification": {
            "type": "activity",
            "activity": "sendEmail",
            "params": {"to": "{{trigger.requester}}", "subject": "Approved"},
            "success": "notification_complete"
          },
          "notification_complete": {"type": "end"}
        }
      },
      "processing_branch": {
        "initialStep": "process_request",
        "steps": {
          "process_request": {
            "type": "activity",
            "activity": "processRequest",
            "params": {"requestId": "{{trigger.requestId}}"},
            "success": "processing_complete"
          },
          "processing_complete": {"type": "end"}
        }
      }
    },
    "waitFor": "all",
    "success": "workflow_complete",
    "error": "workflow_failed"
  }
}
```

**Fields:**
- `branches` (required): Object containing branch definitions
- `waitFor` (optional): "all" (default), "any", or "first_n"
- `success`, `error`: Standard routing fields

#### **Delay Step**
Waits for a specified duration.

```json
{
  "wait_step": {
    "type": "delay",
    "duration": "30m",
    "success": "next_step"
  }
}
```

**Fields:**
- `duration` (required): Time to wait (e.g., "30s", "5m", "2h", "1d")

#### **End Step**
Terminates the workflow.

```json
{
  "workflow_complete": {
    "type": "end"
  }
}
```

### 2. Available Activities

#### **Data Manipulation Activities**

##### `updateRecord`
Updates an existing record in a table.

```json
{
  "type": "activity",
  "activity": "updateRecord",
  "params": {
    "recordId": "{{trigger.recordId}}",
    "tableSlug": "products",
    "updates": {
      "status": "approved",
      "approved_by": "{{state.approval_decision.approver}}"
    }
  },
  "success": "record_updated",
  "error": "update_failed"
}
```

**Parameters:**
- `recordId` (required): ID of record to update
- `tableSlug` (required): Table name
- `updates` (required): Object with fields to update

**Returns:** Updated record data

##### `createRecord`
Creates a new record in a table.

```json
{
  "type": "activity",
  "activity": "createRecord",
  "params": {
    "tableSlug": "audit_log",
    "data": {
      "action": "workflow_completed",
      "record_id": "{{trigger.recordId}}",
      "details": "{{state}}"
    }
  },
  "outputPath": "audit_record",
  "success": "audit_created",
  "error": "audit_failed"
}
```

**Parameters:**
- `tableSlug` (required): Table name
- `data` (required): Record data to create

**Returns:** Created record with ID

##### `queryRecords`
Queries records from a table.

```json
{
  "type": "activity",
  "activity": "queryRecords",
  "params": {
    "tableSlug": "users",
    "filters": {
      "role": "manager",
      "department": "{{record.department}}"
    },
    "limit": 10
  },
  "outputPath": "managers",
  "success": "managers_found",
  "error": "query_failed"
}
```

**Parameters:**
- `tableSlug` (required): Table name
- `filters` (optional): Filter conditions
- `limit` (optional): Maximum records to return

**Returns:** Array of matching records

#### **Communication Activities**

##### `sendEmail`
Sends an email notification.

```json
{
  "type": "activity",
  "activity": "sendEmail",
  "params": {
    "to": ["{{trigger.requester}}", "manager@company.com"],
    "subject": "Request {{trigger.requestId}} Approved",
    "template": "approval_notification",
    "data": {
      "requestId": "{{trigger.requestId}}",
      "approver": "{{state.approval_decision.approver}}"
    }
  },
  "success": "email_sent",
  "error": "email_failed",
  "retryPolicy": {
    "maxAttempts": 3,
    "initialInterval": "30s"
  }
}
```

**Parameters:**
- `to` (required): Email address(es) - string or array
- `subject` (required): Email subject line
- `template` (required): Email template name
- `data` (optional): Template data for interpolation

**Returns:** Email delivery status

##### `createNotification`
Creates an in-app notification.

```json
{
  "type": "activity",
  "activity": "createNotification",
  "params": {
    "userId": "{{trigger.requester}}",
    "title": "Request Approved",
    "message": "Your request {{trigger.requestId}} has been approved",
    "type": "success",
    "data": {"requestId": "{{trigger.requestId}}"}
  },
  "success": "notification_created",
  "error": "notification_failed"
}
```

**Parameters:**
- `userId` (required): User ID to notify
- `title` (required): Notification title
- `message` (required): Notification message
- `type` (optional): "info", "success", "warning", "error"
- `data` (optional): Additional data

**Returns:** Notification ID

#### **External Integration Activities**

##### `callWebhook`
Makes HTTP request to external API.

```json
{
  "type": "activity",
  "activity": "callWebhook",
  "params": {
    "url": "https://api.external.com/webhooks/approval",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer {{secrets.api_token}}",
      "Content-Type": "application/json"
    },
    "data": {
      "event": "approval_completed",
      "recordId": "{{trigger.recordId}}",
      "status": "approved"
    },
    "timeout": 30000
  },
  "outputPath": "webhook_response",
  "success": "webhook_sent",
  "error": "webhook_failed",
  "retryPolicy": {
    "maxAttempts": 2,
    "initialInterval": "5s"
  }
}
```

**Parameters:**
- `url` (required): API endpoint URL
- `method` (required): HTTP method (GET, POST, PUT, DELETE)
- `headers` (optional): HTTP headers
- `data` (optional): Request body data
- `timeout` (optional): Timeout in milliseconds

**Returns:** API response data

#### **Utility Activities**

##### `evaluateCondition`
Evaluates a complex condition (used internally by condition steps).

```json
{
  "type": "activity",
  "activity": "evaluateCondition",
  "params": {
    "condition": "{{state.amount}} > 1000 && {{state.department}} === 'finance'",
    "data": "{{state}}"
  },
  "outputPath": "condition_result",
  "success": "condition_evaluated"
}
```

**Parameters:**
- `condition` (required): Expression to evaluate
- `data` (required): Context data for evaluation

**Returns:** Boolean result

##### `logError`
Logs error information for debugging.

```json
{
  "type": "activity",
  "activity": "logError",
  "params": {
    "error": "Validation failed",
    "context": "{{state}}",
    "level": "error"
  },
  "success": "error_logged"
}
```

**Parameters:**
- `error` (required): Error message
- `context` (optional): Additional context data
- `level` (optional): Log level (info, warn, error)

**Returns:** Log entry ID

### 3. Error Handling Patterns

#### **Retry Policies**
Configure automatic retries for activities:

```json
{
  "retryPolicy": {
    "maxAttempts": 3,
    "initialInterval": "1s",
    "backoffMultiplier": 2,
    "maxInterval": "30s"
  }
}
```

**Fields:**
- `maxAttempts`: Maximum retry attempts
- `initialInterval`: Initial delay between retries
- `backoffMultiplier`: Multiplier for exponential backoff
- `maxInterval`: Maximum delay between retries

#### **Error Routing**
Handle different error scenarios:

```json
{
  "validate_data": {
    "type": "activity",
    "activity": "validateInput",
    "params": {"data": "{{trigger.data}}"},
    "success": "data_valid",
    "error": "validation_failed",
    "retryPolicy": {"maxAttempts": 2}
  },
  "validation_failed": {
    "type": "activity",
    "activity": "logError",
    "params": {
      "error": "Data validation failed",
      "data": "{{trigger.data}}"
    },
    "success": "workflow_failed"
  }
}
```

### 4. State Management

#### **State Interpolation**
Access workflow state in parameters using `{{}}` syntax:

- `{{trigger.recordId}}` - Access trigger data
- `{{state.approval_decision.approved}}` - Access step outputs
- `{{record.manager_id}}` - Access record data
- `{{secrets.api_token}}` - Access secure configuration

#### **Output Paths**
Store activity results in workflow state:

```json
{
  "get_manager": {
    "type": "activity",
    "activity": "queryRecords",
    "params": {
      "tableSlug": "users",
      "filters": {"id": "{{record.manager_id}}"}
    },
    "outputPath": "manager_info",
    "success": "manager_found"
  },
  "send_approval_request": {
    "type": "user_task",
    "assignee": "{{state.manager_info[0].email}}",
    "taskType": "approval"
  }
}
```

### 5. Event Configuration

Events are configured at the schema level and stored in the `custom_data_schema` table:

```sql
-- Add events column to existing table
ALTER TABLE custom_data_schema 
ADD COLUMN events JSONB DEFAULT '{}';

-- Add workflow definitions table
CREATE TABLE workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workflow_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(50) NOT NULL DEFAULT '1.0',
  definition JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(company_id, workflow_id, version)
);

-- Add workflow executions table for tracking
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workflow_id VARCHAR(255) NOT NULL,
  workflow_version VARCHAR(50) NOT NULL,
  temporal_workflow_id VARCHAR(255) NOT NULL,
  temporal_run_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL, -- running, completed, failed, cancelled
  trigger_event JSONB NOT NULL,
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  INDEX(company_id, workflow_id),
  INDEX(temporal_workflow_id),
  INDEX(status)
);
```

### 6. Event Configuration Examples

#### **Data Events**
Configure workflows to trigger on data changes:

```json
{
  "events": {
    "onCreate": [
      {
        "workflowId": "product_approval_workflow",
        "conditions": {"status": "pending_approval"},
        "enabled": true,
        "priority": 1
      }
    ],
    "onUpdate": [
      {
        "workflowId": "status_change_notification",
        "conditions": {"status": "cancelled"},
        "enabled": true
      }
    ],
    "onFieldChange": {
      "status": [
        {
          "workflowId": "status_notification_workflow",
          "conditions": {"from": "pending", "to": "approved"},
          "enabled": true
        }
      ]
    }
  }
}
```

#### **Manual Triggers**
Configure buttons/actions users can trigger:

```json
{
  "events": {
    "manualTriggers": [
      {
        "id": "emergency_approval",
        "name": "Emergency Approval",
        "workflowId": "emergency_approval_workflow",
        "description": "Trigger emergency approval for high-priority items",
        "permissions": ["manager", "admin"],
        "confirmationRequired": true,
        "icon": "alert-triangle"
      },
      {
        "id": "bulk_process",
        "name": "Bulk Processing",
        "workflowId": "bulk_process_workflow",
        "description": "Process multiple records at once",
        "permissions": ["admin"],
        "batchSupport": true
      }
    ]
  }
}
```

## 🔧 Technical Implementation

### 1. Database Schema

```sql
-- Add events column to existing table
ALTER TABLE custom_data_schema 
ADD COLUMN events JSONB DEFAULT '{}';

-- Add workflow definitions table
CREATE TABLE workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workflow_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  definition JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(company_id, workflow_id)
);

-- Add workflow executions table for tracking
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workflow_id VARCHAR(255) NOT NULL,
  temporal_workflow_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL, -- running, completed, failed, cancelled
  trigger_event JSONB NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);
```

### 2. Event System Integration

The existing audit trigger will be extended to:

1. **Check for workflow events** configured in the schema
2. **Emit PostgreSQL notifications** when events match
3. **Handle field-level changes** for specific field monitoring
4. **Maintain existing audit functionality** without disruption

**Event Flow:**
- Data changes → Audit trigger → Check schema events → Emit workflow events → Temporal workflow starts

### 3. Activity Implementation

Activities will be implemented as TypeScript functions that integrate with existing DocPal services:

- **Data Activities**: Use existing record service functions
- **Communication**: Integrate with email and notification systems  
- **User Tasks**: Create database entries and await completion
- **External APIs**: HTTP client with retry and timeout handling
- **Utilities**: Condition evaluation, logging, delays

## 🎨 User Interface Design

### 1. Workflow Builder

A drag-and-drop visual workflow builder with the following components:

#### **Step Types:**
- **Start**: Workflow entry point
- **Activity**: Execute an action (API call, data update, etc.)
- **Condition**: Branch based on data/logic
- **Parallel**: Execute multiple branches simultaneously
- **User Task**: Human interaction required
- **Delay**: Wait for a specified time
- **End**: Workflow completion

#### **Builder Features:**
- **Visual Canvas**: Drag-and-drop interface
- **Step Configuration**: Forms for configuring each step
- **Connection Lines**: Visual flow connections
- **Validation**: Real-time workflow validation
- **Testing**: Ability to test workflows with sample data
- **Versioning**: Manage workflow versions

### 2. Event Configuration UI

Interface for configuring workflow triggers at the schema level:

```typescript
// Event configuration component
const EventConfiguration = ({ schema, onSave }) => {
  const [events, setEvents] = useState(schema.events || {});
  
  return (
    <div className="event-configuration">
      <Tabs>
        <Tab label="Data Events">
          <EventTriggerList 
            events={events.onCreate || []}
            eventType="onCreate"
            onChange={(triggers) => setEvents({...events, onCreate: triggers})}
          />
          <EventTriggerList 
            events={events.onUpdate || []}
            eventType="onUpdate"
            onChange={(triggers) => setEvents({...events, onUpdate: triggers})}
          />
          {/* Field change events */}
        </Tab>
        
        <Tab label="Manual Triggers">
          <ManualTriggerList
            triggers={events.manualTriggers || []}
            onChange={(triggers) => setEvents({...events, manualTriggers: triggers})}
          />
        </Tab>
      </Tabs>
      
      <Button onClick={() => onSave(events)}>Save Configuration</Button>
    </div>
  );
};
```

### 3. Workflow Monitoring

Dashboard for monitoring workflow executions:

- **Execution List**: All workflow runs with status
- **Execution Details**: Step-by-step execution view
- **Performance Metrics**: Success rates, execution times
- **Error Analysis**: Failed workflows with error details
- **User Tasks**: Pending tasks requiring human action

## 🚀 Implementation Phases

### Phase 0: Proof of Concept (Week 1)
**Goal**: Validate core JSON-based dynamic workflow concept with Temporal

**Deliverables**:
- [ ] Minimal Temporal workflow engine executing JSON definitions
- [ ] Comprehensive test suite covering all critical workflow patterns
- [ ] Performance and reliability validation
- [ ] Go/No-Go decision for full implementation

**Detailed POC specification**: See [Workflow-POC-Phase0.md](./Workflow-POC-Phase0.md)

### Phase 1: Foundation (Weeks 2-3)
- [ ] Database schema setup (workflow_definitions, workflow_executions)
- [ ] Basic Temporal workflow engine
- [ ] Core activity library (CRUD operations)
- [ ] Event system integration with audit triggers
- [ ] Basic API endpoints for workflow management

### Phase 2: Core Features (Weeks 3-4)
- [ ] JSON workflow definition validation
- [ ] Condition evaluation system
- [ ] Parallel execution support
- [ ] User task management system
- [ ] Manual trigger API endpoints

### Phase 3: Advanced Features (Weeks 5-6)
- [ ] Workflow builder UI (basic version)
- [ ] Event configuration interface
- [ ] Workflow monitoring dashboard
- [ ] Error handling and retry policies
- [ ] Workflow versioning

### Phase 4: Polish & Integration (Weeks 7-8)
- [ ] Enhanced workflow builder with drag-and-drop
- [ ] Advanced activity library (emails, webhooks, etc.)
- [ ] Performance optimization
- [ ] Documentation and testing
- [ ] User training materials

## 🔒 Security Considerations

### 1. Permissions
- Workflow creation/editing requires appropriate permissions
- Activity execution respects existing data permissions
- User task assignment validates assignee permissions

### 2. Data Access
- Workflows can only access data within their company scope
- Activity parameters are validated and sanitized
- External API calls are logged and monitored

### 3. Code Execution
- No arbitrary code execution - only predefined activities
- Condition evaluation uses sandboxed environment
- Template interpolation is safe from injection attacks

## 📊 Monitoring & Observability

### 1. Metrics
- Workflow execution success/failure rates
- Average execution time per workflow
- Activity performance metrics
- User task completion rates

### 2. Logging
- Detailed execution logs for debugging
- Activity input/output logging
- Error tracking and alerting
- Performance monitoring

### 3. Alerting
- Failed workflow notifications
- Long-running workflow alerts
- User task timeout notifications
- System health monitoring

## 🧪 Testing Strategy

### 1. Unit Tests
- Individual activity testing
- Workflow definition validation
- Condition evaluation testing
- Event trigger logic

### 2. Integration Tests
- End-to-end workflow execution
- Database trigger integration
- Temporal workflow testing
- API endpoint testing

### 3. Performance Tests
- High-volume workflow execution
- Parallel execution performance
- Database performance under load
- Memory usage optimization

## 📚 Documentation Plan

### 1. User Documentation
- Workflow builder user guide
- Activity reference documentation
- Event configuration guide
- Best practices and examples

### 2. Developer Documentation
- API reference
- Activity development guide
- Workflow definition schema
- Integration examples

### 3. Operations Documentation
- Deployment guide
- Monitoring setup
- Troubleshooting guide
- Performance tuning

---

This document serves as the comprehensive design specification for the workflow integration feature. It will be updated as implementation progresses and requirements evolve.
