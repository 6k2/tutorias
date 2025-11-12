import { buildTeacherProfile } from '../../teacherProfile';

describe('@unit create teacher profile', () => {
  it('trims fields, filters empty subjects, and attaches a timestamp', () => {
    const data = {
      uid: '  teacher-1 ',
      displayName: '  Profe Demonstración ',
      subjects: [' Matemáticas  ', '', 'Física', null],
      bio: '  Apasionado por enseñar. ',
    };

    const profile = buildTeacherProfile(data);

    expect(profile.uid).toBe('teacher-1');
    expect(profile.displayName).toBe('Profe Demonstración');
    expect(profile.bio).toBe('Apasionado por enseñar.');
    expect(profile.subjects).toEqual(['Matemáticas', 'Física']);
    expect(typeof profile.createdAt).toBe('number');
    expect(profile.createdAt).toBeGreaterThan(0);
  });

  it('throws when required fields are missing or invalid', () => {
    expect(() =>
      buildTeacherProfile({ uid: '', displayName: 'Docente', subjects: [] })
    ).toThrow('uid is required');

    expect(() =>
      buildTeacherProfile({ uid: 'teacher-2', displayName: '   ', subjects: [] })
    ).toThrow('displayName is required');

    expect(() =>
      buildTeacherProfile({ uid: 'teacher-3', displayName: 'Docente', subjects: null })
    ).toThrow('subjects must be an array');
  });
});
