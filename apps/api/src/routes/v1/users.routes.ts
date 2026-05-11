import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../../middleware/auth.js';
import { planValidationMiddleware } from '../../middleware/plan.js';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/database.js';
import bcrypt from 'bcrypt';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/users:
 *   get:
 *     summary: Get account users (linked assistants/nurses)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.rol;
    const accountId = userRole === 'DOCTOR' || userRole === 'ADMIN' ? userId : req.user!.cuentaId;

    if (!accountId) {
      return res.status(400).json({ error: 'Account context not found' });
    }

    // Get all linked users for this account
    const users = await prisma.usuarioVinculado.findMany({
      where: { cuentaId: accountId }, 
      select: {
        id: true, 
        email: true, 
        nombre: true, 
        rol: true, 
        activo: true,
        createdAt: true, 
        updatedAt: true
      }
    });

    res.json({ users });
  } catch (error) {
    logger.error({ error },  'Error fetching users');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/users:
 *   post:
 *     summary: Create a new linked user (assistant/nurse)
 *     tags: [Users]
 */
router.post('/',  
  authMiddleware, 
  planValidationMiddleware('add_assistant',  { count: 1 }),
  async (req: AuthRequest,  res: Response) => {
    try {
      const { email, nombre, rol, password } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.rol;

      // Only DOCTOR or ADMIN can create assistants/nurses
      if (userRole !== 'DOCTOR' && userRole !== 'ADMIN') {
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: 'Only DOCTOR or ADMIN can create assistants/nurses' 
        });
      }

      // Validate input
      if (!email || !nombre || !rol || !password) {
        return res.status(400).json({ 
          error: 'Missing required fields', 
          message: 'Email, nombre, rol, and password are required'
        });
      }

      // Check if user already exists in Cuenta or UsuarioVinculado
      const existingCuenta = await prisma.cuenta.findUnique({ where: { email } });
      const existingLinked = await prisma.usuarioVinculado.findUnique({ where: { email } });

      if (existingCuenta || existingLinked) {
        return res.status(409).json({ 
          error: 'Conflict', 
          message: 'User with this email already exists' 
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create the new linked user
      const newUser = await prisma.usuarioVinculado.create({
        data: {
          email, 
          nombre, 
          rol: rol === 'ENFERMERA' ? 'ENFERMERA' : 'ASISTENTE', 
          passwordHash: hashedPassword, 
          cuentaId: userId,
          doctorAsignadoId: userId
        }, 
        select: {
          id: true, 
          email: true, 
          nombre: true, 
          rol: true, 
          createdAt: true, 
          updatedAt: true
        }
      });

      logger.info({ 
        event: 'user_created',  
        userId: newUser.id,  
        creatorId: userId, 
        rol: newUser.rol
      }, 'Linked user created successfully');

      res.status(201).json(newUser);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error({ error,  code: error.code },  'Prisma error creating user');
        return res.status(400).json({ error: 'Database error',  message: error.message });
      }
      
      logger.error({ error },  'Error creating user');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @openapi
 * /api/v1/users/{id}:
 *   put:
 *     summary: Update user information
 */
router.put('/:id',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { nombre, rol, activo } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.rol;

    // Only DOCTOR or ADMIN can update other users
    if (userRole !== 'DOCTOR' && userRole !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Only DOCTOR or ADMIN can update other users' 
      });
    }

    // Get the user to update and ensure it belongs to this account
    const userToUpdate = await prisma.usuarioVinculado.findFirst({
      where: { 
        id, 
        cuentaId: userId 
      }
    });

    if (!userToUpdate) {
      return res.status(404).json({ error: 'User not found in your account' });
    }

    // Prepare update data
    const updateData: any = {};
    if (nombre) updateData.nombre = nombre;
    if (activo !== undefined) updateData.activo = activo;
    if (rol) {
      if (!['ASISTENTE',  'ENFERMERA'].includes(rol)) {
        return res.status(400).json({ 
          error: 'Invalid role', 
          message: 'Role must be ASISTENTE or ENFERMERA' 
        });
      }
      updateData.rol = rol;
    }

    // Update the user
    const updatedUser = await prisma.usuarioVinculado.update({
      where: { id }, 
      data: updateData, 
      select: {
        id: true, 
        email: true, 
        nombre: true, 
        rol: true, 
        activo: true,
        createdAt: true, 
        updatedAt: true
      }
    });

    logger.info({ 
      event: 'user_updated',  
      userId: updatedUser.id,  
      updaterId: userId, 
      changes: Object.keys(updateData)
    }, 'Linked user updated');

    res.json(updatedUser);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error({ error,  code: error.code },  'Prisma error updating user');
      return res.status(400).json({ error: 'Database error',  message: error.message });
    }
    
    logger.error({ error },  'Error updating user');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/v1/users/{id}:
 *   delete:
 *     summary: Delete a user
 */
router.delete('/:id',  authMiddleware,  async (req: AuthRequest,  res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user!.id;
    const userRole = req.user!.rol;

    // Only DOCTOR or ADMIN can delete users
    if (userRole !== 'DOCTOR' && userRole !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Only DOCTOR or ADMIN can delete users' 
      });
    }

    // Get the user to delete and ensure it belongs to this account
    const userToDelete = await prisma.usuarioVinculado.findFirst({
      where: { 
        id, 
        cuentaId: userId 
      }
    });

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found in your account' });
    }

    // Delete the user
    await prisma.usuarioVinculado.delete({
      where: { id }
    });

    logger.info({ 
      event: 'user_deleted',  
      userId: id,  
      deleterId: userId
    }, 'Linked user deleted');

    res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
      }
      logger.error({ error,  code: error.code },  'Prisma error deleting user');
      return res.status(400).json({ error: 'Database error',  message: error.message });
    }
    
    logger.error({ error },  'Error deleting user');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
