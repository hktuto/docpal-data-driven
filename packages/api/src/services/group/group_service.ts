// Group Service for DocPal API
// Handles group CRUD operations and auto-join rules within company schemas

import { v4 as uuidv4 } from 'uuid';
import { queryInTenantSchema, withTenantTransaction } from '../../database/utils/database';

// Types
export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_at: Date;
  updated_at: Date;
  auto_join: boolean;
  auto_join_rule: Record<string, any>;
}

export interface CreateGroupData {
  name: string;
  slug: string;
  description: string;
  auto_join?: boolean;
  auto_join_rule?: Record<string, any>;
}

export interface UpdateGroupData {
  name?: string;
  slug?: string;
  description?: string;
  auto_join?: boolean;
  auto_join_rule?: Record<string, any>;
}

export interface GroupWithMembers extends Group {
  member_count: number;
  members?: GroupMember[];
}

export interface GroupMember {
  id: string;
  user_id: string;
  group_id: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Get all groups in a company
 */
export const getGroups = async (companyId: string): Promise<Group[]> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      slug,
      description,
      created_at,
      updated_at,
      auto_join,
      auto_join_rule
    FROM "group"
    ORDER BY name
  `);
  
  return result.rows;
};

/**
 * Get group by ID
 */
export const getGroupById = async (companyId: string, groupId: string): Promise<Group | null> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      slug,
      description,
      created_at,
      updated_at,
      auto_join,
      auto_join_rule
    FROM "group"
    WHERE id = $1
  `, [groupId]);
  
  return result.rows[0] || null;
};

/**
 * Get group by slug
 */
export const getGroupBySlug = async (companyId: string, slug: string): Promise<Group | null> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      slug,
      description,
      created_at,
      updated_at,
      auto_join,
      auto_join_rule
    FROM "group"
    WHERE slug = $1
  `, [slug]);
  
  return result.rows[0] || null;
};

/**
 * Create new group
 */
export const createGroup = async (companyId: string, groupData: CreateGroupData): Promise<Group> => {
  const { name, slug, description, auto_join = false, auto_join_rule = {} } = groupData;
  
  // Check if slug already exists
  const existingGroup = await getGroupBySlug(companyId, slug);
  if (existingGroup) {
    throw new Error('Group already exists with this slug');
  }
  
  return await withTenantTransaction(companyId, async (client) => {
    const result = await client.query(`
      INSERT INTO "group" (
        id, name, slug, description, auto_join, auto_join_rule
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id, name, slug, description, created_at, updated_at, 
        auto_join, auto_join_rule
    `, [uuidv4(), name, slug, description, auto_join, JSON.stringify(auto_join_rule)]);
    
    return result.rows[0];
  });
};

/**
 * Update group
 */
export const updateGroup = async (
  companyId: string,
  groupId: string,
  updateData: UpdateGroupData
): Promise<Group> => {
  const { name, slug, description, auto_join, auto_join_rule } = updateData;
  
  // If slug is being updated, check for conflicts
  if (slug) {
    const existingGroup = await getGroupBySlug(companyId, slug);
    if (existingGroup && existingGroup.id !== groupId) {
      throw new Error('Group already exists with this slug');
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
    if (auto_join !== undefined) {
      updateFields.push(`auto_join = $${paramCount++}`);
      values.push(auto_join);
    }
    if (auto_join_rule !== undefined) {
      updateFields.push(`auto_join_rule = $${paramCount++}`);
      values.push(JSON.stringify(auto_join_rule));
    }
    
    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }
    
    updateFields.push(`updated_at = NOW()`);
    values.push(groupId);
    
    const result = await client.query(`
      UPDATE "group" 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id, name, slug, description, created_at, updated_at, 
        auto_join, auto_join_rule
    `, values);
    
    if (result.rows.length === 0) {
      throw new Error('Group not found');
    }
    
    return result.rows[0];
  });
};

/**
 * Delete group
 */
export const deleteGroup = async (companyId: string, groupId: string): Promise<void> => {
  await withTenantTransaction(companyId, async (client) => {
    // Check if group has members
    const membersResult = await client.query(
      'SELECT COUNT(*) as count FROM user_group WHERE group_id = $1',
      [groupId]
    );
    
    if (parseInt(membersResult.rows[0].count) > 0) {
      throw new Error('Cannot delete group with members. Remove all members first.');
    }
    
    const result = await client.query(
      'DELETE FROM "group" WHERE id = $1',
      [groupId]
    );
    
    if (result.rowCount === 0) {
      throw new Error('Group not found');
    }
  });
};

/**
 * Get groups with member counts
 */
export const getGroupsWithMemberCounts = async (companyId: string): Promise<GroupWithMembers[]> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      g.id,
      g.name,
      g.slug,
      g.description,
      g.created_at,
      g.updated_at,
      g.auto_join,
      g.auto_join_rule,
      COALESCE(COUNT(ug.id), 0) as member_count
    FROM "group" g
    LEFT JOIN user_group ug ON g.id = ug.group_id
    GROUP BY g.id, g.name, g.slug, g.description, g.created_at, g.updated_at, g.auto_join, g.auto_join_rule
    ORDER BY g.name
  `);
  
  return result.rows;
};

