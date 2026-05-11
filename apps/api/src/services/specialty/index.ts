/**
 * Specialty Service - Public API
 * Galeno - Ecuador Health 360
 *
 * Central export for all specialty-related functionality
 */

// Types and schemas
export {
  TOOL_CATEGORIES,
  ToolConfigSchema,
  SpecialtyToolsSchema,
  SpecialtyConfigSchema,
  SpecialtyJsonSchema,
  parseSpecialtyJson,
  validateTools,
  getToolById,
  isFeatureEnabled,
  type ToolCategory,
  type ToolConfig,
  type SpecialtyTools,
  type SpecialtyConfig,
  type SpecialtyJson,
  type EspecialidadWithConfig,
  type DoctorEspecialidadWithSpecialty,
  type ToolId,
  type ToolMap
} from './types.js';

// Configuration service
export {
  getSpecialtyConfig,
  getSpecialtyConfigByShortName,
  getAllActiveSpecialties,
  getSpecialtyTools,
  getToolConfig,
  isFeatureEnabled as isSpecialtyFeatureEnabled,
  invalidateSpecialtyCache,
  invalidateAllSpecialtyCaches,
  getDoctorPrimarySpecialty,
  getDoctorSpecialties
} from './config.js';

// Seed data
export {
  specialtySeedData,
  getSpecialtyCreateInput,
  getSpecialtyNames,
  getSpecialtyShortNames,
  getSpecialtyConfigByShortName as getSeedSpecialtyConfig
} from './seed-data.js';

// Default export with all services
export { default } from './config.js';
