import RecapMessage from "@/components/recap/RecapMessage";
import { getT } from "@/lib/i18n/server";

// Any address the app has no page for, and the recap's `notFound()` for an unknown server.
export default async function NotFound() {
  const t = await getT();
  return (
    <RecapMessage title={t("common.message.notFoundTitle")} t={t}>
      {t("common.message.notFoundText")}
    </RecapMessage>
  );
}
