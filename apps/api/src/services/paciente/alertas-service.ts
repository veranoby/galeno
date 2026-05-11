// apps/api/src/services/paciente/alertas-service.ts
import prisma from '../../config/database.js';

export interface AlertaClinica {
  id: string;
  tipo: 'alergia' | 'medicamento' | 'condicion' | 'interaccion' | 'vital' | 'historia';
  severidad: 'baja' | 'media' | 'alta' | 'critica';
  mensaje: string;
  fuente: string; // 'antecedente', 'medicamento', 'vital', etc.
  fechaRegistro?: Date;
}

export async function getAlertasPaciente(pacienteId: string): Promise<AlertaClinica[]> {
  const alertas: AlertaClinica[] = [];

  // Obtener antecedentes del paciente
  const paciente = await prisma.paciente.findUnique({
    where: { id: pacienteId },
    include: {
      antecedentes: true,
      consultas: {
        orderBy: { createdAt: 'desc' },
        take: 5 // Últimas 5 consultas
      }
    }
  });

  if (!paciente) return [];

  // Alertas de alergias (severidad alta)
  paciente.antecedentes
    .filter(a => a.tipo === 'alergia')
    .forEach(alergia => {
      alertas.push({
        id: alergia.id, 
        tipo: 'alergia', 
        severidad: 'alta', 
        mensaje: `Alergia: ${alergia.detalle}`, 
        fuente: 'antecedente', 
        fechaRegistro: alergia.fechaRegistro
      });
    });

  // Alertas de medicamentos críticos
  paciente.antecedentes
    .filter(a => a.tipo === 'medicamento')
    .forEach(med => {
      alertas.push({
        id: med.id, 
        tipo: 'medicamento', 
        severidad: 'media', 
        mensaje: `Medicamento activo: ${med.detalle}`, 
        fuente: 'antecedente', 
        fechaRegistro: med.fechaRegistro
      });
    });

  // Alertas de condiciones crónicas
  paciente.antecedentes
    .filter(a => a.tipo === 'personal' && a.categoria?.toLowerCase().includes('cronica'))
    .forEach(cond => {
      alertas.push({
        id: cond.id, 
        tipo: 'condicion', 
        severidad: 'media', 
        mensaje: `Condición crónica: ${cond.detalle}`, 
        fuente: 'antecedente', 
        fechaRegistro: cond.fechaRegistro
      });
    });

  // Alertas de condiciones familiares importantes
  paciente.antecedentes
    .filter(a => a.tipo === 'familiar' && ['diabetes',  'cardiaca',  'hipertension'].some(t => a.detalle.toLowerCase().includes(t)))
    .forEach(cond => {
      alertas.push({
        id: cond.id, 
        tipo: 'condicion', 
        severidad: 'baja', 
        mensaje: `Antecedente familiar: ${cond.detalle}`, 
        fuente: 'antecedente', 
        fechaRegistro: cond.fechaRegistro
      });
    });

  // Alertas de diagnósticos recientes
  paciente.consultas.forEach(consulta => {
    if (consulta.diagnosticoCie10) {
      // Suponiendo que diagnosticoCie10 es un JSON que contiene códigos CIE-10
      try {
        const diagnosticos = Array.isArray(consulta.diagnosticoCie10) 
          ? consulta.diagnosticoCie10 
          : JSON.parse(consulta.diagnosticoCie10 as any);
        
        diagnosticos.forEach((diag: any) => {
          if (diag.codigo && diag.descripcion) {
            const severidad = ['I10', 'E11', 'E10'].some(c => c === diag.codigo) ? 'alta' : 'media';
            alertas.push({
              id: `${consulta.id}-${diag.codigo}`, 
              tipo: 'historia', 
              severidad: severidad, 
              mensaje: `Diagnóstico CIE-10: ${diag.codigo} - ${diag.descripcion}`, 
              fuente: 'consulta', 
              fechaRegistro: consulta.createdAt
            });
          }
        });
      } catch (e) {
        // Si no se puede parsear el JSON, ignorar
      }
    }
  });

  return alertas;
}

export async function getAlertasPacienteByTipo(pacienteId: string,  tipo: string): Promise<AlertaClinica[]> {
  const todasLasAlertas = await getAlertasPaciente(pacienteId);
  return todasLasAlertas.filter(alerta => alerta.tipo === tipo);
}

export async function getAlertasPacienteBySeveridad(pacienteId: string,  severidad: string): Promise<AlertaClinica[]> {
  const todasLasAlertas = await getAlertasPaciente(pacienteId);
  return todasLasAlertas.filter(alerta => alerta.severidad === severidad);
}