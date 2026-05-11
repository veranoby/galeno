/**
 * Document Components
 * 
 * Componentes para visualización de estado y caducidad de documentos médicos
 */

export { default as ExpiredBadge } from './ExpiredBadge.vue';
export { default as DocumentStatus } from './DocumentStatus.vue';

// Re-exportar utilidades relacionadas
export {
  calculateExpirationDate,
  calculateExpirationStatus,
  isDocumentExpired,
  getExpirationColor,
  getExpirationColorByDocument,
  formatExpirationStatus,
  DOCUMENT_EXPIRATION_DAYS,
  type ExpirationStatus,
} from '@/utils/documentExpiration';
