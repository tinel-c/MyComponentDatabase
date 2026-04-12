import { redirect } from "next/navigation";

/** Supports /parts/p/42 → canonical /p/42 */
export default async function RedirectPartsPToShortUrl({
  params,
}: {
  params: Promise<{ partNumber: string }>;
}) {
  const { partNumber } = await params;
  redirect(`/p/${partNumber}`);
}
