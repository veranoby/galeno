// apps/web/src/composables/__tests__/useGPS.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGPS } from '../useGPS';

// Mock the geolocation API
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn()
};

const mockPermissions = {
  query: vi.fn()
};

// Mock fetch
const mockFetch = vi.fn();

// Mock window object to include navigator
Object.assign(global, {
  navigator: {
    geolocation: mockGeolocation,
    permissions: mockPermissions
  },
  fetch: mockFetch
});

describe('useGPS', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock browser APIs
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true
    });

    Object.defineProperty(navigator, 'permissions', {
      value: mockPermissions,
      writable: true
    });

    // Mock fetch
    global.fetch = mockFetch;
  });

  it('should initialize with correct default values', () => {
    const gps = useGPS();

    expect(gps.isSupported).toBe(true);
    expect(gps.currentPosition).toBeNull();
    expect(gps.isTracking).toBe(false);
    expect(gps.permissionStatus).toBeNull();
    expect(gps.error).toBeNull();
  });

  it('should request permission correctly', async () => {
    const mockPermissionStatus = {
      state: 'granted',
      onchange: null
    };

    mockPermissions.query.mockResolvedValue(mockPermissionStatus);

    const gps = useGPS();
    const permission = await gps.requestPermission();

    expect(permission).toBe('granted');
    expect(mockPermissions.query).toHaveBeenCalledWith({ name: 'geolocation' });
  });

  it('should get current position', async () => {
    const mockPosition = {
      coords: {
        latitude: -33.4489,
        longitude: -70.6693,
        accuracy: 10
      },
      timestamp: Date.now()
    };

    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success(mockPosition);
    });

    const gps = useGPS();
    const position = await gps.getCurrentPosition();

    expect(position.lat).toBe(-33.4489);
    expect(position.lng).toBe(-70.6693);
    expect(position.accuracy).toBe(10);
  });

  it('should start and stop tracking', async () => {
    const mockPosition = {
      coords: {
        latitude: -33.4489,
        longitude: -70.6693,
        accuracy: 10
      },
      timestamp: Date.now()
    };

    const mockWatchId = 123;
    mockGeolocation.watchPosition.mockImplementation((success, error, options) => {
      success(mockPosition);
      return mockWatchId;
    });

    const gps = useGPS();

    // Mock permission request
    mockPermissions.query.mockResolvedValue({ state: 'granted', onchange: null });

    // Start tracking
    await gps.startTracking('doc123', 'office1');

    // Verify watchPosition was called
    expect(mockGeolocation.watchPosition).toHaveBeenCalled();

    // Stop tracking
    gps.stopTracking();

    // Verify clearWatch was called
    expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(mockWatchId);
  });

  it('should update location to server', async () => {
    const mockPosition = {
      coords: {
        latitude: -33.4489,
        longitude: -70.6693,
        accuracy: 10
      },
      timestamp: Date.now()
    };

    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success(mockPosition);
    });

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
      ok: true
    });

    const gps = useGPS();

    // First get a position
    await gps.getCurrentPosition();

    // Then update to server
    const result = await gps.updateLocationToServer('doc123', 'office1');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('/api/location/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Doctor-ID': 'doc123'
      },
      body: JSON.stringify({
        doctorId: 'doc123',
        oficinaId: 'office1',
        lat: -33.4489,
        lng: -70.6693
      })
    });
  });
});