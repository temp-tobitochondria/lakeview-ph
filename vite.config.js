import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        react(),
        laravel({
            // app.css is imported inside app.jsx, so no need to list it as a separate entry
            input: ['resources/js/app.jsx'],
            refresh: true,
        }),
        tailwindcss(),
    ],
});
