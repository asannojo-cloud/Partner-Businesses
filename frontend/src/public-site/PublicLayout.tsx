import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "홈", icon: "🤝", match: (p: string) => p === "/" },
  { to: "/search", label: "검색", icon: "🔍", match: (p: string) => p === "/search" || p.startsWith("/category") },
  { to: "/map", label: "지도", icon: "🗺️", match: (p: string) => p === "/map" },
  { to: "/favorites", label: "즐겨찾기", icon: "⭐", match: (p: string) => p === "/favorites" },
];

// 모바일 조합원증 앱에서 넘어온 조합원이 다시 그 앱으로 돌아갈 방법이 없다는 요청으로 추가
// (2026-08-18). 협약기관 안내는 그 앱과 완전히 별개 서비스라 URL 링크로만 연결한다.
const MEMBER_CARD_APP_URL = "https://agongno-membercard.onrender.com/member/help";

export default function PublicLayout() {
  const location = useLocation();
  const showBottomNav = !location.pathname.startsWith("/partners/");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-brand-900 text-white px-4 py-2.5 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <a
            href={MEMBER_CARD_APP_URL}
            aria-label="조합원증 앱으로 돌아가기"
            title="조합원증 앱으로 돌아가기"
            className="flex items-center gap-1 text-xs font-bold bg-white/10 rounded-full px-2.5 py-1.5 shrink-0"
          >
            <span className="text-lg leading-none">🏠</span>
            <span>HOME</span>
          </a>
          <a href="tel:0415402667" className="flex items-center gap-1 text-xs bg-white/10 rounded-full px-3 py-1.5 shrink-0">
            <span>☎</span>
            <span>041-540-2667</span>
          </a>
        </div>
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <img src="/union-logo.png" alt="" className="h-8 w-8 object-contain bg-white rounded-full p-1 shrink-0" />
          <p className="font-bold text-sm whitespace-nowrap">아산시공무원노동조합 협약기관 안내</p>
        </Link>
      </header>

      <main className="flex-1 min-w-0 pb-16">
        <Outlet />
      </main>

      {showBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex max-w-md mx-auto">
          {NAV_ITEMS.map((item) => {
            const active = item.match(location.pathname);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex-1 flex flex-col items-center py-2 text-xs ${active ? "text-brand-900 font-semibold" : "text-slate-400"}`}
              >
                <span className="text-lg leading-none mb-0.5">{item.icon}</span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
}
