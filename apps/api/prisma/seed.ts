/* eslint-disable no-console */
/**
 * Seeds fictional demo data: 2 doctors, 20 patients each, with labs,
 * imaging reports, medication history and a few starter messages.
 * Deterministic (seeded PRNG) so every environment gets the same data.
 * All names and records are fictional.
 */
import { LabFlag, Prisma, PrismaClient, Sex } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';

// mulberry32 PRNG
let seed = 20261106;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const int = (min: number, max: number) => Math.floor(between(min, max + 1));
const sample = <T>(arr: readonly T[], n: number): T[] => [...arr].sort(() => rand() - 0.5).slice(0, n);
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

const FEMALE_NAMES = ['Ava', 'Priya', 'Sofia', 'Grace', 'Lena', 'Maria', 'Hana', 'Chloe', 'Nora', 'Zara', 'Ines', 'Ruth', 'Leah', 'Mei', 'Amara', 'Clara', 'Ivy', 'Elena', 'Freya', 'Yara'];
const MALE_NAMES = ['Liam', 'Arjun', 'Mateo', 'Noah', 'Kenji', 'Omar', 'Lucas', 'Ethan', 'Samuel', 'Felix', 'Ravi', 'Hugo', 'Isaac', 'Tomas', 'Jonah', 'Elias', 'Kofi', 'Leo', 'Marcus', 'Theo'];
const LAST_NAMES = ['Anderson', 'Bennett', 'Castillo', 'Dubois', 'Eriksen', 'Fernandez', 'Gupta', 'Hartley', 'Ibrahim', 'Jensen', 'Kowalski', 'Lindqvist', 'Moreau', 'Nakamura', 'Okafor', 'Petrov', 'Quinn', 'Rossi', 'Sato', 'Thornton', 'Ueda', 'Valdez', 'Whitaker', 'Xu', 'Yilmaz', 'Zimmer', 'Abbott', 'Brennan', 'Costa', 'Delgado', 'Ellison', 'Fischer', 'Garcia', 'Holm', 'Iyer', 'Jovanovic', 'Keller', 'Larsen', 'Mendes', 'Novak'];
const STREETS = ['Maple Ave', 'Oak Street', 'Cedar Lane', 'Birch Road', 'Willow Way', 'Elm Court', 'Pine Drive', 'Harbor View', 'Sunset Blvd', 'Riverside Dr'];
const CITIES = ['Springfield', 'Riverton', 'Lakeside', 'Fairview', 'Brookfield'];
const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const ALLERGIES = ['Penicillin', 'Sulfa drugs', 'Latex', 'Peanuts', 'Shellfish', 'Aspirin', 'Codeine', 'Iodinated contrast'];

const GP_CONDITIONS = ['Hypertension', 'Type 2 diabetes', 'Hyperlipidemia', 'Asthma', 'Hypothyroidism', 'GERD', 'Seasonal allergies', 'Migraine', 'Anxiety', 'Osteoarthritis'];
const SURGICAL_CONDITIONS = ['Inguinal hernia', 'Cholelithiasis', 'Appendicitis (post-op)', 'Umbilical hernia', 'Lipoma', 'Pilonidal cyst', 'Hemorrhoids', 'Post-cholecystectomy follow-up', 'Thyroid nodule', 'Diverticulitis'];

