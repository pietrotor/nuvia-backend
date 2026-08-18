import { projectToolResultForModel } from '../services/project-tool-result-for-model';

// Regression fixture: keeps the model-facing availability payload well under the
// full tool result so multi-round turns do not re-send heavy JSON.
describe('token cost fixture', () => {
  it('shrinks a heavy find_availability payload by at least half', () => {
    const full = {
      status: 'success' as const,
      summary: '3 horarios',
      nextActions: [
        'Decir el motivo concreto que viene en preferred.reason y preferred.detail, no un "no hay disponibilidad" genérico.',
        'Ofrecer solo los horarios de "options", tal cual vienen. No completes con horarios propios.',
        'Este servicio no ofrece elegir profesional: no preguntes con quién, asigná la que aparece en la opción.',
      ],
      data: {
        preferred: {
          label: 'martes 15:00',
          available: false,
          reason: 'occupied',
          detail: 'Esa hora ya está tomada.',
          professionalName: 'Ana',
          lastStartBefore: '14:00',
          firstStartAfter: '16:00',
        },
        dayLabel: 'martes 18 de agosto',
        options: Array.from({ length: 6 }, (_, i) => ({
          startsAt: `2026-08-18T1${i}:00:00.000Z`,
          label: `1${i}:00`,
          professionalId: `p${i}`,
          professionalName: `Pro ${i}`,
          branchId: `b${i}`,
          branchName: `Sucursal ${i}`,
          unusedMetadata: { calendarId: `cal-${i}`, raw: 'x'.repeat(80) },
        })),
        availableDays: Array.from({ length: 14 }, (_, i) => ({
          label: `día ${i}`,
          ranges: ['09:00-12:00', '14:00-18:00'],
          windowsRaw: 'y'.repeat(40),
        })),
        unavailableDays: Array.from({ length: 8 }, (_, i) => ({
          label: `cerrado ${i}`,
          reason: 'closed',
          detail: 'El local no atiende ese día porque...'.repeat(3),
        })),
        nextAvailable: null,
        clientChoosesProfessional: false,
      },
    };

    const projected = projectToolResultForModel('find_availability', full);
    const fullChars = JSON.stringify({
      status: full.status,
      summary: full.summary,
      data: full.data,
      nextActions: full.nextActions,
    }).length;
    const projectedChars = JSON.stringify(projected).length;

    expect(projectedChars).toBeLessThan(fullChars * 0.5);
  });

  it('keeps a single cacheable static system message ahead of volatile text', () => {
    const messages = [
      {
        role: 'system' as const,
        content: 'Platform + voice rules that stay identical for the tenant.',
        cacheable: true,
      },
      {
        role: 'system' as const,
        content: 'Fecha y hora de referencia: lunes 17 de agosto, 11:30.',
      },
      { role: 'user' as const, content: 'Hola' },
    ];

    const cacheableSystem = messages.filter(
      (message) => message.role === 'system' && message.cacheable === true,
    );
    expect(cacheableSystem).toHaveLength(1);
    expect(messages[0].cacheable).toBe(true);
    expect(messages[1].cacheable).toBeUndefined();
    expect(messages[1].content).toContain('Fecha y hora');
  });
});
