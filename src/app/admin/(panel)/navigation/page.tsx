import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { NavigationEditor } from "@/components/admin/NavigationEditor";
import { PageTitle } from "@/components/admin/ui";

export const metadata = { title: "Navigation" };

export default async function NavigationPage() {
  await requireStaff("content.manage");
  const s = await getSettings();
  return (
    <>
      <PageTitle title="Menus" sub="The footer on every page: service buttons, help links and extra legal links, in Kreyòl and French. Use ▲▼ to change the order, ✕ to remove. Press Publish to put it live." />
      <NavigationEditor initial={s.navigation ?? { header: [], footer: [] }} />
    </>
  );
}
