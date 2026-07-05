import { defineConfig } from 'tsup';

export default defineConfig({
  // Separate entries so `@farskid/kilid/react` is its own chunk; the core stays
  // react-free and the adapter is only ever loaded when imported.
  entry: {
    index: 'src/index.ts',
    'react/index': 'src/react/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react'],
  treeshake: true,
});
