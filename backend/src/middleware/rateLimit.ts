import rateLimit from "express-rate-limit";

// 로그인 엔드포인트에 대한 IP 단위 요청 제한 (계정 잠금과는 별개의 보호막)
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요." },
});

// 공개 API에 대한 완만한 제한. 로그인된 관리자는 대량 업로드 등 정상적인 작업이 있으므로 제외한다.
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.session?.auth?.role === "admin",
});
