import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
    input: path.resolve(__dirname, 'app.js'),
    output: {
        file: path.resolve(__dirname, 'dist/app.bundle.js'),
        format: 'esm',
        sourcemap: true,
    },
    // Keep remote CDN imports (Firebase) external so they are not bundled
    external: (id) => /^https?:\/\//.test(id),
    treeshake: false
};
