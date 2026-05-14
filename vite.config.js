import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: './GeneratorMain.js',
            name: 'ParticleWrap',
            formats: ['es', 'umd'],
            fileName: (format) => `particle-wrap.${format === 'es' ? 'esm' : 'umd'}.js`,
        },
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true,
    },
});