// OpenFGA utility functions for DocPal API

import { OpenFgaApi, Configuration, WriteAuthorizationModelRequest } from '@openfga/sdk';

// OpenFGA configuration interface
interface OpenFGAConfig {
  apiUrl: string;
  storeId?: string;
  authorizationModelId?: string;
}

// Global OpenFGA client
let fgaClient: OpenFgaApi | null = null;

/**
 * Initialize OpenFGA client
 */
export const initializeOpenFGA = (config: OpenFGAConfig): OpenFgaApi => {
  const configuration = new Configuration({
    apiUrl: config.apiUrl,
  });

  fgaClient = new OpenFgaApi(configuration);
  return fgaClient;
};

/**
 * Get OpenFGA client instance
 */
export const getFGAClient = (): OpenFgaApi => {
  if (!fgaClient) {
    throw new Error('OpenFGA client not initialized. Call initializeOpenFGA first.');
  }
  return fgaClient;
};

/**
 * Create a new store for a company
 */
export const createCompanyStore = async (companyName: string): Promise<string> => {
  const client = getFGAClient();
  
  // company name pass in should already be compant_uuid
  const response = await client.createStore({
    name: companyName,
  });

  if (!response.id) {
    throw new Error('Failed to create OpenFGA store');
  }

  return response.id;
};

/**
 * Create authorization model for a company store
 */
