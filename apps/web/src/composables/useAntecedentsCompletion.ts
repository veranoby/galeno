import { computed, ComputedRef } from 'vue';
import { calculateAntecedentsCompletion } from '@/utils/antecedentsCompletion';

/**
 * Composable to calculate antecedents completion percentage
 * @param antecedentsData - Reactive reference to the patient's antecedents data
 * @param requiredFields - Optional array of required field names
 * @returns A computed ref containing the completion percentage
 */
export function useAntecedentsCompletion(
  antecedentsData: ComputedRef<Record<string, any>> | Record<string, any>,
  requiredFields?: string[]
): ComputedRef<number> {
  return computed(() => {
    const data = typeof antecedentsData === 'function' ? antecedentsData.value : antecedentsData;
    return calculateAntecedentsCompletion(data, requiredFields);
  });
}