import { Router } from "express";
import { adminGuard } from "../../middleware/guards";
import { listCategoriesForAdmin, addCategory, deleteCategory, addSubCategory, deleteSubCategory } from "./categories.service";

export const adminCategoriesRouter = Router();
adminCategoriesRouter.use(adminGuard);

adminCategoriesRouter.get("/", async (req, res) => {
  res.json({ categories: await listCategoriesForAdmin() });
});

adminCategoriesRouter.post("/", async (req, res) => {
  const label = typeof req.body?.label === "string" ? req.body.label : "";
  await addCategory(label);
  res.status(201).json({ categories: await listCategoriesForAdmin() });
});

adminCategoriesRouter.delete("/:id", async (req, res) => {
  await deleteCategory(Number(req.params.id));
  res.json({ categories: await listCategoriesForAdmin() });
});

adminCategoriesRouter.post("/:id/subcategories", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name : "";
  await addSubCategory(Number(req.params.id), name);
  res.status(201).json({ categories: await listCategoriesForAdmin() });
});

adminCategoriesRouter.delete("/subcategories/:subId", async (req, res) => {
  await deleteSubCategory(Number(req.params.subId));
  res.json({ categories: await listCategoriesForAdmin() });
});
