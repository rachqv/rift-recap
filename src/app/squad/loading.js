import LoadingScreen from "@/components/LoadingScreen";
import { getT } from "@/lib/i18n/server";

export default async function Loading() {
  const t = await getT();
  return <LoadingScreen lines={[1, 2, 3, 4].map((n) => t(`common.loading.squad${n}`))} />;
}
