import React from 'react';
import { Moon, Sun, Globe, Palette, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useI18n } from '../lib/i18n';
import { AppLanguage, AppTheme } from '../lib/translations';

export default function PreferencesPage() {
  const { language, setLanguage, theme, setTheme, dir, t } = useI18n();

  const handleSelectTheme = (nextTheme: AppTheme) => {
    setTheme(nextTheme);
    if (nextTheme === 'light') {
      toast.success(t('تم تفعيل الوضع النهاري', 'Mode clair activé', 'Light mode enabled'));
    } else {
      toast.success(t('تم تفعيل الوضع الليلي', 'Mode sombre activé', 'Dark mode enabled'));
    }
  };

  const handleSelectLanguage = (nextLang: AppLanguage) => {
    setLanguage(nextLang);
    if (nextLang === 'fr') {
      toast.success('Langue changée en Français');
    } else if (nextLang === 'en') {
      toast.success('Language switched to English');
    } else {
      toast.success('تم تغيير لغة التطبيق إلى العربية');
    }
  };

  const languageOptions: Array<{
    code: AppLanguage;
    nativeName: string;
    subtitle: string;
    badge: string;
    directionLabel: string;
  }> = [
    {
      code: 'ar',
      nativeName: 'العربية',
      subtitle: t('اللغة الافتراضية للتطبيق', 'Langue arabe (RTL)', 'Arabic (RTL)'),
      badge: 'AR',
      directionLabel: 'RTL',
    },
    {
      code: 'fr',
      nativeName: 'Français',
      subtitle: t('الفرنسية', 'Langue française (LTR)', 'French (LTR)'),
      badge: 'FR',
      directionLabel: 'LTR',
    },
    {
      code: 'en',
      nativeName: 'English',
      subtitle: t('الإنجليزية', 'Langue anglaise (LTR)', 'English (LTR)'),
      badge: 'EN',
      directionLabel: 'LTR',
    },
  ];

  return (
    <div className="space-y-6 text-slate-100 max-w-5xl mx-auto" dir={dir}>
      {/* Top Banner */}
      <div className="bg-[#091021] border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#0099FF]/20 border border-cyan-500/40 text-[#0099FF] flex items-center justify-center shrink-0">
            <Palette size={26} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">
              {t('إعدادات التطبيق والمظهر واللغة', "Paramètres de l'application, thème et langue", 'App Settings, Appearance & Language')}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {t(
                'تخصيص مظهر التطبيق (الوضع الليلي أو النهاري) وتبديل لغة الواجهة بالكامل',
                "Personnalisez le thème (mode sombre ou clair) et traduisez toute l'interface",
                'Customize app appearance (Dark or Light mode) and translate the entire interface'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Theme Selection: Mode Sombre & Mode Clair */}
      <div className="bg-[#0D162A] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
          </div>
          <div>
            <h3 className="text-base font-black text-white">
              {t('مظهر التطبيق', "Apparence de l'application", 'App Appearance')}
            </h3>
            <p className="text-xs text-slate-400">
              {t(
                'اختر بين الوضع الليلي أو الوضع النهاري',
                'Choisissez entre le mode sombre et le mode clair',
                'Choose between Dark Mode and Light Mode'
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode Sombre */}
          <button
            type="button"
            onClick={() => handleSelectTheme('dark')}
            className={`p-5 rounded-2xl border-2 text-start transition-all cursor-pointer flex items-start justify-between gap-4 ${
              theme === 'dark'
                ? 'bg-[#121E36] border-[#0099FF] shadow-lg shadow-sky-500/15'
                : 'bg-[#121E36]/60 border-slate-700/70 hover:border-slate-500'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 text-sky-400 flex items-center justify-center shrink-0">
                <Moon size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">
                    {t('الوضع الليلي', 'Mode sombre', 'Dark Mode')}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                    Mode Sombre
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {t('خلفية داكنة مريحة للعين', 'Thème sombre reposant pour les yeux', 'Comfortable dark obsidian interface')}
                </p>
              </div>
            </div>
            {theme === 'dark' && (
              <span className="inline-flex items-center gap-1 text-xs font-black text-sky-400 shrink-0">
                <CheckCircle2 size={18} />
                <span>{t('مفعّل', 'Activé', 'Active')}</span>
              </span>
            )}
          </button>

          {/* Mode Clair */}
          <button
            type="button"
            onClick={() => handleSelectTheme('light')}
            className={`p-5 rounded-2xl border-2 text-start transition-all cursor-pointer flex items-start justify-between gap-4 ${
              theme === 'light'
                ? 'bg-[#121E36] border-[#0099FF] shadow-lg shadow-sky-500/15'
                : 'bg-[#121E36]/60 border-slate-700/70 hover:border-slate-500'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-500 flex items-center justify-center shrink-0">
                <Sun size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">
                    {t('الوضع النهاري', 'Mode clair', 'Light Mode')}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                    Mode Clair
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {t('خلفية فاتحة واضحة للنهار', 'Thème clair lumineux et lisible', 'Crisp bright daylight interface')}
                </p>
              </div>
            </div>
            {theme === 'light' && (
              <span className="inline-flex items-center gap-1 text-xs font-black text-sky-400 shrink-0">
                <CheckCircle2 size={18} />
                <span>{t('مفعّل', 'Activé', 'Active')}</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Language Selection: AR / FR / EN */}
      <div className="bg-[#0D162A] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-[#0099FF]/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
            <Globe size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-white">
              {t('لغة التطبيق', "Langue de l'application", 'Application Language')}
            </h3>
            <p className="text-xs text-slate-400">
              {t(
                'ترجمة فورية لجميع عناصر وقوائم التطبيق',
                "Traduction instantanée de tous les éléments de l'application",
                'Instant translation of all application elements'
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {languageOptions.map((opt) => {
            const isSelected = language === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => handleSelectLanguage(opt.code)}
                data-no-translate="true"
                className={`p-5 rounded-2xl border-2 text-start transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                  isSelected
                    ? 'bg-[#0099FF]/15 border-[#0099FF] shadow-lg shadow-sky-500/15'
                    : 'bg-[#121E36] border-slate-700/80 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                      isSelected
                        ? 'bg-[#0099FF] text-white shadow'
                        : 'bg-[#182643] text-slate-300 border border-slate-700'
                    }`}
                  >
                    {opt.badge}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#182643] text-slate-400 border border-slate-700">
                    {opt.directionLabel}
                  </span>
                </div>

                <div>
                  <div className="text-base font-black text-white">{opt.nativeName}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{opt.subtitle}</div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 w-full">
                  {isSelected ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-sky-400">
                      <CheckCircle2 size={15} />
                      <span>{t('مفعّل', 'Activé', 'Active')}</span>
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-400">
                      {opt.code === 'ar' ? 'تفعيل العربية' : opt.code === 'fr' ? 'Activer le français' : 'Enable English'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-[#121E36] border border-cyan-500/30 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-300">
          <Sparkles size={18} className="text-cyan-400 shrink-0" />
          <span>
            {t(
              'عند اختيار اللغة، يتم ترجمة القوائم، الأزرار، الجداول، والنوافذ تلقائياً مع ضبط اتجاه العرض (RTL للعربية و LTR للفرنسية والإنجليزية).',
              "Lors de la sélection d'une langue, tous les menus, boutons, tableaux et fenêtres sont traduits automatiquement avec adaptation du sens d'affichage.",
              'Selecting a language automatically translates all menus, buttons, tables, and dialogs and updates layout direction.'
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
