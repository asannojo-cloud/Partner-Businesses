import { Request, Response, NextFunction } from "express";

/**
 * 관리자 전용 API 보호. 일반 사용자는 로그인 개념이 없으므로(PRD — 즐겨찾기는 로컬 저장) 이 앱의
 * 인증 가드는 관리자용 한 종류뿐이다.
 */
export function adminGuard(req: Request, res: Response, next: NextFunction) {
  if (req.session.auth?.role !== "admin") {
    return res.status(401).json({ error: "관리자 로그인이 필요합니다." });
  }
  next();
}
