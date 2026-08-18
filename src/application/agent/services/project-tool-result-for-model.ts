import { AgentToolResult } from '../tools/agent-tool';

// What the model needs for the next round: status, a one-line summary, and only the
// fields it must copy into a later tool call. Full payloads stay in agent_traces.
export function projectToolResultForModel(
  name: string,
  result: AgentToolResult,
): Record<string, unknown> {
  const projected: Record<string, unknown> = {
    status: result.status,
    summary: result.summary,
  };

  const data = slimData(name, result.data);
  if (data !== undefined) {
    projected.data = data;
  }

  if (result.nextActions?.length) {
    projected.nextActions = result.nextActions.slice(0, 2);
  }

  return projected;
}

function slimData(name: string, data: unknown): unknown {
  if (data == null) return undefined;

  switch (name) {
    case 'find_availability':
      return slimAvailability(data);
    case 'list_services':
      return slimList(data, [
        'id',
        'name',
        'durationMinutes',
        'price',
        'requiresDeposit',
        'professionalNames',
        'branchNames',
      ]);
    case 'list_professionals':
      return slimList(data, [
        'id',
        'name',
        'workingDays',
        'branchNames',
        'branchName',
      ]);
    case 'list_branches':
      return slimList(data, ['id', 'name', 'address', 'mapsUrl']);
    case 'list_my_appointments':
      return slimList(data, [
        'appointmentId',
        'service',
        'professional',
        'startsAt',
        'status',
        'branchId',
        'branchName',
      ]);
    case 'book_appointment':
    case 'reschedule_appointment':
    case 'cancel_appointment':
    case 'set_branch':
    case 'resend_deposit_qr':
    case 'request_handoff':
      return data;
    case 'get_business_info':
      return slimBusinessInfo(data);
    default:
      return data;
  }
}

function slimAvailability(data: unknown): unknown {
  if (!isRecord(data)) return data;

  if (data.mode === 'choose_day_and_period') {
    return {
      mode: data.mode,
      requestedPeriod: data.requestedPeriod ?? null,
      days: Array.isArray(data.days) ? data.days.slice(0, 7) : [],
      unavailableDays: slimUnavailableDays(data.unavailableDays),
      nextAvailable: data.nextAvailable ?? null,
      clientChoosesProfessional: data.clientChoosesProfessional,
    };
  }

  if (data.mode === 'show_day_schedule') {
    return {
      mode: data.mode,
      dayLabel: data.dayLabel,
      requestedPeriod: data.requestedPeriod ?? null,
      segments: Array.isArray(data.segments) ? data.segments : [],
      availableOtherPeriods: Array.isArray(data.availableOtherPeriods)
        ? data.availableOtherPeriods
        : [],
      alternativeDays: Array.isArray(data.alternativeDays)
        ? data.alternativeDays.slice(0, 7)
        : [],
      unavailableDays: slimUnavailableDays(data.unavailableDays),
      nextAvailable: data.nextAvailable ?? null,
      clientChoosesProfessional: data.clientChoosesProfessional,
    };
  }

  return {
    mode: data.mode ?? 'resolve_exact_time',
    preferred: data.preferred ?? null,
    dayLabel: data.dayLabel ?? null,
    options: Array.isArray(data.options)
      ? data.options.map((option) => {
          if (!isRecord(option)) return option;
          return {
            startsAt: option.startsAt,
            label: option.label,
            professionalId: option.professionalId,
            professionalName: option.professionalName,
            branchId: option.branchId,
            branchName: option.branchName,
          };
        })
      : [],
    unavailableDays: slimUnavailableDays(data.unavailableDays),
    nextAvailable: data.nextAvailable ?? null,
    clientChoosesProfessional: data.clientChoosesProfessional,
  };
}

function slimUnavailableDays(data: unknown): unknown[] {
  return Array.isArray(data)
    ? data.slice(0, 5).map((day) => {
        if (!isRecord(day)) return day;
        return {
          label: day.label,
          reason: day.reason,
          detail: day.detail,
        };
      })
    : [];
}

function slimBusinessInfo(data: unknown): unknown {
  if (!isRecord(data)) return data;
  const branch = isRecord(data.branch)
    ? {
        id: data.branch.id,
        name: data.branch.name,
        address: data.branch.address,
        mapsUrl: data.branch.mapsUrl,
        weeklyHours: data.branch.weeklyHours,
      }
    : data.branch;
  return {
    branch,
    branches: data.branches,
    bookingPolicy: data.bookingPolicy,
    faq: data.faq,
  };
}

function slimList(data: unknown, keys: string[]): unknown {
  if (!Array.isArray(data)) return data;
  return data.map((row) => {
    if (!isRecord(row)) return row;
    const next: Record<string, unknown> = {};
    for (const key of keys) {
      if (row[key] !== undefined) next[key] = row[key];
    }
    return next;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
