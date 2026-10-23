import '../src/lib/env.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const doctorId = 'demo-doctor';
const patientId = 'demo-patient';
const photoRows = [
  {
    id: 'demo-photo-garden',
    imageUrl: '/placeholders/garden.svg',
    caption: 'A sunny garden with colorful flowers.',
  },
  {
    id: 'demo-photo-tea',
    imageUrl: '/placeholders/tea.svg',
    caption: 'A warm cup of tea on a table.',
  },
  {
    id: 'demo-photo-birds',
    imageUrl: '/placeholders/birds.svg',
    caption: 'Two small birds sitting on a branch.',
  },
  {
    id: 'demo-photo-window',
    imageUrl: '/placeholders/window.svg',
    caption: 'A bright window looking out at green trees.',
  },
];

function scenesFor(photoId: string, caption: string) {
  return JSON.stringify([
    {
      photoId,
      narration: caption,
      recallQuestion: 'What can you see?',
      expectedAnswer: caption,
      answerOptions: [caption, 'A blue bicycle', 'A snowy mountain'],
    },
  ]);
}

async function main() {
  const doctorPasswordHash = await bcrypt.hash('demo-doctor', 10);
  const patientPasswordHash = await bcrypt.hash('demo-patient', 10);

  await prisma.user.upsert({
    where: { email: 'doctor@demo.local' },
    update: { passwordHash: doctorPasswordHash, role: 'DOCTOR' },
    create: {
      id: doctorId,
      email: 'doctor@demo.local',
      passwordHash: doctorPasswordHash,
      role: 'DOCTOR',
    },
  });

  await prisma.patient.upsert({
    where: { id: patientId },
    update: { name: 'Demo Patient', createdByDoctorId: doctorId },
    create: {
      id: patientId,
      name: 'Demo Patient',
      createdByDoctorId: doctorId,
    },
  });

  await prisma.user.upsert({
    where: { email: 'patient@demo.local' },
    update: { passwordHash: patientPasswordHash, role: 'PATIENT', patientId },
    create: {
      id: 'demo-patient-login',
      email: 'patient@demo.local',
      passwordHash: patientPasswordHash,
      role: 'PATIENT',
      patientId,
    },
  });

  for (const photo of photoRows) {
    await prisma.photo.upsert({
      where: { id: photo.id },
      update: { ...photo, patientId },
      create: { ...photo, patientId },
    });
  }

  const storyRows = [
    {
      id: 'demo-story-draft',
      title: 'A Morning in the Garden',
      prompt: 'Create a gentle story about noticing the garden.',
      status: 'DRAFT',
      scenesJson: scenesFor(photoRows[0].id, photoRows[0].caption),
      approvedAt: null,
      assignedAt: null,
    },
    {
      id: 'demo-story-approved',
      title: 'A Quiet Cup of Tea',
      prompt: 'Create a calm story about a cup of tea.',
      status: 'APPROVED',
      scenesJson: scenesFor(photoRows[1].id, photoRows[1].caption),
      approvedAt: new Date('2026-01-01T10:00:00.000Z'),
      assignedAt: null,
    },
    {
      id: 'demo-story-assigned',
      title: 'Birds by the Window',
      prompt: 'Create a short story about birds near a window.',
      status: 'ASSIGNED',
      scenesJson: scenesFor(photoRows[2].id, photoRows[2].caption),
      approvedAt: new Date('2026-01-01T10:00:00.000Z'),
      assignedAt: new Date('2026-01-02T10:00:00.000Z'),
    },
  ];

  for (const story of storyRows) {
    await prisma.story.upsert({
      where: { id: story.id },
      update: { ...story, patientId },
      create: { ...story, patientId },
    });
  }
}

main()
  .then(() => console.log('Seeded fictional Memoria demo data.'))
  .finally(async () => prisma.$disconnect());
