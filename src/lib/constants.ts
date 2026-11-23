export const ALGERIAN_STREAMS = [
  // 1st Year Secondary Streams
  { id: 'common_science', name: 'جذع مشترك علوم وتكنولوجيا', level: '1ثا', shortName: 'ج م ع ت' },
  { id: 'common_arts', name: 'جذع مشترك آداب', level: '1ثا', shortName: 'ج م آ' },

  // 2nd & 3rd Year Secondary Streams
  { id: 'exp_sciences', name: 'علوم تجريبية', level: '2ثا/3ثا', shortName: 'علوم تجريبية' },
  { id: 'math', name: 'رياضيات', level: '2ثا/3ثا', shortName: 'رياضيات' },
  { id: 'math_tech', name: 'تقني رياضي', level: '2ثا/3ثا', shortName: 'تقني رياضي' },
  { id: 'management', name: 'تسيير واقتصاد', level: '2ثا/3ثا', shortName: 'تسيير واقتصاد' },
  { id: 'arts_philo', name: 'آداب وفلسفة', level: '2ثا/3ثا', shortName: 'آداب وفلسفة' },
  { id: 'foreign_languages', name: 'لغات أجنبية', level: '2ثا/3ثا', shortName: 'لغات أجنبية' },
  { id: 'arts', name: 'فنون', level: '2ثا/3ثا', shortName: 'فنون' },
];

export const SECONDARY_SUBJECTS = [
  'الرياضيات',
  'العلوم الفيزيائية',
  'علوم الطبيعة والحياة',
  'اللغة العربية وآدابها',
  'اللغة الفرنسية',
  'اللغة الإنجليزية',
  'التاريخ والجغرافيا',
  'العلوم الإسلامية',
  'الفلسفة',
  'إعلام آلي',
  'التسيير المالي والمحاسبي',
  'الاقتصاد والمناجمنت',
  'القانون',
  'الهندسة المدنية',
  'الهندسة الميكانيكية',
  'الهندسة الكهربائية',
  'هندسة الطرائق',
  'اللغة الألمانية',
  'اللغة الإسبانية',
  'اللغة الإيطالية',
  'اللغة الأمازيغية',
  'التربية البدنية والرياضية',
  'فنون (سمعي بصري / موسيقى / مسرح / رسم)'
];

