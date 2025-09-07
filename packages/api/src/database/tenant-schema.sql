-- DocPal Tenant Schema Template
-- This script creates the default tables for each company schema

-- Function to create tenant schema and default tables
CREATE OR REPLACE FUNCTION create_tenant_schema(company_id_param UUID)
RETURNS VOID AS $$
DECLARE
    schema_name TEXT := 'company_' || REPLACE(company_id_param::TEXT, '-', '_');
BEGIN
    -- Create schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
    
    -- Set search path to include public schema for uuid functions
    EXECUTE format('SET search_path TO %I, public', schema_name);
    
    -- User profile table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.user_profile (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(128) NOT NULL,
            email VARCHAR(128) NOT NULL UNIQUE,
            phone VARCHAR(128) UNIQUE,
            address VARCHAR(256),
            city VARCHAR(128),
            preferences JSONB NOT NULL DEFAULT ''{}''::jsonb,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            created_by UUID NOT NULL
        )', schema_name);
    
    -- Role table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.role (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(128) NOT NULL,
            slug VARCHAR(128) NOT NULL UNIQUE,
            description VARCHAR(256) NOT NULL,
            parent_role_id UUID REFERENCES %I.role(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )', schema_name, schema_name);
    
    -- Group table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I."group" (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(128) NOT NULL,
            slug VARCHAR(128) NOT NULL UNIQUE,
            description VARCHAR(256) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            auto_join BOOLEAN NOT NULL DEFAULT FALSE,
            auto_join_rule JSONB NOT NULL DEFAULT ''{}''::jsonb
        )', schema_name);
    
    -- User-Group relationship table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.user_group (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL,
            group_id UUID NOT NULL REFERENCES %I."group"(id) ON DELETE CASCADE,
            description VARCHAR(256),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE(user_id, group_id)
        )', schema_name, schema_name);
    
    -- Custom data model table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.custom_data_model (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            slug VARCHAR(128) NOT NULL UNIQUE,
            label VARCHAR(128) NOT NULL,
            is_system BOOLEAN NOT NULL DEFAULT FALSE,
            is_relation BOOLEAN NOT NULL DEFAULT FALSE,
            description VARCHAR(256) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            company_id UUID NOT NULL,
            columns JSONB NOT NULL DEFAULT ''[]''::jsonb,
            events JSONB DEFAULT ''{}''::jsonb
        )', schema_name);
    
    -- Data Views table for custom view management
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.data_views (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(128) NOT NULL,
            description VARCHAR(512),
            table_slug VARCHAR(128) NOT NULL,
            is_default BOOLEAN NOT NULL DEFAULT FALSE,
            layout JSONB NOT NULL DEFAULT ''[]''::jsonb,
            created_by UUID NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            
            -- Foreign key constraint to custom_data_model
            CONSTRAINT fk_data_views_table_slug 
                FOREIGN KEY (table_slug) REFERENCES %I.custom_data_model(slug) ON DELETE CASCADE
        )', schema_name, schema_name);
    
    -- Enhanced audit log table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.audit_log (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            table_name TEXT NOT NULL,
            record_id UUID,
            operation CHAR(1) NOT NULL CHECK (operation IN (''I'', ''U'', ''D'')),
            user_id UUID,
            user_email TEXT,
            session_id UUID,
            operation_source VARCHAR(50) DEFAULT ''system'',
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp,
            old_data JSONB,
            new_data JSONB,
            changed_fields TEXT[],
            system_context JSONB
        )', schema_name);
    
    -- History table for data versioning
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.history (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            table_name VARCHAR(128) NOT NULL,
            record_id UUID NOT NULL,
            data JSONB NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            company_id UUID NOT NULL
        )', schema_name);
    
    -- Form table (placeholder for future)
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.form (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(128) NOT NULL UNIQUE,
            description VARCHAR(256) NOT NULL,
            form_json JSONB NOT NULL DEFAULT ''{}''::jsonb,
            actions JSONB NOT NULL DEFAULT ''[]''::jsonb,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )', schema_name);
    
    -- Workflow Definitions Table
    -- Stores JSON workflow definitions for each tenant
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.workflow_definitions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(100) NOT NULL UNIQUE,
            version VARCHAR(20) NOT NULL DEFAULT ''1.0'',
            definition JSONB NOT NULL,
            events JSONB DEFAULT ''{}''::jsonb,
            status VARCHAR(20) DEFAULT ''active'' CHECK (status IN (''active'', ''inactive'', ''draft'')),
            created_by UUID, -- References users.id but no FK constraint (cross-schema)
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(slug, version)
        )', schema_name);

    -- Workflow Executions Table
    -- Tracks workflow instances and their execution state
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.workflow_executions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            workflow_definition_id UUID NOT NULL REFERENCES %I.workflow_definitions(id) ON DELETE CASCADE,
            definition JSONB NOT NULL, -- Store workflow definition JSON at execution time
            temporal_workflow_id VARCHAR(255) NOT NULL,
            temporal_run_id VARCHAR(255) NOT NULL,
            trigger_data JSONB,
            status VARCHAR(20) DEFAULT ''running'' CHECK (status IN (''running'', ''completed'', ''failed'', ''cancelled'', ''terminated'')),
            started_at TIMESTAMP DEFAULT NOW(),
            completed_at TIMESTAMP,
            result JSONB,
            error_message TEXT,
            UNIQUE(temporal_workflow_id, temporal_run_id)
        )', schema_name, schema_name);

    -- Workflow User Tasks Table
    -- Manages user task assignments within workflows
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.workflow_user_tasks (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            workflow_execution_id UUID NOT NULL REFERENCES %I.workflow_executions(id) ON DELETE CASCADE,
            step_id VARCHAR(100) NOT NULL,
            assignee_id UUID, -- References users.id, can be null for group tasks
            candidate JSONB, -- Store user, group, or role IDs for task assignment
            task_type VARCHAR(50) NOT NULL,
            form_definition JSONB,
            context_data JSONB,
            status VARCHAR(20) DEFAULT ''pending'' CHECK (status IN (''pending'', ''assigned'', ''completed'', ''cancelled'', ''timeout'')),
            result JSONB,
            created_at TIMESTAMP DEFAULT NOW(),
            completed_at TIMESTAMP,
            timeout_at TIMESTAMP
        )', schema_name, schema_name);
    
    -- Create update trigger function for workflow_definitions
    EXECUTE format('
        CREATE OR REPLACE FUNCTION %I.update_workflow_definitions_updated_at()
        RETURNS TRIGGER AS $trigger$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $trigger$ LANGUAGE plpgsql;
    ', schema_name);
    
    -- Create the trigger
    EXECUTE format('
        CREATE TRIGGER trigger_workflow_definitions_updated_at
            BEFORE UPDATE ON %I.workflow_definitions
            FOR EACH ROW
            EXECUTE FUNCTION %I.update_workflow_definitions_updated_at();
    ', schema_name, schema_name);
    
    -- Create audit trigger function for this tenant
    EXECUTE format('
        CREATE OR REPLACE FUNCTION %I.audit_trigger_function()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $func$
        DECLARE
            old_data JSONB := NULL;
            new_data JSONB := NULL;
            changed_fields TEXT[] := ''{}''::TEXT[];
            current_user_id UUID := NULL;
            current_session_id UUID := NULL;
            current_user_email TEXT := NULL;
            operation_source TEXT := ''system'';
            system_context JSONB := NULL;
            key TEXT;
            schema_events JSONB := NULL;
            event_config JSONB;
            company_id_value UUID;
        BEGIN
            -- Try to get user context (will be NULL for system operations)
            RAISE NOTICE ''Getting user context'';
            BEGIN
                current_user_id := current_setting(''app.current_user_id'', true)::UUID;
                current_session_id := current_setting(''app.current_session_id'', true)::UUID;
                current_user_email := current_setting(''app.current_user_email'', true);
                operation_source := COALESCE(current_setting(''app.operation_source'', true), ''system'');
                system_context := current_setting(''app.system_context'', true)::JSONB;
            EXCEPTION WHEN OTHERS THEN
                -- If any setting fails, continue with NULL values (system operation)
                NULL;
            END;
            
            -- Extract company ID from schema name (company_uuid format)
            -- Convert underscores back to hyphens for proper UUID format
            company_id_value := REPLACE(REPLACE(TG_TABLE_SCHEMA, ''company_'', ''''), ''_'', ''-'')::UUID;
            
            -- WORKFLOW EVENTS: Handle workflow notifications FIRST (before audit logging)
            -- Query custom_data_model for event configuration
            RAISE NOTICE ''Checking for workflow events for table'';
            BEGIN
                -- Get event configuration from custom_data_model table
                SELECT events INTO schema_events 
                FROM custom_data_model 
                WHERE slug = TG_TABLE_NAME;
                
                -- Check if there are workflow triggers configured for this operation
                IF schema_events IS NOT NULL AND schema_events ? ''triggers'' THEN
                    RAISE NOTICE ''Found event configuration for table'';

                    -- Loop through triggers to find matching event type
                    FOR event_config IN SELECT * FROM jsonb_array_elements(schema_events->''triggers'') LOOP
                        RAISE NOTICE ''Checking trigger event config'';
                        IF event_config->>''event'' = TG_OP OR event_config->>''event'' = LOWER(TG_OP) THEN
                            RAISE NOTICE ''Triggering workflow for event'';
                            
                            -- Send workflow notification with full context
                            PERFORM pg_notify(''workflow_events'', json_build_object(
                                ''event_type'', TG_OP,
                                ''table_name'', TG_TABLE_NAME,
                                ''company_id'', company_id_value,
                                ''record_id'', COALESCE(NEW.id, OLD.id),
                                ''old_data'', CASE WHEN TG_OP = ''DELETE'' THEN to_jsonb(OLD) ELSE NULL END,
                                ''new_data'', CASE WHEN TG_OP = ''INSERT'' OR TG_OP = ''UPDATE'' THEN to_jsonb(NEW) ELSE NULL END,
                                ''schema_events'', schema_events,
                                ''trigger_config'', event_config,
                                ''user_id'', current_user_id,
                                ''session_id'', current_session_id,
                                ''timestamp'', NOW()
                            )::text);
                            
                            RAISE NOTICE ''Workflow notification sent'';
                        END IF;
                    END LOOP;
                ELSE
                    RAISE NOTICE ''No workflow triggers configured for table'';
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- If event processing fails, don not break the main operation
                RAISE NOTICE ''Error processing workflow events'';
                RAISE NOTICE ''Error details:'';
            END;
            
            RAISE NOTICE ''trigger audit log'';            
            -- Handle different operations
            IF TG_OP = ''DELETE'' THEN
                old_data := to_jsonb(OLD);
                
                INSERT INTO audit_log (
                    table_name, record_id, operation,
                    user_id, user_email, session_id, operation_source, system_context,
                    old_data
                ) VALUES (
                    TG_TABLE_NAME, OLD.id, ''D'',
                    current_user_id, current_user_email, current_session_id, operation_source, system_context,
                    old_data
                );
                
                RETURN OLD;
                
            ELSIF TG_OP = ''INSERT'' THEN
                new_data := to_jsonb(NEW);
                
                INSERT INTO audit_log (
                    table_name, record_id, operation,
                    user_id, user_email, session_id, operation_source, system_context,
                    new_data
                ) VALUES (
                    TG_TABLE_NAME, NEW.id, ''I'',
                    current_user_id, current_user_email, current_session_id, operation_source, system_context,
                    new_data
                );
                
                RETURN NEW;
                
            ELSIF TG_OP = ''UPDATE'' THEN
                old_data := to_jsonb(OLD);
                new_data := to_jsonb(NEW);
                
                -- Find changed fields
                FOR key IN SELECT jsonb_object_keys(new_data) LOOP
                    IF (old_data ->> key) IS DISTINCT FROM (new_data ->> key) THEN
                        changed_fields := array_append(changed_fields, key);
                    END IF;
                END LOOP;
                
                -- Only log if there are actual changes
                IF array_length(changed_fields, 1) > 0 THEN
                    INSERT INTO audit_log (
                        table_name, record_id, operation,
                        user_id, user_email, session_id, operation_source, system_context,
                        old_data, new_data, changed_fields
                    ) VALUES (
                        TG_TABLE_NAME, NEW.id, ''U'',
                        current_user_id, current_user_email, current_session_id, operation_source, system_context,
                        old_data, new_data, changed_fields
                    );
                END IF;
                
                RETURN NEW;
            END IF;
            
            RETURN COALESCE(NEW, OLD);
        END;
        $func$;
    ', schema_name);
    
    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_user_group_user_id ON %I.user_group(user_id)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_user_group_group_id ON %I.user_group(group_id)', 
                   replace(schema_name, '-', '_'), schema_name);
    
    -- Data Views indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_data_views_table_slug ON %I.data_views(table_slug)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_data_views_created_by ON %I.data_views(created_by)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS idx_%I_data_views_default_per_table ON %I.data_views(table_slug) WHERE is_default = true', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_audit_log_table_name ON %I.audit_log(table_name)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_audit_log_timestamp ON %I.audit_log(timestamp)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_audit_log_operation ON %I.audit_log(operation)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_audit_log_user_id ON %I.audit_log(user_id) WHERE user_id IS NOT NULL', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_audit_log_record_id ON %I.audit_log(record_id) WHERE record_id IS NOT NULL', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_history_table_name ON %I.history(table_name)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_history_record_id ON %I.history(record_id)', 
                   replace(schema_name, '-', '_'), schema_name);
    
    -- Workflow table indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_workflow_definitions_slug ON %I.workflow_definitions(slug)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_workflow_definitions_status ON %I.workflow_definitions(status)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_workflow_definitions_created_by ON %I.workflow_definitions(created_by)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_workflow_executions_definition_id ON %I.workflow_executions(workflow_definition_id)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_workflow_executions_temporal_workflow_id ON %I.workflow_executions(temporal_workflow_id)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_workflow_executions_status ON %I.workflow_executions(status)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_workflow_executions_started_at ON %I.workflow_executions(started_at)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_workflow_user_tasks_execution_id ON %I.workflow_user_tasks(workflow_execution_id)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_workflow_user_tasks_assignee_id ON %I.workflow_user_tasks(assignee_id)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_workflow_user_tasks_status ON %I.workflow_user_tasks(status)', 
                   replace(schema_name, '-', '_'), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_workflow_user_tasks_timeout_at ON %I.workflow_user_tasks(timeout_at)', 
                   replace(schema_name, '-', '_'), schema_name);
    
    -- Reset search path
    SET search_path TO public;
    
END;
$$ LANGUAGE plpgsql;


