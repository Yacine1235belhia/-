import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppLanguage, AppTheme, containsArabic, translateArabicText } from './translations';

const THEME_STORAGE_KEY = 'hirasa_theme';
const LANG_STORAGE_KEY = 'hirasa_lang';

interface I18nContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  dir: 'rtl' | 'ltr';
  t: (ar: string, fr?: string, en?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const getInitialTheme = (): AppTheme => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'dark';
};

const getInitialLanguage = (): AppLanguage => {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'ar' || saved === 'fr' || saved === 'en') return saved;
  } catch {}
  return 'ar';
};

// WeakMaps to store lossless originals so switching ar <-> fr <-> en is 100% reversible
const originalTextMap = new WeakMap<Text, string>();
const lastAppliedTextMap = new WeakMap<Text, string>();

const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label'] as const;
const originalAttrMap = new WeakMap<Element, Partial<Record<(typeof TRANSLATABLE_ATTRS)[number], string>>>();
const lastAppliedAttrMap = new WeakMap<Element, Partial<Record<(typeof TRANSLATABLE_ATTRS)[number], string>>>();

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'CODE', 'PRE', 'TEXTAREA']);

function shouldSkipElement(el: Element | null): boolean {
  if (!el) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.closest('[data-no-translate="true"]')) return true;
  // Keep official Ministry printable paper sheets intact in Arabic unless explicitly opted in
  if (
    el.closest('#allocation-print-document') ||
    el.closest('#printable-area') ||
    el.closest('#calling-lists-printable .print-card')
  ) {
    return true;
  }
  return false;
}

function processTextNode(node: Text, lang: AppLanguage) {
  const parent = node.parentElement;
  if (shouldSkipElement(parent)) return;

  const currentVal = node.nodeValue ?? '';
  const lastApplied = lastAppliedTextMap.get(node);

  // If React or code updated this node with new source text (not our own translation write)
  if (currentVal !== lastApplied) {
    if (containsArabic(currentVal) || !originalTextMap.has(node)) {
      originalTextMap.set(node, currentVal);
    }
  }

  const original = originalTextMap.get(node);
  if (original === undefined) return;

  const target = lang === 'ar' ? original : translateArabicText(original, lang);
  lastAppliedTextMap.set(node, target);
  if (node.nodeValue !== target) {
    node.nodeValue = target;
  }
}

function processElementAttrs(el: Element, lang: AppLanguage) {
  if (shouldSkipElement(el)) return;

  let origStore = originalAttrMap.get(el);
  if (!origStore) {
    origStore = {};
    originalAttrMap.set(el, origStore);
  }
  let appliedStore = lastAppliedAttrMap.get(el);
  if (!appliedStore) {
    appliedStore = {};
    lastAppliedAttrMap.set(el, appliedStore);
  }

  for (const attr of TRANSLATABLE_ATTRS) {
    const curAttr = el.getAttribute(attr);
    if (curAttr === null) continue;

    if (curAttr !== appliedStore[attr]) {
      if (containsArabic(curAttr) || origStore[attr] === undefined) {
        origStore[attr] = curAttr;
      }
    }

    const origVal = origStore[attr];
    if (origVal === undefined) continue;

    const targetVal = lang === 'ar' ? origVal : translateArabicText(origVal, lang);
    appliedStore[attr] = targetVal;
    if (curAttr !== targetVal) {
      el.setAttribute(attr, targetVal);
    }
  }
}

function translateSubtree(root: Node, lang: AppLanguage) {
  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root as Text, lang);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;

  const rootEl = root as Element;
  if (shouldSkipElement(rootEl)) return;

  processElementAttrs(rootEl, lang);

  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let cur: Node | null = walker.nextNode();
  while (cur) {
    if (cur.nodeType === Node.TEXT_NODE) {
      processTextNode(cur as Text, lang);
    } else if (cur.nodeType === Node.ELEMENT_NODE) {
      processElementAttrs(cur as Element, lang);
    }
    cur = walker.nextNode();
  }
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(getInitialTheme);
  const [language, setLanguageState] = useState<AppLanguage>(getInitialLanguage);

  const dir: 'rtl' | 'ltr' = language === 'ar' ? 'rtl' : 'ltr';

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const setLanguage = useCallback((nextLang: AppLanguage) => {
    setLanguageState(nextLang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, nextLang);
    } catch {}
  }, []);

  // Sync HTML attributes & document title
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    html.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('lang', language);
    html.setAttribute('dir', dir);
    document.title = translateArabicText('نظام إدارة الحراسة الذكي', language);
  }, [language, dir]);

  // Real-time DOM translation sync for all components, modals, and toasts
  useEffect(() => {
    if (!document.body) return;

    translateSubtree(document.body, language);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData') {
          processTextNode(m.target as Text, language);
        } else if (m.type === 'attributes' && m.target instanceof Element) {
          processElementAttrs(m.target, language);
        } else if (m.type === 'childList') {
          m.addedNodes.forEach((node) => translateSubtree(node, language));
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
    });

    return () => observer.disconnect();
  }, [language]);

  const t = useCallback(
    (ar: string, fr?: string, en?: string) => {
      if (language === 'ar') return ar;
      if (language === 'fr' && fr) return fr;
      if (language === 'en' && en) return en;
      return translateArabicText(ar, language);
    },
    [language]
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, theme, setTheme, toggleTheme, dir, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
