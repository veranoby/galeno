// apps/api/src/services/consulta/context-service.ts
import prisma from '../../config/database.js';
import { ConsultaContext } from '../../types/ia.types.js';

export async function buildConsultaContext(consultaId: string): Promise<ConsultaContext> {
  // Obtener la consulta con información del paciente
  const consulta = await prisma.consulta.findUnique({
    where: { id: consultaId }, 
    include: {
      paciente: {
        include: {
          antecedentes: true
        }
      }, 
      cuenta: true // doctor information
    }
  });

  if (!consulta) {
    throw new Error('Consulta no encontrada');
  }

  // Obtener medicamentos activos de los antecedentes del paciente
  // Nota: Los medicamentos se almacenan como antecedentes de tipo 'medicamento'
  const medicamentosActivos = consulta.paciente.antecedentes
    .filter((antecedente: any) => antecedente.tipo === 'medicamento')
    .map((antecedente: any) => ({
      id: antecedente.id, 
      nombre: antecedente.detalle.split(' ')[0] || antecedente.detalle, // Primer palabra como nombre
      principioActivo: '',
      concentracion: '',
      formaFarmaceutica: '',
      viaAdministracion: '',
      frecuencia: '',
      duracion: '',
      estado: 'activo' as const
    }));

  // Obtener alergias del paciente (se asume que están en antecedentes con tipo 'alergia')
  const alergias = consulta.paciente.antecedentes
    .filter((antecedente: any) => antecedente.tipo === 'alergia')
    .map((antecedente: any) => antecedente.detalle);

  return {
    pacienteId: consulta.pacienteId,
    antecedentes: consulta.paciente.antecedentes,
    medicamentosActivos,
    alergias
  };
}