export const createAuthorizationModel = async (storeId: string): Promise<string> => {
  const client = getFGAClient();

  // Basic DocPal authorization model
  const authorizationModel: WriteAuthorizationModelRequest = {
    schema_version: '1.1',
    type_definitions: [
      {
        type: 'company',
        relations: {
          member: {
            this: {},
          },
          admin: {
            this: {},
          },
        },
        metadata: {
          relations: {
            member: { directly_related_user_types: [{ type: 'user' }] },
            admin: { directly_related_user_types: [{ type: 'user' }] },
          },
        },
      },
      {
        type: 'user',
      },
      {
        type: 'role',
        relations: {
          company: {
            this: {},
          },
          assignee: {
            this: {},
          },
          viewer: {
            union: {
              child: [
                { this: {} },
                { tupleToUserset: {
                  tupleset: { relation: 'company' },
                  computedUserset: { object: '', relation: 'member' }
                }},
              ],
            },
          },
          editor: {
            union: {
              child: [
                { this: {} },
                { tupleToUserset: {
                  tupleset: { relation: 'company' },
                  computedUserset: { object: '', relation: 'admin' }
                }},
              ],
            },
          },
          admin: {
            union: {
              child: [
                { this: {} },
                { tupleToUserset: {
                  tupleset: { relation: 'company' },
                  computedUserset: { object: '', relation: 'admin' }
                }},
              ],
            },
          },
        },
        metadata: {
          relations: {
            company: { directly_related_user_types: [{ type: 'company' }] },
            assignee: { directly_related_user_types: [{ type: 'user' }] },
            viewer: { 
              directly_related_user_types: [
                { type: 'user' },
                { type: 'role', relation: 'assignee' },
                { type: 'group', relation: 'member' },
              ],
            },
            editor: { 
              directly_related_user_types: [
                { type: 'user' },
                { type: 'role', relation: 'assignee' },
                { type: 'group', relation: 'member' },
              ],
            },
            admin: { 
              directly_related_user_types: [
                { type: 'user' },
                { type: 'role', relation: 'assignee' },
                { type: 'group', relation: 'member' },
              ],
            },
          },
        },
      },
      {
        type: 'group',
        relations: {
          company: {
            this: {},
          },
          member: {
            this: {},
          },
          viewer: {
            union: {
              child: [
                { this: {} },
                { tupleToUserset: {
                  tupleset: { relation: 'company' },
                  computedUserset: { object: '', relation: 'member' }
                }},
              ],
            },
          },
          editor: {
            union: {
              child: [
                { this: {} },
                { tupleToUserset: {
                  tupleset: { relation: 'company' },
                  computedUserset: { object: '', relation: 'admin' }
                }},
              ],
            },
          },
          admin: {
            union: {
              child: [
                { this: {} },
                { tupleToUserset: {
                  tupleset: { relation: 'company' },
                  computedUserset: { object: '', relation: 'admin' }
                }},
              ],
            },
          },
        },
        metadata: {
          relations: {
            company: { directly_related_user_types: [{ type: 'company' }] },
            member: { directly_related_user_types: [{ type: 'user' }] },
            viewer: { 
              directly_related_user_types: [
                { type: 'user' },
                { type: 'role', relation: 'assignee' },
                { type: 'group', relation: 'member' },
              ],
            },
            editor: { 
              directly_related_user_types: [
                { type: 'user' },
                { type: 'role', relation: 'assignee' },
                { type: 'group', relation: 'member' },
              ],
            },
            admin: { 
              directly_related_user_types: [
                { type: 'user' },
                { type: 'role', relation: 'assignee' },
                { type: 'group', relation: 'member' },
              ],
            },
          },
        },
      },
      {
        type: 'user_profile',
        relations: {
          company: {
            this: {},
          },
          owner: {
            this: {},
          },
          viewer: {
            union: {
              child: [
                { this: {} },
                { computedUserset: { relation: 'owner' } },
                { tupleToUserset: {
                  tupleset: { relation: 'company' },
                  computedUserset: { object: '', relation: 'member' }
                }},
              ],
            },
          },
          editor: {
            union: {
              child: [
                { this: {} },
                { computedUserset: { relation: 'owner' } },
                { tupleToUserset: {
                  tupleset: { relation: 'company' },
                  computedUserset: { object: '', relation: 'admin' }
                }},
              ],
            },
          },
          creator: {
            union: {
              child: [
                { this: {} },
                { computedUserset: { relation: 'owner' } },
                { tupleToUserset: {
                  tupleset: { relation: 'company' },
                  computedUserset: { object: '', relation: 'admin' }
                }},
              ],
            },
          },
          admin: {
            union: {
              child: [
                { this: {} },
                { computedUserset: { relation: 'owner' } },
                { tupleToUserset: {
                  tupleset: { relation: 'company' },
                  computedUserset: { object: '', relation: 'admin' }
                }},
              ],
            },
          },
        },
        metadata: {
          relations: {
            company: { directly_related_user_types: [{ type: 'company' }] },
            owner: { directly_related_user_types: [{ type: 'user' }] },
            viewer: { 
              directly_related_user_types: [
                { type: 'user' },
                { type: 'role', relation: 'assignee' },
                { type: 'group', relation: 'member' },
              ],
            },
            editor: { 
              directly_related_user_types: [
                { type: 'user' },
                { type: 'role', relation: 'assignee' },
                { type: 'group', relation: 'member' },
              ],
            },
            creator: { 
              directly_related_user_types: [
                { type: 'user' },
                { type: 'role', relation: 'assignee' },
                { type: 'group', relation: 'member' },
              ],
            },
            admin: { 
              directly_related_user_types: [
                { type: 'user' },
                { type: 'role', relation: 'assignee' },
                { type: 'group', relation: 'member' },
              ],
            },
          },
        },
      },
      {
        type: 'custom_data_model',
        relations: {
          company: {
            this: {},
          },
          owner: {
            this: {},
          },
          viewer: {
            union: {
              child: [
                { this: {} },
                { computedUserset: { relation: 'owner' } },
                { tupleToUserset: {
                  tupleset: { relation: 'company' },
                  computedUserset: { object: '', relation: 'member' }
                }},
              ],
            },
          },
          editor: {
            union: {
              child: [
                { this: {} },
                { computedUserset: { relation: 'owner' } },
                { tupleToUserset: {
                  tupleset: { relation: 'company' },
                  computedUserset: { object: '', relation: 'admin' }
                }},
              ],
            },
          },
          creator: {
            union: {
              child: [
                { this: {} },
                { computedUserset: { relation: 'owner' } },
                { tupleToUserset: {
                  tupleset: { relation: 'company' },
                  computedUserset: { object: '', relation: 'admin' }
                }},
              ],
            },
          },
          admin: {
            union: {
              child: [
                { this: {} },
                { computedUserset: { relation: 'owner' } },
                { tupleToUserset: {
                  tupleset: { relation: 'company' },
                  computedUserset: { object: '', relation: 'admin' }
                }},
              ],
            },
          },
        },
        metadata: {
          relations: {
            company: { directly_related_user_types: [{ type: 'company' }] },
            owner: { directly_related_user_types: [{ type: 'user' }] },
            viewer: { 
              directly_related_user_types: [
                { type: 'user' },
                { type: 'role', relation: 'assignee' },
                { type: 'group', relation: 'member' },
              ],
            },
            editor: { 
              directly_related_user_types: [
                { type: 'user' },
                { type: 'role', relation: 'assignee' },
                { type: 'group', relation: 'member' },
              ],
            },
            creator: { 
              directly_related_user_types: [
                { type: 'user' },
                { type: 'role', relation: 'assignee' },
                { type: 'group', relation: 'member' },
              ],
            },
            admin: { 
              directly_related_user_types: [
                { type: 'user' },
                { type: 'role', relation: 'assignee' },
                { type: 'group', relation: 'member' },
              ],
            },
          },
        },
      },
    ],
  };

  const response = await client.writeAuthorizationModel(storeId, authorizationModel);

  if (!response.authorization_model_id) {
    throw new Error('Failed to create authorization model');
  }

  return response.authorization_model_id;
};

