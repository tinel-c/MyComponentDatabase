import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBudgetAccess } from "@/lib/authz";
import {
  pageStackClass,
  sectionSubheadingClass,
} from "@/components/forms/field-classes";
import { FreshStartWizard } from "@/components/data/FreshStartWizard";

export default async function FreshStartPage() {
  const { membership } = await requireBudgetAccess();
  if (membership.role !== "ADMIN" && membership.role !== "EDITOR") {
    redirect("/more");
  }

  return (
    <div className={`mx-auto max-w-2xl ${pageStackClass}`}>
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-fg md:text-2xl">
          Fresh Start
        </h1>
        <p className={sectionSubheadingClass}>
          Guided selective erase — wipe history while keeping the structure you
          want. Team memberships are never deleted.
        </p>
      </div>
      <FreshStartWizard />
    </div>
  );
}
