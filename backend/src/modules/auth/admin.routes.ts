import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { adminGuard } from "../../middleware/guards";
import { isLocked, registerFailedAttempt, resetFailedAttempts, verifyPassword, hashPassword } from "./auth.service";

export const adminAuthRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
});

adminAuthRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
  }
  const { username, password } = parsed.data;

  const { rows } = await pool.query(
    `SELECT id, username, display_name, password_hash, failed_login_count, locked_until
     FROM admin_users WHERE username = $1`,
    [username]
  );
  const admin = rows[0];
  const genericError = { error: "아이디 또는 비밀번호가 올바르지 않습니다." };

  if (!admin) return res.status(401).json(genericError);

  if (isLocked(admin)) {
    return res.status(423).json({ error: "로그인 시도 초과로 잠시 잠겼습니다. 잠시 후 다시 시도해주세요." });
  }

  const ok = await verifyPassword(password, admin.password_hash);
  if (!ok) {
    await registerFailedAttempt(admin.id, admin.failed_login_count);
    return res.status(401).json(genericError);
  }

  await resetFailedAttempts(admin.id);

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "로그인 처리 중 오류가 발생했습니다." });
    req.session.auth = { role: "admin", id: admin.id };
    res.json({ ok: true, username: admin.username, displayName: admin.display_name });
  });
});

adminAuthRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("asanpartners.sid");
    res.json({ ok: true });
  });
});

adminAuthRouter.get("/me", adminGuard, async (req, res) => {
  const { rows } = await pool.query(`SELECT username, display_name FROM admin_users WHERE id = $1`, [
    req.session.auth!.id,
  ]);
  const admin = rows[0];
  if (!admin) return res.status(401).json({ error: "세션이 만료되었습니다." });
  res.json({ username: admin.username, displayName: admin.display_name });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요."),
  newPassword: z.string().min(8, "새 비밀번호는 8자 이상이어야 합니다."),
});

adminAuthRouter.patch("/password", adminGuard, async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." });
  }
  const { currentPassword, newPassword } = parsed.data;

  const { rows } = await pool.query(`SELECT id, password_hash FROM admin_users WHERE id = $1`, [
    req.session.auth!.id,
  ]);
  const admin = rows[0];
  if (!admin) return res.status(401).json({ error: "세션이 만료되었습니다." });

  const ok = await verifyPassword(currentPassword, admin.password_hash);
  if (!ok) return res.status(400).json({ error: "현재 비밀번호가 올바르지 않습니다." });

  const newHash = await hashPassword(newPassword);
  await pool.query(`UPDATE admin_users SET password_hash = $1 WHERE id = $2`, [newHash, admin.id]);
  res.json({ ok: true });
});
