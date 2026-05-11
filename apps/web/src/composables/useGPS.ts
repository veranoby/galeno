// apps/web/src/composables/useGPS.ts
import { ref } from 'vue';
import { apiClient } from '@/services/api';

export interface Position {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
}

export interface GPSOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export interface NearbyDoctorRequest {
  patientLat: number;
  patientLng: number;
  radiusKm?: number;
  especialidad?: string;
}

export interface DoctorLocation {
  doctorId: string;
  doctorName: string;
  especialidad: string;
  oficinaName: string;
  distanciaKm: number;
  ubicacion: {
    lat: number;
    lng: number;
  };
}

export interface GPSService {
  currentPosition: Position | null;
  isTracking: boolean;
  isSupported: boolean;
  permissionStatus: PermissionState | null;
  error: string | null;

  // Methods
  requestPermission: () => Promise<PermissionState>;
  getCurrentPosition: (options?: GPSOptions) => Promise<Position>;
  startTracking: (callback?: (position: Position) => void, options?: GPSOptions) => Promise<void>;
  stopTracking: () => void;
  updateLocationToServer: (doctorId: string, oficinaId: string) => Promise<boolean>;
  findNearbyDoctors: (request: NearbyDoctorRequest) => Promise<DoctorLocation[]>;
  revokeConsent: () => Promise<boolean>;
}

export const useGPS = (): GPSService => {
  const currentPosition = ref<Position | null>(null);
  const isTracking = ref(false);
  const isSupported = ref(typeof navigator !== 'undefined' && 'geolocation' in navigator);
  const permissionStatus = ref<PermissionState | null>(null);
  const error = ref<string | null>(null);

  let watchId: number | null = null;
  let updateInterval: NodeJS.Timeout | null = null;

  /**
   * Requests geolocation permission from the user
   */
  const requestPermission = async (): Promise<PermissionState> => {
    if (!isSupported.value) {
      error.value = 'Geolocation is not supported by this browser.';
      throw new Error(error.value);
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      permissionStatus.value = permission.state;

      // Listen for permission changes
      permission.onchange = () => {
        permissionStatus.value = permission.state;
      };

      return permission.state;
    } catch (err) {
      error.value = `Error requesting permission: ${err}`;
      throw err;
    }
  };

  /**
   * Gets current position once
   */
  const getCurrentPosition = (options?: GPSOptions): Promise<Position> => {
    return new Promise((resolve, reject) => {
      if (!isSupported.value) {
        error.value = 'Geolocation is not supported by this browser.';
        reject(new Error(error.value));
        return;
      }

      const defaultOptions: GPSOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      };

      const opts = { ...defaultOptions, ...options };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos: Position = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };

          currentPosition.value = pos;
          error.value = null;
          resolve(pos);
        },
        (err) => {
          error.value = `Unable to retrieve your location: ${err.message}`;
          reject(new Error(error.value));
        },
        opts
      );
    });
  };

  /**
   * Starts watching position changes
   */
  const startTracking = async (
    callback?: (position: Position) => void,
    options?: GPSOptions
  ): Promise<void> => {
    if (!isSupported.value) {
      error.value = 'Geolocation is not supported by this browser.';
      throw new Error(error.value);
    }

    // Request permission if not already granted
    const status = await requestPermission();
    if (status !== 'granted') {
      error.value = 'Geolocation permission not granted.';
      throw new Error(error.value);
    }

    const defaultOptions: GPSOptions = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0
    };

    const opts = { ...defaultOptions, ...options };

    isTracking.value = true;

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const pos: Position = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };

        currentPosition.value = pos;
        error.value = null;

        if (callback) {
          callback(pos);
        }
      },
      (err) => {
        error.value = `Error watching position: ${err.message}`;
        console.error(error.value);
      },
      opts
    );
  };

  /**
   * Stops watching position changes
   */
  const stopTracking = (): void => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }

    isTracking.value = false;
  };

  /**
   * Updates location to server
   */
  const updateLocationToServer = async (doctorId: string, oficinaId: string): Promise<boolean> => {
    if (!currentPosition.value) {
      try {
        await getCurrentPosition();
      } catch (err) {
        console.error('Could not get current position to update server:', err);
        return false;
      }
    }

    if (!currentPosition.value) {
      error.value = 'Could not determine current position';
      return false;
    }

    try {
      const response = await apiClient.post('/location/update', {
        doctorId,
        oficinaId,
        lat: currentPosition.value.lat,
        lng: currentPosition.value.lng
      });

      if (response.success) {
        return true;
      } else {
        error.value = response.error || 'Failed to update location on server';
        return false;
      }
    } catch (err) {
      error.value = `Error updating location to server: ${err}`;
      console.error(error.value);
      return false;
    }
  };

  /**
   * Finds nearby doctors based on patient location
   */
  const findNearbyDoctors = async (request: NearbyDoctorRequest): Promise<DoctorLocation[]> => {
    try {
      const response = await apiClient.post<DoctorLocation[]>('/location/nearby-doctors', request);

      if (response.success && response.data) {
        return response.data;
      } else {
        error.value = response.error || 'Failed to find nearby doctors';
        return [];
      }
    } catch (err) {
      error.value = `Error finding nearby doctors: ${err}`;
      console.error(error.value);
      return [];
    }
  };

  /**
   * Revokes location consent
   */
  const revokeConsent = async (): Promise<boolean> => {
    try {
      const response = await apiClient.post('/location/consent', {
        activated: false
      });

      if (response.success) {
        return true;
      } else {
        error.value = response.error || 'Failed to revoke consent';
        return false;
      }
    } catch (err) {
      error.value = `Error revoking consent: ${err}`;
      console.error(error.value);
      return false;
    }
  };

  return {
    currentPosition: currentPosition.value,
    isTracking: isTracking.value,
    isSupported: isSupported.value,
    permissionStatus: permissionStatus.value,
    error: error.value,
    requestPermission,
    getCurrentPosition,
    startTracking,
    stopTracking,
    updateLocationToServer,
    findNearbyDoctors,
    revokeConsent
  };
};
