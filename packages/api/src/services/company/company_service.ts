import { Pool } from 'pg';
import { withTransaction, withTenantTransaction, queryInTenantSchema, getPool } from '../../database/utils/database';
import { createCompanyStore, createAuthorizationModel, setupCompanyPermissions, getFGAClient } from '../../utils/openfga';
import { findUserByEmail, createUser, createSession } from '../auth/auth_service';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
// Using local types for now - will be moved to shared library later
interface Company {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  settings?: Record<string, any>;
  status?: string;
  openfga_store_id?: string;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
  plan?: string;
  plan_details?: Record<string, any>;
}

/**
 * Company registration data
 */
export interface CompanyRegistrationData {
  name: string;
  slug: string;
  description?: string;
  settings?: Record<string, any>;
}

/**
 * Admin user profile data for company registration
 */
export interface AdminUserProfileData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  preferences?: Record<string, any>;
}

/**
 * Enhanced company registration data with admin user
 */
export interface EnhancedCompanyRegistrationData {
  // Company info
  name: string;
  slug: string;
  description?: string;
  settings?: Record<string, any>;
  // Admin user info
  admin: {
    email: string;
    password: string;
    profile: AdminUserProfileData;
  };
}

/**
 * Company with user relationship
 */
export interface CompanyWithRole extends Company {
  role: string;
  joined_at: Date;
}

/**
 * Create a new company
 */
export const createCompany = async (
  pool: Pool,
  companyData: CompanyRegistrationData,
  ownerId: string
): Promise<Company> => {
  return await withTransaction(async (client) => {
    // 1. Create company record with all data in global table
    const companyResult = await client.query(
      `INSERT INTO company (name, slug, description, settings, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        companyData.name,
        companyData.slug,
        companyData.description || null,
        companyData.settings || {},
        ownerId,
      ]
    );

    const company = companyResult.rows[0] as Company;

    // 2. Add owner to company_user table
    await client.query(
      `INSERT INTO company_user (company_id, user_id)
       VALUES ($1, $2)`,
      [company.id, ownerId]
    );

    // 3. Create OpenFGA store for the company
    const storeId = await createCompanyStore(`company-${company.id}`);
    
    // 4. Update company with OpenFGA store ID
    await client.query(
      `UPDATE company SET openfga_store_id = $1 WHERE id = $2`,
      [storeId, company.id]
    );

    // 5. Create authorization model in OpenFGA
    await createAuthorizationModel(storeId);

    // 6. Create tenant schema
    await client.query('SELECT create_tenant_schema($1)', [company.id]);

    return { ...company, openfga_store_id: storeId };
  });
};

/**
 * Create company with admin user (enhanced registration)
 */
export const createCompanyWithAdmin = async (
  pool: Pool,
  registrationData: EnhancedCompanyRegistrationData
): Promise<{
  company: Company;
  user: any;
  sessionToken: string;
}> => {
  return await withTransaction(async (client) => {
    const { admin, ...companyData } = registrationData;
    
    // 1. Check if user already exists
    let user = await findUserByEmail(admin.email);
    let isNewUser = false;
    
    if (!user) {
      // Create new user
      user = await createUser({
        email: admin.email,
        password: admin.password,
      });
      isNewUser = true;
    }
    
    // 2. Create company with user as owner
    const company = await createCompany(pool, companyData, user.id);
    
    // 3. Create user profile in tenant schema
    await withTenantTransaction(company.id, async (tenantClient) => {
      // Check if profile already exists
      const existingProfile = await tenantClient.query(
        'SELECT id FROM user_profile WHERE email = $1',
        [admin.email]
      );
      
      if (existingProfile.rows.length === 0) {
        // Create user profile
        await tenantClient.query(
          `INSERT INTO user_profile (id, name, email, phone, address, city, preferences, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            user.id,
            admin.profile.name,
            admin.profile.email,
            admin.profile.phone,
            admin.profile.address,
            admin.profile.city,
            admin.profile.preferences || {},
            user.id,
          ]
        );
      }
    });
    
    // 4. Seed default roles and groups, and setup user relationships
    const { adminRoleId, allUsersGroupId } = await seedCompanyDefaults(pool, company.id, user.id);
    
    // 5. Setup OpenFGA permissions
    await setupCompanyPermissions(
      company.openfga_store_id!,
      company.id,
      user.id,
      adminRoleId,
      allUsersGroupId,
      user.id // user_profile ID is same as user ID
    );
    
    // 6. Create session token
    const sessionToken = uuidv4();
    await createSession(sessionToken, user, company.id);
    
    return {
      company,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        updated_at: user.updated_at,
        isNewUser,
      },
      sessionToken,
    };
  });
};

