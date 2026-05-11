import { describe, it, expect } from 'vitest';
import { mockPatient } from '../fixtures/patient';

describe('API Unit Tests', () => {
  it('should correctly import the mock patient fixture', () => {
    expect(mockPatient).toBeDefined();
    expect(mockPatient.firstName).toBe('Juan');
    expect(mockPatient.lastName).toBe('Perez');
  });

  it('basic math still works', () => {
    expect(1 + 1).toBe(2);
  });
});
