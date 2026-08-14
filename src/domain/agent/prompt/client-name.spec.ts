import { promptClientName } from './client-name';

describe('promptClientName', () => {
  it('greets by first name only', () => {
    expect(promptClientName('Pietro Torrico')).toBe('Pietro');
  });

  it('keeps a name the way it was written', () => {
    expect(promptClientName('María José')).toBe('María');
  });

  it('drops the placeholder the webhook invents without a profile name', () => {
    expect(promptClientName('Cliente 1998')).toBe('');
  });

  it('drops a name that is really a phone number', () => {
    expect(promptClientName('+591 69531998')).toBe('');
  });

  it('skips emoji and decorations before the actual name', () => {
    expect(promptClientName('🌸 Ana 🌸')).toBe('Ana');
  });

  it('has nothing to greet with when the name is missing', () => {
    expect(promptClientName(null)).toBe('');
    expect(promptClientName('   ')).toBe('');
  });

  it('ignores a single token too long to be a first name', () => {
    expect(promptClientName('Distribuidoraeimportadoranacional')).toBe('');
  });
});
