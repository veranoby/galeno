import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create especialidades base
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
    })
  ]);

  console.log(`✅ Created ${especialidades.length} especialidades`);

  // Create demo doctor
  const passwordHash = await bcrypt.hash('Demo123!', 10);
  const doctor = await prisma.cuenta.upsert({
    where: { email: 'doctor@galeno.ec' },
    update: {},
    create: {
      email: 'doctor@galeno.ec',
      passwordHash,
      nombre: 'Dr. Carlos Martínez',
      rol: 'DOCTOR',
      plan: 'FREE'
    }
  });

  // Link doctor to especialidades
  await prisma.doctorEspecialidad.upsert({
    where: {
      id: 'demo-doctor-especialidad'
    },
    update: {},
    create: {
      id: 'demo-doctor-especialidad',
      doctorId: doctor.id,
      especialidadId: especialidades[0].id,
      principal: true,
      senescytValidada: false
    }
  });

  console.log(`✅ Created demo doctor: ${doctor.email}`);
  console.log(`   Password: Demo123!`);

  // Create demo paciente
  const paciente = await prisma.paciente.upsert({
    where: { cedula: '1712345678' },
    update: {},
    create: {
      cuentaId: doctor.id,
      healthWalletId: 'HW-1712345678',
      nombre: 'María García',
      cedula: '1712345678',
      fechaNacimiento: new Date('1990-05-15'),
      telefono: '+593 99 123 4567',
      email: 'maria.garcia@example.com'
    }
  });

  console.log(`✅ Created demo paciente: ${paciente.nombre}`);

  console.log('🌱 Seed completed!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
