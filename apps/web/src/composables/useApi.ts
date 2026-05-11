import { ref } from 'vue';
import { apiClient } from '@/services/api';
import type { ApiResponse } from '@galeno/shared-types';

/**
 * Composable for easy API access with loading and error state tracking.
 * Uses the centralized apiClient for all requests.
 */
export function useApi() {
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const request = async <T>(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: string,
    body?: any
  ): Promise<ApiResponse<T>> => {
    isLoading.value = true;
    error.value = null;

    try {
      let response: ApiResponse<T>;
      
      switch (method) {
        case 'get':
          response = await apiClient.get<T>(url);
          break;
        case 'post':
          response = await apiClient.post<T>(url, body);
          break;
        case 'put':
          response = await apiClient.put<T>(url, body);
          break;
        case 'patch':
          response = await apiClient.patch<T>(url, body);
          break;
        case 'delete':
          response = await apiClient.delete<T>(url);
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      if (!response.success) {
        error.value = response.error || 'Unknown error';
      }

      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      error.value = msg;
      return { success: false, error: msg };
    } finally {
      isLoading.value = false;
    }
  };

  const get = <T>(url: string) => request<T>('get', url);
  const post = <T>(url: string, body: any) => request<T>('post', url, body);
  const put = <T>(url: string, body: any) => request<T>('put', url, body);
  const patch = <T>(url: string, body: any) => request<T>('patch', url, body);
  const del = <T>(url: string) => request<T>('delete', url);

  return {
    isLoading,
    error,
    get,
    post,
    put,
    patch,
    delete: del,
    api: apiClient // Export raw client if needed
  };
}
