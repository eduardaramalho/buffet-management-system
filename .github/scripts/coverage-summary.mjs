#!/usr/bin/env node
/**
 * Publica a cobertura de uma aplicação no resumo do job do GitHub Actions.
 * Uso: node .github/scripts/coverage-summary.mjs <nome> <coverage-summary.json> <mínimo exigido (%)>
 *
 * Serve de evidência separada por aplicação (backend 75% / frontend 25% exigidos pela régua),
 * já que o Quality Gate do Sonar avalia o monorepo como um todo. Quem falha o build são os
 * thresholds do Jest e do Vitest; este script apenas reporta.
 */
import { appendFileSync, readFileSync } from 'node:fs'

const [name, summaryPath, requiredArg] = process.argv.slice(2)
if (!name || !summaryPath || !requiredArg) {
  console.error('Uso: coverage-summary.mjs <nome> <coverage-summary.json> <mínimo (%)>')
  process.exit(1)
}

const required = Number(requiredArg)
const { total } = JSON.parse(readFileSync(summaryPath, 'utf8'))
const metrics = [
  ['Linhas', total.lines],
  ['Branches', total.branches],
  ['Funções', total.functions],
  ['Statements', total.statements],
]

const rows = metrics.map(([label, metric]) => {
  const status = metric.pct >= required ? '✅' : '❌'
  return `| ${label} | ${metric.pct.toFixed(2)}% | ${metric.covered}/${metric.total} | ${status} |`
})

const markdown = [
  `### Cobertura de testes: ${name}`,
  '',
  `Mínimo configurado no CI: **${required}%**`,
  '',
  '| Métrica | Cobertura | Cobertos/Total | Status |',
  '|---|---|---|---|',
  ...rows,
  '',
].join('\n')

console.log(markdown)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`)
