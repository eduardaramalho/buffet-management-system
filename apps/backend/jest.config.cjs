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
  // Mesma política de exclusão do sonar-project.properties (ADR 0007): fica de fora apenas
  // código gerado (Prisma) e o ponto de entrada que sobe o servidor HTTP. Rotas e factories
  // são cobertas pelos testes de permissão de cada módulo.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/generated/**',
    '!src/server.ts',
    '!src/seed.ts',
  ],
  // lcov alimenta o Sonar; json-summary alimenta o resumo de cobertura do GitHub Actions.
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      lines: 85,
      branches: 85,
      functions: 85,
      statements: 85,
    },
  },
};
