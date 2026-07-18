// Plain module-level holder for the in-memory access token. Kept separate
// from the Redux store so apiClient's interceptors can read/write it without
// creating a circular import (store -> baseApi -> axiosBaseQuery -> apiClient -> store).
let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}
