import config from './package.json';
import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function gitShort(): string {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
}

const CurrentVersion = 'v' + config.version + '-' + gitShort();

const cdnConfig = {
    modules: [{
            name: 'pixi.js',
            var: 'PIXI',
            path: `dist/pixi.min.js`,
            version: config.dependencies['pixi.js']
        }
    ]
};

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    createHtmlPlugin({
      inject: {
        data: {
          GIT_VERSION: CurrentVersion,
          CDN_CONFIG: JSON.stringify(cdnConfig)
        }
      }
    }),
    VitePWA({
      injectRegister: 'auto',
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/phi-chart-render(.*?)\.(png|ogg|ico|ttf)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'assets-cache',
            },
          }
        ],
      },
      minify: true,
      manifest: {
        id: 'misaliu-phi-chart-render',
        name: 'phi-chart-render',
        short_name: 'phi-chart-render',
        description: 'A Phigros chart render based on Pixi.js',
        scope: '/phi-chart-render/',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#000000',
        includeAssets: [ './icons/favicon.ico' ],
        icons: [
          {
            src: './icons/64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: './icons/192.png',
            sizes: '192x192',
            type: 'image/png'
          }
        ]
      }
    }),
  ],
  define: {
    GIT_VERSION: JSON.stringify(CurrentVersion)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 9000,
    open: true
  },
  build: {
    sourcemap: true
  }
});
