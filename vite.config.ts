import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ command }) => ({

    plugins: [vue()],

    root: command === 'serve' ? 'playground' : '.',

    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src')
        }
    },

    build: {
        lib: {
            entry: {
                index: 'src/index.ts',
                features: 'src/features/index.ts'
            },
            name: 'VueTimelineEditor',
            fileName: (format) => `index.${format}.js`
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