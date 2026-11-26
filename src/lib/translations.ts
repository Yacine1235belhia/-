export type AppLanguage = 'ar' | 'fr' | 'en';
export type AppTheme = 'dark' | 'light';

type TranslationPair = {
  fr: string;
  en: string;
};

// Exact Arabic -> French & English dictionary covering the entire application UI
export const TRANSLATIONS: Record<string, TranslationPair> = {
  // Brand & Global
  'Hirasa Pro': { fr: 'Hirasa Pro', en: 'Hirasa Pro' },
  'نظام إدارة الحراسة الذكي': { fr: 'Système Intelligent de Gestion des Surveillances', en: 'Smart Exam Proctoring Management System' },
  'نظام إدارة الاختبارات': { fr: 'Système de Gestion des Examens', en: 'Exam Management System' },
  'نظام إدارة الاختبارات والحراسة - Hirasa Pro': { fr: 'Gestion des Examens & Surveillances - Hirasa Pro', en: 'Exam & Proctoring System - Hirasa Pro' },
  'الجمهورية الجزائرية الديمقراطية الشعبية': { fr: 'République Algérienne Démocratique et Populaire', en: "People's Democratic Republic of Algeria" },
  'وزارة التربية الوطنية': { fr: "Ministère de l'Éducation Nationale", en: 'Ministry of National Education' },
  'الجمهورية الجزائرية الديمقراطية الشعبية - وزارة التربية الوطنية': { fr: "République Algérienne Démocratique et Populaire - Ministère de l'Éducation Nationale", en: "People's Democratic Republic of Algeria - Ministry of National Education" },

  // Navigation & Tabs
  'القائمة الرئيسية': { fr: 'Menu principal', en: 'Main Menu' },
  'معلومات المؤسسة': { fr: "Infos de l'établissement", en: 'Institution Info' },
  'جداول الاختبارات': { fr: 'Planning des examens', en: 'Exam Schedules' },
  'إعداد قاعات الامتحان': { fr: "Salles d'examen", en: 'Exam Rooms' },
  'ضبط جداول حراسة الأساتذة': { fr: 'Surveillances des enseignants', en: 'Proctoring Schedules' },
  'مجالس الأقسام': { fr: 'Conseils de classe', en: 'Class Councils' },
  'الإعدادات': { fr: 'Paramètres', en: 'Settings' },

  // Top Header, Save & Offline Status
  'حفظ البيانات': { fr: 'Enregistrer', en: 'Save Data' },
  'حفظ البيانات (تغييرات غير محفوظة)': { fr: 'Enregistrer (modifications non sauvegardées)', en: 'Save Data (unsaved changes)' },
  'تم الحفظ': { fr: 'Enregistré', en: 'Saved' },
  'جاري الحفظ...': { fr: 'Enregistrement...', en: 'Saving...' },
  'إفراغ التطبيق': { fr: "Vider l'application", en: 'Clear App' },
  'إفراغ التطبيق ومسح المحفوظ': { fr: "Vider l'application et effacer les données", en: 'Clear App & Saved Data' },
  'العودة إلى تطبيق خالٍ تماماً': { fr: 'Revenir à une application entièrement vide', en: 'Reset to a completely empty workspace' },
  'هل أنت متأكد من مسح جميع البيانات الحالية والمحفوظة (الأساتذة، التلاميذ، القاعات، الأفواج، الاختبارات، والحراسة) ليصبح التطبيق خالياً بالكامل؟': {
    fr: "Êtes-vous sûr de vouloir effacer toutes les données actuelles et enregistrées (enseignants, élèves, salles, groupes, examens et surveillances) ?",
    en: 'Are you sure you want to delete all current and saved data (teachers, students, rooms, cohorts, exams, and proctoring) to reset the app completely?'
  },
  'نعم، إفراغ التطبيق بالكامل': { fr: 'Oui, tout effacer', en: 'Yes, clear everything' },
  'جاري الإفراغ...': { fr: 'Suppression...', en: 'Clearing...' },
  'تنبيه: التعديلات الحالية مؤقتة وستُمسح تلقائياً عند تحديث الصفحة أو الخروج ما لم تضغط على «حفظ البيانات».': {
    fr: 'Attention : les modifications actuelles sont temporaires et seront perdues au rechargement sauf si vous cliquez sur « Enregistrer ».',
    en: 'Warning: current changes are temporary and will be lost on reload unless you click "Save Data".'
  },
  'وضع عدم الاتصال — يتم العمل والحفظ محلياً بدون إنترنت': {
    fr: 'Mode hors ligne — travail et sauvegarde en local sans internet',
    en: 'Offline mode — working and saving locally without internet'
  },
  'جاري تهيئة بيئة العمل والتحقق من البيانات المحفوظة...': {
    fr: "Initialisation de l'espace de travail...",
    en: 'Initializing workspace and checking saved data...'
  },
  'عادت الشبكة — تمت مزامنة البيانات المحفوظة تلقائياً': {
    fr: 'Connexion rétablie — données synchronisées automatiquement',
    en: 'Back online — saved data synced automatically'
  },
  'أنت الآن في وضع عدم الاتصال — سيتم الحفظ محلياً بدون إنترنت': {
    fr: 'Vous êtes hors ligne — sauvegarde locale activée',
    en: 'You are now offline — changes will be saved locally'
  },
  'تم حفظ جميع البيانات بنجاح! لن تُفقد عند التحديث أو الإغلاق.': {
    fr: 'Toutes les données ont été enregistrées avec succès !',
    en: 'All data saved successfully! It will persist across refreshes.'
  },
  'تم الحفظ محلياً (بدون إنترنت)! ستبقى بياناتك محفوظة عند التحديث أو الإغلاق.': {
    fr: 'Enregistré localement (hors ligne) ! Vos données sont conservées.',
    en: 'Saved locally (offline)! Your data will persist across refreshes.'
  },
  'تم مسح المحفوظ وإفراغ التطبيق بالكامل': {
    fr: "Données effacées et application réinitialisée",
    en: 'Saved data cleared and app reset'
  },
  'تعذر إتمام عملية الحفظ': { fr: "Impossible d'enregistrer les données", en: 'Failed to save data' },
  'حدث خطأ أثناء إفراغ التطبيق': { fr: "Erreur lors de la réinitialisation", en: 'Error clearing the application' },

  // Roles
  'مدير': { fr: 'Directeur', en: 'Director' },
  'المدير': { fr: 'Le Directeur', en: 'Director' },
  'ناظر': { fr: 'Censeur', en: 'Vice Principal' },
  'الناظر': { fr: 'Le Censeur', en: 'Vice Principal' },
  'مستشار التربية': { fr: "Conseiller d'éducation", en: 'Education Advisor' },
  'مدير النظام': { fr: 'Administrateur système', en: 'System Role' },

  // Preferences / Settings Page
  'إعدادات التطبيق والمظهر واللغة': { fr: "Paramètres de l'application, thème et langue", en: 'App Settings, Appearance & Language' },
  'تخصيص مظهر التطبيق (الوضع الليلي أو النهاري) وتبديل لغة الواجهة بالكامل': {
    fr: "Personnalisez le thème (sombre ou clair) et changez la langue de toute l'application",
    en: 'Customize app appearance (Dark or Light mode) and translate the entire interface'
  },
  'مظهر التطبيق': { fr: "Apparence de l'application", en: 'App Appearance' },
  'اختر بين الوضع الليلي أو الوضع النهاري': { fr: 'Choisissez entre le mode sombre et le mode clair', en: 'Choose between Dark Mode and Light Mode' },
  'الوضع الليلي': { fr: 'Mode sombre', en: 'Dark Mode' },
  'الوضع النهاري': { fr: 'Mode clair', en: 'Light Mode' },
  'خلفية داكنة مريحة للعين': { fr: 'Thème sombre reposant pour les yeux', en: 'Comfortable dark obsidian interface' },
  'خلفية فاتحة واضحة للنهار': { fr: 'Thème clair lumineux et lisible', en: 'Crisp bright daylight interface' },
  'لغة التطبيق': { fr: "Langue de l'application", en: 'Application Language' },
  'ترجمة فورية لجميع عناصر وقوائم التطبيق': {
    fr: "Traduction instantanée de tous les éléments de l'application",
    en: 'Instant translation of all application elements'
  },
  'العربية': { fr: 'العربية (Arabe)', en: 'العربية (Arabic)' },
  'الفرنسية': { fr: 'Français', en: 'French' },
  'الإنجليزية': { fr: 'English (Anglais)', en: 'English' },
  'مفعّل': { fr: 'Activé', en: 'Active' },
  'تم تفعيل الوضع النهاري': { fr: 'Mode clair activé', en: 'Light mode enabled' },
  'تم تفعيل الوضع الليلي': { fr: 'Mode sombre activé', en: 'Dark mode enabled' },

  // Institution Settings Page
  'إعداد المؤسسة': { fr: "Configuration de l'établissement", en: 'Institution Configuration' },
  'بيانات التعريف ورتبة مستعمل التطبيق': { fr: "Informations d'identification et rôle de l'utilisateur", en: 'Institution details and system user role' },
  'قم بإدخال معلومات المؤسسة وتحديد رتبة مدير النظام': {
    fr: "Saisissez les informations de l'établissement et le rôle du gestionnaire",
    en: 'Enter institution details and select system administrator role'
  },
  'اسم المؤسسة *': { fr: "Nom de l'établissement *", en: 'Institution Name *' },
  'البلدية': { fr: 'Commune', en: 'Municipality' },
  'مديرية التربية لولاية': { fr: "Direction de l'Éducation de la Wilaya", en: 'Education Directorate (Wilaya)' },
  'الموسم الدراسي': { fr: 'Année scolaire', en: 'School Year' },
  'الفصل الدراسي الحالي': { fr: 'Trimestre actuel', en: 'Current Term' },
  'الفصل الأول': { fr: '1er Trimestre', en: '1st Term' },
  'الفصل الثاني': { fr: '2e Trimestre', en: '2nd Term' },
  'الفصل الثالث': { fr: '3e Trimestre', en: '3rd Term' },
  'تاريخ بداية الاختبارات (أول يوم)': { fr: 'Date de début des examens', en: 'Exam Start Date' },
  'تاريخ نهاية الاختبارات (آخر يوم)': { fr: 'Date de fin des examens', en: 'Exam End Date' },
  'اختيار السنوات / المستويات المعنية بالامتحان': { fr: 'Sélection des niveaux concernés', en: 'Select Exam Grade Levels' },
  'حفظ المعلومات': { fr: 'Enregistrer les informations', en: 'Save Settings' },
  'تحديد توقيت الاختبارات والحراسة': { fr: 'Horaires des examens et de surveillance', en: 'Exam & Proctoring Timings' },
  'توقيت موحد للكل': { fr: 'Horaire unifié pour tous', en: 'Unified Schedule' },
  'توقيت منفصل حسب المستوى': { fr: 'Horaire séparé par niveau', en: 'Separate Timing per Level' },
  'مزامنة التوقيت الآن': { fr: 'Synchroniser les horaires', en: 'Sync Timings Now' },
  'جاري التنفيذ...': { fr: 'En cours...', en: 'Processing...' },
  'حصة الاختبار 1 (صباحاً)': { fr: 'Séance 1 (Matin)', en: 'Morning Session 1' },
  'حصة الاختبار 2 (اختياري)': { fr: 'Séance 2 (Optionnel)', en: 'Morning Session 2 (Optional)' },
  'الفترة الصباحية (للحراسة)': { fr: 'Période du matin (surveillance)', en: 'Morning Period (Proctoring)' },
  'الفترة المسائية (للحراسة)': { fr: 'Période après-midi (surveillance)', en: 'Afternoon Period (Proctoring)' },
  'إدراج حصة مسائية تلقائياً في جدول الاختبارات': { fr: "Ajouter automatiquement une séance d'après-midi", en: 'Automatically include afternoon exam slot' },
  'إدراج حصة مسائية في جدول الاختبارات': { fr: "Inclure une séance d'après-midi", en: 'Include afternoon exam slot' },
  'توقيت الحصة المسائية:': { fr: "Horaire de l'après-midi :", en: 'Afternoon slot:' },
  'قوالب سريعة لفصل توقيت المستويات:': { fr: 'Modèles rapides par niveau :', en: 'Quick level timing presets:' },
  '1و2 ثا (08:00 - 10:00) • 3 ثا (10:00 - 12:00)': { fr: '1ère & 2e AS (08:00-10:00) • 3e AS (10:00-12:00)', en: '1st & 2nd Yr (08:00-10:00) • 3rd Yr (10:00-12:00)' },
  'إرجاع حصتين لكل مستوى': { fr: 'Rétablir 2 séances par niveau', en: 'Restore 2 slots per level' },
  'الحصة الصباحية 1': { fr: 'Séance matin 1', en: 'Morning Slot 1' },
  'الحصة 2 (اختياري)': { fr: 'Séance 2 (opt.)', en: 'Slot 2 (optional)' },
  'فارغ لحصة واحدة': { fr: 'Vide = 1 séance', en: 'Empty for 1 slot' },
  'صباحي (الحراسة)': { fr: 'Matin (Surveillance)', en: 'Morning (Proctoring)' },
  'مسائي (الحراسة)': { fr: 'Après-midi (Surv.)', en: 'Afternoon (Proctoring)' },
  'أدوات تجربة النظام والنسخ الاحتياطي': { fr: 'Outils de test et données démo', en: 'System Testing & Demo Tools' },
  'بيانات تجريبية (Seed Data)': { fr: 'Données de démonstration', en: 'Demo Data (Seed Data)' },
  'ملء النظام بأساتذة وقاعات واختبارات افتراضية مسبقاً': {
    fr: 'Remplir le système avec des enseignants, salles et examens de test',
    en: 'Populate the system with sample teachers, rooms, and exams'
  },
  'إضافة بيانات تجريبية': { fr: 'Ajouter données démo', en: 'Add Demo Data' },
  'مسح البيانات': { fr: 'Effacer les données', en: 'Clear Data' },
  'جاري إضافة البيانات التجريبية...': { fr: 'Ajout des données de démo...', en: 'Adding demo data...' },
  'تم إضافة البيانات التجريبية بنجاح': { fr: 'Données de démo ajoutées avec succès', en: 'Demo data added successfully' },
  'تم مسح البيانات بنجاح': { fr: 'Données effacées avec succès', en: 'Data cleared successfully' },
  'تم حفظ معلومات المؤسسة ومزامنة توقيت الاختبارات والحراسة بنجاح': {
    fr: "Informations de l'établissement enregistrées et horaires synchronisés",
    en: 'Institution settings saved and timings synchronized'
  },

  // Grade Levels & Streams
  'السنة الأولى ثانوي (1 ثا)': { fr: '1ère Année Secondaire (1 AS)', en: '1st Year Secondary (1 AS)' },
  'السنة الثانية ثانوي (2 ثا)': { fr: '2ème Année Secondaire (2 AS)', en: '2nd Year Secondary (2 AS)' },
  'السنة الثالثة ثانوي (3 ثا)': { fr: '3ème Année Secondaire (3 AS)', en: '3rd Year Secondary (3 AS)' },
  'السنة الثالثة (تجريبي)': { fr: '3ème Année (Bac Blanc)', en: '3rd Year (Mock Bac)' },
  'السنة الثالثة (بكالوريا تجريبي)': { fr: '3ème Année (Bac Blanc)', en: '3rd Year (Mock Bac)' },
  'السنة الأولى (1 ثا)': { fr: '1ère Année (1 AS)', en: '1st Year (1 AS)' },
  'السنة الثانية (2 ثا)': { fr: '2ème Année (2 AS)', en: '2nd Year (2 AS)' },
  'السنة الثالثة (3 ثا)': { fr: '3ème Année (3 AS)', en: '3rd Year (3 AS)' },
  'السنة الأولى': { fr: '1ère Année', en: '1st Year' },
  'السنة الثانية': { fr: '2ème Année', en: '2nd Year' },
  'السنة الثالثة': { fr: '3ème Année', en: '3rd Year' },
  'السنة الأولى ثانوي': { fr: '1ère Année Secondaire', en: '1st Year Secondary' },
  'السنة الثانية ثانوي': { fr: '2ème Année Secondaire', en: '2nd Year Secondary' },
  'السنة الثالثة ثانوي': { fr: '3ème Année Secondaire', en: '3rd Year Secondary' },
  'السنوات الأولى والثانية': { fr: '1ère & 2ème Années', en: '1st & 2nd Years' },
  'السنوات الأولى والثانية (1 و 2 ثا)': { fr: '1ère & 2ème Années (1 & 2 AS)', en: '1st & 2nd Years (1 & 2 AS)' },
  'امتحان البكالوريا التجريبي': { fr: 'Examen du Baccalauréat Blanc', en: 'Mock Baccalaureate Exam' },
  '🎓 امتحان البكالوريا التجريبي (السنة 3)': { fr: '🎓 Baccalauréat Blanc (3e Année)', en: '🎓 Mock Baccalaureate (3rd Year)' },
  'كل السنوات': { fr: 'Tous les niveaux', en: 'All Years' },
  '1 و 2 ثا فقط': { fr: '1 & 2 AS uniquement', en: '1st & 2nd Yr only' },
  'التجريبي فقط': { fr: 'Bac Blanc uniquement', en: 'Mock Bac only' },
  'جميع المستويات': { fr: 'Tous les niveaux', en: 'All Levels' },
  'جميع المستويات (1ثا + 2ثا + 3ثا)': { fr: 'Tous les niveaux (1AS + 2AS + 3AS)', en: 'All Levels (1AS + 2AS + 3AS)' },
  'جميع الشعب': { fr: 'Toutes les filières', en: 'All Streams' },
  'جميع الشعب المعنية': { fr: 'Toutes les filières concernées', en: 'All concerned streams' },
  'شامل (كلا الطورين)': { fr: 'Complet (tous cycles)', en: 'All Cycles' },

  // Streams
  'أولى جذع مشترك علوم وتكنولوجيا': { fr: '1AS Tronc Commun Sciences & Technologie', en: '1AS Common Core Science & Technology' },
  'أولى جذع مشترك آداب': { fr: '1AS Tronc Commun Lettres', en: '1AS Common Core Arts & Humanities' },
  'ج م ع ت': { fr: 'TC Sciences', en: 'CC Science' },
  'ج م آ': { fr: 'TC Lettres', en: 'CC Arts' },
  'علوم تجريبية': { fr: 'Sciences Expérimentales', en: 'Experimental Sciences' },
  'رياضيات': { fr: 'Mathématiques', en: 'Mathematics' },
  'تقني رياضي': { fr: 'Technique Mathématique', en: 'Technical Mathematics' },
  'تسيير واقتصاد': { fr: 'Gestion et Économie', en: 'Management & Economics' },
  'آداب وفلسفة': { fr: 'Lettres et Philosophie', en: 'Literature & Philosophy' },
  'لغات أجنبية': { fr: 'Langues Étrangères', en: 'Foreign Languages' },
  'فنون': { fr: 'Arts', en: 'Arts' },
  'ثانية علوم تجريبية': { fr: '2AS Sciences Expérimentales', en: '2AS Experimental Sciences' },
  'ثانية رياضيات': { fr: '2AS Mathématiques', en: '2AS Mathematics' },
  'ثانية تقني رياضي': { fr: '2AS Technique Mathématique', en: '2AS Technical Math' },
  'ثانية تسيير واقتصاد': { fr: '2AS Gestion et Économie', en: '2AS Management & Economics' },
  'ثانية آداب وفلسفة': { fr: '2AS Lettres et Philosophie', en: '2AS Literature & Philosophy' },
  'ثانية لغات أجنبية': { fr: '2AS Langues Étrangères', en: '2AS Foreign Languages' },
  'ثانية فنون': { fr: '2AS Arts', en: '2AS Arts' },
  'ثالثة علوم تجريبية': { fr: '3AS Sciences Expérimentales', en: '3AS Experimental Sciences' },
  'ثالثة رياضيات': { fr: '3AS Mathématiques', en: '3AS Mathematics' },
  'ثالثة تقني رياضي': { fr: '3AS Technique Mathématique', en: '3AS Technical Math' },
  'ثالثة تسيير واقتصاد': { fr: '3AS Gestion et Économie', en: '3AS Management & Economics' },
  'ثالثة آداب وفلسفة': { fr: '3AS Lettres et Philosophie', en: '3AS Literature & Philosophy' },
  'ثالثة لغات أجنبية': { fr: '3AS Langues Étrangères', en: '3AS Foreign Languages' },
  'ثالثة فنون': { fr: '3AS Arts', en: '3AS Arts' },

  // Days & Periods
  'الأحد': { fr: 'Dimanche', en: 'Sunday' },
  'الإثنين': { fr: 'Lundi', en: 'Monday' },
  'الثلاثاء': { fr: 'Mardi', en: 'Tuesday' },
  'الأربعاء': { fr: 'Mercredi', en: 'Wednesday' },
  'الخميس': { fr: 'Jeudi', en: 'Thursday' },
  'الجمعة': { fr: 'Vendredi', en: 'Friday' },
  'السبت': { fr: 'Samedi', en: 'Saturday' },
  'صباح': { fr: 'Matin', en: 'Morning' },
  'صباحاً': { fr: 'Matin', en: 'Morning' },
  'صباحي': { fr: 'Matin', en: 'Morning' },
  'صباحية': { fr: 'Matinée', en: 'Morning' },
  'مساء': { fr: 'Après-midi', en: 'Afternoon' },
  'مساءً': { fr: 'Après-midi', en: 'Afternoon' },
  'مسائي': { fr: 'Après-midi', en: 'Afternoon' },
  'مسائية': { fr: 'Après-midi', en: 'Afternoon' },

  // Subjects
  'اللغة العربية وآدابها': { fr: 'Langue Arabe et Littérature', en: 'Arabic Language & Literature' },
  'الرياضيات': { fr: 'Mathématiques', en: 'Mathematics' },
  'العلوم الفيزيائية': { fr: 'Sciences Physiques', en: 'Physical Sciences' },
  'علوم الطبيعة والحياة': { fr: 'Sciences de la Nature et de la Vie', en: 'Natural & Life Sciences' },
  'العلوم الإسلامية': { fr: 'Sciences Islamiques', en: 'Islamic Sciences' },
  'التاريخ والجغرافيا': { fr: 'Histoire et Géographie', en: 'History & Geography' },
  'اللغة الفرنسية': { fr: 'Langue Française', en: 'French Language' },
  'اللغة الإنجليزية': { fr: 'Langue Anglaise', en: 'English Language' },
  'الفلسفة': { fr: 'Philosophie', en: 'Philosophy' },
  'الإعلام الآلي': { fr: 'Informatique', en: 'Computer Science' },
  'التكنولوجيا': { fr: 'Technologie', en: 'Technology' },
  'اللغة الأمازيغية': { fr: 'Langue Amazighe', en: 'Amazigh Language' },
  'هندسة مدنية': { fr: 'Génie Civil', en: 'Civil Engineering' },
  'هندسة ميكانيكية': { fr: 'Génie Mécanique', en: 'Mechanical Engineering' },
  'هندسة كهربائية': { fr: 'Génie Électrique', en: 'Electrical Engineering' },
  'هندسة الطرائق': { fr: 'Génie des Procédés', en: 'Process Engineering' },

  // Common Actions & Modals
  'إلغاء': { fr: 'Annuler', en: 'Cancel' },
  'حفظ': { fr: 'Enregistrer', en: 'Save' },
  'حفظ التعديلات': { fr: 'Enregistrer les modifications', en: 'Save Changes' },
  'حفظ التغييرات': { fr: 'Enregistrer les modifications', en: 'Save Changes' },
  'إضافة': { fr: 'Ajouter', en: 'Add' },
  'تعديل': { fr: 'Modifier', en: 'Edit' },
  'حذف': { fr: 'Supprimer', en: 'Delete' },
  'إغلاق': { fr: 'Fermer', en: 'Close' },
  'تأكيد': { fr: 'Confirmer', en: 'Confirm' },
  'نعم': { fr: 'Oui', en: 'Yes' },
  'لا': { fr: 'Non', en: 'No' },
  'بحث': { fr: 'Rechercher', en: 'Search' },
  'الكل': { fr: 'Tous', en: 'All' },
  'متاح': { fr: 'Disponible', en: 'Available' },
  'معفى': { fr: 'Dispensé', en: 'Exempt' },
  'إعفاء': { fr: 'Dispenser', en: 'Exempt' },
  'خروج': { fr: 'Quitter', en: 'Exit' },
  'خروج من الطباعة': { fr: "Quitter l'impression", en: 'Exit Print' },
  'خروج والعودة للتطبيق': { fr: "Quitter et revenir à l'application", en: 'Exit & Return to App' },
  'خروج من الطباعة والعودة إلى التطبيق': { fr: "Quitter l'impression et revenir à l'application", en: 'Exit Print & Return to App' },
  'وضع الطباعة والمعاينة': { fr: "Mode impression et aperçu", en: 'Print & Preview Mode' },
  'إجراءات': { fr: 'Actions', en: 'Actions' },
  'ملاحظات': { fr: 'Remarques', en: 'Notes' },
  'الرقم': { fr: 'N°', en: 'No.' },
  'الاسم واللقب': { fr: 'Nom et Prénom', en: 'Full Name' },
  'التخصص': { fr: 'Spécialité', en: 'Specialty' },
  'التاريخ': { fr: 'Date', en: 'Date' },
  'الفترة': { fr: 'Période', en: 'Period' },
  'التوقيت': { fr: 'Horaire', en: 'Timing' },
  'المدة': { fr: 'Durée', en: 'Duration' },
  'المادة': { fr: 'Matière', en: 'Subject' },
  'القاعة': { fr: 'Salle', en: 'Room' },
  'الحالة': { fr: 'Statut', en: 'Status' },
  'السعة': { fr: 'Capacité', en: 'Capacity' },
  'استيراد إكسل': { fr: 'Importer Excel', en: 'Import Excel' },
  'استيراد Excel': { fr: 'Importer Excel', en: 'Import Excel' },
  'تصدير Excel': { fr: 'Exporter Excel', en: 'Export Excel' },
  'تصدير إكسل': { fr: 'Exporter Excel', en: 'Export Excel' },
  'تصدير PDF': { fr: 'Exporter PDF', en: 'Export PDF' },
  '🖨️ طباعة الآن': { fr: '🖨️ Imprimer maintenant', en: '🖨️ Print Now' },
  'طباعة الآن (Print)': { fr: 'Imprimer maintenant', en: 'Print Now' },
  '🖨️ طباعة الآن (System Print)': { fr: '🖨️ Imprimer maintenant (Système)', en: '🖨️ Print Now (System Print)' },
  '📥 تنزيل كملف PDF مباشر': { fr: '📥 Télécharger en PDF', en: '📥 Download PDF' },
  '📄 تنزيل الوثيقة كملف إلكتروني (.html)': { fr: '📄 Télécharger en fichier (.html)', en: '📄 Download Document (.html)' },
  'طباعة الوثيقة': { fr: 'Imprimer le document', en: 'Print Document' },
  'طباعة القائمة': { fr: 'Imprimer la liste', en: 'Print List' },
  'طباعة الجداول': { fr: 'Imprimer les plannings', en: 'Print Schedules' },
  'طباعة الوثائق الآن (Print)': { fr: 'Imprimer les documents', en: 'Print Documents Now' },
  'طباعة الوثائق فوراً': { fr: 'Imprimer les documents', en: 'Print Documents Now' },

  // ExamsPage
  'جدول الاختبارات': { fr: 'Calendrier des examens', en: 'Exam Timetable' },
  'معاينة وطباعة الرزنامة': { fr: 'Aperçu et impression', en: 'Preview & Print' },
  'معاينة وطباعة جدول سير الاختبارات': { fr: 'Aperçu et impression du calendrier des examens', en: 'Preview & Print Exam Schedule' },
  'الرزنامة الرسمية للجمهورية الجزائرية الديمقراطية الشعبية - وزارة التربية الوطنية': {
    fr: "Calendrier officiel - Ministère de l'Éducation Nationale",
    en: 'Official Schedule - Ministry of National Education'
  },
  'توليد مقترح جدول موحد': { fr: 'Générer un planning proposé', en: 'Auto-Generate Timetable' },
  'إضافة يوم جديد': { fr: 'Ajouter un jour', en: 'Add Day' },
  'إضافة توقيت جديد لليوم': { fr: 'Ajouter un créneau horaire', en: 'Add Time Slot' },
  'إضافة مادة للجدول': { fr: 'Ajouter une matière', en: 'Add Subject' },
  'إدارة المواد': { fr: 'Gérer les matières', en: 'Manage Subjects' },
  'مسح كل الجدول': { fr: 'Vider le calendrier', en: 'Clear Schedule' },
  'مسح جدول سير الاختبارات': { fr: 'Effacer le calendrier des examens', en: 'Clear Exam Schedule' },
  'حفظ وتدوين': { fr: 'Enregistrer', en: 'Save & Record' },
  'نطاق الطباعة:': { fr: "Portée d'impression :", en: 'Print Scope:' },
  'توقيت موحد من معلومات المؤسسة': { fr: "Horaire unifié depuis les paramètres", en: 'Unified timing from settings' },
  'فصل توقيت المستويات: مفعّل ✓': { fr: 'Horaires séparés par niveau : Activé ✓', en: 'Separate level timings: Active ✓' },
  'اليوم والتاريخ': { fr: 'Jour & Date', en: 'Day & Date' },
  'الفترة والتوقيت': { fr: 'Période & Horaire', en: 'Period & Time' },
  'تاريخ بداية الأسبوع:': { fr: 'Date de début :', en: 'Start Date:' },
  'إضافة شعبة / قسم جديد للرزنامة:': { fr: 'Ajouter une filière au calendrier :', en: 'Add stream to schedule:' },

  // HallsPage
  'إعداد قاعات الامتحان وتوزيع الأفواج': { fr: "Configuration des salles d'examen et répartition", en: 'Exam Rooms Setup & Cohort Allocation' },
  'إدارة القاعات، رفع قوائم التلاميذ، التفويج المتوازن، دمج الشعب، وطباعة قوائم المناداة والتعليق': {
    fr: "Gestion des salles, listes d'élèves, répartition équilibrée, fusion et impression des listes d'appel",
    en: 'Manage rooms, student lists, balanced cohorts, stream merging, and printable calling lists'
  },
  'إضافة سريعة: 20 قاعة': { fr: 'Ajout rapide : 20 salles', en: 'Quick Add: 20 Rooms' },
  'تهيئة شاملة': { fr: 'Initialisation complète', en: 'Full Initialize' },
  'استيراد قاعات': { fr: 'Importer des salles', en: 'Import Rooms' },
  'إضافة القاعة': { fr: 'Ajouter la salle', en: 'Add Room' },
  'إضافة قاعة يدوياً': { fr: 'Ajouter une salle manuellement', en: 'Add Room Manually' },
  'اسم القاعة': { fr: 'Nom de la salle', en: 'Room Name' },
  'اسم القاعة *': { fr: 'Nom de la salle *', en: 'Room Name *' },
  'السعة (طالب)': { fr: 'Capacité (élèves)', en: 'Capacity (students)' },
  'السعة الاستيعابية (طالب) *': { fr: "Capacité d'accueil *", en: 'Room Capacity *' },
  'قائمة القاعات والمخابر المعتمدة': { fr: 'Liste des salles et laboratoires', en: 'Registered Exam Rooms & Labs' },
  'مسح جميع القاعات': { fr: 'Supprimer toutes les salles', en: 'Delete All Rooms' },
  'إجمالي التلاميذ': { fr: 'Total élèves', en: 'Total Students' },
  'الذكور': { fr: 'Garçons', en: 'Male' },
  'الإناث': { fr: 'Filles', en: 'Female' },
  'القاعات المطلوبة': { fr: 'Salles requises', en: 'Required Rooms' },
  'رفع ملف التلاميذ (Excel)': { fr: 'Importer élèves (Excel)', en: 'Upload Students (Excel)' },
  'توليد عينة تلاميذ': { fr: 'Générer un échantillon', en: 'Generate Sample Students' },
  'تفويج تلقائي متوازن': { fr: 'Répartition équilibrée auto', en: 'Balanced Auto-Cohort' },
  'ترتيب ألفبائي': { fr: 'Tri alphabétique', en: 'Alphabetical Sort' },
  'ترتيب بالتناوب (ذكر / أنثى)': { fr: 'Alternance (Garçon / Fille)', en: 'Alternate (Male / Female)' },
  'دمج اللغات الأجنبية': { fr: 'Fusionner Langues Étrangères', en: 'Merge Foreign Languages' },
  'دمج الهندسات (تقني رياضي)': { fr: 'Fusionner Tech-Math', en: 'Merge Tech-Math' },
  'فصل المستويات تماماً (عدم الخلط)': { fr: 'Séparer les niveaux strictement', en: 'Strictly Separate Levels' },
  'قائمة المناداة والإمضاء': { fr: "Liste d'appel et émargement", en: 'Calling & Signature List' },
  'ملصق باب القاعة (A4)': { fr: 'Affiche porte de salle (A4)', en: 'Room Door Poster (A4)' },
  'ملصقات المقاعد والطاولات': { fr: 'Étiquettes des tables', en: 'Desk Stickers' },
  'جميع القاعات دفعة واحدة': { fr: 'Toutes les salles', en: 'All Rooms at Once' },
  'وثائق القاعات المطبوعة (قوائم المناداة وملصقات الأبواب)': {
    fr: "Documents imprimables des salles (listes d'appel & affiches)",
    en: 'Printable Room Documents (Calling Lists & Door Posters)'
  },
  'وثائق رسمية مقاس A4 لتعليقها على باب كل قاعة وتسليمها للأساتذة الحراس': {
    fr: 'Documents officiels A4 pour affichage sur porte et remise aux surveillants',
    en: 'Official A4 documents for room doors and proctors'
  },
  'رقم التسجيل': { fr: 'Matricule', en: 'ID Number' },
  'الجنس': { fr: 'Sexe', en: 'Gender' },
  'الشعبة': { fr: 'Filière', en: 'Stream' },
  'القسم': { fr: 'Classe', en: 'Class' },
  'رقم المقعد': { fr: 'Place N°', en: 'Seat No.' },
  'ذكر': { fr: 'Garçon', en: 'Male' },
  'أنثى': { fr: 'Fille', en: 'Female' },
  'قاعة محذوفة': { fr: 'Salle supprimée', en: 'Deleted Room' },
  'غير مفوج': { fr: 'Non affecté', en: 'Unassigned' },

  // AllocationPage (Proctoring)
  'توليد التوزيع الذكي': { fr: 'Générer la répartition', en: 'Smart Auto-Allocate' },
  'توليد التوزيع الذكي الآن': { fr: 'Générer la répartition maintenant', en: 'Generate Allocation Now' },
  'توزيع ذكي وعادل لمواد وقاعات الامتحان مع تحكم كامل بشروط الحراسة والطباعة المباشرة السريعة.': {
    fr: 'Répartition équitable des surveillances par matière et salle avec contrôle complet des règles et impression directe.',
    en: 'Fair smart proctoring distribution with full rule control and direct printing.'
  },
  'شروط وضوابط التوزيع': { fr: 'Règles de répartition', en: 'Allocation Rules' },
  'شروط التوزيع الذكي': { fr: 'Conditions intelligentes', en: 'Smart Constraints' },
  'قائمة الأساتذة': { fr: 'Liste des enseignants', en: 'Teachers List' },
  'تفريغ جدول الحراسة': { fr: 'Vider le planning', en: 'Clear Proctoring' },
  'تفريغ الجدول': { fr: 'Vider le tableau', en: 'Clear Table' },
  'إجمالي الأساتذة': { fr: 'Total enseignants', en: 'Total Teachers' },
  'إجمالي التكليفات': { fr: 'Total surveillances', en: 'Total Duties' },
  'متوسط الحراسات': { fr: 'Moyenne surveillances', en: 'Avg Duties' },
  'متوسط الحراسة / أستاذ': { fr: 'Moyenne / enseignant', en: 'Avg / Teacher' },
  'مؤشر التكافؤ (Min / Max)': { fr: "Indice d'équité (Min / Max)", en: 'Fairness Index (Min / Max)' },
  'عدد الغيابات / الاستثناءات': { fr: 'Absences / Dispenses', en: 'Exemptions / Exceptions' },
  'بطاقات الأساتذة': { fr: 'Cartes enseignants', en: 'Teacher Cards' },
  'الجدول العام الملون': { fr: 'Tableau général coloré', en: 'Color-Coded Master Grid' },
  'جدول القاعات': { fr: 'Planning des salles', en: 'Room Timetable' },
  'قائمة التكليفات': { fr: 'Liste des affectations', en: 'Assignments List' },
  'تخصيص نطاق توليد الحراسة': { fr: 'Portée de génération des surveillances', en: 'Customize Allocation Scope' },
  '1. اختبارات السنوات المعنية بالتوليد:': { fr: '1. Niveaux concernés :', en: '1. Grade levels to allocate:' },
  '2. الأساتذة المشاركون في الحراسة:': { fr: '2. Enseignants participants :', en: '2. Participating teachers:' },
  'تحديد الكل': { fr: 'Tout sélectionner', en: 'Select All' },
  'إلغاء الكل': { fr: 'Tout désélectionner', en: 'Deselect All' },
  'إلغاء التحديد': { fr: 'Désélectionner', en: 'Deselect' },
  'البحث باسم الأستاذ أو مادة التخصص...': { fr: 'Rechercher par nom ou spécialité...', en: 'Search teacher name or specialty...' },
  'بحث عن أستاذ أو مادة تخصص...': { fr: 'Rechercher enseignant ou matière...', en: 'Search teacher or subject...' },
  'حارس احتياط': { fr: 'Surveillant de réserve', en: 'Reserve Proctor' },
  '🛡️ حارس احتياط': { fr: '🛡️ Surveillant de réserve', en: '🛡️ Reserve Proctor' },
  '🛡️ احتياط': { fr: '🛡️ Réserve', en: '🛡️ Reserve' },
  'مركز طباعة وثائق الحراسة المعتمدة (Hirasa Pro v4)': { fr: "Centre d'impression officiel (Hirasa Pro v4)", en: 'Official Proctoring Print Center (Hirasa Pro v4)' },
  'اختر نوع الوثيقة الإدارية المراد طباعتها فوراً': { fr: 'Choisissez le type de document à imprimer', en: 'Select document type to print immediately' },
  '1. استدعاءات الأساتذة': { fr: '1. Convocations enseignants', en: '1. Teacher Convocations' },
  '2. جدول القاعات': { fr: '2. Tableau des salles', en: '2. Room Timetable' },
  '3. الجدول الملون العام': { fr: '3. Tableau général coloré', en: '3. Master Color Grid' },
  '4. محضر الإمضاء اليومي': { fr: '4. Fiche de présence quotidienne', en: '4. Daily Sign-In Sheet' },
  'بدء الطباعة المباشرة الآن': { fr: "Lancer l'impression maintenant", en: 'Start Direct Print Now' },
  'معاينة وطباعة الوثيقة الرسمية': { fr: 'Aperçu et impression du document officiel', en: 'Official Document Preview & Print' },
  'يمكنك الطباعة فوراً أو تنزيل الوثيقة كملف PDF عالي الجودة بنقرة واحدة': {
    fr: 'Imprimez immédiatement ou téléchargez en PDF haute qualité en un clic',
    en: 'Print immediately or download as high-quality PDF in one click'
  },
  'عدد الحراس في كل قاعة:': { fr: 'Surveillants par salle :', en: 'Proctors per room:' },
  'حراس الاحتياط لكل فترة (صباح/مساء):': { fr: 'Réserves par période :', en: 'Reserve proctors per period:' },
  'فترة واحدة يومياً': { fr: '1 séance par jour max', en: 'Max 1 per day' },
  'تجنب مادة التخصص': { fr: 'Éviter sa spécialité', en: 'Avoid own specialty' },
  'إعفاء فترة امتحان المادة': { fr: 'Dispenser durant sa matière', en: 'Exempt during own subject' },
  'يوم راحة للأستاذ': { fr: '1 jour de repos si possible', en: 'One day off if possible' },
  'ضبط وتعديل تكليف الحراسة (Hirasa Pro)': { fr: 'Modifier une affectation (Hirasa Pro)', en: 'Adjust Proctoring Assignment' },
  'إلغاء التكليف وتفريغ الخانة': { fr: "Annuler l'affectation", en: 'Unassign Duty' },
  '🛡️ تحويل إلى حارس احتياط': { fr: '🛡️ Passer en réserve', en: '🛡️ Convert to Reserve' },
  'استبدال بأستاذ متاح آخر (غير مشغول في هذه الفترة):': { fr: 'Remplacer par un autre enseignant disponible :', en: 'Swap with another available teacher:' },

  // TeachersPage
  'قائمة الأساتذة واستثناءات الحراسة': { fr: 'Liste des enseignants et dispenses', en: 'Teachers List & Exemptions' },
  'إدارة بيانات الأساتذة وتخصصاتهم وساعات الحراسة المسندة': {
    fr: 'Gérer les enseignants, spécialités et heures de surveillance',
    en: 'Manage teacher records, specialties, and assigned proctoring hours'
  },
  'بحث عن أستاذ، تخصص، أو سبب إعفاء...': { fr: 'Rechercher enseignant, spécialité ou motif...', en: 'Search teacher, specialty, or exemption...' },
  'إضافة أستاذ': { fr: 'Ajouter enseignant', en: 'Add Teacher' },
  'استيراد الأساتذة': { fr: 'Importer enseignants', en: 'Import Teachers' },
  'إضافة / استيراد إكسل': { fr: 'Ajouter / Importer Excel', en: 'Add / Import Excel' },
  'مسح القائمة': { fr: 'Vider la liste', en: 'Clear List' },
  'حذف الأساتذة التجريبيين': { fr: 'Supprimer enseignants démo', en: 'Delete Demo Teachers' },
  'اسم ولقب الأستاذ': { fr: "Nom et prénom de l'enseignant", en: 'Teacher Full Name' },
  'التخصص / المادة': { fr: 'Spécialité / Matière', en: 'Specialty / Subject' },
  'الأقدمية': { fr: 'Ancienneté', en: 'Seniority' },
  'الحالة / الإعفاء': { fr: 'Statut / Dispense', en: 'Status / Exemption' },
  'ساعات الحراسة المسندة': { fr: 'Heures assignées', en: 'Assigned Hours' },
  'متاح للحراسة': { fr: 'Disponible', en: 'Available' },
  'إلغاء الإعفاء': { fr: 'Lever la dispense', en: 'Remove Exemption' },
  'إعفاء أستاذ من الحراسة': { fr: 'Dispenser un enseignant', en: 'Exempt Teacher' },
  'تأكيد الإعفاء الآن': { fr: 'Confirmer la dispense', en: 'Confirm Exemption' },
  'إغلاق والعودة للتطبيق': { fr: "Fermer et revenir à l'application", en: 'Close & Return to App' },
  'المؤسسة التعليمية:': { fr: 'Établissement :', en: 'Institution:' },
  'مديرية التربية لولاية:': { fr: 'Direction Wilaya :', en: 'Directorate:' },
  'المؤسسة:': { fr: 'Établissement :', en: 'School:' },
  'الولاية:': { fr: 'Wilaya :', en: 'Wilaya:' },
  'الموسم:': { fr: 'Année :', en: 'Year:' },
  'الفصل:': { fr: 'Trimestre :', en: 'Term:' },
  'عدد الحراس': { fr: 'Nombre de surveillants', en: 'Proctor Count' },
  'مسح الكل': { fr: 'Tout effacer', en: 'Clear All' },
  'حذف القاعة': { fr: 'Supprimer la salle', en: 'Delete Room' },
  'إسناد حارس لهذه القاعة': { fr: 'Affecter un surveillant à cette salle', en: 'Assign proctor to this room' },
  'نعم، تفريغ الجدول': { fr: 'Oui, vider le tableau', en: 'Yes, clear schedule' },
  'نعم، مسح جميع القاعات': { fr: 'Oui, tout supprimer', en: 'Yes, delete all rooms' },
  'نعم، تهيئة القاعات': { fr: 'Oui, initialiser', en: 'Yes, initialize' },
  'نعم، مسح كل الجدول بالكامل (جميع المستويات)': { fr: 'Oui, tout effacer', en: 'Yes, clear entire schedule' },
  'عرض أفقي (A4)': { fr: 'Paysage (A4)', en: 'Landscape (A4)' },
  'شبكي (A4)': { fr: 'Grille (A4)', en: 'Grid (A4)' },
  '4 بالورقة (A4)': { fr: '4 par page (A4)', en: '4 per page (A4)' },
  'كشف التوقيعات': { fr: "Feuille d'émargement", en: 'Sign-in sheet' },

  // Additional Modal, Rule, Form, and Toast Strings
  'ضوابط وقواعد التوزيع الآلي للحراسة (وفق معايير Hirasa Pro):': {
    fr: 'Règles de répartition automatique (Normes Hirasa Pro) :',
    en: 'Auto-Allocation Rules (Hirasa Pro Standards):'
  },
  'إخفاء النافذة ✕': { fr: 'Masquer ✕', en: 'Hide ✕' },
  'معاينة وتدقيق قائمة الأساتذة المدرجة': {
    fr: 'Aperçu et vérification de la liste des enseignants',
    en: 'Preview & Verify Teachers List'
  },
  'حذف التجريبيين': { fr: 'Supprimer démo', en: 'Delete Demo' },
  'بيانات تجريبية': { fr: 'Données démo', en: 'Demo Data' },
  'إغلاق النافذة': { fr: 'Fermer la fenêtre', en: 'Close Window' },
  'المعرف / الرقم': { fr: 'ID / Matricule', en: 'ID / Number' },
  'المادة / التخصص': { fr: 'Matière / Spécialité', en: 'Subject / Specialty' },
  'اختر سبب الإعفاء السريع:': { fr: 'Motif rapide de dispense :', en: 'Quick exemption reason:' },
  'أو اكتب السبب / الحجة بالتفصيل:': { fr: 'Ou précisez le motif en détail :', en: 'Or enter detailed reason:' },
  'غائب': { fr: 'Absent', en: 'Absent' },
  'عطلة مرضية': { fr: 'Congé maladie', en: 'Sick Leave' },
  'لديه حجة / مبرر إداري': { fr: 'Justificatif administratif', en: 'Administrative Excuse' },
  'تكوين / تربص': { fr: 'Formation / Stage', en: 'Training / Workshop' },
  'إعفاء إداري': { fr: 'Dispense administrative', en: 'Admin Exemption' },
  'تأكيد تفريغ جدول الحراسة': { fr: 'Confirmer le vidage du planning', en: 'Confirm Clear Proctoring Schedule' },
  'سيتم حذف جميع التكليفات المسندة حالياً': { fr: 'Toutes les affectations actuelles seront supprimées', en: 'All current assignments will be removed' },
  'إسناد تكليف حراسة جديد': { fr: 'Nouvelle affectation de surveillance', en: 'Assign New Proctoring Duty' },
  'لم يتم توليد أي جدول حراسة بعد': { fr: 'Aucun planning généré pour le moment', en: 'No proctoring schedule generated yet' },
  '2. الأساتذة المعنيون بالحراسة:': { fr: '2. Enseignants concernés :', en: '2. Participating Teachers:' },
  'انتقاء من القائمة': { fr: 'Choisir dans la liste', en: 'Select from List' },
  'نمط العرض:': { fr: "Mode d'affichage :", en: 'View Mode:' },
  'تواريخ بداية ونهاية الاختبارات والسنوات المعنية': {
    fr: 'Dates des examens et niveaux concernés',
    en: 'Exam Dates & Concerned Grade Levels'
  },
  'نسبة الحراسة لكل قاعة': { fr: 'Surveillants par salle', en: 'Proctors per Room' },
  'جاري حفظ جميع بيانات التطبيق...': { fr: "Enregistrement de toutes les données...", en: 'Saving all app data...' },
  'جاري إفراغ التطبيق ومسح البيانات المحفوظة...': { fr: "Réinitialisation complète en cours...", en: 'Clearing workspace and saved data...' },
  'تخصيص المواد حسب المستوى والشعبة': {
    fr: 'Personnaliser les matières par niveau et filière',
    en: 'Customize Subjects by Level & Stream'
  },
  'المستوى': { fr: 'Niveau', en: 'Level' },
  'ثالثة': { fr: '3e AS', en: '3rd Yr' },
  'ثانية': { fr: '2e AS', en: '2nd Yr' },
  'أولى': { fr: '1re AS', en: '1st Yr' },
  'جذع مشترك علوم وتكنولوجيا': { fr: 'TC Sciences & Technologie', en: 'Common Core Science & Tech' },
  'جذع مشترك آداب': { fr: 'TC Lettres', en: 'Common Core Arts' },
  'تأكيد مسح بيانات التلاميذ': { fr: 'Confirmer la suppression des élèves', en: 'Confirm Clear Students' },
  'مسح التلاميذ المصفّين في الجدول فقط': { fr: 'Supprimer uniquement les élèves filtrés', en: 'Delete filtered students only' },
  'لا توجد قاعات مضافة حالياً': { fr: 'Aucune salle ajoutée', en: 'No rooms added yet' },
  'قائمة وبيانات التلاميذ المسجلين': { fr: 'Liste des élèves inscrits', en: 'Registered Students List' },
  'إعدادات التفويج وتقسيم الأقسام': { fr: 'Paramètres de répartition en groupes', en: 'Cohort & Group Allocation Settings' },
  'لم يتم إنشاء وتفويج الأقسام بعد': { fr: 'Aucun groupe généré pour le moment', en: 'No cohorts generated yet' },
  'معاينة جداول سير الامتحانات بالقاعات': { fr: 'Aperçu des plannings par salle', en: 'Room Exam Schedules Preview' },
  'الربط التلقائي للهيدر واستعراض كافة الصفوف المستخرجة': {
    fr: 'Détection automatique des colonnes et aperçu des lignes',
    en: 'Auto header mapping and extracted row preview'
  },
  'تنسيق ومعاينة تلقائية للملف:': { fr: 'Détection automatique du fichier :', en: 'Automatic File Detection:' },
  'اختر ورقة العمل (Sheet):': { fr: 'Choisir la feuille (Sheet) :', en: 'Select Worksheet (Sheet):' },
  'سطر العناوين (الهيدر في الملف):': { fr: "Ligne d'en-tête :", en: 'Header Row:' },
  'مطابقة حقول النظام مع أعمدة ملف الإكسل': { fr: 'Correspondance des colonnes Excel', en: 'Map System Fields to Excel Columns' },
  '* مطلوب': { fr: '* Requis', en: '* Required' },
  '-- تجاهل / غير موجود --': { fr: '-- Ignorer / Absent --', en: '-- Ignore / Missing --' },
  'غير محدد': { fr: 'Non défini', en: 'Unspecified' },
  'اختر نطاق المسح المطلوب': { fr: "Choisissez l'étendue à effacer", en: 'Choose clear scope' },
  'استيراد قائمة الأساتذة': { fr: 'Importer la liste des enseignants', en: 'Import Teachers List' },
  'استيراد قائمة التلاميذ': { fr: 'Importer la liste des élèves', en: 'Import Students List' },
  'تصفية حسب الاختبارات المبرمجة فقط': { fr: 'Filtrer sur les examens programmés', en: 'Scheduled exams only' },
  'بحث في قائمة الأساتذة (الاسم، التخصص، الرقم، سبب الإعفاء)...': {
    fr: 'Rechercher enseignant (nom, spécialité, ID, motif)...',
    en: 'Search teachers (name, specialty, ID, reason)...'
  },
  'مثال: عطلة مرضية من 10 إلى 15...': { fr: 'Ex: Congé maladie du 10 au 15...', en: 'e.g., Sick leave from 10th to 15th...' },
  'مثلاً: ثانوية محمد بلخير': { fr: 'Ex: Lycée Mohamed Belkheir', en: 'e.g., Mohamed Belkheir High School' },
  'مثلاً: البيض': { fr: 'Ex: El Bayadh', en: 'e.g., El Bayadh' },
  'استخراج وتوزيع الحراسة الآن': { fr: 'Générer la répartition maintenant', en: 'Generate Allocation Now' },
  'إعادة التوزيع': { fr: 'Régénérer', en: 'Re-allocate' },

  // Auto-Add Teachers & Synced Settings Timings
  'إضافة الأساتذة تلقائياً': { fr: 'Ajout automatique des enseignants', en: 'Auto-Add Teachers' },
  'إخفاء الإضافة التلقائية': { fr: "Masquer l'ajout automatique", en: 'Hide Auto-Add' },
  'توليد صف لكل تخصص': { fr: 'Générer une ligne par matière', en: 'Generate Row per Subject' },
  'تجهيز قائمة نموذجية (12 أستاذ)': { fr: 'Préparer une liste modèle (12)', en: 'Fill Sample Roster (12)' },
  'لصق واستخراج تلقائي (الاسم واللقب + مادة التخصص)': {
    fr: 'Coller et extraire (Nom + Matière)',
    en: 'Paste & Auto-Extract (Full Name + Subject)'
  },
  'التخصص الافتراضي:': { fr: 'Spécialité par défaut :', en: 'Default Subject:' },
  'استخراج تلقائي إلى القائمة': { fr: 'Extraire vers la liste', en: 'Auto-Extract to List' },
  'توليد صفوف تلقائية حسب مادة التخصص': {
    fr: 'Générer des lignes par spécialité',
    en: 'Auto-Generate Rows by Subject'
  },
  'العدد': { fr: 'Nombre', en: 'Count' },
  'صف جديد': { fr: 'Nouvelle ligne', en: 'New Row' },
  'أدخل اسم ولقب الأستاذ...': { fr: 'Nom et prénom...', en: 'Enter full name...' },
  'استبدال القائمة الحالية بالأساتذة الجدد (يُستبعد التجريبيون تلقائياً في كل الأحوال)': {
    fr: 'Remplacer la liste actuelle (les données démo sont toujours exclues)',
    en: 'Replace existing list (demo teachers always excluded)'
  },
  'مرتبط تلقائياً بجدول الاختبارات': { fr: 'Synchronisé avec le planning', en: 'Auto-synced with Exam Schedule' },
  'يتحدّث أول يوم وأيام الأسبوع في جدول الاختبارات مباشرةً عند تغيير هذا التاريخ.': {
    fr: 'Les dates du planning des examens se mettent à jour automatiquement.',
    en: 'Exam schedule dates update automatically when this date changes.'
  },
  'توقيت موحد': { fr: 'Horaire unifié', en: 'Unified Timing' },
  'فصل توقيت المستويات': { fr: 'Séparer par niveau', en: 'Split by Level' },
  'فصل: 1و2ثا (08-10) • 3ثا (10-12)': {
    fr: 'Séparer : 1/2AS (08-10) • 3AS (10-12)',
    en: 'Split: 1st/2nd (08-10) • 3rd (10-12)'
  },
  'فصل السنة 3 (10-12 + 14-16)': {
    fr: 'Séparer 3AS (10-12 + 14-16)',
    en: 'Split 3rd Yr (10-12 + 14-16)'
  },
  '08-10 فقط': { fr: '08-10 seul', en: '08-10 only' },
  '10-12 فقط': { fr: '10-12 seul', en: '10-12 only' },
  '08-10 و 10-12': { fr: '08-10 et 10-12', en: '08-10 & 10-12' },
  'إغلاق نموذج الإضافة': { fr: 'Fermer le formulaire', en: 'Close Add Form' },
  'لا يوجد أساتذة مدرجون حالياً — يمكنك إضافة أستاذ يدوياً، الإضافة تلقائياً، أو استيراد ملف إكسل': {
    fr: 'Aucun enseignant inscrit — ajoutez-en un manuellement, automatiquement ou via Excel',
    en: 'No teachers listed yet — add a teacher manually, auto-add, or import Excel'
  },

  // ClassCouncilsPage
  'تنظيم وبرمجة رزنامة مجالس الأقسام لنهاية الفصل': {
    fr: 'Organisation et planification des conseils de classe',
    en: 'Organize and schedule end-of-term class council meetings'
  },
  'قائمة الأساتذة وإضافة أستاذ (ضبط الحراسة)': {
    fr: 'Liste des enseignants & ajout (Surveillances)',
    en: 'Teachers List & Add Teacher (Proctoring)'
  },
  'توليد رزنامة مقترحة': { fr: 'Générer planning proposé', en: 'Generate Suggested Schedule' },
  'إضافة مجلس قسم': { fr: 'Ajouter conseil de classe', en: 'Add Class Council' },
  'القسم / الشعبة *': { fr: 'Classe / Filière *', en: 'Class / Stream *' },
  'القسم / الشعبة': { fr: 'Classe / Filière', en: 'Class / Stream' },
  'رئيس المجلس': { fr: 'Président du conseil', en: 'Council President' },
  'الأستاذ الرئيسي': { fr: 'Professeur principal', en: 'Head Teacher' },
  'بحث عن قسم، قاعة، أو أستاذ...': { fr: 'Rechercher classe, salle ou enseignant...', en: 'Search class, room, or teacher...' },
  'طباعة الرزنامة': { fr: 'Imprimer le planning', en: 'Print Schedule' },
  'لا توجد جلسات لمجالس الأقسام حالياً': { fr: 'Aucun conseil de classe programmé', en: 'No class council sessions scheduled yet' },
  'يمكنك إضافة جلسة مجلس قسم يدوياً أو توليد رزنامة مقترحة جاهزة لجميع الأقسام بنقرة واحدة.': {
    fr: 'Ajoutez un conseil manuellement ou générez un planning proposé pour toutes les classes en un clic.',
    en: 'Add a class council session manually or auto-generate a schedule for all classes in one click.'
  },
  'تأكيد مسح رزنامة مجالس الأقسام': { fr: 'Confirmer la suppression des conseils', en: 'Confirm Clear Class Councils' },
  'هل تريد مسح جميع جلسات مجالس الأقسام المبرمجة حالياً؟ يمكنك إعادة توليدها لاحقاً في أي وقت.': {
    fr: 'Voulez-vous effacer tous les conseils de classe programmés ? Vous pourrez les régénérer à tout moment.',
    en: 'Clear all scheduled class council sessions? You can regenerate them anytime.'
  },
  'نعم، مسح الكل': { fr: 'Oui, tout effacer', en: 'Yes, Clear All' },
  'تم إضافة مجلس القسم بنجاح': { fr: 'Conseil de classe ajouté avec succès', en: 'Class council added successfully' },
  'تم تحديث موعد مجلس القسم': { fr: 'Conseil de classe mis à jour', en: 'Class council updated' },
  'تم حذف الجلسة': { fr: 'Séance supprimée', en: 'Session deleted' },
  'تم مسح رزنامة مجالس الأقسام': { fr: 'Planning des conseils effacé', en: 'Class councils cleared' },
  'رزنامة مجالس الأقسام': { fr: 'Calendrier des conseils de classe', en: 'Class Councils Schedule' },
  'توقيت ومادة الحراسة:': { fr: 'Horaire et matière de surveillance :', en: 'Proctoring Time & Exam:' },
  'عدد الحراس:': { fr: 'Surveillants :', en: 'Proctors:' },
  'افتراضي (2 حراس)': { fr: 'Par défaut (2 surveillants)', en: 'Default (2 proctors)' },
  '1 حارس (حالة استثنائية)': { fr: '1 surveillant (cas exceptionnel)', en: '1 proctor (exceptional case)' },
  '1 (حارس واحد)': { fr: '1 (un seul)', en: '1 (single)' },
  'حارس واحد': { fr: '1 surveillant', en: '1 proctor' },
  'خطأ في تحديث عدد الحراس': { fr: 'Erreur lors de la mise à jour des surveillants', en: 'Error updating proctor count' },
};

