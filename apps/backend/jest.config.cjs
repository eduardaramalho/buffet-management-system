/**
 * Testes de backend: usamos fakes e mocks manuais em vez de MySQL real.
 * O banco de teste dedicado, se houver no futuro, deve ser explícito e não compartilhado com o desenvolvimento local.
 */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/generated/**', '!src/server.ts'],
  coverageThreshold: {
    global: {
      lines: 85,
      branches: 85,
    },
  },
};
