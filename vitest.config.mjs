import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/*.test.js'],
    reporters: ['default', 'junit'],
    outputFile: {
      junit: '__coverage__/test-report.xml',
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: '__coverage__',
      reporter: ['text', 'lcov'],
      include: ['lib/**/*.js'],
      exclude: ['lib/**/*.test.js'],
    },
  },
});
