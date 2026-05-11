// apps/web/src/composables/useRatings.ts
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'vue-toastification';
import { apiClient } from '@/services/api';

export interface CreateRatingDTO {
  doctorId: string;
  rating: number;
  comentario?: string;
  consultaId?: string;
  anonimizado?: boolean;
}

export interface Rating {
  id: string;
  doctorId: string;
  pacienteId: string;
  rating: number;
  comentario?: string;
  anonimizado: boolean;
  aprobado: boolean;
  reportado: boolean;
  util: number;
  noUtil: number;
  respuesta?: string;
  respuestaFecha?: string;
  createdAt: string;
  updatedAt: string;
  paciente?: {
    nombre: string;
    foto?: string;
  };
}

export interface RatingStats {
  total: number;
  average: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface RatingsResponse {
  ratings: Rating[];
  total: number;
  limit: number;
  offset: number;
}

export function useRatings(doctorId: string) {
  const toast = useToast();

  // Estado
  const data = ref<RatingsResponse | null>(null);
  const stats = ref<RatingStats | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const submitting = ref(false);

  // Getters
  const ratings = computed(() => data.value?.ratings || []);
  const total = computed(() => data.value?.total || 0);
  const hasMore = computed(() => {
    if (!data.value) return false;
    return data.value.offset + data.value.limit < data.value.total;
  });

  // Fetch ratings
  async function fetchRatings(params?: PaginationParams) {
    try {
      loading.value = true;
      error.value = null;

      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());

      const response = await apiClient.get<RatingsResponse>(
        `/api/v1/doctor/public/${doctorId}/ratings?${queryParams.toString()}`
      );

      if (response.success && response.data) {
        if (params?.offset && params.offset > 0) {
          // Append to existing data
          data.value = {
            ...response.data.data,
            ratings: [...(data.value?.ratings || []), ...response.data.data.ratings]
          };
        } else {
          data.value = response.data.data;
        }
      }

      return response.data?.data || null;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Error al cargar valoraciones';
      toast.error(error.value);
      return null;
    } finally {
      loading.value = false;
    }
  }

  // Fetch stats
  async function fetchStats() {
    try {
      const response = await apiClient.get<{ data: RatingStats }>(
        `/api/v1/doctor/public/${doctorId}/ratings/stats`
      );

      if (response.success && response.data) {
        stats.value = response.data.data;
      }

      return response.data?.data || null;
    } catch (err) {
      console.error('Error fetching stats:', err);
      return null;
    }
  }

  // Submit rating
  async function submitRating(ratingData: CreateRatingDTO) {
    try {
      submitting.value = true;
      error.value = null;

      if (ratingData.rating < 1 || ratingData.rating > 5) {
        throw new Error('La valoración debe estar entre 1 y 5');
      }

      const response = await apiClient.post<{ data: Rating }>(
        `/api/v1/doctor/public/${ratingData.doctorId}/ratings`,
        ratingData
      );

      if (response.success && response.data) {
        toast.success('¡Gracias por tu valoración!');
        
        // Refresh ratings and stats
        await fetchRatings();
        await fetchStats();

        return response.data.data;
      }

      throw new Error(response.error || 'Error al enviar valoración');
    } catch (err: any) {
      error.value = err.message || 'Error al enviar valoración';
      toast.error(error.value);
      throw err;
    } finally {
      submitting.value = false;
    }
  }

  // Mark rating as useful
  async function markUseful(ratingId: string, useful: boolean = true) {
    try {
      const response = await apiClient.post<{ data: Rating }>(
        `/api/v1/doctor/ratings/${ratingId}/useful`,
        { useful }
      );

      if (response.success && response.data) {
        // Update local data
        const rating = ratings.value.find(r => r.id === ratingId);
        if (rating) {
          if (useful) {
            rating.util++;
          } else {
            rating.noUtil++;
          }
        }

        toast.success('Gracias por tu feedback');
        return response.data.data;
      }

      throw new Error(response.error || 'Error al marcar valoración');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al marcar valoración');
      return null;
    }
  }

  // Report rating
  async function reportRating(ratingId: string, reason?: string) {
    try {
      const response = await apiClient.post<{ data: Rating }>(
        `/api/v1/doctor/ratings/${ratingId}/report`,
        { reason }
      );

      if (response.success && response.data) {
        toast.success('Valoración reportada. Nuestro equipo la revisará.');
        
        // Update local data
        const rating = ratings.value.find(r => r.id === ratingId);
        if (rating) {
          rating.reportado = true;
        }

        return response.data.data;
      }

      throw new Error(response.error || 'Error al reportar valoración');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al reportar valoración');
      return null;
    }
  }

  // Load more ratings
  async function loadMore() {
    if (!data.value || !hasMore.value) return;
    
    const newOffset = data.value.offset + data.value.limit;
    return fetchRatings({ offset: newOffset, limit: data.value.limit });
  }

  // Refresh all data
  async function refresh() {
    await Promise.all([
      fetchRatings(),
      fetchStats()
    ]);
  }

  // Lifecycle
  onMounted(() => {
    fetchRatings();
    fetchStats();
  });

  return {
    // State
    data,
    ratings,
    stats,
    total,
    hasMore,
    loading,
    error,
    submitting,

    // Actions
    fetchRatings,
    fetchStats,
    submitRating,
    markUseful,
    reportRating,
    loadMore,
    refresh
  };
}

export default useRatings;
