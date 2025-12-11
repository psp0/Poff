import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // 빌드 설정
  build: {
    outDir: 'dist',
    // 파일 해시 포함 (캐시 무효화)
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
    // 프로덕션에서는 소스맵 비활성화 (보안)
    sourcemap: false,
    // minify 설정 (기본: esbuild)
    minify: 'esbuild',
  },

  // 정적 파일 폴더 (pokehabit-assets 제외 - API에서 제공)
  publicDir: 'public',
});
