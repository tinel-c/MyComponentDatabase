import { DashboardChrome } from "@/components/dashboard/DashboardChrome";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return <DashboardChrome session={session}>{children}</DashboardChrome>;
}
