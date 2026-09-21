"use client";

import { useEffect } from "react";
import Backdrop from "@/components/Backdrop";
import { MessageScreen } from "@/components/recap/MessageCard";
import { useT } from "@/lib/i18n/client";

// The last resort when a page throws something the page itself didn't expect. `reset` draws the page again.
export default function ErrorPage({ error, reset }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <MessageScreen backdrop={<Backdrop />} title={t("common.message.crashTitle")} t={t} retry={{ label: t("common.message.retry"), onClick: reset }}>
      {t("common.message.crashText")}
    </MessageScreen>
  );
}
