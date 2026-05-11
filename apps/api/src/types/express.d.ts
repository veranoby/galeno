import { Rol, RolVinculado } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        rol: string; // Using string to accommodate both enums or mapped values
        cuentaId?: string;
      };
    }
  }
}

export {};
