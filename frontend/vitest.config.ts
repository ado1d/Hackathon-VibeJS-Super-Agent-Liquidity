import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Coverage config — consumed by `npm test -- --coverage` in CI.
    // Output paths match what sonar-project.properties expects.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      // Files that should not count against coverage (entry points,
      // type declarations, test setup). SonarCloud also excludes these
      // via sonar.coverage.exclusions, but having them here keeps the
      // local `npm test -- --coverage` output honest too.
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/types.ts',
        // Non-source files at the project root
        'eslint.config.*',
        'vite.config.*',
        'vitest.config.*',
        'playwright.config.*',
        'tests/**',
        // Generated .d.ts companions of config files
        '**/*.config.d.ts',
        '**/vite-env.d.ts',
      ],
    },
  },
})
