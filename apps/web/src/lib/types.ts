export type Role = 'DOCTOR' | 'PATIENT';
export type CallType = 'AUDIO' | 'VIDEO';
export type CallStatus = 'RINGING' | 'ACTIVE' | 'DECLINED' | 'MISSED' | 'ENDED';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  doctor: { id: string; specialty: string } | null;
  patient: { id: string; mrn: string; doctor: { id: string; specialty: string; name: string } } | null;
}

export interface PatientSummary {
  id: string;
  userId: string;
  mrn: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  sex: string;
  conditions: string[];
  activeMedications: number;
  lastMessage: { body: string; createdAt: string } | null;
}

export interface LabResult {
  id: string;
  panel: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL';
  collectedAt: string;
}

export interface ImagingReport {
  id: string;
  modality: string;
  bodyPart: string;
  findings: string;
  impression: string;
  radiologist: string;
  performedAt: string;
}

export interface Prescription {
  id: string;
  drugName: string;
  dosage: string;
  route: string;
  frequency: string;
  durationDays: number | null;
  quantity: number | null;
  refills: number;
  instructions: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'DISCONTINUED';
  startDate: string;
  endDate: string | null;
  createdAt: string;
  prescribedBy: { user: { firstName: string; lastName: string } };
}

export interface PatientProfile {
  id: string;
  mrn: string;
  dateOfBirth: string;
  sex: string;
  phone: string;
  address: string;
  bloodType: string;
  heightCm: number;
  weightKg: number;
  allergies: string[];
  conditions: string[];
  emergencyContact: string;
  user: { id: string; firstName: string; lastName: string; email: string };
  doctor: { id: string; specialty: string; user: { firstName: string; lastName: string } };
  labResults: LabResult[];
  imagingReports: ImagingReport[];
  prescriptions: Prescription[];
}

export interface Message {
  id: string;
  patientId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  sender: { firstName: string; lastName: string; role: Role };
}

export interface CallInfo {
  id: string;
  type: CallType;
  status: CallStatus;
  patientId: string;
  doctorId: string;
  doctorName: string;
  patientName: string;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
}