/**
 * Get company by ID
 */
export const getCompanyById = async (
  pool: Pool,
  companyId: string
): Promise<Company | null> => {
  const result = await pool.query(
    'SELECT * FROM company WHERE id = $1 AND status = $2',
    [companyId, 'active']
  );

  return result.rows[0] || null;
};

/**
 * Get company by slug
 */
export const getCompanyBySlug = async (
  pool: Pool,
  slug: string
): Promise<Company | null> => {
  const result = await pool.query(
    'SELECT * FROM company WHERE slug = $1 AND status = $2',
    [slug, 'active']
  );

  return result.rows[0] || null;
};

/**
 * Get companies for a user
 */
export const getUserCompanies = async (
  pool: Pool,
  userId: string
): Promise<CompanyWithRole[]> => {
  const result = await pool.query(
    `SELECT 
       c.*,
       cu.created_at as joined_at,
       cu.role_id
     FROM company c
     INNER JOIN company_user cu ON c.id = cu.company_id
     WHERE cu.user_id = $1 AND c.status = $2
     ORDER BY cu.created_at DESC`,
    [userId, 'active']
  );

  // Get user role from tenant schema for each company
  const companies: CompanyWithRole[] = [];
  for (const row of result.rows) {
    let role = 'member'; // Default role
    
    if (row.role_id) {
      try {
        // Get user's role from tenant role table
        const roleResult = await queryInTenantSchema(
          row.id,
          'SELECT slug FROM role WHERE id = $1',
          [row.role_id]
        );
        
        if (roleResult.rows.length > 0) {
          role = roleResult.rows[0].slug;
        }
      } catch (error) {
        // Tenant schema might not exist yet or role not found
        // Use default role
      }
    }
    
    companies.push({
      ...row,
      role,
      joined_at: row.joined_at,
    });
  }

  return companies;
};

/**
 * Check if user has access to company
 */
export const checkUserCompanyAccess = async (
  pool: Pool,
  userId: string,
  companyId: string
): Promise<{ hasAccess: boolean; role?: string }> => {
  const result = await pool.query(
    `SELECT cu.role_id FROM company_user cu
     INNER JOIN company c ON cu.company_id = c.id
     WHERE cu.user_id = $1 AND cu.company_id = $2 AND c.status = $3`,
    [userId, companyId, 'active']
  );
  if (result.rows.length === 0) {
    return { hasAccess: false };
  }

  let role = 'member'; // Default role
  
  if (result.rows[0].role_id) {
    try {
      // Get user's role from tenant role table
      const roleResult = await queryInTenantSchema(
        companyId,
        'SELECT slug FROM role WHERE id = $1',
        [result.rows[0].role_id]
      );
      if (roleResult.rows.length > 0) {
        role = roleResult.rows[0].slug;
      }
    } catch (error) {
      // Tenant schema might not exist yet or role not found
      // Use default role
    }
  }
  return { hasAccess: true, role };
};

/**
 * Add user to company
 */
export const addUserToCompany = async (
  pool: Pool,
  companyId: string,
  userId: string,
  role: string = 'member',
  invitedBy: string
): Promise<void> => {
  await withTransaction(async (client) => {
    // Check if user is already in company
    const existing = await client.query(
      'SELECT id FROM company_user WHERE company_id = $1 AND user_id = $2',
      [companyId, userId]
    );

    if (existing.rows.length > 0) {
      throw new Error('User is already a member of this company');
    }

    // Add user to company
    await client.query(
      `INSERT INTO company_user (company_id, user_id)
       VALUES ($1, $2)`,
      [companyId, userId]
    );
  });
};

