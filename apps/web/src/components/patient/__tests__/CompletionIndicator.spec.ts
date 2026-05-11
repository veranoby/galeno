import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AntecedentsCompletionBadge from '@/components/AntecedentsCompletionBadge.vue';
import { calculateAntecedentsCompletion } from '@/utils/antecedentsCompletion';

describe('AntecedentsCompletionBadge', () => {
  it('renders correctly with 100% completion', () => {
    const antecedentsData = {
      personalHistory: 'No significant medical history',
      familyHistory: 'Father had diabetes',
      allergies: ['Penicillin'],
      currentMedications: ['Metformin'],
      pastSurgeries: ['Appendectomy'],
      chronicConditions: ['Hypertension'],
      vaccinationStatus: 'Up to date'
    };

    const wrapper = mount(AntecedentsCompletionBadge, {
      props: {
        antecedentsData
      }
    });

    expect(wrapper.find('.percentage-text').text()).toBe('100%');
    expect(wrapper.find('.completion-label').text()).toBe('100% completado');
  });

  it('renders correctly with 57% completion', () => {
    const antecedentsData = {
      personalHistory: 'No significant medical history',
      familyHistory: 'Father had diabetes',
      allergies: [], // Empty array
      currentMedications: ['Metformin'],
      pastSurgeries: null, // Null value
      chronicConditions: ['Hypertension'],
      vaccinationStatus: '' // Empty string
    };

    const wrapper = mount(AntecedentsCompletionBadge, {
      props: {
        antecedentsData
      }
    });

    // With 4 out of 7 fields filled, that's 57% (rounded)
    expect(wrapper.find('.percentage-text').text()).toBe('57%');
    expect(wrapper.find('.completion-label').text()).toBe('57% completado');
  });

  it('applies correct CSS class for low completion (<50%)', () => {
    const antecedentsData = {
      personalHistory: 'No significant medical history',
      familyHistory: '', // Empty
      allergies: [], // Empty
      currentMedications: [], // Empty
      pastSurgeries: null, // Null
      chronicConditions: [], // Empty
      vaccinationStatus: undefined // Undefined
    };

    const wrapper = mount(AntecedentsCompletionBadge, {
      props: {
        antecedentsData
      }
    });

    expect(wrapper.classes()).toContain('low-completion');
    expect(wrapper.find('.percentage-text').attributes('fill')).toBe('#f44336'); // Red
  });

  it('applies correct CSS class for medium completion (50-79%)', () => {
    const antecedentsData = {
      personalHistory: 'No significant medical history',
      familyHistory: 'Father had diabetes',
      allergies: [], // Empty
      currentMedications: [], // Empty
      pastSurgeries: null, // Null
      chronicConditions: [], // Empty
      vaccinationStatus: undefined // Undefined
    };

    const wrapper = mount(AntecedentsCompletionBadge, {
      props: {
        antecedentsData
      }
    });

    expect(wrapper.classes()).toContain('medium-completion');
    expect(wrapper.find('.percentage-text').attributes('fill')).toBe('#ff9800'); // Orange/yellow
  });

  it('applies correct CSS class for high completion (>=80%)', () => {
    const antecedentsData = {
      personalHistory: 'No significant medical history',
      familyHistory: 'Father had diabetes',
      allergies: ['Penicillin'],
      currentMedications: ['Metformin'],
      pastSurgeries: ['Appendectomy'],
      chronicConditions: ['Hypertension'],
      vaccinationStatus: 'Up to date'
    };

    const wrapper = mount(AntecedentsCompletionBadge, {
      props: {
        antecedentsData
      }
    });

    expect(wrapper.classes()).toContain('high-completion');
    expect(wrapper.find('.percentage-text').attributes('fill')).toBe('#4caf50'); // Green
  });
});

describe('calculateAntecedentsCompletion utility function', () => {
  it('calculates 100% completion when all fields are filled', () => {
    const antecedentsData = {
      personalHistory: 'No significant medical history',
      familyHistory: 'Father had diabetes',
      allergies: ['Penicillin'],
      currentMedications: ['Metformin'],
      pastSurgeries: ['Appendectomy'],
      chronicConditions: ['Hypertension'],
      vaccinationStatus: 'Up to date'
    };

    const completion = calculateAntecedentsCompletion(antecedentsData);
    expect(completion).toBe(100);
  });

  it('calculates 0% completion when no fields are filled', () => {
    const antecedentsData = {
      personalHistory: '',
      familyHistory: null,
      allergies: [],
      currentMedications: [],
      pastSurgeries: undefined,
      chronicConditions: [],
      vaccinationStatus: ' '
    };

    const completion = calculateAntecedentsCompletion(antecedentsData);
    expect(completion).toBe(0);
  });

  it('calculates correct percentage with some fields filled', () => {
    const antecedentsData = {
      personalHistory: 'No significant medical history',
      familyHistory: 'Father had diabetes',
      allergies: [], // Empty
      currentMedications: [], // Empty
      pastSurgeries: null, // Null
      chronicConditions: [], // Empty
      vaccinationStatus: undefined // Undefined
    };

    const completion = calculateAntecedentsCompletion(antecedentsData);
    expect(completion).toBe(29); // 2 out of 7 = 28.57%, rounded to 29
  });

  it('handles custom required fields', () => {
    const antecedentsData = {
      personalHistory: 'No significant medical history',
      familyHistory: 'Father had diabetes',
      allergies: []
    };

    const completion = calculateAntecedentsCompletion(
      antecedentsData,
      ['personalHistory', 'familyHistory'] // Only 2 required fields
    );
    
    expect(completion).toBe(100); // Both required fields are filled
  });

  it('returns 100 when no required fields are specified', () => {
    const antecedentsData = {}; // Empty object
    
    const completion = calculateAntecedentsCompletion(antecedentsData, []);
    expect(completion).toBe(100);
  });

  it('handles nested object properties', () => {
    const antecedentsData = {
      medicalHistory: {
        conditions: ['diabetes', 'hypertension'],
        surgeries: []
      },
      familyHistory: 'Father had heart disease'
    };

    const completion = calculateAntecedentsCompletion(
      antecedentsData,
      ['medicalHistory.conditions', 'medicalHistory.surgeries', 'familyHistory']
    );
    
    // medicalHistory.conditions (filled), medicalHistory.surgeries (empty), familyHistory (filled)
    // So 2 out of 3 = 67%
    expect(completion).toBe(67);
  });
});