// apps/web/src/types/location.ts

export interface Oficina {
  id: string;
  nombre: string;
  direccion: string;
  
  // Public coordinates (not sensitive)
  lat: number;
  lng: number;
  
  telefono?: string;
  indicaciones?: string;
}