// Fragment translations for JSX interpolated text nodes (e.g. `1. قاعات الامتحان ({count})`)
const FRAGMENT_TRANSLATIONS: Record<string, TranslationPair> = {
  '1. قاعات الامتحان (': { fr: "1. Salles d'examen (", en: '1. Exam Rooms (' },
  '2. رفع التلاميذ والإحصائيات (': { fr: '2. Élèves et statistiques (', en: '2. Students & Stats (' },
  '3. توزيع الأفواج والأقسام (': { fr: '3. Groupes et classes (', en: '3. Cohorts & Classes (' },
  '4. طباعة قوائم المناداة والتعليق': { fr: "4. Impression listes d'appel", en: '4. Printable Calling Lists' },
  'قائمة الأساتذة (': { fr: 'Enseignants (', en: 'Teachers (' },
  'المستوى الحالي (': { fr: 'Niveau actuel (', en: 'Current Level (' },
  'كُلّف بحراسة': { fr: 'Assigné à', en: 'Assigned to' },
  'فترة (': { fr: 'séance(s) (', en: 'duty/duties (' },
  'ساعة إجمالاً)': { fr: 'h au total)', en: 'hrs total)' },
  'حراسات مسندة': { fr: 'surveillances', en: 'duties' },
  'متاح من أصل': { fr: 'disponibles sur', en: 'available out of' },
  'اختبار مبرمج': { fr: 'examen(s) prévu(s)', en: 'scheduled exam(s)' },
  'تحديد كل المتاحين (': { fr: 'Tout sélectionner (', en: 'Select All Available (' },
  'الاختبارات المختارة:': { fr: 'Examens sélectionnés :', en: 'Selected Exams:' },
  'الأساتذة المختارون:': { fr: 'Enseignants sélectionnés :', en: 'Selected Teachers:' },
  'إجمالي الأساتذة المعتمدين لحساب وتوزيع الحراسة:': {
    fr: 'Total enseignants pour la répartition :',
    en: 'Total teachers for allocation:'
  },
  'المواد الخاصة بـ:': { fr: 'Matières pour :', en: 'Subjects for:' },
  'مادة محددة': { fr: 'matière(s) sélectionnée(s)', en: 'subject(s) selected' },
  'إجمالي التلاميذ المسجلين:': { fr: 'Total élèves inscrits :', en: 'Total registered students:' },
  'نعم، مسح الكل (': { fr: 'Oui, tout supprimer (', en: 'Yes, delete all (' },
  'مسح مواد المستوى الحالي (': { fr: 'Effacer le niveau actuel (', en: 'Clear current level (' },
  'معاينة الصفوف المستخرجة من الملف (': { fr: 'Aperçu des lignes extraites (', en: 'Extracted Rows Preview (' },
  'استرداد الآن (': { fr: 'Importer maintenant (', en: 'Import Now (' },
  'استرداد (': { fr: 'Importer (', en: 'Import (' },
};

