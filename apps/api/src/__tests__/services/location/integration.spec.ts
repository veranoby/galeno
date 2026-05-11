import { describe, it, expect, beforeEach, vi } from 'vitest';
import locationService from '../../../services/location/location.service';

describe('Location Integration', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  it('should properly encrypt and store location data', async () => {
    // Set consent
    const consentResult = await locationService.setConsent('doc123', true);
    expect(consentResult).toBe(true);

    // Update location
    const updateResult = await locationService.updateDoctorLocation('doc123', 'office1', -33.4489, -70.6693);
    expect(updateResult).toBe(true);

    // Retrieve location - Location only contains lat and lng
    const location = await locationService.getDoctorLocation('doc123');
    expect(location).not.toBeNull();
    expect(location?.lat).toBe(-33.4489);
    expect(location?.lng).toBe(-70.6693);

    // Get decrypted coordinates
    const coords = await locationService.getDecryptedCoordinates('doc123');
    expect(coords).toEqual({ lat: -33.4489, lng: -70.6693 });
  });

  it('should handle consent flow properly', async () => {
    // Set consent to true
    const setResult = await locationService.setConsent('doc123', true);
    expect(setResult).toBe(true);

    // Revoke consent
    const revokeResult = await locationService.setConsent('doc123', false);
    expect(revokeResult).toBe(true);

    // Note: getConsent is not implemented in LocationService
    // Only setConsent is available
  });

  it('should deactivate location when consent is revoked', async () => {
    // Set consent and add location
    await locationService.setConsent('doc123', true);
    await locationService.updateDoctorLocation('doc123', 'office1', -33.4489, -70.6693);

    // Verify location exists
    let location = await locationService.getDoctorLocation('doc123');
    expect(location).not.toBeNull();

    // Revoke consent - this sets activo to false in database
    await locationService.setConsent('doc123', false);

    // Location queries are filtered by activo: true, so should return null
    location = await locationService.getDoctorLocation('doc123');
    expect(location).toBeNull();
  });
});