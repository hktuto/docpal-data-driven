# DocPal - Comprehensive Product Requirements Document (PRD) Outline

## 1. Project Overview
DocPal is a comprehensive multi-tenant document and data management platform built as a modern SaaS solution. The system combines advanced document management, dynamic data modeling, workflow automation, and sophisticated permission systems to provide organizations with a unified platform for managing both structured and unstructured data with enterprise-grade security and scalability.

### 1.2 Product Vision
To provide a unified, API-first platform that enables organizations to manage documents, structured data, workflows, and complex permission models while maintaining ease of use, scalability, and enterprise-grade security across isolated tenant environments.

## 2. Core Features

### 2.1 Dynamic Data Modeling
- Tenants will have the ability to create and manage their own data models.
- Unified api endpoint for all data operations.
- Data models will be stored in the database and will be accessible to the tenants.

### 2.2 Data Dynamic Access control
- Tenant can modify and customize the access control for their data models.
- Basic access control is out of the box for all data models

### 2.3 Data versioning
- Data models will be versioned and will be accessible to the tenants.
- Tenant can revert to a previous version of the data model.
- All Data will have complete history and audit trail.

### 2.4 Data sharing
- Tenant can share data with other tenants.
- Tenant can receive data from other tenants.
- Tenant data can be share to external systems.

## 3. Tech Stack
- Api : fastidy - typescript
- Database : postgresql
- File storage : minIO
- Workflow orchestration : temporal
- Access control : openFGA

## 4. Project Structure
```
| Packages
├── Api // backend
│   ├── services
│   │   ├── auth 
│   │   │   ├── auth_middleware.ts
│   │   │   ├── auth_route.ts
│   │   │   ├── auth_service.ts
│   │   ├── company 
│   │   │   ├── company_middleware.ts
│   │   │   ├── company_route.ts
│   │   │   ├── company_service.ts
│   │   ├── schema
│   │   │   ├── schema_route.ts
│   │   │   ├── schema_service.ts
│   │   ├── record
│   │   │   ├── record_route.ts
│   │   │   ├── record_service.ts
│   │   ├── history
│   │   │   ├── history_route.ts
│   │   │   ├── history_service.ts
│   │   ├── user
│   │   │   ├── user_route.ts
│   │   │   ├── user_service.ts
│   │   ├── permission
│   │   │   ├── permission_middleware.ts
│   │   │   ├── permission_route.ts
│   │   │   ├── permission_service.ts
│   │   ├── workflow
│   │   │   ├── workflow_route.ts
│   │   │   ├── workflow_service.ts
│   │   ├── audit
│   │   │   ├── audit_route.ts
│   │   │   ├── audit_service.ts
│   ├── utils // shared utils like db pool , cache, logger
├── Frontend // frontend 
│ Libraries // shared libraries
│ Scripts // helper script for development, and seed data

```

## 5. Data Model
to archive tenant isolation, we separate the db into different schema for each tenant. each schema will have its own data schema. to manage the global data we will have a global schema.

## 5.1 Global Schema
```
| Global Schema
├── company 
├── company_user // company to user relation table. one user can have multiple companies. also store user profile id for easy access.
├── user // user auth data , only auth related data , no other data
├── audit // audit data for create user, create company
├── session // session data for user, store the session token and related data

Company table
- id  uuid unique not null primary key
- name varchar(128) not null
- openFGA_Store_ID varchar(128) not null
- created_at timestamp not null default now()
- updated_at timestamp not null default now()
- plan varchar(128) // for future use
- plan_details jsonb // for future use

User table
- id  uuid unique not null primary key
- email varchar(128) not null
- password varchar(256) not null // hash password with bcrypt
- created_at timestamp not null default now()
- updated_at timestamp not null default now()
- company_user_id uuid not null foreign key references company_user(id) // one user can have multiple companies.

Company_user table
- id uuid unique not null primary key
- company_id uuid not null foreign key references company(id)
- user_id uuid not null foreign key references user(id)
- user_profile_id uuid not null foreign key references company_(company_id).user_profile(id)
- created_at timestamp not null default now()
- updated_at timestamp not null default now()

Audit table
- id  uuid unique not null primary key
- action varchar(128) not null
- data jsonb not null
- created_at timestamp not null default now()
- updated_at timestamp not null default now()
- company_id uuid not null foreign key references company(id)

```

