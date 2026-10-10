import type { AnswerResponse, HintResponse, HistoryResponse, PuzzleResponse, SessionResponse } from '~/types/api'

export class ApiError extends Error {
  status: number
  data: any
  constructor(message: string, status: number, data?: any) {
    super(message)
    this.status = status
    this.data = data
  }
}

async function call<T>(url: string, opts: Parameters<typeof $fetch>[1] = {}): Promise<T> {
  try {
    return await $fetch<T>(url, opts as any)
  } catch (e: any) {
    const status = e?.statusCode ?? e?.response?.status ?? 0
    const message = status ? e?.data?.message || e?.statusMessage || 'Something went wrong.' : 'Could not reach the server. Check your connection.'
    throw new ApiError(message, status, e?.data?.data)
  }
}

/** Thin typed wrapper over the server routes. */
export function useApi() {
  return {
    session: (phone: string) => call<SessionResponse>('/api/session', { method: 'POST', body: { phone_number: phone } }),
    next: (phone: string) => call<PuzzleResponse>('/api/puzzle/next', { query: { phone_number: phone } }),
    hint: (phone: string, playId: number, gap: number) =>
      call<HintResponse>('/api/puzzle/hint', { method: 'POST', body: { phone_number: phone, play_id: playId, gap } }),
    answer: (phone: string, playId: number, action: 'submit' | 'skip' | 'timeout', letters?: string[]) =>
      call<AnswerResponse>('/api/puzzle/answer', { method: 'POST', body: { phone_number: phone, play_id: playId, action, letters } }),
    history: (phone: string, limit = 10) => call<HistoryResponse>('/api/history', { query: { phone_number: phone, limit } })
  }
}
