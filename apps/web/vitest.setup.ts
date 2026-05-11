import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { server } from './src/mocks/server';

// Mock CSS, image, and asset imports
vi.mock('*.css', () => ({}));
vi.mock('*.scss', () => ({}));
vi.mock('*.sass', () => ({}));
vi.mock('*.svg', () => ({}));
vi.mock('*.png', () => ({}));
vi.mock('*.jpg', () => ({}));
vi.mock('*.jpeg', () => ({}));
vi.mock('*.gif', () => ({}));

// Mock ResizeObserver for JSDOM environment
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
