// Role Service for DocPal API
// Handles role CRUD operations and hierarchy management within company schemas

import { v4 as uuidv4 } from 'uuid';
import { queryInTenantSchema, withTenantTransaction } from '../../database/utils/database';

// Types
export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string;
  parent_role_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateRoleData {
  name: string;
  slug: string;
  description: string;
  parent_role_id?: string;
}

export interface UpdateRoleData {
  name?: string;
  slug?: string;
  description?: string;
  parent_role_id?: string;
}

export interface RoleWithHierarchy extends Role {
  children?: RoleWithHierarchy[];
  parent?: Role;
}

/**
 * Get all roles in a company
 */
export const getRoles = async (companyId: string): Promise<Role[]> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      slug,
      description,
      parent_role_id,
      created_at,
      updated_at
    FROM role
    ORDER BY name
  `);
  
  return result.rows;
};

/**
 * Get role by ID
 */
export const getRoleById = async (companyId: string, roleId: string): Promise<Role | null> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      slug,
      description,
      parent_role_id,
      created_at,
      updated_at
    FROM role
    WHERE id = $1
  `, [roleId]);
  
  return result.rows[0] || null;
};

/**
 * Get role by slug
 */
export const getRoleBySlug = async (companyId: string, slug: string): Promise<Role | null> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      slug,
      description,
      parent_role_id,
      created_at,
      updated_at
    FROM role
    WHERE slug = $1
  `, [slug]);
  
  return result.rows[0] || null;
};

/**
 * Create new role
 */
export const createRole = async (companyId: string, roleData: CreateRoleData): Promise<Role> => {
  const { name, slug, description, parent_role_id } = roleData;
  
  // Check if slug already exists
  const existingRole = await getRoleBySlug(companyId, slug);
  if (existingRole) {
    throw new Error('Role already exists with this slug');
  }
  
  // If parent role is specified, verify it exists
  if (parent_role_id) {
    const parentRole = await getRoleById(companyId, parent_role_id);
    if (!parentRole) {
      throw new Error('Parent role not found');
    }
  }
  
  return await withTenantTransaction(companyId, async (client) => {
    const result = await client.query(`
      INSERT INTO role (
        id, name, slug, description, parent_role_id
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        id, name, slug, description, parent_role_id, 
        created_at, updated_at
    `, [uuidv4(), name, slug, description, parent_role_id]);
    
    return result.rows[0];
  });
};

/**
 * Update role
 */
export const updateRole = async (
  companyId: string,
  roleId: string,
  updateData: UpdateRoleData
): Promise<Role> => {
  const { name, slug, description, parent_role_id } = updateData;
  
  // If slug is being updated, check for conflicts
  if (slug) {
    const existingRole = await getRoleBySlug(companyId, slug);
    if (existingRole && existingRole.id !== roleId) {
      throw new Error('Role already exists with this slug');
    }
  }
  
  // If parent role is specified, verify it exists and doesn't create circular reference
  if (parent_role_id) {
    if (parent_role_id === roleId) {
      throw new Error('Role cannot be its own parent');
    }
    
    const parentRole = await getRoleById(companyId, parent_role_id);
    if (!parentRole) {
      throw new Error('Parent role not found');
    }
    
    // Check for circular reference by traversing up the hierarchy
    const circularCheck = await checkCircularReference(companyId, roleId, parent_role_id);
    if (circularCheck) {
      throw new Error('Cannot create circular reference in role hierarchy');
    }
  }
  
  return await withTenantTransaction(companyId, async (client) => {
    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (slug !== undefined) {
      updateFields.push(`slug = $${paramCount++}`);
      values.push(slug);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (parent_role_id !== undefined) {
      updateFields.push(`parent_role_id = $${paramCount++}`);
      values.push(parent_role_id);
    }
    
    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }
    
    updateFields.push(`updated_at = NOW()`);
    values.push(roleId);
    
    const result = await client.query(`
      UPDATE role 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id, name, slug, description, parent_role_id, 
        created_at, updated_at
    `, values);
    
    if (result.rows.length === 0) {
      throw new Error('Role not found');
    }
    
    return result.rows[0];
  });
};

/**
 * Delete role
 */
export const deleteRole = async (companyId: string, roleId: string): Promise<void> => {
  await withTenantTransaction(companyId, async (client) => {
    // Check if role has children
    const childrenResult = await client.query(
      'SELECT COUNT(*) as count FROM role WHERE parent_role_id = $1',
      [roleId]
    );
    
    if (parseInt(childrenResult.rows[0].count) > 0) {
      throw new Error('Cannot delete role with child roles');
    }
    
    // Check if role is assigned to users
    const usersResult = await client.query(
      'SELECT COUNT(*) as count FROM company_user WHERE role_id = $1',
      [roleId]
    );
    
    if (parseInt(usersResult.rows[0].count) > 0) {
      throw new Error('Cannot delete role that is assigned to users');
    }
    
    const result = await client.query(
      'DELETE FROM role WHERE id = $1',
      [roleId]
    );
    
    if (result.rowCount === 0) {
      throw new Error('Role not found');
    }
  });
};

/**
 * Get role hierarchy (roles with their children and parent)
 */
export const getRoleHierarchy = async (companyId: string): Promise<RoleWithHierarchy[]> => {
  const roles = await getRoles(companyId);
  
  // Create a map for quick lookup
  const roleMap = new Map<string, RoleWithHierarchy>();
  roles.forEach(role => {
    roleMap.set(role.id, { ...role, children: [] });
  });
  
  // Build hierarchy
  const rootRoles: RoleWithHierarchy[] = [];
  
  roles.forEach(role => {
    const roleWithHierarchy = roleMap.get(role.id)!;
    
    if (role.parent_role_id) {
      const parent = roleMap.get(role.parent_role_id);
      if (parent) {
        parent.children!.push(roleWithHierarchy);
        roleWithHierarchy.parent = parent;
      }
    } else {
      rootRoles.push(roleWithHierarchy);
    }
  });
  
  return rootRoles;
};

/**
 * Get all descendants of a role
 */
export const getRoleDescendants = async (companyId: string, roleId: string): Promise<Role[]> => {
  const result = await queryInTenantSchema(companyId, `
    WITH RECURSIVE role_hierarchy AS (
      SELECT id, name, slug, description, parent_role_id, created_at, updated_at
      FROM role
      WHERE id = $1
      
      UNION ALL
      
      SELECT r.id, r.name, r.slug, r.description, r.parent_role_id, r.created_at, r.updated_at
      FROM role r
      INNER JOIN role_hierarchy rh ON r.parent_role_id = rh.id
    )
    SELECT id, name, slug, description, parent_role_id, created_at, updated_at
    FROM role_hierarchy
    WHERE id != $1
    ORDER BY name
  `, [roleId]);
  
  return result.rows;
};

/**
 * Check for circular reference in role hierarchy
 */
const checkCircularReference = async (
  companyId: string, 
  roleId: string, 
  potentialParentId: string
): Promise<boolean> => {
  const descendants = await getRoleDescendants(companyId, roleId);
  return descendants.some(descendant => descendant.id === potentialParentId);
};

/**
 * Search roles by name or description
 */
export const searchRoles = async (
  companyId: string, 
  searchTerm: string, 
  limit: number = 50
): Promise<Role[]> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      slug,
      description,
      parent_role_id,
      created_at,
      updated_at
    FROM role
    WHERE 
      name ILIKE $1 OR 
      description ILIKE $1 OR
      slug ILIKE $1
    ORDER BY name
    LIMIT $2
  `, [`%${searchTerm}%`, limit]);
  
  return result.rows;
};
