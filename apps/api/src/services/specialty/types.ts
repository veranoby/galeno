/**
 * Specialty Configuration Types and Zod Schemas
 * Galeno - Ecuador Health 360
 *
 * Defines the structure for specialty tools configuration
 * with Zod validation for runtime type safety
 */

import { z } from 'zod';
import type { Especialidad, DoctorEspecialidad } from '@prisma/client';

// ============= TOOL CATEGORIES =============

/**
 * Available tool categories in the Galeno platform
 */
export const TOOL_CATEGORIES = {
  DIAGNOSTIC: 'diagnostic',
  MONITORING: 'monitoring',
  IMAGING: 'imaging',
  PROCEDURE: 'procedure',
  EDUCATION: 'education',
  ADMIN: 'admin'
} as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[keyof typeof TOOL_CATEGORIES];

// ============= ZOD SCHEMAS =============

/**
 * Schema for individual tool configuration
 */
export const ToolConfigSchema = z.object({
  id: z.string().min(1, 'Tool ID is required'),
  name: z.string().min(1, 'Tool name is required'),
  description: z.string().optional(),
  category: z.nativeEnum(TOOL_CATEGORIES),
  enabled: z.boolean().default(true),
  required: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
  config: z.record(z.unknown()).optional()
});

export type ToolConfig = z.infer<typeof ToolConfigSchema>;

/**
 * Schema for specialty tools array
 */
export const SpecialtyToolsSchema = z.array(ToolConfigSchema);

export type SpecialtyTools = z.infer<typeof SpecialtyToolsSchema>;

/**
 * Schema for complete specialty configuration stored in JSON field
 */
export const SpecialtyConfigSchema = z.object({
  tools: SpecialtyToolsSchema,
  features: z.object({
    teleconsulta: z.boolean().default(false),
    interconsultas: z.boolean().default(false),
    recetasDigitales: z.boolean().default(true),
    examenesDigitales: z.boolean().default(true),
    certificadosDigitales: z.boolean().default(true),
    historiaClinicaAvanzada: z.boolean().default(false),
    iaAsistente: z.boolean().default(false)
  }).default({
    teleconsulta: false,
    interconsultas: false,
    recetasDigitales: true,
    examenesDigitales: true,
    certificadosDigitales: true,
    historiaClinicaAvanzada: false,
    iaAsistente: false
  }),
  metadata: z.object({
    version: z.string().default('1.0.0'),
    lastUpdated: z.string().datetime().optional(),
    author: z.string().optional()
  }).optional()
});

export type SpecialtyConfig = z.infer<typeof SpecialtyConfigSchema>;

/**
 * Schema for validating JSON from database
 */
export const SpecialtyJsonSchema = z.union([
  SpecialtyConfigSchema,
  z.array(z.string()) // Legacy format: just tool IDs
]);

export type SpecialtyJson = z.infer<typeof SpecialtyJsonSchema>;

// ============= PRISMA TYPES =============

/**
 * Type-safe Prisma query result for Especialidad
 */
export type EspecialidadWithConfig = Especialidad & {
  herramientasParsed: SpecialtyConfig;
};

/**
 * Type-safe Prisma query result for DoctorEspecialidad with nested Especialidad
 */
export type DoctorEspecialidadWithSpecialty = DoctorEspecialidad & {
  especialidad: EspecialidadWithConfig;
};

// ============= UTILITY TYPES =============

/**
 * Tool ID type for type-safe tool references
 */
export type ToolId = string;

/**
 * Map of tool IDs to their configurations
 */
export type ToolMap = Record<ToolId, ToolConfig>;

// ============= VALIDATION FUNCTIONS =============

/**
 * Validate and parse specialty JSON from database
 */
export function parseSpecialtyJson(json: unknown): SpecialtyConfig {
  const result = SpecialtyJsonSchema.safeParse(json);

  if (!result.success) {
    // Return default config if parsing fails
    return {
      tools: [],
      features: {
        teleconsulta: false,
        interconsultas: false,
        recetasDigitales: true,
        examenesDigitales: true,
        certificadosDigitales: true,
        historiaClinicaAvanzada: false,
        iaAsistente: false
      }
    };
  }

  const data = result.data;

  // Handle legacy format (array of strings)
  if (Array.isArray(data)) {
    return {
      tools: data.map((toolId, index) => ({
        id: toolId,
        name: toolId,
        category: TOOL_CATEGORIES.ADMIN,
        enabled: true,
        required: false,
        order: index
      })),
      features: {
        teleconsulta: false,
        interconsultas: false,
        recetasDigitales: true,
        examenesDigitales: true,
        certificadosDigitales: true,
        historiaClinicaAvanzada: false,
        iaAsistente: false
      }
    };
  }

  return data;
}

/**
 * Validate tools configuration
 */
export function validateTools(tools: unknown): tools is SpecialtyTools {
  return SpecialtyToolsSchema.safeParse(tools).success;
}

/**
 * Get tool by ID from configuration
 */
export function getToolById(config: SpecialtyConfig, toolId: string): ToolConfig | undefined {
  return config.tools.find(tool => tool.id === toolId);
}

/**
 * Check if a feature is enabled for a specialty
 */
export function isFeatureEnabled(config: SpecialtyConfig, feature: keyof SpecialtyConfig['features']): boolean {
  return config.features[feature] ?? false;
}
