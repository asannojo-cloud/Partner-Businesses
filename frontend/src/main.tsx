import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { loadCategories } from "./shared/categories";

// 카테고리(대분류/세부분류)는 관리자가 추가/삭제할 수 있는 DB 기반 목록이다. 여러 화면이
// shared/categories.ts의 CATEGORIES 배열을 정적 import해서 바로 읽으므로, 첫 렌더 전에
// 한 번 최신 값으로 채워둔다 (실패해도 기본값으로 렌더를 진행한다).
loadCategories().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
});
