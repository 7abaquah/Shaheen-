// FROZEN: owned by the lead (graph.md → N1).
// Besides ordinary correctness rules, this file enforces the architecture boundaries that the
// security model depends on. A violation here is a gate failure, not a style nit.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const DANGEROUS_SYNTAX = [
  { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Raw HTML injection is forbidden. Render text as React children.' },
  { selector: "JSXOpeningElement[name.name='style']", message: 'Inline <style> elements are blocked by the Content-Security-Policy. Put CSS in src/styles.css.' },
  { selector: "JSXOpeningElement[name.name='script']", message: 'Inline scripts are forbidden.' },
  { selector: "MemberExpression[property.name=/^(innerHTML|outerHTML|insertAdjacentHTML)$/]", message: 'HTML string sinks are forbidden.' },
  { selector: "CallExpression[callee.object.name='document'][callee.property.name=/^(write|writeln)$/]", message: 'document.write is forbidden.' },
];

const NO_WEAK_RANDOM = {
  selector: "MemberExpression[object.name='Math'][property.name='random']",
  message: 'Math.random is not a CSPRNG. Use crypto.getRandomValues (kernel: randomBytes).',
};

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'sources/**', 'graph/**', 'e2e/artifacts/**', 'shared/catalog.json', 'server/src/generated/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'off',
      '@typescript-eslint/no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-proto': 'error',
      eqeqeq: ['error', 'always'],
      'no-restricted-syntax': ['error', ...DANGEROUS_SYNTAX],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // ── kernel: runs in the browser and in Node; no framework, no Node built-ins, no weak randomness
  {
    files: ['kernel/src/**/*.ts'],
    languageOptions: { globals: { ...globals['shared-node-browser'] } },
    rules: {
      'no-console': 'error',
      'no-restricted-syntax': ['error', ...DANGEROUS_SYNTAX, NO_WEAK_RANDOM],
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['node:*', 'fs', 'path', 'crypto', 'http', 'https', 'net', 'child_process'], message: 'The kernel must run unchanged in the browser: use WebCrypto, no Node built-ins.' },
          { group: ['react', 'react-dom', 'react/*', 'react-dom/*'], message: 'The kernel is framework-free.' },
          { group: ['**/src/**', '**/server/**', '@/*', '@kernel', '@shared/*'], message: 'The kernel depends on nothing above it. Use relative imports inside kernel/ and ../shared/.' },
          { group: ['@anthropic-ai/*'], message: 'Model credentials and SDKs belong to the gateway only.' },
        ],
      }],
    },
  },

  // ── gateway: Node only
  {
    files: ['server/src/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-console': 'error',
      'no-restricted-syntax': ['error', ...DANGEROUS_SYNTAX, NO_WEAK_RANDOM],
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['react', 'react-dom', 'react/*', 'react-dom/*', '**/src/**', '@/*', '@kernel', '@shared/*'], message: 'The gateway imports only node:*, ../kernel/src/index.ts, ../shared/* and its own files (relative paths, .ts extension).' },
        ],
      }],
    },
  },
  {
    files: ['server/src/main.ts'],
    rules: { 'no-console': 'off' },
  },

  // ── front-end
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@anthropic-ai/*'], message: 'The browser never talks to the model API. Use useModule().ai.' },
          { group: ['**/server/**', 'node:*'], message: 'Server code is not available in the browser.' },
          { group: ['**/kernel/src/**', '**/kernel/contract*'], message: "Import the kernel through its public entry: '@kernel'." },
        ],
      }],
    },
  },

  // The front-end contract is the one place that names the kernel contract directly.
  {
    files: ['src/contract.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // ── feature modules: least privilege
  {
    files: ['src/modules/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error',
        { name: 'localStorage', message: 'Persist through useModule().kernel.vault.' },
        { name: 'sessionStorage', message: 'Persist through useModule().kernel.vault.' },
        { name: 'indexedDB', message: 'Persist through useModule().kernel.vault.' },
        { name: 'fetch', message: 'Network access goes through useModule().ai.' },
        { name: 'XMLHttpRequest', message: 'Network access goes through useModule().ai.' },
        { name: 'WebSocket', message: 'Network access goes through useModule().ai.' },
        { name: 'EventSource', message: 'Network access goes through useModule().ai.' },
      ],
      'no-restricted-properties': ['error',
        { object: 'window', property: 'localStorage' }, { object: 'window', property: 'sessionStorage' },
        { object: 'window', property: 'fetch' }, { object: 'globalThis', property: 'fetch' },
        { object: 'globalThis', property: 'localStorage' },
      ],
      'no-restricted-syntax': ['error', ...DANGEROUS_SYNTAX, {
        selector: "MemberExpression[object.name='Math'][property.name='random']",
        message: 'No randomness in feature modules: simulated figures come from useMarketSim() and are labelled as simulated.',
      }],
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@anthropic-ai/*'], message: 'The browser never talks to the model API. Use useModule().ai.' },
          { group: ['**/server/**', 'node:*'], message: 'Server code is not available in the browser.' },
          { group: ['**/kernel/src/**', '**/kernel/contract*'], message: "Import the kernel through its public entry: '@kernel'." },
          { group: ['../*', '../../*', '@/modules/*'], message: 'Modules are isolated from each other. Import shared code from @/ui, @/shell/api, @shared/* or @kernel.' },
          { group: ['@/shell/*', '!@/shell/api'], message: "The only shell entry modules may import is '@/shell/api'." },
        ],
      }],
    },
  },

  // ── tests and tooling
  {
    files: ['**/tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', 'src/shell/testing.tsx'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'e2e/**/*.mjs', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
);
