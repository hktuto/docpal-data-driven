// User Assignment Service for DocPal API
// Handles user role and group assignments within company schemas

import { queryInTenantSchema, withTenantTransaction } from '../../database/utils/database';
import { getRoleById } from '../role/role_service';
import { getGroupById, addUserToGroup, removeUserFromGroup, getUserGroups } from '../group/group_service';

// Types
export interface UserRoleAssignment {
  user_id: string;
  role_id: string;
  assigned_at: Date;
}

export interface UserGroupAssignment {
  user_id: string;
  group_id: string;
  assigned_at: Date;
}

export interface UserWithAssignments {
  user_id: string;
  role_id?: string;
  role_name?: string;
  groups: Array<{
    group_id: string;
    group_name: string;
    assigned_at: Date;
  }>;
}

/**
 * Assign role to user
 */
export const assignRoleToUser = async (
  companyId: string,
  userId: string,
  roleId: string
): Promise<UserRoleAssignment> => {
  // Verify role exists
  const role = await getRoleById(companyId, roleId);
  if (!role) {
    throw new Error('Role not found');
  }
  
  return await withTenantTransaction(companyId, async (client) => {
    // Update or insert role assignment in company_user table
    const result = await client.query(`
      UPDATE company_user 
      SET role_id = $1, updated_at = NOW()
      WHERE user_id = $2 AND company_id = $3
      RETURNING user_id, role_id, updated_at as assigned_at
    `, [roleId, userId, companyId]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found in company');
    }
    
    return result.rows[0];
  });
};

/**
 * Remove role from user
 */
export const removeRoleFromUser = async (
  companyId: string,
  userId: string
): Promise<void> => {
  await withTenantTransaction(companyId, async (client) => {
    const result = await client.query(`
      UPDATE company_user 
      SET role_id = NULL, updated_at = NOW()
      WHERE user_id = $1 AND company_id = $2
    `, [userId, companyId]);
    
    if (result.rowCount === 0) {
      throw new Error('User not found in company');
    }
  });
};

/**
 * Get user's role assignment
 */
export const getUserRole = async (companyId: string, userId: string): Promise<UserRoleAssignment | null> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      cu.user_id,
      cu.role_id,
      cu.updated_at as assigned_at
    FROM company_user cu
    WHERE cu.user_id = $1 AND cu.company_id = $2 AND cu.role_id IS NOT NULL
  `, [userId, companyId]);
  
  return result.rows[0] || null;
};

/**
 * Assign user to group
 */
export const assignUserToGroup = async (
  companyId: string,
  userId: string,
  groupId: string,
  description?: string
): Promise<UserGroupAssignment> => {
  // Verify group exists
  const group = await getGroupById(companyId, groupId);
  if (!group) {
    throw new Error('Group not found');
  }
  
  // Use the existing addUserToGroup function from group service
  const member = await addUserToGroup(companyId, groupId, userId, description);
  
  return {
    user_id: member.user_id,
    group_id: member.group_id,
    assigned_at: member.created_at
  };
};

/**
 * Remove user from group
 */
export const removeUserFromGroupAssignment = async (
  companyId: string,
  userId: string,
  groupId: string
): Promise<void> => {
  // Use the existing removeUserFromGroup function from group service
  await removeUserFromGroup(companyId, groupId, userId);
};

/**
 * Get user's group assignments
 */
export const getUserGroupAssignments = async (companyId: string, userId: string): Promise<UserGroupAssignment[]> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      ug.user_id,
      ug.group_id,
      ug.created_at as assigned_at
    FROM user_group ug
    WHERE ug.user_id = $1
    ORDER BY ug.created_at
  `, [userId]);
  
  return result.rows;
};

/**
 * Get user with all assignments (role and groups)
 */
export const getUserWithAssignments = async (companyId: string, userId: string): Promise<UserWithAssignments | null> => {
  // Get user's role
  const roleAssignment = await getUserRole(companyId, userId);
  
  // Get user's groups
  const userGroups = await getUserGroups(companyId, userId);
  
  // Get group assignments with details
  const groupAssignments = await queryInTenantSchema(companyId, `
    SELECT 
      ug.group_id,
      g.name as group_name,
      ug.created_at as assigned_at
    FROM user_group ug
    INNER JOIN "group" g ON ug.group_id = g.id
    WHERE ug.user_id = $1
    ORDER BY ug.created_at
  `, [userId]);
  
  if (!roleAssignment && groupAssignments.rows.length === 0) {
    return null;
  }
  
  return {
    user_id: userId,
    role_id: roleAssignment?.role_id,
    role_name: roleAssignment ? (await getRoleById(companyId, roleAssignment.role_id))?.name : undefined,
    groups: groupAssignments.rows
  };
};

/**
 * Get all users with their assignments in a company
 */
export const getUsersWithAssignments = async (companyId: string): Promise<UserWithAssignments[]> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      cu.user_id,
      cu.role_id,
      r.name as role_name,
      COALESCE(
        json_agg(
          json_build_object(
            'group_id', ug.group_id,
            'group_name', g.name,
            'assigned_at', ug.created_at
          )
        ) FILTER (WHERE ug.group_id IS NOT NULL),
        '[]'::json
      ) as groups
    FROM company_user cu
    LEFT JOIN role r ON cu.role_id = r.id
    LEFT JOIN user_group ug ON cu.user_id = ug.user_id
    LEFT JOIN "group" g ON ug.group_id = g.id
    WHERE cu.company_id = $1
    GROUP BY cu.user_id, cu.role_id, r.name
    ORDER BY cu.user_id
  `, [companyId]);
  
  return result.rows.map(row => ({
    user_id: row.user_id,
    role_id: row.role_id,
    role_name: row.role_name,
    groups: row.groups
  }));
};

/**
 * Bulk assign users to group
 */
export const bulkAssignUsersToGroup = async (
  companyId: string,
  groupId: string,
  userIds: string[],
  description?: string
): Promise<UserGroupAssignment[]> => {
  // Verify group exists
  const group = await getGroupById(companyId, groupId);
  if (!group) {
    throw new Error('Group not found');
  }
  
  const assignments: UserGroupAssignment[] = [];
  const errors: string[] = [];
  
  for (const userId of userIds) {
    try {
      const assignment = await assignUserToGroup(companyId, userId, groupId, description);
      assignments.push(assignment);
    } catch (error) {
      errors.push(`User ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  if (errors.length > 0 && assignments.length === 0) {
    throw new Error(`Failed to assign users to group: ${errors.join(', ')}`);
  }
  
  return assignments;
};

/**
 * Bulk remove users from group
 */
export const bulkRemoveUsersFromGroup = async (
  companyId: string,
  groupId: string,
  userIds: string[]
): Promise<void> => {
  const errors: string[] = [];
  
  for (const userId of userIds) {
    try {
      await removeUserFromGroupAssignment(companyId, userId, groupId);
    } catch (error) {
      errors.push(`User ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Failed to remove users from group: ${errors.join(', ')}`);
  }
};
