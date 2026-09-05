import { requireBudgetAccess } from "@/lib/authz";
import { AppChrome } from "@/components/layout/AppChrome";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { budget } = await requireBudgetAccess();
  return <AppChrome budgetName={budget.name}>{children}</AppChrome>;
}
