// Flat config. Deliberately small: the rules that catch real defects, and nothing that
// only enforces taste — Prettier owns formatting, so anything stylistic here would just
// be a second opinion to argue with.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Spelled out rather than pulled from the `globals` package: this is the whole list the
// repository actually uses, and it is shorter than the dependency would be.
const NODE_GLOBALS = {
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  AbortController: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/out/**',
      '**/dist/**',
      '**/data/**',
      '.static-build-stash/**',
      '.temporary/**',
      // A throwaway harness from an earlier session, kept only for reference. Its work
      // was ported into the app; it is not built, tested or shipped.
      'preview/**',
      'packages/database/src/migrations/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: { globals: NODE_GLOBALS },
    rules: {
      // An unused parameter is often a signature being kept deliberately, so the
      // underscore convention opts out rather than forcing a lie about the shape.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Raw SQL and driver rows genuinely arrive as `any`. Warning on every one of them
      // trains people to ignore warnings, which is worse than the `any`.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Reading localStorage or a DOM class on mount cannot happen during render — the
      // server has neither — so these components legitimately set state in an effect.
      // Left off rather than suppressed line by line; useSyncExternalStore would be the
      // idiomatic fix and is worth doing, but not as a condition of shipping.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
);
