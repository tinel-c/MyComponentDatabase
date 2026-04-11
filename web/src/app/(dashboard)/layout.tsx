import { DashboardChrome } from "@/components/dashboard/DashboardChrome";
import { auth } from "@/auth";
import { getGravatarUrl } from "@/lib/gravatar";
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
  const gravatarUrl = getGravatarUrl(session.user.email, { size: 80, defaultImage: "identicon" });
  return (
    <DashboardChrome session={session} gravatarUrl={gravatarUrl}>
      {children}
    </DashboardChrome>
  );
}
