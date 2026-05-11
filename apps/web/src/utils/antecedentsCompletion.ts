/**
 * Utility function to calculate the completion percentage of antecedents
 * @param antecedentsData - The patient's antecedents data object
 * @param requiredFields - Array of required field names (supports nested paths like 'medicalHistory.conditions')
 * @returns The completion percentage as a number between 0 and 100
 */
export function calculateAntecedentsCompletion(
  antecedentsData: Record<string, any>,
  requiredFields: string[] = [
    'personalHistory',
    'familyHistory',
    'allergies',
    'currentMedications',
    'pastSurgeries',
    'chronicConditions',
    'vaccinationStatus'
  ]
): number {
  if (!antecedentsData || typeof antecedentsData !== 'object') {
    return 0;
  }

  if (requiredFields.length === 0) {
    return 100; // If no required fields, consider it 100% complete
  }

  let filledCount = 0;

  for (const field of requiredFields) {
    const value = getNestedValue(antecedentsData, field);

    // Check if the field has a value
    if (hasValue(value)) {
      filledCount++;
    }
  }

  return Math.round((filledCount / requiredFields.length) * 100);
}

/**
 * Helper function to get nested object values
 * @param obj - The object to get the value from
 * @param path - The dot notation path to the desired property
 * @returns The value at the specified path or null if not found
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}

/**
 * Helper function to determine if a value is considered "filled"
 * @param value - The value to check
 * @returns True if the value is considered filled, false otherwise
 */
function hasValue(value: any): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  // For numbers, booleans, etc.
  return true;
}