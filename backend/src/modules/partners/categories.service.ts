import { pool } from "../../db/pool";
import { AppError } from "../../middleware/errorHandler";
import { loadCategoriesFromDb } from "../../shared/categories";

export interface AdminCategoryRow {
  id: number;
  code: string;
  label: string;
  subCategories: { id: number; name: string }[];
}

export async function listCategoriesForAdmin(): Promise<AdminCategoryRow[]> {
  const { rows: cats } = await pool.query(`SELECT id, code, label FROM categories ORDER BY sort_order, id`);
  const { rows: subs } = await pool.query(`SELECT id, category_id, name FROM subcategories ORDER BY sort_order, id`);
  return cats.map((c) => ({
    id: c.id,
    code: c.code,
    label: c.label,
    subCategories: subs.filter((s) => s.category_id === c.id).map((s) => ({ id: s.id, name: s.name })),
  }));
}

export async function addCategory(label: string): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) throw new AppError(400, "대분류 이름을 입력해주세요.");

  const { rows: maxRows } = await pool.query(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories`);
  const { rows } = await pool.query(
    `INSERT INTO categories (code, label, sort_order) VALUES ('', $1, $2) RETURNING id`,
    [trimmed, maxRows[0].next]
  );
  const id = rows[0].id;
  await pool.query(`UPDATE categories SET code = $1 WHERE id = $2`, [`custom_${id}`, id]);
  await loadCategoriesFromDb();
}

export async function deleteCategory(id: number): Promise<void> {
  const { rows } = await pool.query(`SELECT code, label FROM categories WHERE id = $1`, [id]);
  const category = rows[0];
  if (!category) throw new AppError(404, "대분류를 찾을 수 없습니다.");

  const { rows: countRows } = await pool.query(`SELECT count(*)::int AS count FROM partners WHERE category = $1`, [category.code]);
  if (countRows[0].count > 0) {
    throw new AppError(400, `"${category.label}" 분류를 사용 중인 협약기관이 ${countRows[0].count}곳 있어 삭제할 수 없습니다. 먼저 해당 기관들의 분류를 변경해주세요.`);
  }

  await pool.query(`DELETE FROM categories WHERE id = $1`, [id]);
  await loadCategoriesFromDb();
}

export async function addSubCategory(categoryId: number, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(400, "세부분류 이름을 입력해주세요.");

  const { rows: catRows } = await pool.query(`SELECT id FROM categories WHERE id = $1`, [categoryId]);
  if (!catRows[0]) throw new AppError(404, "대분류를 찾을 수 없습니다.");

  const { rows: maxRows } = await pool.query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM subcategories WHERE category_id = $1`,
    [categoryId]
  );
  try {
    await pool.query(
      `INSERT INTO subcategories (category_id, name, sort_order) VALUES ($1,$2,$3)`,
      [categoryId, trimmed, maxRows[0].next]
    );
  } catch (err: any) {
    if (err?.code === "23505") throw new AppError(400, "이미 존재하는 세부분류입니다.");
    throw err;
  }
  await loadCategoriesFromDb();
}

export async function deleteSubCategory(id: number): Promise<void> {
  const { rows } = await pool.query(
    `SELECT s.name, c.code AS category_code, c.label AS category_label
     FROM subcategories s JOIN categories c ON c.id = s.category_id
     WHERE s.id = $1`,
    [id]
  );
  const sub = rows[0];
  if (!sub) throw new AppError(404, "세부분류를 찾을 수 없습니다.");

  const { rows: countRows } = await pool.query(
    `SELECT count(*)::int AS count FROM partners WHERE category = $1 AND sub_category = $2`,
    [sub.category_code, sub.name]
  );
  if (countRows[0].count > 0) {
    throw new AppError(400, `"${sub.category_label} / ${sub.name}" 분류를 사용 중인 협약기관이 ${countRows[0].count}곳 있어 삭제할 수 없습니다. 먼저 해당 기관들의 분류를 변경해주세요.`);
  }

  await pool.query(`DELETE FROM subcategories WHERE id = $1`, [id]);
  await loadCategoriesFromDb();
}
