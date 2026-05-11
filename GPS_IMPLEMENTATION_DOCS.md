# TASK-043: GPS Dinámico Multi-Oficina - Implementation Documentation

## Overview
This document describes the implementation of the dynamic GPS system for multi-office doctor location tracking with full LOPDP compliance. The system enables doctors to share their active location with patients, who can then be guided to the correct office.

## Architecture

### Backend Components

#### 1. Crypto Service (`apps/api/src/services/location/crypto.service.ts`)
- Implements AES-256-GCM encryption for sensitive location data
- Uses environment variable for encryption key
- Provides encrypt/decrypt methods with authentication tags
- Ensures location coordinates are never stored in plain text

#### 2. Location Service (`apps/api/src/services/location/location.service.ts`)
- Manages doctor location records with encrypted coordinates
- Handles consent management for LOPDP compliance
- Implements distance calculation using Haversine formula
- Provides audit logging for data access

#### 3. API Routes (`apps/api/src/routes/location/location.routes.ts`)
- `/location/update` - Updates doctor's encrypted location
- `/location/:doctorId` - Retrieves doctor's location
- `/location/offices` - Lists all offices
- `/location/offices/:officeId` - Gets specific office details
- `/location/distance/:doctorId/:officeId` - Calculates distance between doctor and office
- `/location/consent` - Manages consent status

#### 4. Middleware (`apps/api/src/middleware/gps-auth.middleware.ts`)
- Verifies GPS location access permissions
- Checks consent status before allowing location updates
- Logs access attempts for audit trail

### Frontend Components

#### 1. useGPS Composable (`apps/web/src/composables/useGPS.ts`)
- Handles browser geolocation API interaction
- Manages permission requests
- Tracks position continuously with 5-minute intervals
- Updates location to server with encryption

#### 2. Location Store (`apps/web/src/stores/location.ts`)
- Vuex/Pinia store for location state management
- Tracks current position, last update time, and consent status
- Manages active office and tracked doctors

#### 3. LocationSelector Component (`apps/web/src/components/schedule/LocationSelector.vue`)
- UI for selecting offices and viewing doctor presence
- Shows distance calculations and directions
- Handles consent management with toggle switch

#### 4. LocationCard Component (`apps/web/src/components/schedule/LocationCard.vue`)
- Displays individual office information
- Shows doctor presence status and distance
- Provides map and directions functionality

## Security & Privacy Features

### 1. Data Encryption
- All location coordinates are encrypted using AES-256-GCM
- Encryption keys stored in environment variables
- Authentication tags prevent tampering

### 2. LOPDP Compliance
- Explicit consent required before location sharing
- Ability to revoke consent at any time
- Automatic data removal upon consent revocation
- Audit logging of all data access

### 3. Access Control
- Middleware verifies permissions before location updates
- Doctor ID validation on all requests
- Time-based expiration of location data (1 hour)

## API Endpoints

### POST /api/location/update
Updates doctor's location with encrypted coordinates
- Headers: X-Doctor-ID
- Body: { doctorId, oficinaId, lat, lng }
- Requires consent

### GET /api/location/:doctorId
Retrieves doctor's current location
- Returns encrypted location data

### GET /api/location/offices
Lists all available offices
- Public endpoint, no authentication required

### GET /api/location/distance/:doctorId/:officeId
Calculates distance between doctor and office
- Returns distance in kilometers

### POST /api/location/consent
Sets consent status for location tracking
- Body: { doctorId, activated }

## Usage Flow

### For Doctors
1. Doctor activates "Share Location" toggle
2. Browser requests geolocation permission
3. If granted, location is tracked continuously
4. Every 5 minutes, encrypted coordinates are sent to server
5. Doctor can deactivate at any time to stop tracking

### For Patients
1. Patient views appointment details
2. LocationSelector shows available offices
3. Green indicator shows where doctor is currently located
4. Distance to doctor's location is displayed
5. "Directions" button provides route to doctor's office

## Testing

### Backend Tests
- Unit tests for encryption/decryption
- Location update and retrieval tests
- Consent management tests
- Distance calculation tests

### Frontend Tests
- Geolocation API interaction tests
- Permission handling tests
- Component rendering tests

## Environment Variables

- `LOCATION_ENCRYPTION_KEY`: 64-character hex string for AES-256 encryption key

## Deployment Notes

1. Ensure LOCATION_ENCRYPTION_KEY is set in production environment
2. Configure CORS to allow location API access from frontend
3. Set up proper SSL certificates for secure location transmission
4. Monitor location data storage for compliance with retention policies

## Compliance Checklist

- [x] AES-256 encryption for sensitive location data
- [x] Explicit consent mechanism
- [x] Ability to revoke consent and delete data
- [x] Audit logging of data access
- [x] Time-based expiration of location data
- [x] Secure transmission of location data
- [x] Minimal data collection principle
- [x] Purpose limitation for location data use