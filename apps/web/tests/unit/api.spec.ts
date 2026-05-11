import { describe, it, expect } from 'vitest';

describe('API Mocking with MSW', () => {
  it('should mock an API call to /api/test', async () => {
    const response = await fetch('/api/test');
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toEqual({ message: 'Hello from mocked API!' });
  });
});