/**
 * Update user role in company
 */
export const updateUserRole = async (
  pool: Pool,
  companyId: string,
  userId: string,
  newRole: string
): Promise<void> => {
  await pool.query(
    `UPDATE company_user 
     SET role = $1, updated_at = CURRENT_TIMESTAMP
     WHERE company_id = $2 AND user_id = $3`,
    [newRole, companyId, userId]
  );
};

/**
 * Remove user from company
 */
export const removeUserFromCompany = async (
  pool: Pool,
  companyId: string,
  userId: string
): Promise<void> => {
  // Update database status
  await pool.query(
    `UPDATE company_user 
     SET status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE company_id = $2 AND user_id = $3`,
    ['inactive', companyId, userId]
  );
  
  // Clean up OpenFGA permissions
  await cleanupUserCompanyPermissions(companyId, userId);
};

/**
 * Seed default data for new company and setup user relationships
 */
export const seedCompanyDefaults = async (
  pool: Pool,
  companyId: string,
  userId: string
): Promise<{ adminRoleId: string; allUsersGroupId: string }> => {
  return await withTenantTransaction(companyId, async (client) => {
    // Create default admin role (or get existing one)
    const adminRoleResult = await client.query(
      `INSERT INTO role (name, slug, description)
       VALUES ($1, $2, $3) 
       ON CONFLICT (slug) DO UPDATE SET 
         name = EXCLUDED.name,
         description = EXCLUDED.description
       RETURNING id`,
      [
        'Administrator',
        'admin',
        'Full system access',
      ]
    );


    // Create default group (or get existing one)
    const allUsersGroupResult = await client.query(
      `INSERT INTO "group" (name, slug, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET 
         name = EXCLUDED.name,
         description = EXCLUDED.description
       RETURNING id`,
      [
        'All Users',
        'all-users',
        'Default group for all company users',
      ]
    );

    // Update company_user with admin role_id
    await pool.query(
      `UPDATE company_user SET role_id = $1 WHERE company_id = $2 AND user_id = $3`,
      [adminRoleResult.rows[0].id, companyId, userId]
    );

    // Add user to "All Users" group (if not already a member)
    if (!userId) {
      throw new Error('User ID is required for group membership');
    }
    await client.query(
      `INSERT INTO user_group (user_id, group_id) VALUES ($1, $2)
       ON CONFLICT (user_id, group_id) DO NOTHING`,
      [userId, allUsersGroupResult.rows[0].id]
    );

    return {
      adminRoleId: adminRoleResult.rows[0].id,
      allUsersGroupId: allUsersGroupResult.rows[0].id,
    };
  });
};

/**
 * Clean up all OpenFGA permissions for a user when they're removed from a company
 */
const cleanupUserCompanyPermissions = async (companyId: string, userId: string): Promise<void> => {
  try {
    const openFGAClient = getFGAClient();
    
    // Get the company's OpenFGA store ID
    const pool = getPool();
    const storeResult = await pool.query('SELECT openfga_store_id FROM company WHERE id = $1', [companyId]);
    if (storeResult.rows.length === 0) {
      console.error('No OpenFGA store found for company:', companyId);
      return;
    }
    
    const storeId = storeResult.rows[0].openfga_store_id;
    
    // Read all tuples for this user in this company's store
    const readResult = await openFGAClient.read(storeId, {
      tuple_key: {
        user: `user:${userId}`
      }
    });
    
    if (readResult.tuples && readResult.tuples.length > 0) {
      // Delete all existing permissions for this user in this company
      await openFGAClient.write(storeId, {
        deletes: {
          tuple_keys: readResult.tuples.map(tuple => ({
            user: tuple.key.user,
            relation: tuple.key.relation,
            object: tuple.key.object
          }))
        }
      });
      
      console.log(`Cleaned up ${readResult.tuples.length} OpenFGA permission tuples for user ${userId} in company ${companyId}`);
    } else {
      console.log(`No OpenFGA permission tuples found for user ${userId} in company ${companyId}`);
    }
    
  } catch (error) {
    console.error('Error cleaning up user company permissions:', error);
    // Don't throw error here as the user removal should still proceed
  }
};
