// apps/api/src/services/doctor/profile.service.ts
import prisma from '../../config/database.js';
import { logger } from '../../utils/logger.js';

export interface DoctorPublicProfileCreate {
  doctorId: string;
  bio?: string;
  experiencia?: number;
  especialidades?: string[];
  educacion?: any;
  certificaciones?: any;
  idiomas?: string[];
  precioConsulta?: number;
  ubicacion?: string;
  telefonoPublico?: string;
  emailPublico?: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  fotoPerfilUrl?: string;
  fotoPortadaUrl?: string;
}

export interface DoctorPublicProfileUpdate extends Partial<DoctorPublicProfileCreate> {
  verificado?: boolean;
  destacado?: boolean;
  activo?: boolean;
}

export interface RatingCreate {
  doctorId: string;
  pacienteId: string;
  consultaId?: string;
  rating: number;
  comentario?: string;
  anonimizado?: boolean;
}

export class DoctorProfileService {
  /**
   * Get or create public profile for a doctor
   */
  async getOrCreateProfile(doctorId: string) {
    try {
      let profile = await prisma.doctorPublicProfile.findUnique({
        where: { doctorId }
      });

      if (!profile) {
        profile = await prisma.doctorPublicProfile.create({
          data: {
            doctorId,
            activo: true,
            verificado: false,
            destacado: false
          } as any
        });
      }

      // Incrementar vistas
      await this.incrementProfileViews(doctorId);

      return profile;
    } catch (error) {
      logger.error({ error, doctorId }, 'Error getting/creating doctor profile');
      throw new Error('Failed to get doctor profile');
    }
  }

