// apps/api/src/types/location.types.ts

export interface DoctorLocation {
  doctorId: string;
  oficinaId: string;
  
  // Encrypted coordinates
  encryptedLat: string;
  encryptedLng: string;
  
  lastUpdate: Date;
  expiresAt: Date;
}

export interface GPSConsent {
  doctorId: string;
  activado: boolean;
  fechaActivacion?: Date;
  ultimaRevocacion?: Date;
  
  // Access logs for auditing
  accesos: Array<{
    fecha: Date;
    motivo: string;
  }>;
}

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