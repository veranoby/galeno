// Global setup for API tests
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { startTestServer, stopTestServer } from './test-utils/server.js';

// Set required environment variables
process.env.QR_SECRET = 'test-qr-secret-key-for-testing-32bytes';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-32bytes';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-32bytes';

// Mock QR service to avoid env var issues
vi.mock('./src/services/paciente/qr-service', () => ({
  QRService: vi.fn().mockImplementation(() => ({
    generateWalletQR: vi.fn(),
    validateWalletQR: vi.fn(),
    generatePatientQR: vi.fn(),
  })),
  default: vi.fn().mockImplementation(() => ({
    generateWalletQR: vi.fn(),
    validateWalletQR: vi.fn(),
    generatePatientQR: vi.fn(),
  }))
}));

// Mock pharmacy QR validation service
vi.mock('./src/services/pharmacy/qr-validation.service', () => ({
  PharmacyQRValidationService: vi.fn().mockImplementation(() => ({
    validatePharmacyQR: vi.fn(),
    getLimitedPatientInfo: vi.fn(),
  })),
  default: vi.fn().mockImplementation(() => ({
    validatePharmacyQR: vi.fn(),
    getLimitedPatientInfo: vi.fn(),
  }))
}));

// Mock the logger
vi.mock('./src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    captureException: vi.fn(),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setExtra: vi.fn(),
    setExtras: vi.fn(),
  },
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    captureException: vi.fn(),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setExtra: vi.fn(),
    setExtras: vi.fn(),
  }
}));

// Mock auth middleware
vi.mock('./src/middleware/auth', () => ({
  authenticate: vi.fn((req, res, next) => next()),
  authorize: vi.fn((req, res, next) => next()),
  authMiddleware: vi.fn((req, res, next) => next()),
  requireRole: vi.fn(() => (req, res, next) => next()),
  requireMedical: vi.fn((req, res, next) => next()),
  requireDoctor: vi.fn((req, res, next) => next()),
  requirePatient: vi.fn((req, res, next) => next()),
  requireDoctorOrPaciente: vi.fn((req, res, next) => next()),
  requireAdmin: vi.fn((req, res, next) => next()),
  optionalAuthMiddleware: vi.fn((req, res, next) => next()),
}));

// Mock rateLimit middleware
vi.mock('./src/middleware/rateLimit', () => ({
  rateLimit: vi.fn(() => (req, res, next) => next()),
  rateLimitByIP: vi.fn(() => (req, res, next) => next()),
  rateLimitConsultas: vi.fn(() => (req, res, next) => next()),
  rateLimitFirma: vi.fn(() => (req, res, next) => next()),
  rateLimitIA: vi.fn(() => (req, res, next) => next()),
}));

// Test server lifecycle
beforeAll(async () => {
  await startTestServer();
});

afterAll(async () => {
  await stopTestServer();
});

afterEach(() => {
  vi.clearAllMocks();
});
