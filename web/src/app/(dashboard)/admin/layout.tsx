import { requireAdmin } from "@/lib/authz";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();
  return <div className="admin-area">{children}</div>;
}