## 5.2 Tenant Schema
Each tenant will have it own schema, name by company_${company_id}.

To archive dynamic schema, we only need 1 default table for a company, to store the dynamic table settings. Then the system will base on the seed data to create the dynamic table.

```
| Dynamic data related
├── custom_data_model // the custom data model for tenant

custom_data_model
- id uuid unique not null primary key
- slug varchar(128) not null
- label varchar(128) not null
- is_system boolean not null default false // if true, the table is create by system, user can not delete it
- is_relation boolean not null default false // if true, that mean this table is a relation table, will not list in the table list
- description varchar(256) not null
- created_at timestamp not null default now()
- updated_at timestamp not null default now()
- company_id uuid not null foreign key references company(id)
- columns jsonb not null // the columns detail for the table, include data setting, display setting ...etc


```

### 5.4 Default table for company

there a many default table for a company to make the system work, we should store the default table json in the script/seed_data/default_table.json

```
company_profile
- id uuid unique not null primary key
- name varchar(128) not null
- description varchar(256) not null
- preferences jsonb not null
- created_at timestamp not null default now()
- updated_at timestamp not null default now()

user_profile
- id uuid unique not null primary key
- name varchar(128) not null
- email varchar(128) not null
- phone varchar(128) not null
- address varchar(256) not null
- city varchar(128) not null
- preferences jsonb not null
- role varchar(128) not null
- created_at timestamp not null default now()
- updated_at timestamp not null default now()
- created_by uuid not null foreign key references user(id)

role
- id uuid unique not null primary key
- name varchar(128) not null
- description varchar(256) not null
- parent_role_id uuid not null foreign key references role(id)
- created_at timestamp not null default now()
- updated_at timestamp not null default now()

group
- id uuid unique not null primary key
- name varchar(128) not null
- description varchar(256) not null
- created_at timestamp not null default now()
- updated_at timestamp not null default now()
- auto_join boolean not null default false
- auto_join_rule jsonb not null

user_group
- id uuid unique not null primary key
- user_id uuid not null foreign key references user(id)
- group_id uuid not null foreign key references group(id)
- description varchar(256) not null
- created_at timestamp not null default now()
- updated_at timestamp not null default now()

audit
- id uuid unique not null primary key
- action varchar(128) not null
- data jsonb not null
- created_at timestamp not null default now()
- updated_at timestamp not null default now()
- company_id uuid not null foreign key references company(id)

history
- id uuid unique not null primary key
- table_name varchar(128) not null
- data jsonb not null
- created_at timestamp not null default now()
- updated_at timestamp not null default now()
- company_id uuid not null foreign key references company(id)

form
- id uuid unique not null primary key
- name varchar(128) not null
- description varchar(256) not null
- form_json jsonb not null
- actions jsonb not null
- created_at timestamp not null default now()
- updated_at timestamp not null default now()


workflow
- id uuid unique not null primary key
- name varchar(128) not null
- description varchar(256) not null
- workflow_json jsonb not null
- created_at timestamp not null default now()
- updated_at timestamp not null default now()

task
- id uuid unique not null primary key
- name varchar(128) not null
- description varchar(256) not null
- task_json jsonb not null
- workflow_id uuid  foreign key references workflow(id)
- form_id uuid foreign key references form(id)
- status varchar(128) not null
- version varchar(128) not null
- created_at timestamp not null default now()
- updated_at timestamp not null default now()

```

## 6 Access control
this project will use openFGA for access control. and for tenant isolation, we will create 1 store per company.

#### Main concept in Docpal permission model

one user can have 1 role, and multiple groups.

Roles have hierarchy, parent role will inherit the permission from the child role.

Groups are used to group users together, and they can be used to assign permissions to a group of users.

Basic inheritance rule:
- company 
  - member -> users
  - admin -> users

- custom_data_model
  - owner -> user
  - viewer -> user, role or group
  - editor -> user, role or group
  - creator -> user, role or group
  - admin -> user, role or group
  owner have all permission
  viewer have read permission
  editor have read and write permission
  creator have read and write permission
  admin have read and write permission

