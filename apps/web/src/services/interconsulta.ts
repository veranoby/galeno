import { apiClient } from './api';
import type { Interconsulta } from '@/types/models';

export const interconsultaService = {
  async obtenerInterconsultas(filtros: any): Promise<Interconsulta[]> {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.busqueda) params.append('q', filtros.busqueda);
    if (filtros.tipo) params.append('tipo', filtros.tipo);

    const response = await apiClient.get<any>(`/consultas/interconsultas?${params.toString()}`);
    return response.success ? response.data.data : [];
  },

  async responderInterconsulta(id: string, data: { respuesta: string; estado: string }): Promise<any> {
    const response = await apiClient.post<any>(`/consultas/interconsultas/${id}/responder`, data);
    return response.success ? response.data : null;
  }
};

export default interconsultaService;
