// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', 'validation/output/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Guardrail: detect/ and tier/ are deterministic and must never import the LLM layers.
    files: ['src/detect/**/*.ts', 'src/tier/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/parse/**', '**/reason/**'], message: 'detect/ and tier/ must be deterministic and may not import LLM-calling modules (parse/ or reason/).' },
          ],
        },
      ],
    },
  }
);
