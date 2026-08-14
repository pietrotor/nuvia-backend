import { Professional } from '@domain/professionals/entities/professional.entity';

import { ProfessionalResponseDto } from './professional-response.dto';

const professionalWith = (avatarStorageKey: string | null): Professional =>
  new Professional({
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: '22222222-2222-2222-2222-222222222222',
    name: 'Valeria',
    isActive: true,
    avatarStorageKey,
    avatarMimeType: avatarStorageKey ? 'image/png' : null,
  });

describe('ProfessionalResponseDto', () => {
  it('returns no avatar path when none was uploaded', () => {
    expect(ProfessionalResponseDto.from(professionalWith(null)).avatarUrl).toBe(
      null,
    );
  });

  it('stamps the avatar path with a version so it can be cached', () => {
    const { avatarUrl } = ProfessionalResponseDto.from(
      professionalWith('tenants/t/professionals/p/a.png'),
    );

    expect(avatarUrl).toMatch(
      /^\/api\/v1\/professionals\/11111111-1111-1111-1111-111111111111\/avatar\?v=[0-9a-f]{12}$/,
    );
  });

  it('changes the version when the photo changes', () => {
    const first = ProfessionalResponseDto.from(
      professionalWith('tenants/t/professionals/p/a.png'),
    );
    const second = ProfessionalResponseDto.from(
      professionalWith('tenants/t/professionals/p/b.png'),
    );

    expect(second.avatarUrl).not.toBe(first.avatarUrl);
  });

  it('keeps the storage key out of the path', () => {
    const storageKey = 'tenants/t/professionals/p/secret-name.png';

    expect(
      ProfessionalResponseDto.from(professionalWith(storageKey)).avatarUrl,
    ).not.toContain('secret-name');
  });
});
