import config from './package.json';
import {
    defineConfig
} from 'vite';
import {
    createHtmlPlugin
} from 'vite-plugin-html';
import {
    VitePWA
} from 'vite-plugin-pwa';
import git from 'git-rev-sync';
import path from 'path';
// import cdn from 'vite-plugin-cdn-import'

const CurrentVersion = 'v' + config.version + '-' + git.short();

const cdnConfig = {
    modules: [{
            name: 'pixi.js',
            var: 'PIXI',
            path: `dist/pixi.min.js`,
            version: config.dependencies['pixi.js']
        },
        {
            name: 'jszip',
            var: 'JSZip',
            path: `dist/jszip.min.js`,
            version: config.dependencies['jszip']
        }
    ]
};

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [
        // cdn({
        //     prodUrl:"https://registry.npmmirror.com/{name}/{version}/files/{path}",
        //     modules: [
        //         {
        //             name: 'pixi.js',
        //             var: 'pixi.js',
        //             path: `dist/pixi.min.js`,
        //         },
        //         {
        //             name: 'pixi.js',
        //             var: 'pixi',
        //             path: `dist/pixi.min.js`,
        //         },
        //         {
        //             name: 'jszip',
        //             var: 'jszip',
        //             path: `dist/jszip.min.js`
        //         }
        //     ],
        // }),
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
                cleanupOutdatedCaches: false,
                runtimeCaching: [{
                    urlPattern: /\/phi-chart-render(.*?)\.(png|ogg|ico|ttf|js)/,
                    handler: 'CacheFirst',
                    options: {
                        cacheName: 'assets-cache',
                        expiration: {
                            maxEntries: 100,
                            maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                        }
                    },
                }],
            },
            minify: true,
            manifest: {
                id: 'misaliu-phi-chart-render',
                name: 'phi-chart-render',
                short_name: 'phi-chart-render',
                description: 'A Phigros chart render based on Pixi.js',
                scope: './',
                display: 'standalone',
                orientation: 'landscape',
                background_color: '#000000',
                includeAssets: ['./icons/favicon.ico'],
                icons: [{
                        src: './icons/64.png',
                        sizes: '64x64',
                        type: 'image/png'
                    },
                    {
                        src: './icons/192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: './icons/512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            }
        }),
    ],
    define: {
        GIT_VERSION: JSON.stringify(CurrentVersion),
        CDN_CONFIG: JSON.stringify(cdnConfig)
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    server: {
        host: '0.0.0.0',
        port: 9000,
        // open: true
    },
    build: {
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('pixi')) {
                        return 'pixi'; // 将 pixi 中的代码单独打包成一个  JS 文件
                    }
                    if (id.includes('jszip')) {
                        return 'jszip'; // 将 jszip 中的代码单独打包成一个  JS 文件
                    }
                }
            }
        }
    }
});