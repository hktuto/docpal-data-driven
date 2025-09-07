// DocPal Core Types

// User types
export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Company types
export interface Company {
  id: string;
  name: string;
  slug: string;
  description?: string;
  settings: Record<string, any>;
  status: 'active' | 'inactive' | 'suspended';
  created_by: string;
  openfga_store_id?: string;
  created_at: Date;
  updated_at: Date;
}

// Session types
export interface SessionUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface SessionCompany {
  id: string;
  name: string;
  slug: string;
  role: string;
  openfga_store_id?: string;
}

// Database types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

// Column definition for dynamic schemas
export interface ColumnDefinition {
  name: string;
  data_type: string;
  data_type_options?: {
    length?: number;
    precision?: number;
    scale?: number;
  };
  nullable: boolean;
  default?: any;
  view_type: 'text' | 'number' | 'boolean' | 'datetime' | 'file' | 'relation' | 'json';
  view_validation?: {
    required?: boolean;
    min_length?: number;
    max_length?: number;
    min?: number;
    max?: number;
    pattern?: string;
    [key: string]: any;
  };
  view_editor: string;
  view_editor_options?: {
    placeholder?: string;
    help_text?: string;
    options?: Array<{ value: string; label: string }>;
    [key: string]: any;
  };
  is_relation: boolean;
  relation_setting?: {
    target_table: string;
    target_column: string;
    display_column: string;
    relationship_type: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';
  };
  display_options?: {
    label: string;
    description?: string;
    show_in_list: boolean;
    show_in_detail: boolean;
    order: number;
  };
  permissions?: {
    inherit_from_table: boolean;
    custom_permissions?: any;
  };
}

// Custom data model
export interface CustomDataModel {
  id: string;
  slug: string;
  label: string;
  is_system: boolean;
  is_relation: boolean;
  description: string;
  created_at: Date;
  updated_at: Date;
  company_id: string;
  columns: ColumnDefinition[];
}