const DYNAMIC_RULES: Array<{
  regex: RegExp;
  fr: (...args: string[]) => string;
  en: (...args: string[]) => string;
}> = [
  {
    regex: /^(\d+)\s*تلميذ(?:اً|ة)?$/,
    fr: (_, n) => `${n} élève(s)`,
    en: (_, n) => `${n} student(s)`,
  },
  {
    regex: /^(\d+)\s*أستاذ(?:اً|ة)?$/,
    fr: (_, n) => `${n} enseignant(s)`,
    en: (_, n) => `${n} teacher(s)`,
  },
  {
    regex: /^(\d+)\s*قاعة$/,
    fr: (_, n) => `${n} salle(s)`,
    en: (_, n) => `${n} room(s)`,
  },
  {
    regex: /^(\d+)\s*حراسات مسندة$/,
    fr: (_, n) => `${n} surveillances`,
    en: (_, n) => `${n} assigned duties`,
  },
  {
    regex: /^نسبة\s*(\d+)%$/,
    fr: (_, n) => `Taux ${n}%`,
    en: (_, n) => `Rate ${n}%`,
  },
  {
    regex: /^سعة\s*(\d+)\s*طالب$/,
    fr: (_, n) => `Capacité ${n} élèves`,
    en: (_, n) => `Capacity ${n} students`,
  },
  {
    regex: /^(\d+)\s*سا$/,
    fr: (_, n) => `${n} h`,
    en: (_, n) => `${n} h`,
  },
  {
    regex: /^قاعة\s+(.+)$/,
    fr: (_, name) => `Salle ${name}`,
    en: (_, name) => `Room ${name}`,
  },
  {
    regex: /^إجمالي الأساتذة:\s*(\d+)$/,
    fr: (_, n) => `Total enseignants : ${n}`,
    en: (_, n) => `Total teachers: ${n}`,
  },
  {
    regex: /^سعة القاعة:\s*(\d+)\s*مقعد$/,
    fr: (_, n) => `Capacité : ${n} places`,
    en: (_, n) => `Capacity: ${n} seats`,
  },
  {
    regex: /^اختبارات\s+(.+)$/,
    fr: (_, term) => `Examens ${translateArabicText(term, 'fr')}`,
    en: (_, term) => `Exams ${translateArabicText(term, 'en')}`,
  },
];

