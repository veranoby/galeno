import { describe, it, expect } from 'vitest';
import { mockUser } from '../fixtures/user';

describe('User Fixture', () => {
  it('should have a mock user object', () => {
    expect(mockUser).toBeDefined();
    expect(mockUser.id).toBe('1');
    expect(mockUser.name).toBe('John Doe');
    expect(mockUser.email).toBe('john.doe@example.com');
  });
});
