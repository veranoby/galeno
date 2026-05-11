/**
 * Repositorio para operaciones de base de datos de facturas
 */
import { PrismaClient } from '@prisma/client';
import type { Factura, FacturaInput } from './billing.types';

const prisma = new PrismaClient();

export class FacturaRepository {
  /**
   * Obtiene todas las facturas de una cuenta
   */
  async findByCuentaId(cuentaId: string): Promise<Factura[]> {
    const facturas = await prisma.factura.findMany({
      where: { cuentaId },
      orderBy: { fechaEmision: 'desc' },
    });

    return facturas.map(this.mapToFactura);
  }

  /**
   * Obtiene una factura por ID
   */
  async findById(id: string): Promise<Factura | null> {
    const factura = await prisma.factura.findUnique({
      where: { id },
    });

    return factura ? this.mapToFactura(factura) : null;
  }

  /**
   * Obtiene una factura por secuencial
   */
  async findBySecuencial(cuentaId: string, secuencial: string): Promise<Factura | null> {
    const factura = await prisma.factura.findFirst({
      where: {
        cuentaId,
        secuencial,
      },
    });

    return factura ? this.mapToFactura(factura) : null;
  }

  /**
   * Crea una nueva factura
   */
  async create(data: FacturaInput): Promise<Factura> {
    const factura = await prisma.factura.create({
      data: {
        ...data,
        ambiente: data.ambiente || 'pruebas',
      },
    });

    return this.mapToFactura(factura);
  }

  /**
   * Actualiza una factura existente
   */
  async update(id: string, data: Partial<FacturaInput>): Promise<Factura> {
    const factura = await prisma.factura.update({
      where: { id },
      data,
    });

    return this.mapToFactura(factura);
  }

  /**
   * Elimina una factura
   */
  async delete(id: string): Promise<void> {
    await prisma.factura.delete({
      where: { id },
    });
  }

  /**
   * Actualiza el estado de autorización SRI
   */
  async updateAutorizacionSRI(
    id: string,
    estado: 'autorizada' | 'rechazada',
    xmlAutorizado: string,
    claveAcceso: string
  ): Promise<Factura> {
    const factura = await prisma.factura.update({
      where: { id },
      data: {
        estado,
        xmlAutorizado,
        claveAcceso,
      },
    });

    return this.mapToFactura(factura);
  }

  /**
   * Mapea desde Prisma a tipo Factura
   */
  private mapToFactura(factura: any): Factura {
    return {
      id: factura.id,
      cuentaId: factura.cuentaId,
      ruc: factura.ruc,
      razonSocial: factura.razonSocial,
      secuencial: factura.secuencial,
      fechaEmision: factura.fechaEmision,
      estado: factura.estado as Factura['estado'],
      montoTotal: Number(factura.montoTotal),
      xmlGenerado: factura.xmlGenerado ?? undefined,
      xmlAutorizado: factura.xmlAutorizado ?? undefined,
      claveAcceso: factura.claveAcceso ?? undefined,
      ambiente: factura.ambiente as 'pruebas' | 'produccion',
      createdAt: factura.createdAt,
      updatedAt: factura.updatedAt,
    };
  }
}

export const facturaRepository = new FacturaRepository();
