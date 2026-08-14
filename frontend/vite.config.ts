import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "아산시공무원노동조합 협약기관 안내",
        short_name: "협약기관 안내",
        description: "아산시공무원노동조합 협약기관 검색 및 혜택 안내",
        lang: "ko",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f3f4f6",
        theme_color: "#134e4a",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // 관리자 데이터/파일 응답은 오프라인 캐시 대상에서 제외한다.
        navigateFallbackDenylist: [/^\/api\//, /^\/admin\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5180,
    proxy: {
      "/api": {
        target: "http://localhost:4100",
        changeOrigin: true,
        // 폴더/파일 일괄 업로드는 용량이 크고 오래 걸릴 수 있다. Vite 개발서버 프록시(http-proxy)의
        // 기본 타임아웃에 걸려 "ECONNABORTED"로 끊기는 문제가 있어(2026-08-14 실제 발견) 개발
        // 환경에서는 타임아웃을 비활성화한다. 운영 배포는 Express가 프론트 정적 빌드를 함께
        // 서빙해 이 프록시 자체가 없으므로 영향받지 않는다.
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
});
