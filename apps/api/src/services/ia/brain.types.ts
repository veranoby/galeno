/**
 * IA Brain Types - TASK-009E
 * Defines the structure for AI preference learning system
 */

export interface IABrainData {
  doctorId: string;
  lastUpdated: Date;

  // Preferencias por categoría
  preferences: {
    diagnostics: {
      // CIE-10 codes más usados
      topCodes: Array<{ code: string; count: number; lastUsed: Date }>;
      // Especialidades preferidas
      specialties: string[];
    };

    medications: {
      // Medicamentos más recetados
      topMeds: Array<{ name: string; count: number; lastUsed: Date }>;
      // Dosis preferidas por medicamento
      preferredDoses: Record<string, string>;
    };

    exams: {
      // Exámenes más solicitados
      topExams: Array<{ name: string; count: number; lastUsed: Date }>;
    };
  };

  // Aceptaciones recientes (últimas 100)
  recentAcceptances: Array<{
    category: 'diagnostic' | 'medication' | 'exam';
    itemId: string;
    accepted: boolean;
    timestamp: Date;
  }>;
}

export interface AcceptanceRecord {
  category: 'diagnostic' | 'medication' | 'exam';
  itemId: string;
  accepted: boolean;
  timestamp: Date;
}

export interface PreferenceUpdate {
  category: 'diagnostics' | 'medications' | 'exams';
  itemId: string;
  action: 'increment' | 'decrement';
  metadata?: Record<string, unknown>;
}

export interface BrainPreferences {
  diagnostics: {
    topCodes: Array<{ code: string; count: number; lastUsed: Date }>;
    specialties: string[];
  };
  medications: {
    topMeds: Array<{ name: string; count: number; lastUsed: Date }>;
    preferredDoses: Record<string, string>;
  };
  exams: {
    topExams: Array<{ name: string; count: number; lastUsed: Date }>;
  };
}

export interface PatternAnalysisResult {
  doctorId: string;
  patterns: {
    mostUsed: {
      diagnostics: string[];
      medications: string[];
      exams: string[];
    };
    trends: {
      increasing: string[]; // Items with growing acceptance rates
      decreasing: string[]; // Items with declining acceptance rates
    };
    recommendations: Array<{
      category: 'diagnostic' | 'medication' | 'exam';
      item: string;
      confidence: number; // 0-1 scale
      reason: string;
    }>;
  };
  analyzedAt: Date;
}