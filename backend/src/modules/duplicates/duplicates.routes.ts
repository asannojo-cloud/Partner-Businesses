import { Router } from "express";
import { adminGuard } from "../../middleware/guards";
import { findDuplicate } from "./duplicates.service";

export const adminDuplicatesRouter = Router();
adminDuplicatesRouter.use(adminGuard);

adminDuplicatesRouter.post("/check", async (req, res) => {
  const { name, address } = req.body ?? {};
  if (typeof name !== "string") return res.status(400).json({ error: "name이 필요합니다." });
  const match = await findDuplicate(name, typeof address === "string" ? address : "");
  res.json({ match });
});