the system should add default permission for each custom table when user create the table.
and system should also store the permission for default table into the seed json file.

Advanced permission rule for custom table
- user can set column level permission for each column, column permission will inherit the table permission, but user can override the column permission.
 - inherit permission
  - viewer -> user, role or group
  - editor -> user, role or group
 - additional permission
  - mask -> user, role or group

  
- user can set row level permission for each row, row permission will inherit the table permission, but user can override the row permission.
  - inherit permission
    - viewer -> user, role or group
    - editor -> user, role or group
    - creator -> user, role or group
    - admin -> user, role or group


## 7 Seed data

To let the company work out of the box, we need to seed some data for the company.

### Default Super admin in global schema
- email : superadmin@docpal.com
- password : superadmin123
- created_at : now
- updated_at : now

### Default role
- System admin
 - name : System Admin
 - description : System Admin have all permission
 - parent_role_id : null
 - created_at : now
 - updated_at : now
 - company_id : null

### Default group
- System admin
 - name : System Admin
 - description : System Admin have all permission
 - parent_group_id : null
 - created_at : now
 - updated_at : now
 - company_id : null
 - auto_join : false
 - auto_join_rule : null

- Member
 - name : Member
 - description : Member have read permission
 - parent_group_id : null
 - created_at : now
 - updated_at : now
 - company_id : null
 - auto_join : true
 - auto_join_rule : {allow: ["*"]}


## 8 Business process
### 8.1 create company
- user create company along with admin user profile
- check if company or user already exist
- create global user and company if not exist
- system create default table for company
- system create default role for company
- system create default group for company
- system create default user_profile for user
- system add user to default role and group
- system create new openFGA store for company
- system generate openFGA model for compant
- system add default tuple for default table
  - add user to company
  - add user to default role and group
  - add role and group to default table

### 8.2 create custom data model
 - user create custom data model
 - system check if data model name already exist
 - system check if the schema is valid
 - system insert data to custom_data_model table
 - system create table in company schema db
 - system add default permission for custom data model
  - add openFGA tuple for custom data model
  - add user to table owner

### 8.3 add column to custom data model
 - user add column to custom data model
 - system check if column name already exist
 - system check if the column is valid
 - system insert data to custom_data_model_column table


## 9 API endpoint
  - auth ( public)
    - login
    - logout
    - session
  - company
    - register ( public)
    - user
      - post
      - get
      - :id (user_id)
        - get
        - update
        - delete
    - role
      - post
      - get
      - :id (role_id)
        - get
        - update
        - delete
    - group
      - get
      - post
      - :id (group_id)
        - get
        - update
        - delete
    - schema
      - :table_slug
        - get
        - update
        - delete
      - get
      - post
    - record
      - :table_slug
        - post
        - :id (record_id)
          - get
          - update
          - delete
        - query
          - table
          - kanban
          - tree
        - stats
          - agg
          - chart
      - permission
        - :table_slug
          - model
            - get
            - update
            - :column_name
              - get
              - update
              - delete
          - :record_id
            - get
            - update
            - delete

## 10 Authentication
- this project will use session cookie for authentication
- the session token should store information about the userid and companyid
- session data should store in the global schema session table.

## 11 middleware
- auth middleware // check user login or not, and provide user if into request, if session is near to expire, should refresh the session.
- company middleware // check which compnay user is in, should provide company and openFGA store id into request.


## 12 Development plan

### Phase 1 - setup environment
[ ] setup the project structure
[ ] test openFGA connection
[ ] test database connection
[ ] test file storage connection
[ ] test workflow orchestration connection
[ ] default global schema data

### Phase 2 - setup basic feature
[ ] setup session feature
[ ] setup auth feature
[ ] setup company profile feature
[ ] setup user profile feature
[ ] setup role feature
[ ] setup group feature
[ ] setup schema feature
[ ] setup record feature
[ ] setup permission feature

### Phase 3 - setup advanced feature
[ ] setup workflow feature
[ ] setup audit feature
[ ] setup history feature
[ ] setup form feature
[ ] setup task feature


        



  


