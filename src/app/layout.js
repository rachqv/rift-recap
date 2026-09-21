import { Cinzel, Inter } from "next/font/google";
import LanguageSwitch from "@/components/LanguageSwitch";
import Parallax from "@/components/Parallax";
import SiteSound from "@/components/SiteSound";
import { TOP_BAR_SLOT } from "@/components/topBar";
import { LOCALES } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/client";
import { getClientI18n, getLocale, getT } from "@/lib/i18n/server";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Cinzel only has Latin letters; other scripts (and the Inter subsets it lacks) fall back to the fonts in globals.css.
const display = Cinzel({ subsets: ["latin", "latin-ext"], variable: "--font-display", weight: ["600", "800"] });
const body = Inter({ subsets: ["latin", "latin-ext", "cyrillic", "greek", "vietnamese"], variable: "--font-body" });

export async function generateMetadata() {
  const [locale, t] = [await getLocale(), await getT()];
  const description = t("common.meta.description");
  // Defaults for pages without their own preview (the home page). Recaps set their own, with the player's card.
  const card = `/demo/card?format=og&lang=${locale}`;
  return {
    // Absolute base for link-preview images (Open Graph needs full URLs).
    metadataBase: new URL(SITE_URL),
    // Page titles already end in "· Rift Recap" (they're translated messages), so there's no title template.
    title: "Rift Recap",
    description,
    applicationName: "Rift Recap",
    openGraph: {
      title: "Rift Recap",
      description,
      siteName: "Rift Recap",
      type: "website",
      locale: LOCALES[locale].intl.replace("-", "_"),
      images: [{ url: card, width: 1200, height: 630, alt: "Rift Recap" }],
    },
    twitter: { card: "summary_large_image", title: "Rift Recap", description, images: [card] },
  };
}

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const i18n = await getClientI18n(locale);
  return (
    <html lang={locale} dir={LOCALES[locale].dir} className={`${display.variable} ${body.variable}`}>
      <body>
        <I18nProvider {...i18n}>
          <Parallax />
          <header className="top-bar">
            <LanguageSwitch />
            {/* The site's sound (speaker, volume and the soundtrack) lives here so it keeps playing from page to page. */}
            <SiteSound />
            {/* Pages with their own controls (the recap's slideshow) put them here, level with the language switch. */}
            <div id={TOP_BAR_SLOT} className="top-bar-slot" />
          </header>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