// Official Algerian Secondary School Curriculum Subjects per Stream (حسب المرسوم التربوي الجزائري)
export const OFFICIAL_STREAM_SUBJECTS: Record<string, string[]> = {
  // 1st Year (السنة الأولى ثانوي)
  'common_science': [
    'الرياضيات',
    'العلوم الفيزيائية',
    'علوم الطبيعة والحياة',
    'اللغة العربية وآدابها',
    'العلوم الإسلامية',
    'التاريخ والجغرافيا',
    'اللغة الفرنسية',
    'اللغة الإنجليزية',
    'التكنولوجيا',
    'إعلام آلي',
    'اللغة الأمازيغية',
    'التربية البدنية والرياضية'
  ],
  'common_arts': [
    'اللغة العربية وآدابها',
    'التاريخ والجغرافيا',
    'العلوم الإسلامية',
    'اللغة الفرنسية',
    'اللغة الإنجليزية',
    'الرياضيات',
    'العلوم الفيزيائية',
    'علوم الطبيعة والحياة',
    'إعلام آلي',
    'اللغة الأمازيغية',
    'التربية البدنية والرياضية'
  ],

  // 2nd & 3rd Year (السنة الثانية والثالثة ثانوي)
  'exp_sciences': [
    'علوم الطبيعة والحياة',
    'العلوم الفيزيائية',
    'الرياضيات',
    'اللغة العربية وآدابها',
    'العلوم الإسلامية',
    'التاريخ والجغرافيا',
    'اللغة الفرنسية',
    'اللغة الإنجليزية',
    'الفلسفة',
    'إعلام آلي',
    'اللغة الأمازيغية',
    'التربية البدنية والرياضية'
  ],
  'math': [
    'الرياضيات',
    'العلوم الفيزيائية',
    'علوم الطبيعة والحياة',
    'اللغة العربية وآدابها',
    'العلوم الإسلامية',
    'التاريخ والجغرافيا',
    'اللغة الفرنسية',
    'اللغة الإنجليزية',
    'الفلسفة',
    'إعلام آلي',
    'اللغة الأمازيغية',
    'التربية البدنية والرياضية'
  ],
  'math_tech': [
    'الهندسة المدنية',
    'الهندسة الميكانيكية',
    'الهندسة الكهربائية',
    'هندسة الطرائق',
    'الرياضيات',
    'العلوم الفيزيائية',
    'اللغة العربية وآدابها',
    'العلوم الإسلامية',
    'التاريخ والجغرافيا',
    'اللغة الفرنسية',
    'اللغة الإنجليزية',
    'الفلسفة',
    'إعلام آلي',
    'اللغة الأمازيغية',
    'التربية البدنية والرياضية'
  ],
  'management': [
    'التسيير المالي والمحاسبي',
    'الاقتصاد والمناجمنت',
    'القانون',
    'الرياضيات',
    'التاريخ والجغرافيا',
    'اللغة العربية وآدابها',
    'العلوم الإسلامية',
    'اللغة الفرنسية',
    'اللغة الإنجليزية',
    'الفلسفة',
    'إعلام آلي',
    'اللغة الأمازيغية',
    'التربية البدنية والرياضية'
  ],
  'arts_philo': [
    'اللغة العربية وآدابها',
    'الفلسفة',
    'التاريخ والجغرافيا',
    'العلوم الإسلامية',
    'اللغة الفرنسية',
    'اللغة الإنجليزية',
    'الرياضيات',
    'العلوم الفيزيائية',
    'علوم الطبيعة والحياة',
    'إعلام آلي',
    'اللغة الأمازيغية',
    'التربية البدنية والرياضية'
  ],
  'foreign_languages': [
    'اللغة العربية وآدابها',
    'اللغة الفرنسية',
    'اللغة الإنجليزية',
    'اللغة الألمانية',
    'اللغة الإسبانية',
    'اللغة الإيطالية',
    'الفلسفة',
    'التاريخ والجغرافيا',
    'العلوم الإسلامية',
    'الرياضيات',
    'إعلام آلي',
    'اللغة الأمازيغية',
    'التربية البدنية والرياضية'
  ],
  'arts': [
    'فنون (سمعي بصري / موسيقى / مسرح / رسم)',
    'اللغة العربية وآدابها',
    'الفلسفة',
    'التاريخ والجغرافيا',
    'العلوم الإسلامية',
    'اللغة الفرنسية',
    'اللغة الإنجليزية',
    'الرياضيات',
    'إعلام آلي',
    'التربية البدنية والرياضية'
  ]
};

export function getOfficialSubjectsForStreamName(streamName: string): string[] {
  if (!streamName) return SECONDARY_SUBJECTS;

  const s = streamName.trim();
  if (s.includes('علوم وتكنولوجيا') || s.includes('ج م ع ت')) return OFFICIAL_STREAM_SUBJECTS['common_science'];
  if (s.includes('جذع مشترك آداب') || s.includes('ج م آ')) return OFFICIAL_STREAM_SUBJECTS['common_arts'];

  if (s.includes('تقني') || s.includes('ميكانيك') || s.includes('كهرباء') || s.includes('طرائق') || s.includes('مدنية')) {
    return OFFICIAL_STREAM_SUBJECTS['math_tech'];
  }
  if (s.includes('تسيير') || s.includes('اقتصاد') || s.includes('محاسب')) {
    return OFFICIAL_STREAM_SUBJECTS['management'];
  }
  if (s.includes('تجريبية') || (s.includes('علوم') && !s.includes('إسلامية'))) {
    return OFFICIAL_STREAM_SUBJECTS['exp_sciences'];
  }
  if (s.includes('رياضيات') && !s.includes('تقني')) {
    return OFFICIAL_STREAM_SUBJECTS['math'];
  }
  if (s.includes('فلسفة') || (s.includes('آداب') && !s.includes('لغات'))) {
    return OFFICIAL_STREAM_SUBJECTS['arts_philo'];
  }
  if (s.includes('لغات')) {
    return OFFICIAL_STREAM_SUBJECTS['foreign_languages'];
  }
  if (s.includes('فنون')) {
    return OFFICIAL_STREAM_SUBJECTS['arts'];
  }

  return SECONDARY_SUBJECTS;
}

export function isDemoTeacher(teacher: { id?: string; email?: string; name?: string } | null | undefined): boolean {
  if (!teacher) return false;
  const id = String(teacher.id || '').trim();
  const email = String(teacher.email || '').trim();
  if (id.startsWith('demo_') || id.startsWith('t_demo_')) return true;
  // Match t_1..t_99 or t1..t99 from mock seeds
  if (/^t_?\d{1,3}$/.test(id)) return true;
  if (email.endsWith('@example.com') || email.includes('example.com')) return true;
  return false;
}

