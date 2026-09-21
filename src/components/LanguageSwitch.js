"use client";

import { useTransition } from "react";
import { setLocale } from "@/app/actions";
import Select from "@/components/Select";
import { LOCALES, READY_LOCALES } from "@/lib/i18n/config";
import { useT } from "@/lib/i18n/client";
import styles from "./LanguageSwitch.module.css";

/**
 * The language switch: a small pill showing the current language code, opening a themed list of languages. Choosing one
 * saves it in a cookie and the page redraws in that language.
 */
export default function LanguageSwitch() {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const locales = READY_LOCALES.includes(t.locale) ? READY_LOCALES : [...READY_LOCALES, t.locale];

  return (
    <Select
      variant="pill"
      align="end"
      className={pending ? styles.pending : undefined}
      value={t.locale}
      options={locales.map((locale) => ({ value: locale, label: LOCALES[locale].label, lang: locale }))}
      ariaLabel={t("common.language.label")}
      display={t.locale}
      icon={
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z" />
        </svg>
      }
      onChange={(next) => startTransition(() => setLocale(next))}
    />
  );
}
