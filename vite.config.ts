import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import path from 'path'
import { fileURLToPath } from 'url'

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ command }) => ({

    plugins: [
        vue(),
        cssInjectedByJsPlugin({
            jsAssetsFilterFunction: (outputChunk) => {
                return outputChunk.fileName === 'index.js' || outputChunk.fileName === 'index.cjs'
                    || outputChunk.fileName === 'timeline.js' || outputChunk.fileName === 'timeline.cjs'
            }
        })
    ],

    root: command === 'serve' ? 'playground' : '.',

    resolve: {
        alias: [
            {
                find: 'vue-timeline-editor/features/dnd',
                replacement: path.resolve(__dirname, 'dist/features/dnd.js')
            },
            {
                find: 'vue-timeline-editor/features/snapping',
                replacement: path.resolve(__dirname, 'dist/features/snapping.js')
            },
            {
                find: 'vue-timeline-editor/features/sections',
                replacement: path.resolve(__dirname, 'dist/features/sections.js')
            },
            {
                find: 'vue-timeline-editor/timeline',
                replacement: path.resolve(__dirname, 'dist/timeline.js')
            },
            {
                find: 'vue-timeline-editor',
                replacement: path.resolve(__dirname, 'dist/index.js')
            },
            {
                find: '@',
                replacement: path.resolve(__dirname, 'src')
            }
        ]
    },

    build: {
        lib: {
            entry: {
                index: 'src/index.ts',
                timeline: 'src/timeline.ts',
                'features/dnd': 'src/features/dnd.ts',
                'features/snapping': 'src/features/snapping.ts',
                'features/sections': 'src/features/sections.ts',
            },
            name: 'VueTimelineEditor',
        },

        rollupOptions: {
            external: ['vue'],
            output: [
                {
                    format: 'es',
                    globals: {
                        vue: 'Vue'
                    },
                    entryFileNames: '[name].js',
                    chunkFileNames: 'chunks/[name]-[hash].js'
                },
                {
                    format: 'cjs',
                    globals: {
                        vue: 'Vue'
                    },
                    exports: 'named',
                    entryFileNames: '[name].cjs',
                    chunkFileNames: 'chunks/[name]-[hash].cjs'
                }
            ]
        }
    }
}))