// apps/web/src/stores/location.ts
import { defineStore } from 'pinia';
import { Position } from '@/composables/useGPS';

interface LocationState {
  currentPosition: Position | null;
  lastUpdateTime: Date | null;
  activeOfficeId: string | null;
  consentGiven: boolean;
  trackedDoctors: Array<{
    doctorId: string;
    lastSeen: Date;
    distance?: number;
  }>;
}

export const useLocationStore = defineStore('location', {
  state: (): LocationState => ({
    currentPosition: null,
    lastUpdateTime: null,
    activeOfficeId: null,
    consentGiven: false,
    trackedDoctors: []
  }),

  getters: {
    isLocationActive: (state) => !!state.currentPosition && !!state.lastUpdateTime,
    getLocationAge: (state) => {
      if (!state.lastUpdateTime) return null;
      return Date.now() - state.lastUpdateTime.getTime();
    },
    getTrackedDoctor: (state) => (doctorId: string) => {
      return state.trackedDoctors.find(doc => doc.doctorId === doctorId);
    }
  },

  actions: {
    setCurrentPosition(position: Position) {
      this.currentPosition = position;
    },

    setLastUpdateTime(time: Date) {
      this.lastUpdateTime = time;
    },

    setActiveOffice(officeId: string) {
      this.activeOfficeId = officeId;
    },

    setConsent(given: boolean) {
      this.consentGiven = given;
    },

    addTrackedDoctor(doctorId: string, lastSeen: Date, distance?: number) {
      const existingIndex = this.trackedDoctors.findIndex(doc => doc.doctorId === doctorId);
      
      if (existingIndex !== -1) {
        this.trackedDoctors[existingIndex] = {
          doctorId,
          lastSeen,
          distance
        };
      } else {
        this.trackedDoctors.push({
          doctorId,
          lastSeen,
          distance
        });
      }
    },

    removeTrackedDoctor(doctorId: string) {
      this.trackedDoctors = this.trackedDoctors.filter(doc => doc.doctorId !== doctorId);
    },

    updateDoctorDistance(doctorId: string, distance: number) {
      const doctor = this.trackedDoctors.find(doc => doc.doctorId === doctorId);
      if (doctor) {
        doctor.distance = distance;
      }
    },

    clearLocationData() {
      this.currentPosition = null;
      this.lastUpdateTime = null;
      this.activeOfficeId = null;
      this.consentGiven = false;
      this.trackedDoctors = [];
    }
  }
});

// Export with alias to match composable import
export const useStore = useLocationStore;