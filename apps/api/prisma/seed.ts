import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Seed Data para Desarrollo - Galeno
 *
 * Basado en CREDENTIALS.md
 * Usuarios de prueba para desarrollo local
 */

async function main() {
  console.log('🌱 Seeding database...');

  // ============= ESPECIALIDADES =============
  const especialidades = await Promise.all([
    prisma.especialidad.upsert({
      where: { nombreCorto: 'medicina-general' },
      update: {},
      create: {
        nombre: 'Medicina General',
        nombreCorto: 'medicina-general',
        herramientas: ['estetoscopio', 'tensiómetro', 'termómetro']
      }
    }),
    prisma.especialidad.upsert({
      where: { nombreCorto: 'pediatria' },
      update: {},
      create: {
        nombre: 'Pediatría',
        nombreCorto: 'pediatria',
        herramientas: ['curvas-crecimiento', 'vacunacion']
      }
    }),
    prisma.especialidad.upsert({
      where: { nombreCorto: 'odontologia' },
      update: {},
      create: {
        nombre: 'Odontología',
        nombreCorto: 'odontologia',
        herramientas: ['odontograma', 'radiografia-dental']
      }
    }),
    prisma.especialidad.upsert({
      where: { nombreCorto: 'cardiologia' },
      update: {},
      create: {
        nombre: 'Cardiología',
        nombreCorto: 'cardiologia',
        herramientas: ['ecg', 'ecocardiograma']
      }
    }),
    prisma.especialidad.upsert({
      where: { nombreCorto: 'oftalmologia' },
      update: {},
      create: {
        nombre: 'Oftalmología',
        nombreCorto: 'oftalmologia',
        herramientas: ['retina-atlas', 'tabla-optotipos']
      }
    }),
    prisma.especialidad.upsert({
      where: { nombreCorto: 'dermatologia' },
      update: {},
      create: {
        nombre: 'Dermatología',
        nombreCorto: 'dermatologia',
        herramientas: ['dermatoscopio', 'atlas-lesiones']
      }
    }),
    prisma.especialidad.upsert({
      where: { nombreCorto: 'traumatologia' },
      update: {},
      create: {
        nombre: 'Traumatología',
        nombreCorto: 'traumatologia',
        herramientas: ['rayos-x', 'artroscopio']
      }
    })
  ]);

  console.log(`✅ Created ${especialidades.length} especialidades`);

  // ============= USUARIOS DE PRUEBA (CREDENTIALS.md) =============

  // 1. Doctor FREE
  const doctorFree = await prisma.cuenta.upsert({
    where: { email: 'doctor@free.dev' },
    update: {},
    create: {
      email: 'doctor@free.dev',
      passwordHash: await bcrypt.hash('DoctorFree123', 10),
      nombre: 'Dr. Juan Pérez',
      rol: 'DOCTOR',
      plan: 'FREE',
      maxDoctores: 1,
      maxAsistentes: 0
    }
  });

  await prisma.doctorEspecialidad.upsert({
    where: { id: 'doctor-free-especialidad' },
    update: {},
    create: {
      id: 'doctor-free-especialidad',
      doctorId: doctorFree.id,
      especialidadId: especialidades[0].id,
      principal: true,
      senescytValidada: false
    }
  });

  console.log(`✅ Created Doctor FREE: ${doctorFree.email}`);

  // 2. Doctor PREMIUM
  const doctorPremium = await prisma.cuenta.upsert({
    where: { email: 'doctor@premium.dev' },
    update: {},
    create: {
      email: 'doctor@premium.dev',
      passwordHash: await bcrypt.hash('DoctorPrem123', 10),
      nombre: 'Dra. Ana Rodríguez',
      rol: 'DOCTOR',
      plan: 'PREMIUM',
      maxDoctores: 5,
      maxAsistentes: 2
    }
  });

  await prisma.doctorEspecialidad.upsert({
    where: { id: 'doctor-premium-especialidad' },
    update: {},
    create: {
      id: 'doctor-premium-especialidad',
      doctorId: doctorPremium.id,
      especialidadId: especialidades[1].id, // Pediatría
      principal: true,
      senescytValidada: false
    }
  });

  console.log(`✅ Created Doctor PREMIUM: ${doctorPremium.email}`);

  // 3. Admin Sistema
  const admin = await prisma.cuenta.upsert({
    where: { email: 'admin@galeno.dev' },
    update: {},
    create: {
      email: 'admin@galeno.dev',
      passwordHash: await bcrypt.hash('AdminGaleno123', 10),
      nombre: 'Admin Sistema',
      rol: 'ADMIN',
      plan: 'ENTERPRISE'
    }
  });

  console.log(`✅ Created Admin: ${admin.email}`);

  // 4. Enfermera Test (vinculada al doctor premium)
  const enfermera = await prisma.usuarioVinculado.upsert({
    where: { email: 'enfermera@test.dev' },
    update: {},
    create: {
      cuentaId: doctorPremium.id,
      doctorAsignadoId: doctorPremium.id,
      email: 'enfermera@test.dev',
      passwordHash: await bcrypt.hash('Enfermera123', 10),
      nombre: 'Enf. María González',
      rol: 'ENFERMERA',
      activo: true
    }
  });

  console.log(`✅ Created Enfermera: ${enfermera.email}`);

  // ============= PACIENTES DE PRUEBA =============

  const pacientes = await Promise.all([
    prisma.paciente.upsert({
      where: { cedula: '1712345678' },
      update: {},
      create: {
        cuentaId: doctorFree.id,
        healthWalletId: 'HW-1712345678',
        nombre: 'María García',
        cedula: '1712345678',
        fechaNacimiento: new Date('1990-05-15'),
        telefono: '+593 99 123 4567',
        email: 'maria.garcia@example.com'
      }
    }),
    prisma.paciente.upsert({
      where: { cedula: '1104567890' },
      update: {},
      create: {
        cuentaId: doctorPremium.id,
        healthWalletId: 'HW-1104567890',
        nombre: 'Carlos López',
        cedula: '1104567890',
        fechaNacimiento: new Date('1985-08-22'),
        telefono: '+593 98 765 4321',
        email: 'carlos.lopez@example.com'
      }
    }),
    prisma.paciente.upsert({
      where: { cedula: '0912345678' },
      update: {},
      create: {
        cuentaId: doctorPremium.id,
        healthWalletId: 'HW-0912345678',
        nombre: 'Lucía Méndez',
        cedula: '0912345678',
        fechaNacimiento: new Date('2015-03-10'),
        telefono: '+593 99 876 5432',
        email: 'lucia.mendez@example.com'
      }
    })
  ]);

  console.log(`✅ Created ${pacientes.length} pacientes de prueba`);

  // ============= ANTECEDENTES DE PRUEBA =============
  await prisma.antecedentePaciente.upsert({
    where: { id: 'antecedente-maria-test' },
    update: {},
    create: {
      id: 'antecedente-maria-test',
      pacienteId: pacientes[0].id,
      tipo: 'personal',
      categoria: 'cronicos',
      detalle: 'Hipertensión arterial controlada con medicamentos',
      registradoPor: 'doctor'
    }
  });

  console.log('✅ Created antecedentes de prueba');

  // ============= CONSULTAS DE PRUEBA =============
  const consulta = await prisma.consulta.upsert({
    where: { id: 'consulta-maria-test' },
    update: {},
    create: {
      id: 'consulta-maria-test',
      cuentaId: doctorFree.id,
      pacienteId: pacientes[0].id,
      doctorId: doctorFree.id,
      estado: 'finalizada',
      motivoConsulta: 'Dolor de cabeza recurrente',
      evolucion: 'Paciente refiere cefalea tensional. Se indica reposo y analgésicos.',
      diagnosticoCie10: { codigo: 'R51', descripcion: 'Cefalea' },
      firmado: true
    }
  });

  console.log('✅ Created consulta de prueba');

  // ============= UBICACIONES DE PRUEBA =============
  await prisma.ubicacion.upsert({
    where: { id: 'ubicacion-doctor-free' },
    update: {},
    create: {
      id: 'ubicacion-doctor-free',
      doctorId: doctorFree.id,
      nombre: 'Consultorio Central',
      direccion: 'Av. Amazonas N23-83, Quito',
      latitud: -0.1865,
      longitud: -78.4321,
      telefono: '+593 2 123 4567',
      activo: true
    }
  });

  console.log('✅ Created ubicación de prueba');

  // ============= SLOTS DE DISPONIBILIDAD =============
  await prisma.slotDisponibilidad.create({
    data: {
      doctorId: doctorFree.id,
      ubicacionId: 'ubicacion-doctor-free',
      diaSemana: 1, // Lunes
      horaInicio: '08:00',
      horaFin: '12:00',
      duracionMinutos: 30,
      tipo: 'presencial',
      activo: true
    }
  }).catch(() => {}); // Ignore if exists

  console.log('✅ Created slots de disponibilidad');

  console.log('');
  console.log('═════════════════════════════════════════════════════════');
  console.log('🌱 Seed completed!');
  console.log('═════════════════════════════════════════════════════════');
  console.log('');
  console.log('📧 Usuarios de prueba:');
  console.log('');
  console.log('  Doctor FREE:');
  console.log('    Email:    doctor@free.dev');
  console.log('    Password: DoctorFree123');
  console.log('    Plan:     FREE (1 doctor, 0 asistentes)');
  console.log('');
  console.log('  Doctor PREMIUM:');
  console.log('    Email:    doctor@premium.dev');
  console.log('    Password: DoctorPrem123');
  console.log('    Plan:     PREMIUM (5 doctores, 2 asistentes)');
  console.log('');
  console.log('  Admin Sistema:');
  console.log('    Email:    admin@galeno.dev');
  console.log('    Password: AdminGaleno123');
  console.log('');
  console.log('  Enfermera:');
  console.log('    Email:    enfermera@test.dev');
  console.log('    Password: Enfermera123');
  console.log('    Asignada a: doctor@premium.dev');
  console.log('');
  console.log('═════════════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
