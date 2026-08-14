import bcrypt from "bcrypt";
import { pool } from "../../db/pool";
import { env } from "../../config/env";

export interface LockableAdmin {
  id: number;
  password_hash: string;
  failed_login_count: number;
  locked_until: string | null;
}

export function isLocked(account: Pick<LockableAdmin, "locked_until">): boolean {
  if (!account.locked_until) return false;
  return new Date(account.locked_until).getTime() > Date.now();
}

export async function registerFailedAttempt(id: number, currentCount: number) {
  const nextCount = currentCount + 1;
  const shouldLock = nextCount >= env.loginMaxAttempts;
  const lockedUntil = shouldLock ? new Date(Date.now() + env.loginLockMinutes * 60 * 1000) : null;

  await pool.query(
    `UPDATE admin_users SET failed_login_count = $1, locked_until = COALESCE($2, locked_until) WHERE id = $3`,
    [nextCount, lockedUntil, id]
  );
  return { locked: shouldLock, lockedUntil };
}

export async function resetFailedAttempts(id: number) {
  await pool.query(`UPDATE admin_users SET failed_login_count = 0, locked_until = NULL WHERE id = $1`, [id]);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