const HAS_ARABIC_RE = /[\u0600-\u06FF]/;
const SORTED_REPLACE_KEYS = Object.keys(TRANSLATIONS)
  .filter((k) => k.length >= 4)
  .sort((a, b) => b.length - a.length);

const TRANSLATION_CACHE: Record<'fr' | 'en', Map<string, string>> = {
  fr: new Map(),
  en: new Map(),
};

export function containsArabic(text: string): boolean {
  return HAS_ARABIC_RE.test(text);
}

export function translateArabicText(rawText: string, lang: AppLanguage): string {
  if (lang === 'ar' || !rawText || !HAS_ARABIC_RE.test(rawText)) {
    return rawText;
  }

  const leadingWs = rawText.match(/^\s*/)?.[0] || '';
  const trailingWs = rawText.match(/\s*$/)?.[0] || '';
  const trimmed = rawText.trim();
  if (!trimmed) return rawText;

  const cache = TRANSLATION_CACHE[lang];
  const cached = cache.get(trimmed);
  if (cached !== undefined) {
    return `${leadingWs}${cached}${trailingWs}`;
  }

  let result: string | null = null;

  // 1. Direct exact lookup
  const exact = TRANSLATIONS[trimmed];
  if (exact) {
    result = exact[lang];
  }

  // 2. Fragment lookup (e.g. "1. قاعات الامتحان (")
  if (!result) {
    const frag = FRAGMENT_TRANSLATIONS[trimmed];
    if (frag) {
      result = frag[lang];
    }
  }

  // 3. Dynamic pattern rules
  if (!result) {
    for (const rule of DYNAMIC_RULES) {
      const match = trimmed.match(rule.regex);
      if (match) {
        result = lang === 'fr' ? rule.fr(...match) : rule.en(...match);
        break;
      }
    }
  }

  // 4. Composite colon separator (e.g. "المؤسسة: ثانوية ...")
  if (!result) {
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0 && colonIdx < trimmed.length - 1) {
      const left = trimmed.slice(0, colonIdx + 1).trim();
      const right = trimmed.slice(colonIdx + 1).trim();
      const leftTrans = TRANSLATIONS[left] || TRANSLATIONS[left.slice(0, -1)];
      if (leftTrans) {
        const rightTrans = containsArabic(right) ? translateArabicText(right, lang) : right;
        result = `${leftTrans[lang]}${leftTrans[lang].endsWith(':') ? '' : ':'} ${rightTrans}`;
      }
    }
  }

  // 5. Prefix/term replacements inside compound UI strings
  if (!result) {
    let replaced = trimmed;
    for (const arKey of SORTED_REPLACE_KEYS) {
      if (replaced.includes(arKey)) {
        replaced = replaced.split(arKey).join(TRANSLATIONS[arKey][lang]);
      }
    }
    result = replaced;
  }

  cache.set(trimmed, result);
  return `${leadingWs}${result}${trailingWs}`;
}