/**
 * Get group members
 */
export const getGroupMembers = async (companyId: string, groupId: string): Promise<GroupMember[]> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      user_id,
      group_id,
      description,
      created_at,
      updated_at
    FROM user_group
    WHERE group_id = $1
    ORDER BY created_at
  `, [groupId]);
  
  return result.rows;
};

/**
 * Add user to group
 */
export const addUserToGroup = async (
  companyId: string,
  groupId: string,
  userId: string,
  description?: string
): Promise<GroupMember> => {
  // Verify group exists
  const group = await getGroupById(companyId, groupId);
  if (!group) {
    throw new Error('Group not found');
  }
  
  return await withTenantTransaction(companyId, async (client) => {
    // Check if user is already in group
    const existingResult = await client.query(
      'SELECT id FROM user_group WHERE user_id = $1 AND group_id = $2',
      [userId, groupId]
    );
    
    if (existingResult.rows.length > 0) {
      throw new Error('User is already a member of this group');
    }
    
    const result = await client.query(`
      INSERT INTO user_group (id, user_id, group_id, description)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, group_id, description, created_at, updated_at
    `, [uuidv4(), userId, groupId, description]);
    
    return result.rows[0];
  });
};

/**
 * Remove user from group
 */
export const removeUserFromGroup = async (
  companyId: string,
  groupId: string,
  userId: string
): Promise<void> => {
  await withTenantTransaction(companyId, async (client) => {
    const result = await client.query(
      'DELETE FROM user_group WHERE user_id = $1 AND group_id = $2',
      [userId, groupId]
    );
    
    if (result.rowCount === 0) {
      throw new Error('User is not a member of this group');
    }
  });
};

/**
 * Get user's groups
 */
export const getUserGroups = async (companyId: string, userId: string): Promise<Group[]> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      g.id,
      g.name,
      g.slug,
      g.description,
      g.created_at,
      g.updated_at,
      g.auto_join,
      g.auto_join_rule
    FROM "group" g
    INNER JOIN user_group ug ON g.id = ug.group_id
    WHERE ug.user_id = $1
    ORDER BY g.name
  `, [userId]);
  
  return result.rows;
};

/**
 * Search groups by name or description
 */
export const searchGroups = async (
  companyId: string, 
  searchTerm: string, 
  limit: number = 50
): Promise<Group[]> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      slug,
      description,
      created_at,
      updated_at,
      auto_join,
      auto_join_rule
    FROM "group"
    WHERE 
      name ILIKE $1 OR 
      description ILIKE $1 OR
      slug ILIKE $1
    ORDER BY name
    LIMIT $2
  `, [`%${searchTerm}%`, limit]);
  
  return result.rows;
};
