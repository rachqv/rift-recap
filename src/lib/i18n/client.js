"use client";

import { createContext, useContext, useMemo } from "react";
import { createT } from "./translate";

const I18nContext = createContext(null);

/** Gives client components their language. `messages` is what `getClientI18n` returned on the server. */
export function I18nProvider({ locale, messages, children }) {
  const t = useMemo(() => createT(locale, messages), [locale, messages]);
  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>;
}

/** The translate function, in client components: `const t = useT(); t("search.placeholder")`. */
export function useT() {
  const t = useContext(I18nContext);
  if (!t) throw new Error("useT needs an I18nProvider above it (the root layout has one; stories get one from the preview).");
  return t;
}