interface MedTemplate { drugName: string; dosage: string; route: string; frequency: string; durationDays?: number; instructions?: string }
const GP_MEDS: MedTemplate[] = [
  { drugName: 'Lisinopril', dosage: '10 mg', route: 'Oral', frequency: 'Once daily', instructions: 'Monitor blood pressure at home.' },
  { drugName: 'Metformin', dosage: '500 mg', route: 'Oral', frequency: 'Twice daily with meals' },
  { drugName: 'Atorvastatin', dosage: '20 mg', route: 'Oral', frequency: 'Once daily at bedtime' },
  { drugName: 'Levothyroxine', dosage: '50 mcg', route: 'Oral', frequency: 'Once daily before breakfast', instructions: 'Take on an empty stomach.' },
  { drugName: 'Albuterol', dosage: '90 mcg/puff', route: 'Inhaled', frequency: 'Every 4-6 hours as needed' },
  { drugName: 'Omeprazole', dosage: '20 mg', route: 'Oral', frequency: 'Once daily before breakfast', durationDays: 56 },
  { drugName: 'Amlodipine', dosage: '5 mg', route: 'Oral', frequency: 'Once daily' },
  { drugName: 'Cetirizine', dosage: '10 mg', route: 'Oral', frequency: 'Once daily', durationDays: 30 },
  { drugName: 'Amoxicillin', dosage: '500 mg', route: 'Oral', frequency: 'Three times daily', durationDays: 7, instructions: 'Complete the full course.' },
  { drugName: 'Sertraline', dosage: '50 mg', route: 'Oral', frequency: 'Once daily' },
];
const SURGICAL_MEDS: MedTemplate[] = [
  { drugName: 'Paracetamol', dosage: '1 g', route: 'Oral', frequency: 'Every 6 hours as needed', durationDays: 10, instructions: 'Max 4 g per day.' },
  { drugName: 'Ibuprofen', dosage: '400 mg', route: 'Oral', frequency: 'Every 8 hours with food', durationDays: 7 },
  { drugName: 'Cefalexin', dosage: '500 mg', route: 'Oral', frequency: 'Four times daily', durationDays: 7 },
  { drugName: 'Tramadol', dosage: '50 mg', route: 'Oral', frequency: 'Every 6 hours as needed', durationDays: 5, instructions: 'May cause drowsiness.' },
  { drugName: 'Enoxaparin', dosage: '40 mg', route: 'Subcutaneous', frequency: 'Once daily', durationDays: 14 },
  { drugName: 'Ondansetron', dosage: '4 mg', route: 'Oral', frequency: 'Every 8 hours as needed', durationDays: 5 },
  { drugName: 'Docusate sodium', dosage: '100 mg', route: 'Oral', frequency: 'Twice daily', durationDays: 14 },
  { drugName: 'Mupirocin 2% ointment', dosage: 'Thin layer', route: 'Topical', frequency: 'Three times daily', durationDays: 10, instructions: 'Apply to incision site.' },
  { drugName: 'Metronidazole', dosage: '500 mg', route: 'Oral', frequency: 'Three times daily', durationDays: 7 },
  { drugName: 'Pantoprazole', dosage: '40 mg', route: 'Oral', frequency: 'Once daily', durationDays: 28 },
];

interface LabTemplate { panel: string; testName: string; unit: string; low: number; high: number; decimals: number }
const LABS: LabTemplate[] = [
  { panel: 'Complete Blood Count', testName: 'Hemoglobin', unit: 'g/dL', low: 12, high: 17.5, decimals: 1 },
  { panel: 'Complete Blood Count', testName: 'White Blood Cells', unit: 'x10^9/L', low: 4, high: 11, decimals: 1 },
  { panel: 'Complete Blood Count', testName: 'Platelets', unit: 'x10^9/L', low: 150, high: 400, decimals: 0 },
  { panel: 'Basic Metabolic Panel', testName: 'Glucose (fasting)', unit: 'mg/dL', low: 70, high: 99, decimals: 0 },
  { panel: 'Basic Metabolic Panel', testName: 'Creatinine', unit: 'mg/dL', low: 0.6, high: 1.3, decimals: 2 },
  { panel: 'Basic Metabolic Panel', testName: 'Sodium', unit: 'mmol/L', low: 135, high: 145, decimals: 0 },
  { panel: 'Basic Metabolic Panel', testName: 'Potassium', unit: 'mmol/L', low: 3.5, high: 5.1, decimals: 1 },
  { panel: 'Lipid Panel', testName: 'Total Cholesterol', unit: 'mg/dL', low: 125, high: 200, decimals: 0 },
  { panel: 'Lipid Panel', testName: 'LDL Cholesterol', unit: 'mg/dL', low: 0, high: 100, decimals: 0 },
  { panel: 'Lipid Panel', testName: 'HDL Cholesterol', unit: 'mg/dL', low: 40, high: 90, decimals: 0 },
  { panel: 'Endocrine', testName: 'HbA1c', unit: '%', low: 4, high: 5.6, decimals: 1 },
  { panel: 'Endocrine', testName: 'TSH', unit: 'mIU/L', low: 0.4, high: 4, decimals: 2 },
  { panel: 'Liver Function', testName: 'ALT', unit: 'U/L', low: 7, high: 56, decimals: 0 },
  { panel: 'Liver Function', testName: 'Bilirubin (total)', unit: 'mg/dL', low: 0.1, high: 1.2, decimals: 1 },
];

