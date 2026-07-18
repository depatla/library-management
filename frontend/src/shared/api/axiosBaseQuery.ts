import type { BaseQueryFn } from '@reduxjs/toolkit/query'
import type { AxiosError, AxiosRequestConfig } from 'axios'
import { apiClient } from './apiClient'

type AxiosBaseQueryArgs = {
  baseUrl: string
}

export function axiosBaseQuery(
  { baseUrl }: AxiosBaseQueryArgs = { baseUrl: '' },
): BaseQueryFn<
  { url: string; method: AxiosRequestConfig['method']; data?: unknown; params?: unknown },
  unknown,
  { status?: number; data: unknown }
> {
  return async ({ url, method, data, params }) => {
    try {
      const isFormData = typeof FormData !== 'undefined' && data instanceof FormData
      const result = await apiClient({
        url: baseUrl + url,
        method,
        data,
        params,
        // let the browser set the multipart boundary itself instead of the
        // instance-level 'application/json' default clobbering FormData bodies
        headers: isFormData ? { 'Content-Type': undefined } : undefined,
      })
      return { data: result.data }
    } catch (axiosError) {
      const err = axiosError as AxiosError
      return {
        error: {
          status: err.response?.status,
          data: err.response?.data ?? err.message,
        },
      }
    }
  }
}