/**
 * Add a dynamic table type to the OpenFGA authorization model
 */
export const addDynamicTableType = async (storeId: string, tableName: string): Promise<void> => {
  const client = getFGAClient();
  
  try {
    // Get the current authorization model
    // Get the current authorization model by listing models and getting the latest
    const modelsResponse = await client.readAuthorizationModels(storeId);
    
    if (!modelsResponse.authorization_models || modelsResponse.authorization_models.length === 0) {
      throw new Error('No authorization models found');
    }
    
    // Get the latest authorization model (last in the list)
    const currentModel = modelsResponse.authorization_models[modelsResponse.authorization_models.length - 1];
    
    // Check if the table type already exists
    const existingType = currentModel.type_definitions?.find(
      type => type.type === tableName
    );
    
    if (existingType) {
      console.log(`Table type '${tableName}' already exists in OpenFGA model`);
      return;
    }
    
    // Create the new table type definition
    const newTableType = {
      type: tableName,
      relations: {
        company: {
          this: {},
        },
        owner: {
          this: {},
        },
        viewer: {
          union: {
            child: [
              { this: {} },
              { computedUserset: { relation: 'owner' } },
              { tupleToUserset: {
                tupleset: { relation: 'company' },
                computedUserset: { object: '', relation: 'member' }
              }},
            ],
          },
        },
        editor: {
          union: {
            child: [
              { this: {} },
              { computedUserset: { relation: 'owner' } },
              { tupleToUserset: {
                tupleset: { relation: 'company' },
                computedUserset: { object: '', relation: 'admin' }
              }},
            ],
          },
        },
        creator: {
          union: {
            child: [
              { this: {} },
              { computedUserset: { relation: 'owner' } },
              { tupleToUserset: {
                tupleset: { relation: 'company' },
                computedUserset: { object: '', relation: 'admin' }
              }},
            ],
          },
        },
        admin: {
          union: {
            child: [
              { this: {} },
              { computedUserset: { relation: 'owner' } },
              { tupleToUserset: {
                tupleset: { relation: 'company' },
                computedUserset: { object: '', relation: 'admin' }
              }},
            ],
          },
        },
      },
      metadata: {
        relations: {
          company: { directly_related_user_types: [{ type: 'company' }] },
          owner: { directly_related_user_types: [{ type: 'user' }] },
          viewer: { 
            directly_related_user_types: [
              { type: 'user' },
              { type: 'role', relation: 'assignee' },
              { type: 'group', relation: 'member' },
            ],
          },
          editor: { 
            directly_related_user_types: [
              { type: 'user' },
              { type: 'role', relation: 'assignee' },
              { type: 'group', relation: 'member' },
            ],
          },
          creator: { 
            directly_related_user_types: [
              { type: 'user' },
              { type: 'role', relation: 'assignee' },
              { type: 'group', relation: 'member' },
            ],
          },
          admin: { 
            directly_related_user_types: [
              { type: 'user' },
              { type: 'role', relation: 'assignee' },
              { type: 'group', relation: 'member' },
            ],
          },
        },
      },
    };
    
    // Add the new type to the existing model
    const updatedTypeDefinitions = [
      ...(currentModel.type_definitions || []),
      newTableType
    ];
    
    // Write the updated authorization model
    const updatedModel: WriteAuthorizationModelRequest = {
      schema_version: currentModel.schema_version || '1.1',
      type_definitions: updatedTypeDefinitions
    };
    
    await client.writeAuthorizationModel(storeId, updatedModel);
    
    console.log(`Successfully added table type '${tableName}' to OpenFGA model`);
    
  } catch (error) {
    console.error(`Error adding table type '${tableName}' to OpenFGA model:`, error);
    throw new Error(`Failed to add table type to OpenFGA model: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Remove a dynamic table type from the OpenFGA authorization model
 */
export const removeDynamicTableType = async (storeId: string, tableName: string): Promise<void> => {
  const client = getFGAClient();
  
  try {
    // Get the current authorization model
    // Get the current authorization model by listing models and getting the latest
    const modelsResponse = await client.readAuthorizationModels(storeId);
    
    if (!modelsResponse.authorization_models || modelsResponse.authorization_models.length === 0) {
      throw new Error('No authorization models found');
    }
    
    // Get the latest authorization model (last in the list)
    const currentModel = modelsResponse.authorization_models[modelsResponse.authorization_models.length - 1];
    
    // Filter out the table type
    const updatedTypeDefinitions = (currentModel.type_definitions || [])
      .filter(type => type.type !== tableName);
    
    // Check if the type was actually removed
    if (updatedTypeDefinitions.length === (currentModel.type_definitions || []).length) {
      console.log(`Table type '${tableName}' not found in OpenFGA model`);
      return;
    }
    
    // Write the updated authorization model
    const updatedModel: WriteAuthorizationModelRequest = {
      schema_version: currentModel.schema_version || '1.1',
      type_definitions: updatedTypeDefinitions
    };
    
    await client.writeAuthorizationModel(storeId, updatedModel);
    
    console.log(`Successfully removed table type '${tableName}' from OpenFGA model`);
    
  } catch (error) {
    console.error(`Error removing table type '${tableName}' from OpenFGA model:`, error);
    throw new Error(`Failed to remove table type from OpenFGA model: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Check if user has permission
 */
export const checkPermission = async (
  storeId: string,
  userId: string,
  relation: string,
  objectType: string,
  objectId: string
): Promise<boolean> => {
  const client = getFGAClient();

  const response = await client.check(storeId, {
    tuple_key: {
      user: `user:${userId}`,
      relation,
      object: `${objectType}:${objectId}`,
    },
  });

  return response.allowed || false;
};

/**
 * Write relationship tuple
 */
export const writeRelationship = async (
  storeId: string,
  userId: string,
  relation: string,
  objectType: string,
  objectId: string
): Promise<void> => {
  const client = getFGAClient();

  await client.write(storeId, {
    writes: {
      tuple_keys: [
        {
          user: `user:${userId}`,
          relation,
          object: `${objectType}:${objectId}`,
        },
      ],
    },
  });
};

/**
 * Delete relationship tuple
 */
export const deleteRelationship = async (
  storeId: string,
  userId: string,
  relation: string,
  objectType: string,
  objectId: string
): Promise<void> => {
  const client = getFGAClient();

  await client.write(storeId, {
    deletes: {
      tuple_keys: [
        {
          user: `user:${userId}`,
          relation,
          object: `${objectType}:${objectId}`,
        },
      ],
    },
  });
};

/**
 * Setup default permissions for a new company and admin user
 */
export const setupCompanyPermissions = async (
  storeId: string,
  companyId: string,
  userId: string,
  adminRoleId: string,
  allUsersGroupId: string,
  userProfileId: string
): Promise<void> => {
  const client = getFGAClient();

  // Create all permission tuples in one batch
  const tuples = [
    // Add user to company as admin
    {
      user: `user:${userId}`,
      relation: 'admin',
      object: `company:${companyId}`,
    },
    // Add user to company as member (admins are also members)
    {
      user: `user:${userId}`,
      relation: 'member',
      object: `company:${companyId}`,
    },
    // Add user to admin role
    {
      user: `user:${userId}`,
      relation: 'assignee',
      object: `role:${adminRoleId}`,
    },
    // Add user to all users group
    {
      user: `user:${userId}`,
      relation: 'member',
      object: `group:${allUsersGroupId}`,
    },
    // Link admin role to company (enables inheritance)
    {
      user: `company:${companyId}`,
      relation: 'company',
      object: `role:${adminRoleId}`,
    },
    // Link all users group to company (enables inheritance)
    {
      user: `company:${companyId}`,
      relation: 'company',
      object: `group:${allUsersGroupId}`,
    },
    // Link user_profile to company (enables inheritance)
    {
      user: `company:${companyId}`,
      relation: 'company',
      object: `user_profile:${userProfileId}`,
    },
    // Set user_profile owner to user (direct ownership)
    {
      user: `user:${userId}`,
      relation: 'owner',
      object: `user_profile:${userProfileId}`,
    },
  ];

  // Write all tuples in one operation
  await client.write(storeId, {
    writes: {
      tuple_keys: tuples,
    },
  });
};

/**
 * Test OpenFGA connection
 */
export const testOpenFGAConnection = async (): Promise<boolean> => {
  try {
    const client = getFGAClient();
    await client.listStores();
    return true;
  } catch (error) {
    console.error('OpenFGA connection test failed:', error);
    return false;
  }
};
