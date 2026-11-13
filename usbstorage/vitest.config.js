import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const common = path.resolve(import.meta.dirname, process.env.VITE_COMMON_ALIAS || '../frieren-front/src');

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@module': path.resolve(import.meta.dirname, 'src'),
            '@src': common,
            '@common': common,
        },
        // Shared source must use the same providers and React instance as the module.
        dedupe: ['react', 'react-dom', '@tanstack/react-query', 'jotai', 'wouter', 'react-bootstrap', 'prop-types', 'react-toastify'],
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./tests-js/setup.js'],
        include: ['tests-js/**/*.test.jsx'],
    },
});
