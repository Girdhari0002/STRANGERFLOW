import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        proxy: {
            '/api': 'http://localhost:5051',
            '/socket.io': {
                target: 'http://localhost:5051',
                ws: true
            }
        }
    }
})
