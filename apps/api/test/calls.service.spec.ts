import { ConflictException } from '@nestjs/common';
import { AuthUser } from '../src/auth/auth-user';
import { CallsService } from '../src/calls/calls.service';

const doctor: AuthUser = { userId: 'u-doc', role: 'DOCTOR', doctorId: 'doc-1' };
const patient: AuthUser = { userId: 'u-p1', role: 'PATIENT', patientId: 'p1' };

const callRow = (overrides = {}) => ({
  id: 'call-1',
  patientId: 'p1',
  doctorId: 'doc-1',
  type: 'VIDEO',
  status: 'RINGING',
  meetingId: 'm-1',
  createdAt: new Date(),
  answeredAt: null,
  endedAt: null,
  doctor: { userId: 'u-doc', user: { firstName: 'Maya', lastName: 'Ellington' } },
  patient: { userId: 'u-p1', user: { firstName: 'Ava', lastName: 'Quinn' } },
  ...overrides,
});

function setup() {
  const prisma = {
    call: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn().mockResolvedValue(callRow()),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    patient: { findUniqueOrThrow: jest.fn().mockResolvedValue({ mrn: 'MRN-1' }) },
    doctor: { findUniqueOrThrow: jest.fn().mockResolvedValue({ user: { firstName: 'Maya', lastName: 'Ellington' } }) },
  };
  const access = { assertAccess: jest.fn().mockResolvedValue({}) };
  const realtime = { publishToUsers: jest.fn() };
  const rtk = {
    createMeeting: jest.fn().mockResolvedValue('m-1'),
    addParticipant: jest.fn().mockResolvedValue('rtk-token'),
    presetFor: jest.fn().mockReturnValue('preset'),
  };
  const service = new CallsService(prisma as never, access as never, realtime as never, rtk as never);
  return { service, prisma, access, realtime, rtk };
}

describe('CallsService', () => {
  it('lets a doctor start a call and rings the patient', async () => {
    const { service, realtime, rtk } = setup();
    const result = await service.initiate(doctor, 'p1', 'VIDEO');
    expect(result.authToken).toBe('rtk-token');
    expect(rtk.createMeeting).toHaveBeenCalled();
    expect(realtime.publishToUsers).toHaveBeenCalledWith(['u-p1'], 'call:incoming', expect.objectContaining({ id: 'call-1' }));
  });

  it('refuses to start a call when the patient tries', async () => {
    const { service, rtk } = setup();
    await expect(service.initiate(patient, 'p1', 'AUDIO')).rejects.toThrow('Only doctors can start calls');
    expect(rtk.createMeeting).not.toHaveBeenCalled();
  });

  it('refuses a second concurrent call', async () => {
    const { service, prisma } = setup();
    prisma.call.findFirst.mockResolvedValue(callRow({ status: 'ACTIVE' }));
    await expect(service.initiate(doctor, 'p1', 'AUDIO')).rejects.toThrow(ConflictException);
  });

  it('only lets the patient accept, issuing them a participant token', async () => {
    const { service, prisma } = setup();
    prisma.call.findUnique.mockResolvedValue(callRow());
    prisma.call.findUniqueOrThrow.mockResolvedValue(callRow({ status: 'ACTIVE' }));
    const res = await service.accept(patient, 'call-1');
    expect(res.authToken).toBe('rtk-token');
    expect(res.call.status).toBe('ACTIVE');
    await expect(service.accept(doctor, 'call-1')).rejects.toThrow('Only the patient can answer');
  });

  it('hides calls from users who are not participants', async () => {
    const { service, prisma } = setup();
    prisma.call.findUnique.mockResolvedValue(callRow());
    const stranger: AuthUser = { userId: 'u-p2', role: 'PATIENT', patientId: 'p2' };
    await expect(service.end(stranger, 'call-1')).rejects.toThrow('Call not found');
  });

  it('marks an unanswered call as missed when cancelled', async () => {
    const { service, prisma, realtime } = setup();
    prisma.call.findUnique.mockResolvedValue(callRow());
    prisma.call.findUniqueOrThrow.mockResolvedValue(callRow({ status: 'MISSED' }));
    const res = await service.end(doctor, 'call-1');
    expect(prisma.call.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'MISSED' }) }),
    );
    expect(res.status).toBe('MISSED');
    expect(realtime.publishToUsers).toHaveBeenCalledWith(['u-doc', 'u-p1'], 'call:ended', expect.anything());
  });
});