interface ImagingTemplate { modality: string; bodyPart: string; findings: string[]; impression: string[] }
const GP_IMAGING: ImagingTemplate[] = [
  { modality: 'X-Ray', bodyPart: 'Chest (PA & lateral)', findings: ['Lungs are clear bilaterally. No pleural effusion or pneumothorax. Cardiomediastinal silhouette within normal limits.', 'Mild peribronchial thickening. No focal consolidation. Heart size normal.'], impression: ['No acute cardiopulmonary process.', 'Findings may reflect reactive airway disease; clinical correlation advised.'] },
  { modality: 'Ultrasound', bodyPart: 'Thyroid', findings: ['Thyroid gland normal in size with homogeneous echotexture. No discrete nodules.', 'Small 4 mm hypoechoic nodule in right lobe without suspicious features.'], impression: ['Normal thyroid ultrasound.', 'Small benign-appearing nodule; routine follow-up in 12 months.'] },
  { modality: 'X-Ray', bodyPart: 'Right knee', findings: ['Mild joint space narrowing in the medial compartment with small osteophytes.', 'No fracture or dislocation. Joint spaces preserved.'], impression: ['Mild degenerative changes consistent with early osteoarthritis.', 'No acute osseous abnormality.'] },
  { modality: 'ECG', bodyPart: 'Heart', findings: ['Normal sinus rhythm at 72 bpm. Normal axis. No ST-T changes.', 'Sinus rhythm, borderline left ventricular hypertrophy by voltage criteria.'], impression: ['Normal ECG.', 'Possible LVH; consider echocardiogram.'] },
];
const SURGICAL_IMAGING: ImagingTemplate[] = [
  { modality: 'Ultrasound', bodyPart: 'Abdomen (RUQ)', findings: ['Multiple mobile echogenic foci within the gallbladder with posterior acoustic shadowing. Wall thickness 2 mm. CBD 4 mm.', 'Status post cholecystectomy. No fluid collection. CBD 5 mm.'], impression: ['Cholelithiasis without sonographic evidence of acute cholecystitis.', 'Expected post-surgical appearance.'] },
  { modality: 'CT', bodyPart: 'Abdomen & pelvis with contrast', findings: ['Appendix measures 11 mm with periappendiceal fat stranding. No abscess.', 'Sigmoid diverticulosis with mild pericolic fat stranding. No free air or abscess.'], impression: ['Findings consistent with acute uncomplicated appendicitis.', 'Mild acute uncomplicated sigmoid diverticulitis.'] },
  { modality: 'Ultrasound', bodyPart: 'Inguinal region', findings: ['Reducible fat-containing hernia through the right inguinal canal with Valsalva.', 'No hernia identified at rest or with Valsalva.'], impression: ['Right indirect inguinal hernia.', 'No sonographic evidence of inguinal hernia.'] },
  { modality: 'X-Ray', bodyPart: 'Chest (pre-operative)', findings: ['Lungs clear. Heart size normal. No pleural effusion.'], impression: ['No contraindication to surgery identified on chest radiograph.'] },
  { modality: 'MRI', bodyPart: 'Soft tissue, back', findings: ['Well-circumscribed 3.2 cm fat-signal lesion in the subcutaneous tissue without enhancing septations.'], impression: ['Findings consistent with simple lipoma.'] },
];
const RADIOLOGISTS = ['Dr. Helen Marsh (Radiology)', 'Dr. Victor Lam (Radiology)', 'Dr. Ana Rivera (Radiology)'];

