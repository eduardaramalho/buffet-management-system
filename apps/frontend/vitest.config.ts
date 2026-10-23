import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
      // Sem "include", o Vitest 4 mede apenas arquivos importados pelos testes,
      // o que esconde telas sem teste. Incluir todo src/ alinha o relatório ao que o Sonar indexa.
      include: ['src/**/*.{ts,tsx}'],
      // Mesma política de exclusão do sonar-project.properties (ADR 0007):
      // testes, setup de testes e pontos de composição sem lógica de negócio.
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/test/**',
        'src/main.tsx',
        'src/App.tsx',
      ],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
})
