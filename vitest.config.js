import { defineConfig } from 'vitest/config';
import { BaseSequencer } from 'vitest/node';

class AlphabeticalSequencer extends BaseSequencer {
  async sort(files) {
    return files.sort((a, b) => (a.moduleId ?? '').localeCompare(b.moduleId ?? ''));
  }
}

export default defineConfig({
  test: {
    fileParallelism: false,
    sequence: {
      sequencer: AlphabeticalSequencer,
    },
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,

    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'dist', 'reports'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules',
        'tests',
        'vitest.config.js',
        'config',
        'fixtures',
      ],
    },

    reporters: ['default', 'json'],

    outputFile: {
      json: './reports/test-results.json',
    },

    setupFiles: ['./tests/setup.js'],

    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },

    retry: 0,
    bail: 0,

    silent: false,
    verbose: true,

    logHeapUsage: false,
    allowOnly: !process.env.CI,
    passWithNoTests: false,
  },
});
