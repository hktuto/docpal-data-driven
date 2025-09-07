// User Profile Service for DocPal API
// Handles user profile CRUD operations within company schemas

import { v4 as uuidv4 } from 'uuid';
import { queryInTenantSchema, withTenantTransaction } from '../../database/utils/database';

// Types
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  preferences: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

export interface CreateUserProfileData {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  preferences?: Record<string, any>;
}

export interface UpdateUserProfileData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  preferences?: Record<string, any>;
}

/**
 * Get all user profiles in a company
 */
export const getUserProfiles = async (companyId: string): Promise<UserProfile[]> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      email,
      phone,
      address,
      city,
      preferences,
      created_at,
      updated_at,
      created_by
    FROM user_profile
    ORDER BY name
  `);
  
  return result.rows;
};

/**
 * Get user profile by ID
 */
export const getUserProfileById = async (companyId: string, profileId: string): Promise<UserProfile | null> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      email,
      phone,
      address,
      city,
      preferences,
      created_at,
      updated_at,
      created_by
    FROM user_profile
    WHERE id = $1
  `, [profileId]);
  
  return result.rows[0] || null;
};

/**
 * Get user profile by email
 */
export const getUserProfileByEmail = async (companyId: string, email: string): Promise<UserProfile | null> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      email,
      phone,
      address,
      city,
      preferences,
      created_at,
      updated_at,
      created_by
    FROM user_profile
    WHERE email = $1
  `, [email]);
  
  return result.rows[0] || null;
};

/**
 * Create new user profile
 */
export const createUserProfile = async (
  companyId: string, 
  profileData: CreateUserProfileData, 
  createdBy: string
): Promise<UserProfile> => {
  const { name, email, phone, address, city, preferences = {} } = profileData;
  
  // Check if email already exists
  const existingProfile = await getUserProfileByEmail(companyId, email);
  if (existingProfile) {
    throw new Error('User profile already exists with this email');
  }
  
  return await withTenantTransaction(companyId, async (client) => {
    const result = await client.query(`
      INSERT INTO user_profile (
        id, name, email, phone, address, city, preferences, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING 
        id, name, email, phone, address, city, preferences, 
        created_at, updated_at, created_by
    `, [uuidv4(), name, email, phone, address, city, JSON.stringify(preferences), createdBy]);
    
    return result.rows[0];
  });
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  companyId: string,
  profileId: string,
  updateData: UpdateUserProfileData
): Promise<UserProfile> => {
  const { name, email, phone, address, city, preferences } = updateData;
  
  // If email is being updated, check for conflicts
  if (email) {
    const existingProfile = await getUserProfileByEmail(companyId, email);
    if (existingProfile && existingProfile.id !== profileId) {
      throw new Error('User profile already exists with this email');
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
    if (email !== undefined) {
      updateFields.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (phone !== undefined) {
      updateFields.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    if (address !== undefined) {
      updateFields.push(`address = $${paramCount++}`);
      values.push(address);
    }
    if (city !== undefined) {
      updateFields.push(`city = $${paramCount++}`);
      values.push(city);
    }
    if (preferences !== undefined) {
      updateFields.push(`preferences = $${paramCount++}`);
      values.push(JSON.stringify(preferences));
    }
    
    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }
    
    updateFields.push(`updated_at = NOW()`);
    values.push(profileId);
    
    const result = await client.query(`
      UPDATE user_profile 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id, name, email, phone, address, city, preferences, 
        created_at, updated_at, created_by
    `, values);
    
    if (result.rows.length === 0) {
      throw new Error('User profile not found');
    }
    
    return result.rows[0];
  });
};

/**
 * Delete user profile
 */
export const deleteUserProfile = async (companyId: string, profileId: string): Promise<void> => {
  await withTenantTransaction(companyId, async (client) => {
    const result = await client.query(
      'DELETE FROM user_profile WHERE id = $1',
      [profileId]
    );
    
    if (result.rowCount === 0) {
      throw new Error('User profile not found');
    }
  });
};

/**
 * Search user profiles by name or email
 */
export const searchUserProfiles = async (
  companyId: string, 
  searchTerm: string, 
  limit: number = 50
): Promise<UserProfile[]> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      email,
      phone,
      address,
      city,
      preferences,
      created_at,
      updated_at,
      created_by
    FROM user_profile
    WHERE 
      name ILIKE $1 OR 
      email ILIKE $1
    ORDER BY name
    LIMIT $2
  `, [`%${searchTerm}%`, limit]);
  
  return result.rows;
};
