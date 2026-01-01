import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/plugin.js',
      format: 'iife',
      name: 'capacitorWebRTCReceiver',
      globals: {
        '@capacitor/core': 'capacitorExports',
      },
      sourcemap: true,
      inlineDynamicImports: true,
    },
    {
      file: 'dist/esm/index.js',
      format: 'es',
      sourcemap: true,
    },
  ],
  external: ['@capacitor/core'],
  plugins: [nodeResolve(), typescript()],
};