const DOCTORS = [
  { email: 'doctor1@clinic.test', firstName: 'Maya', lastName: 'Ellington', specialty: 'General Physician', licenseNumber: 'GP-100245', conditions: GP_CONDITIONS, meds: GP_MEDS, imaging: GP_IMAGING },
  { email: 'doctor2@clinic.test', firstName: 'Rohan', lastName: 'Castell', specialty: 'General Surgeon', licenseNumber: 'GS-200381', conditions: SURGICAL_CONDITIONS, meds: SURGICAL_MEDS, imaging: SURGICAL_IMAGING },
];

const PATIENTS_PER_DOCTOR = 20;

function labValue(t: LabTemplate): { value: string; flag: LabFlag } {
  const span = t.high - t.low;
  const roll = rand();
  let v: number;
  let flag: LabFlag = 'NORMAL';
  if (roll < 0.12) { v = t.high + span * between(0.05, 0.4); flag = 'HIGH'; }
  else if (roll < 0.2 && t.low > 0) { v = t.low - span * between(0.05, 0.3); flag = 'LOW'; }
  else if (roll < 0.22) { v = t.high + span * between(0.8, 1.5); flag = 'CRITICAL'; }
  else v = between(t.low + span * 0.1, t.high - span * 0.1);
  return { value: Math.max(v, 0).toFixed(t.decimals), flag };
}

