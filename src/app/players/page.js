import PlayersList from "@/components/PlayersList";
import { getT } from "@/lib/i18n/server";
import SetupShell from "@/components/squad/SetupShell";
import forms from "@/components/squad/forms.module.css";

export async function generateMetadata() {
  return { title: (await getT())("players.meta.title") };
}

// The players this browser has looked up. The list itself is read in the browser (it lives in local storage), so this
// page is just the frame around it.
export default async function PlayersPage() {
  const t = await getT();
  return (
    <SetupShell>
      <h1 className={forms.title}>{t("players.title")}</h1>
      <p className={forms.lead}>{t("players.lead")}</p>
      <PlayersList />
    </SetupShell>
  );
}
