import { string } from "zod/v4";
import sql from "../db";
import bcrypt from 'bcrypt';

export type UserRole = "admin" | "manager" | "staff";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
}

// ── Queries ──────────────────────────────────────────────────

export async function getAllUsers(): Promise<User[]> {
  return sql<User[]>`
    SELECT * FROM users
    ORDER BY created_at DESC
  `;
}

export async function getUserById(id: string): Promise<User | null> {
  const [user] = await sql<User[]>`
    SELECT * FROM users
    WHERE id = ${id}
  `;
  return user ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const [user] = await sql<User[]>`
    SELECT * FROM users
    WHERE email = ${email}
  `;
  return user ?? null;
}

// ── Mutations ────────────────────────────────────────────────

export async function createUser(input: CreateUserInput): Promise<User> {
  const hashedPassword = await bcrypt.hash(input.password, 10);
  const [user] = await sql<User[]>`
    INSERT INTO users (name, email, password, role)
    VALUES (
      ${input.name},
      ${input.email},
      ${hashedPassword},
      ${input.role ?? "staff"}
    )
    RETURNING *
  `;
  return user;
}

export async function updateUser(
  id: string,
  input: UpdateUserInput
): Promise<User | null> {
  const [user] = await sql<User[]>`
    UPDATE users
    SET
      name          = COALESCE(${input.name ?? null}, name),
      email         = COALESCE(${input.email ?? null}, email),
      password = COALESCE(${input.password ?? null}, password),
      role          = COALESCE(${input.role ?? null}::user_role, role)
    WHERE id = ${id}
    RETURNING *
  `;
  return user ?? null;
}

export async function deleteUser(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM users
    WHERE id = ${id}
  `;
  return result.count > 0;
}
