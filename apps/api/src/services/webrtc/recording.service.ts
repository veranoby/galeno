// apps/api/src/services/webrtc/recording.service.ts
import { logger } from '../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export interface RecordingMetadata {
  id: string;
  consultaId: string;
  doctorId: string;
  pacienteId: string;
  duration: number;
  size: number;
  path: string;
  createdAt: string;
}

export class RecordingService {
  private readonly STORAGE_PATH = process.env.RECORDINGS_PATH || './recordings';

  constructor() {
    this.ensureStorageDirectory();
  }

  // Asegurar directorio de almacenamiento
  private async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.STORAGE_PATH, { recursive: true });
      logger.info({ path: this.STORAGE_PATH }, 'Recording storage directory ready');
    } catch (error) {
      logger.error({ error }, 'Failed to create recording storage directory');
      throw error;
    }
  }

  // Guardar grabación
  async saveRecording(
    buffer: Buffer,
    metadata: Omit<RecordingMetadata, 'id' | 'createdAt' | 'size' | 'path'>
  ): Promise<RecordingMetadata> {
    try {
      const id = `rec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const filename = `${id}.webm`;
      const filePath = path.join(this.STORAGE_PATH, filename);

      // Guardar archivo
      await fs.writeFile(filePath, buffer);

      // Obtener tamaño
      const stats = await fs.stat(filePath);

      const recording: RecordingMetadata = {
        id,
        consultaId: metadata.consultaId,
        doctorId: metadata.doctorId,
        pacienteId: metadata.pacienteId,
        duration: metadata.duration,
        size: stats.size,
        path: filePath,
        createdAt: new Date().toISOString()
      };

      logger.info({ recordingId: id, size: stats.size }, 'Recording saved');
      return recording;
    } catch (error) {
      logger.error({ error }, 'Failed to save recording');
      throw new Error('Failed to save recording');
    }
  }

  // Obtener grabación
  async getRecording(recordingId: string): Promise<RecordingMetadata | null> {
    try {
      const filePath = path.join(this.STORAGE_PATH, `${recordingId}.webm`);
      
      try {
        await fs.access(filePath);
      } catch {
        return null;
      }

      const stats = await fs.stat(filePath);
      
      // Buscar metadata en BD (implementar según schema)
      // Por ahora, retornar metadata básica
      return {
        id: recordingId,
        consultaId: '',
        doctorId: '',
        pacienteId: '',
        duration: 0,
        size: stats.size,
        path: filePath,
        createdAt: stats.birthtime.toISOString()
      };
    } catch (error) {
      logger.error({ error, recordingId }, 'Failed to get recording');
      return null;
    }
  }

  // Eliminar grabación
  async deleteRecording(recordingId: string): Promise<boolean> {
    try {
      const filePath = path.join(this.STORAGE_PATH, `${recordingId}.webm`);
      await fs.unlink(filePath);
      logger.info({ recordingId }, 'Recording deleted');
      return true;
    } catch (error) {
      logger.error({ error, recordingId }, 'Failed to delete recording');
      return false;
    }
  }

  // Listar grabaciones de una consulta
  async listRecordings(consultaId: string): Promise<RecordingMetadata[]> {
    try {
      const files = await fs.readdir(this.STORAGE_PATH);
      const recordings: RecordingMetadata[] = [];

      for (const file of files) {
        if (file.startsWith(`rec_`) && file.endsWith('.webm')) {
          const filePath = path.join(this.STORAGE_PATH, file);
          const stats = await fs.stat(filePath);
          
          // TODO: Filtrar por consultaId cuando tengamos metadata en BD
          recordings.push({
            id: file.replace('.webm', ''),
            consultaId,
            doctorId: '',
            pacienteId: '',
            duration: 0,
            size: stats.size,
            path: filePath,
            createdAt: stats.birthtime.toISOString()
          });
        }
      }

      return recordings.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      logger.error({ error }, 'Failed to list recordings');
      return [];
    }
  }

  // Limpiar grabaciones antiguas
  async cleanupOldRecordings(daysOld: number = 30): Promise<number> {
    try {
      const files = await fs.readdir(this.STORAGE_PATH);
      const now = Date.now();
      const maxAge = daysOld * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.webm')) continue;

        const filePath = path.join(this.STORAGE_PATH, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          deletedCount++;
          logger.info({ file, age: Math.floor((now - stats.mtimeMs) / 86400000) }, 'Deleted old recording');
        }
      }

      logger.info({ deletedCount }, 'Cleanup completed');
      return deletedCount;
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup old recordings');
      return 0;
    }
  }
}

export const recordingService = new RecordingService();
export default recordingService;
