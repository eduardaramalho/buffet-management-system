import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadReport, getEventsReport, getTasksReport, getTeamPerformanceReport } from './reportsApi'
import { httpClient } from './httpClient'
import { getApiErrorMessage } from './apiError'
import { saveBlob } from '../utils/download'

vi.mock('./httpClient', () => ({ httpClient: { get: vi.fn() } }))
vi.mock('../utils/download', async (importOriginal) => ({ ...(await importOriginal<typeof import('../utils/download')>()), saveBlob: vi.fn() }))

const period = { from: '2026-10-01T03:00:00.000Z', to: '2026-11-01T02:59:59.999Z' }

describe('reportsApi', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('requests the JSON reports with period, filters and pagination, omitting empty filters', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ data: { items: [] } })

    await getEventsReport(period, { status: 'CONFIRMADO', serviceType: undefined }, { page: 2, pageSize: 20 })
    await getTasksReport(period, { origin: 'MANUAL' }, { page: 1, pageSize: 20 })
    const teams = await getTeamPerformanceReport(period)

    expect(httpClient.get).toHaveBeenNthCalledWith(1, '/api/v1/reports/events', { params: { ...period, status: 'CONFIRMADO', page: 2, pageSize: 20 } })
    expect(httpClient.get).toHaveBeenNthCalledWith(2, '/api/v1/reports/tasks', { params: { ...period, origin: 'MANUAL', page: 1, pageSize: 20 } })
    expect(httpClient.get).toHaveBeenNthCalledWith(3, '/api/v1/reports/teams-performance', { params: period })
    expect(teams).toEqual({ items: [] })
  })

  it('downloads an export as a blob and saves it with the server file name', async () => {
    const blob = new Blob(['a;b'])
    vi.mocked(httpClient.get).mockResolvedValue({ data: blob, headers: { 'content-disposition': 'attachment; filename="relatorio-tarefas_2026-10-01_2026-10-31.pdf"' } })

    await downloadReport('tasks', period, { teamId: 'team-1' }, 'pdf')

    expect(httpClient.get).toHaveBeenCalledWith('/api/v1/reports/tasks/export', { params: { ...period, teamId: 'team-1', format: 'pdf' }, responseType: 'blob' })
    expect(saveBlob).toHaveBeenCalledWith(blob, 'relatorio-tarefas_2026-10-01_2026-10-31.pdf')
  })

  it('falls back to a generated file name when the header is not exposed', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ data: new Blob(['x']), headers: {} })

    await downloadReport('teams-performance', period, {}, 'csv')

    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'relatorio-teams-performance.csv')
  })

  it('turns a JSON error delivered as a blob back into a readable API error', async () => {
    const response = { status: 422, statusText: 'Unprocessable', headers: {}, config: { headers: new AxiosHeaders() }, data: new Blob([JSON.stringify({ message: 'O período deve ter no máximo 366 dias' })], { type: 'application/json' }) }
    vi.mocked(httpClient.get).mockRejectedValue(new AxiosError('fail', 'ERR_BAD_REQUEST', undefined, undefined, response))

    const failure = await downloadReport('events', period, {}, 'csv').catch((cause: unknown) => cause)

    expect(getApiErrorMessage(failure, 'fallback')).toBe('O período deve ter no máximo 366 dias')
    expect(saveBlob).not.toHaveBeenCalled()
  })

  it('keeps the original error when the blob body is not JSON', async () => {
    const response = { status: 502, statusText: 'Bad Gateway', headers: {}, config: { headers: new AxiosHeaders() }, data: new Blob(['<html>502</html>'], { type: 'text/html' }) }
    vi.mocked(httpClient.get).mockRejectedValue(new AxiosError('fail', 'ERR_BAD_RESPONSE', undefined, undefined, response))

    const failure = await downloadReport('events', period, {}, 'pdf').catch((cause: unknown) => cause)

    expect(getApiErrorMessage(failure, 'Não foi possível exportar')).toBe('Não foi possível exportar')
  })

  it('rethrows other failures untouched', async () => {
    const failure = new Error('network down')
    vi.mocked(httpClient.get).mockRejectedValue(failure)

    await expect(downloadReport('events', period, {}, 'csv')).rejects.toBe(failure)
  })
})
