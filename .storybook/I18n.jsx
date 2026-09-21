import { I18nProvider } from "@/lib/i18n/client";
import { EN_FLAT } from "@/lib/i18n/en";

/** Client components read their text from a provider; stories get one in English (the same catalog the tests assert on). */
export default function I18n({ children }) {
  return (
    <I18nProvider locale="en" messages={EN_FLAT}>
      {children}
    </I18nProvider>
  );
}
