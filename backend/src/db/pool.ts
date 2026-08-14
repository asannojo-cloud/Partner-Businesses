import { Pool, types } from "pg";
import { env } from "../config/env";

// PostgreSQL DATE 타입(OID 1082)을 JS Date 객체로 자동 변환하면 서버 타임존에 따라
// 날짜가 하루 밀리는 문제가 생긴다. "YYYY-MM-DD" 문자열 그대로 사용한다.
types.setTypeParser(1082, (val: string) => val);

export const pool = new Pool({
  connectionString: env.databaseUrl,
  // Render 등 대부분의 매니지드 PostgreSQL은 SSL 연결을 요구한다.
  ssl: env.isProduction ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[db] 예기치 않은 유휴 클라이언트 오류", err);
});
