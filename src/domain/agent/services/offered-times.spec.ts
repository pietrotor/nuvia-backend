import { clockTimes, unofferedTimes } from './offered-times';

describe('clockTimes', () => {
  it('reads times with and without a leading zero', () => {
    expect(clockTimes('Tengo 9:00 y 17:30 libres')).toEqual(['09:00', '17:30']);
  });

  it('lists each time once', () => {
    expect(clockTimes('A las 15:00, o 15:00 si preferís')).toEqual(['15:00']);
  });

  it('ignores numbers that are not a time of day', () => {
    expect(clockTimes('Son 150 Bs y dura 60 minutos, el 10/08')).toEqual([]);
  });
});

describe('unofferedTimes', () => {
  const offerable = ['09:00', '12:00', '15:00', '17:00'];

  it('lets through an answer that only names times a tool returned', () => {
    const answer =
      'Hoy tengo *09:00*, *12:00* y *15:00*. ¿Cuál te queda mejor?';

    expect(unofferedTimes(answer, offerable)).toEqual([]);
  });

  // The message that reached a client: the free window expanded into a grid, including
  // starts that no longer fit before closing.
  it('catches the times the model filled in between the real ones', () => {
    const answer = [
      'Los otros horarios disponibles son:',
      '- 10:15',
      '- 12:00',
      '- 17:45',
    ].join('\n');

    expect(unofferedTimes(answer, offerable)).toEqual(['10:15', '17:45']);
  });

  it('reads the times out of whatever the tool sent, ranges included', () => {
    expect(unofferedTimes('De 09:00 a 18:00', ['09:00 a 18:00'])).toEqual([]);
  });

  it('stays out of the way when no tool spoke about the schedule', () => {
    expect(unofferedTimes('Te espero a las 17:45', [])).toEqual([]);
  });
});
