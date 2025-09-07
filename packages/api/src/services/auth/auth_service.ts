// Authentication service for DocPal API

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../database/utils/database';
import { setSession, deleteSession } from '../../utils/valkey';
import { getCompanyById } from '../company/company_service';

// Types
interface User {
  id: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
}

export interface SessionData {
  userId: string;
  email: string;
  companyId?: string;
  storeId?: string;
  loginTime: Date;
}

/**
 * Hash password using bcrypt
 */
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Verify password against hash
 */
const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

/**
 * Find user by email
 */
export const findUserByEmail = async (email: string): Promise<User | null> => {
  const result = await query(
    'SELECT id, email, created_at, updated_at FROM "user" WHERE email = $1',
    [email]
  );
  
  return result.rows[0] || null;
};

/**
 * Find user by ID
 */
export const findUserById = async (userId: string): Promise<User | null> => {
  const result = await query(
    'SELECT id, email, created_at, updated_at FROM "user" WHERE id = $1',
    [userId]
  );
  
  return result.rows[0] || null;
};

/**
 * Create new user
 */
export const createUser = async (userData: RegisterData): Promise<User> => {
  const { email, password } = userData;
  
  // Check if user already exists
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new Error('User already exists with this email');
  }
  
  // Hash password
  const hashedPassword = await hashPassword(password);
  
  // Create user in transaction
  return await withTransaction(async (client) => {
    const userResult = await client.query(
      'INSERT INTO "user" (id, email, password) VALUES ($1, $2, $3) RETURNING id, email, created_at, updated_at',
      [uuidv4(), email, hashedPassword]
    );
    
    const user = userResult.rows[0];
    
    // Log audit event
    await client.query(
      'INSERT INTO audit (id, action, data, company_id) VALUES ($1, $2, $3, $4)',
      [uuidv4(), 'user_created', { userId: user.id, email }, null]
    );
    
    return user;
  });
};

/**
 * Authenticate user with email and password
 */
export const authenticateUser = async (credentials: LoginCredentials): Promise<User | null> => {
  const { email, password } = credentials;
  
  // Get user with password hash
  const result = await query(
    'SELECT id, email, password, created_at, updated_at FROM "user" WHERE email = $1',
    [email]
  );
  
  const user = result.rows[0];
  if (!user) {
    return null;
  }
  
  // Verify password
  const isValidPassword = await verifyPassword(password, user.password);
  if (!isValidPassword) {
    return null;
  }
  
  // Return user without password
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

/**
 * Get user's companies
 */
export const getUserCompanies = async (userId: string) => {
  const result = await query(`
    SELECT 
      c.id,
      c.name,
      c.created_at,
      cu.id as company_user_id,
      cu.user_profile_id
    FROM company c
    JOIN company_user cu ON c.id = cu.company_id
    WHERE cu.user_id = $1
    ORDER BY c.name
  `, [userId]);
  
  return result.rows;
};

/**
 * Validate if user belongs to a specific company
 */
export const validateUserCompanyRelationship = async (userId: string, companyId: string): Promise<boolean> => {
  const result = await query(`
    SELECT 1 FROM company_user 
    WHERE user_id = $1 AND company_id = $2
  `, [userId, companyId]);
  
  return result.rows.length > 0;
};

/**
 * Create session for user
 */
export const createSession = async (
  sessionId: string,
  user: User,
  companyId?: string
): Promise<void> => {
  const sessionData: SessionData = {
    userId: user.id,
    email: user.email,
    companyId,
    loginTime: new Date(),
  };
  
  // Store in Valkey with TTL
  await setSession(sessionId, sessionData, 3600 * 7); // 7 hour
  
  // Store in database for tracking
  await withTransaction(async (client) => {
    // Clean up old sessions for this user
    await client.query(
      'DELETE FROM session WHERE user_id = $1',
      [user.id]
    );
    
    // Create new session record
    await client.query(
      'INSERT INTO session (id, user_id, company_id, session_token, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [
        uuidv4(),
        user.id,
        companyId || null,
        sessionId,
        new Date(Date.now() + 3600 * 7 * 1000), // 7 hour from now
      ]
    );
    
    // Log audit event
    await client.query(
      'INSERT INTO audit (id, action, data, company_id) VALUES ($1, $2, $3, $4)',
      [uuidv4(), 'user_login', { userId: user.id, companyId }, companyId || null]
    );
    console.log('-----------session created', sessionId);
  });
};

/**
 * Destroy session
 */
export const destroySession = async (sessionId: string, userId?: string): Promise<void> => {
  // Remove from Valkey
  await deleteSession(sessionId);
  
  // Remove from database
  await withTransaction(async (client) => {
    await client.query(
      'DELETE FROM session WHERE session_token = $1',
      [sessionId]
    );
    
    // Log audit event if we have userId
    if (userId) {
      await client.query(
        'INSERT INTO audit (id, action, data, company_id) VALUES ($1, $2, $3, $4)',
        [uuidv4(), 'user_logout', { userId }, null]
      );
    }
  });
};

/**
 * Validate and refresh session
 */
export const validateSession = async (sessionId: string): Promise<SessionData | null> => {
  // Check database first
  const result = await query(
    'SELECT user_id, company_id, expires_at FROM session WHERE session_token = $1',
    [sessionId]
  );
  console.log('-----------sessionId', sessionId);
  const sessionRecord = result.rows[0];
  console.log('-----------sessionRecord', sessionRecord);
  if (!sessionRecord || new Date() > sessionRecord.expires_at) {
    console.log('-----------sessionRecord expired');
    // Session expired or doesn't exist
    if (sessionRecord) {
      await destroySession(sessionId);
    }
    return null;
  }
  
  // Get user data
  const user = await findUserById(sessionRecord.user_id);
  if (!user) {
    await destroySession(sessionId);
    return null;
  }

  const company = await query('SELECT openfga_store_id FROM company WHERE id = $1', [sessionRecord.company_id]);

  if(!company.rows[0].openfga_store_id) {
    await destroySession(sessionId);
    return null;
  }
  // Return session data
  return {
    userId: user.id,
    email: user.email,
    companyId: sessionRecord.company_id,
    storeId: company.rows[0].openfga_store_id,
    loginTime: new Date(), // We could store this in session if needed
  };
};
