import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import path from 'path'
import { fileURLToPath } from 'url'

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ command }) => ({

    plugins: [vue(), cssInjectedByJsPlugin()],

    root: command === 'serve' ? 'playground' : '.',

    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            'vue-timeline-editor': path.resolve(__dirname, 'dist/index.es.js')
        }
    },

    build: {
        lib: {
            entry: {
                index: 'src/index.ts',
                features: 'src/features/index.ts'
            },
            name: 'VueTimelineEditor',
            fileName: (format, entryName) => `${entryName}.${format}.js`
        },

        rollupOptions: {
            external: ['vue'],
            output: {
                globals: {
                    vue: 'Vue'
                }
            }
        }
    }
}))