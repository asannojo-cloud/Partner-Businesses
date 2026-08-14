import { Router } from "express";
import { CATEGORIES } from "../../shared/categories";

export const publicCategoriesRouter = Router();

publicCategoriesRouter.get("/", (req, res) => {
  res.json({ categories: CATEGORIES });
});