  /**
   * Get public profile by doctor ID
   */
  async getProfileByDoctorId(doctorId: string) {
    try {
      const profile = await prisma.doctorPublicProfile.findUnique({
        where: { doctorId },
        include: {
          ratings: {
            where: { aprobado: true },
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });

      if (!profile || !profile.activo) {
        return null;
      }

      // Incrementar vistas
      await this.incrementProfileViews(doctorId);

      return profile;
    } catch (error) {
      logger.error({ error, doctorId }, 'Error getting doctor profile');
      throw new Error('Failed to get doctor profile');
    }
  }

  /**
   * Get public profile by ID
   */
  async getProfileById(profileId: string) {
    try {
      const profile = await prisma.doctorPublicProfile.findUnique({
        where: { id: profileId },
        include: {
          doctor: {
            select: {
              id: true,
              nombre: true,
              especialidad: true,
              senescytValidado: true
            }
          },
          ratings: {
            where: { aprobado: true },
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });

      if (!profile || !profile.activo) {
        return null;
      }

      return profile;
    } catch (error) {
      logger.error({ error, profileId }, 'Error getting doctor profile');
      throw new Error('Failed to get doctor profile');
    }
  }

  /**
   * Create public profile
   */
  async createProfile(data: DoctorPublicProfileCreate) {
    try {
      const profile = await prisma.doctorPublicProfile.create({
        data: {
          ...data,
          especialidades: JSON.stringify(data.especialidades || []),
          idiomas: JSON.stringify(data.idiomas || [])
        }
      });

      logger.info({ profileId: profile.id, doctorId: data.doctorId }, 'Doctor profile created');
      return profile;
    } catch (error) {
      logger.error({ error, doctorId: data.doctorId }, 'Error creating doctor profile');
      throw new Error('Failed to create doctor profile');
    }
  }

  /**
   * Update public profile
   */
  async updateProfile(doctorId: string, data: DoctorPublicProfileUpdate) {
    try {
      const updateData: any = { ...data };

      if (data.especialidades) {
        updateData.especialidades = JSON.stringify(data.especialidades);
      }
      if (data.idiomas) {
        updateData.idiomas = JSON.stringify(data.idiomas);
      }

      const profile = await prisma.doctorPublicProfile.update({
        where: { doctorId },
        data: updateData
      });

      logger.info({ profileId: profile.id, doctorId }, 'Doctor profile updated');
      return profile;
    } catch (error) {
      logger.error({ error, doctorId }, 'Error updating doctor profile');
      throw new Error('Failed to update doctor profile');
    }
  }

  /**
   * Increment profile views
   */
  async incrementProfileViews(doctorId: string) {
    try {
      await prisma.doctorPublicProfile.update({
        where: { doctorId },
        data: {
          vistasPerfil: {
            increment: 1
          }
        }
      });
    } catch (error) {
      logger.error({ error, doctorId }, 'Error incrementing profile views');
    }
  }

  /**
   * Get featured doctors
   */
  async getFeaturedDoctors(limit: number = 10) {
    try {
      return prisma.doctorPublicProfile.findMany({
        where: {
          destacado: true,
          activo: true
        },
        include: {
          doctor: {
            select: {
              id: true,
              nombre: true,
              especialidad: true
            }
          }
        },
        orderBy: { vistasPerfil: 'desc' },
        take: limit
      });
    } catch (error) {
      logger.error({ error }, 'Error getting featured doctors');
      throw new Error('Failed to get featured doctors');
    }
  }

  /**
   * Search doctors
   */
  async searchDoctors(query: string, limit: number = 20) {
    try {
      return prisma.doctorPublicProfile.findMany({
        where: {
          activo: true,
          OR: [
            { bio: { contains: query, mode: 'insensitive' } },
            { ubicacion: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: {
          doctor: {
            select: {
              id: true,
              nombre: true,
              especialidad: true
            }
          }
        },
        take: limit
      });
    } catch (error) {
      logger.error({ error, query }, 'Error searching doctors');
      throw new Error('Failed to search doctors');
    }
  }

  // ============= MÉTODOS DE VALORACIONES (BIZ-002) =============

  /**
   * Create rating
   */
  async createRating(data: RatingCreate) {
    try {
      // Validate rating (1-5)
      if (data.rating < 1 || data.rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      // Check if patient already rated this doctor
      const existingRating = await prisma.doctorRating.findFirst({
        where: {
          doctorId: data.doctorId,
          pacienteId: data.pacienteId,
          consultaId: data.consultaId || null
        }
      });

      if (existingRating) {
        throw new Error('Patient already rated this doctor');
      }

      const rating = await prisma.doctorRating.create({
        data: {
          ...data,
          aprobado: false // Requiere aprobación
        }
      });

      logger.info({ ratingId: rating.id, doctorId: data.doctorId }, 'Rating created');
      return rating;
    } catch (error) {
      logger.error({ error, doctorId: data.doctorId }, 'Error creating rating');
      throw new Error('Failed to create rating');
    }
  }

  /**
   * Get ratings for a doctor
   */
  async getRatings(doctorId: string, options?: { limit?: number; offset?: number }) {
    try {
      const { limit = 20, offset = 0 } = options || {};

      const [ratings, total] = await Promise.all([
        prisma.doctorRating.findMany({
          where: {
            doctorId,
            aprobado: true
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit
        }),
        prisma.doctorRating.count({
          where: {
            doctorId,
            aprobado: true
          }
        })
      ]);

      return { ratings, total, limit, offset };
    } catch (error) {
      logger.error({ error, doctorId }, 'Error getting ratings');
      throw new Error('Failed to get ratings');
    }
  }

  /**
   * Get rating statistics
   */
  async getRatingStats(doctorId: string) {
    try {
      const stats = await prisma.doctorRating.groupBy({
        by: ['rating'],
        where: {
          doctorId,
          aprobado: true
        },
        _count: {
          rating: true
        }
      });

      const ratings = await prisma.doctorRating.findMany({
        where: {
          doctorId,
          aprobado: true
        },
        select: {
          rating: true
        }
      });

      const total = ratings.length;
      const average = total > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / total
        : 0;

      const distribution = {
        5: stats.find(s => s.rating === 5)?._count.rating || 0,
        4: stats.find(s => s.rating === 4)?._count.rating || 0,
        3: stats.find(s => s.rating === 3)?._count.rating || 0,
        2: stats.find(s => s.rating === 2)?._count.rating || 0,
        1: stats.find(s => s.rating === 1)?._count.rating || 0
      };

      return {
        total,
        average: Math.round(average * 10) / 10,
        distribution
      };
    } catch (error) {
      logger.error({ error, doctorId }, 'Error getting rating stats');
      throw new Error('Failed to get rating stats');
    }
  }

  /**
   * Approve rating
   */
  async approveRating(ratingId: string) {
    try {
      return prisma.doctorRating.update({
        where: { id: ratingId },
        data: { aprobado: true }
      });
    } catch (error) {
      logger.error({ error, ratingId }, 'Error approving rating');
      throw new Error('Failed to approve rating');
    }
  }

  /**
   * Report rating
   */
  async reportRating(ratingId: string) {
    try {
      return prisma.doctorRating.update({
        where: { id: ratingId },
        data: { reportado: true }
      });
    } catch (error) {
      logger.error({ error, ratingId }, 'Error reporting rating');
      throw new Error('Failed to report rating');
    }
  }

  /**
   * Mark rating as useful/not useful
   */
  async markRatingUsefulness(ratingId: string, useful: boolean) {
    try {
      return prisma.doctorRating.update({
        where: { id: ratingId },
        data: useful
          ? { util: { increment: 1 } }
          : { noUtil: { increment: 1 } }
      });
    } catch (error) {
      logger.error({ error, ratingId }, 'Error marking rating usefulness');
      throw new Error('Failed to mark rating usefulness');
    }
  }
}

export const doctorProfileService = new DoctorProfileService();
export default doctorProfileService;