async function main() {
  console.log('Clearing existing data...');
  await prisma.$transaction([
    prisma.call.deleteMany(),
    prisma.message.deleteMany(),
    prisma.prescription.deleteMany(),
    prisma.imagingReport.deleteMany(),
    prisma.labResult.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.doctor.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  let patientNo = 0;
  const lastNames = sample(LAST_NAMES, LAST_NAMES.length);

  for (const d of DOCTORS) {
    const doctorUser = await prisma.user.create({
      data: {
        email: d.email,
        passwordHash,
        role: 'DOCTOR',
        firstName: d.firstName,
        lastName: d.lastName,
        doctor: { create: { specialty: d.specialty, licenseNumber: d.licenseNumber } },
      },
      include: { doctor: true },
    });
    const doctorId = doctorUser.doctor!.id;

    for (let i = 0; i < PATIENTS_PER_DOCTOR; i++) {
      patientNo++;
      const sex: Sex = rand() < 0.5 ? 'FEMALE' : 'MALE';
      const firstName = pick(sex === 'FEMALE' ? FEMALE_NAMES : MALE_NAMES);
      const lastName = lastNames[patientNo - 1];
      const age = int(19, 84);
      const dob = new Date(Date.UTC(new Date().getFullYear() - age, int(0, 11), int(1, 28)));
      const conditions = sample(d.conditions, int(1, 3));

      const patientUser = await prisma.user.create({
        data: {
          email: `patient${patientNo}@clinic.test`,
          passwordHash,
          role: 'PATIENT',
          firstName,
          lastName,
          patient: {
            create: {
              doctorId,
              mrn: `MRN-${String(100000 + patientNo * 37).padStart(6, '0')}`,
              dateOfBirth: dob,
              sex,
              phone: `(555) ${int(200, 899)}-${String(int(0, 9999)).padStart(4, '0')}`,
              address: `${int(10, 980)} ${pick(STREETS)}, ${pick(CITIES)}`,
              bloodType: pick(BLOOD_TYPES),
              heightCm: sex === 'FEMALE' ? int(152, 178) : int(162, 192),
              weightKg: sex === 'FEMALE' ? int(48, 95) : int(58, 115),
              allergies: rand() < 0.45 ? [] : sample(ALLERGIES, int(1, 2)),
              conditions,
              emergencyContact: `${pick([...FEMALE_NAMES, ...MALE_NAMES])} ${lastName} - (555) ${int(200, 899)}-${String(int(0, 9999)).padStart(4, '0')}`,
            },
          },
        },
        include: { patient: true },
      });
      const patientId = patientUser.patient!.id;

      // Labs: 2-3 draws, a subset of tests each time
      const labs: Prisma.LabResultCreateManyInput[] = [];
      for (let draw = 0; draw < int(2, 3); draw++) {
        const collectedAt = daysAgo(draw * int(60, 120) + int(3, 20));
        for (const t of sample(LABS, int(6, 10))) {
          const { value, flag } = labValue(t);
          labs.push({
            patientId,
            panel: t.panel,
            testName: t.testName,
            value,
            unit: t.unit,
            referenceRange: `${t.low}-${t.high}`,
            flag,
            collectedAt,
          });
        }
      }
      await prisma.labResult.createMany({ data: labs });

      // Imaging: 1-2 reports
      const imaging = sample(d.imaging, int(1, 2)).map((t) => {
        const variant = int(0, t.findings.length - 1);
        return {
          patientId,
          modality: t.modality,
          bodyPart: t.bodyPart,
          findings: t.findings[variant],
          impression: t.impression[Math.min(variant, t.impression.length - 1)],
          radiologist: pick(RADIOLOGISTS),
          performedAt: daysAgo(int(10, 400)),
        };
      });
      await prisma.imagingReport.createMany({ data: imaging });

      // Medication history: a mix of active, completed and discontinued
      const meds = sample(d.meds, int(2, 4)).map((m, idx) => {
        const startDate = daysAgo(int(5, 500));
        const status = idx === 0 ? 'ACTIVE' : pick(['ACTIVE', 'COMPLETED', 'COMPLETED', 'DISCONTINUED'] as const);
        const endDate = m.durationDays
          ? new Date(startDate.getTime() + m.durationDays * 86_400_000)
          : status === 'ACTIVE' ? null : daysAgo(int(1, 4));
        return {
          patientId,
          prescribedById: doctorId,
          drugName: m.drugName,
          dosage: m.dosage,
          route: m.route,
          frequency: m.frequency,
          durationDays: m.durationDays ?? null,
          quantity: m.durationDays ? int(10, 60) : 30,
          refills: m.durationDays ? 0 : int(0, 5),
          instructions: m.instructions ?? null,
          status: m.durationDays && endDate && endDate < new Date() && status === 'ACTIVE' ? 'COMPLETED' : status,
          startDate,
          endDate,
        } satisfies Prisma.PrescriptionCreateManyInput;
      });
      await prisma.prescription.createMany({ data: meds });

      // A short starter conversation for some patients
      if (i % 3 === 0) {
        const t0 = daysAgo(int(1, 6)).getTime();
        await prisma.message.createMany({
          data: [
            { patientId, senderId: doctorUser.id, body: `Hi ${firstName}, your recent lab results are in. Let me know if you have any questions.`, createdAt: new Date(t0), readAt: new Date(t0 + 60_000) },
            { patientId, senderId: patientUser.id, body: 'Thank you, Doctor. Should I continue my current medication?', createdAt: new Date(t0 + 3_600_000), readAt: new Date(t0 + 4_000_000) },
            { patientId, senderId: doctorUser.id, body: 'Yes, please continue as prescribed. We will review at your next visit.', createdAt: new Date(t0 + 7_200_000) },
          ],
        });
      }
    }
    console.log(`Seeded Dr. ${d.firstName} ${d.lastName} (${d.email}) with ${PATIENTS_PER_DOCTOR} patients`);
  }

  console.log(`\nDone. All accounts use password: ${PASSWORD}`);
  console.log('Doctors: doctor1@clinic.test (patients 1-20), doctor2@clinic.test (patients 21-40)');
  console.log('Patients: patient1@clinic.test ... patient40@clinic.test');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
