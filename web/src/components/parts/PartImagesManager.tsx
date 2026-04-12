"use client";

import {
  addPartImages,
  deletePartImage,
  setPartCardImage,
} from "@/app/(dashboard)/parts/actions";
import { buttonPrimaryClass, inputClass, labelClass } from "@/components/forms/field-classes";
import { MAX_PART_IMAGES } from "@/lib/part-image-constants";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

export type PartImageRow = {
  id: string;
  url: string;
  sortOrder: number;
};

function UploadImagesButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={buttonPrimaryClass}>
      {pending ? "Uploading…" : "Upload"}
    </button>
  );
}

type Props = {
  partId: string;
  /** Current `Part.imageUrl` (card / list thumbnail). */
  cardImageUrl: string | null;
  images: PartImageRow[];
};

export function PartImagesManager({ partId, cardImageUrl, images }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [actionPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const remaining = MAX_PART_IMAGES - sorted.length;

  const onDelete = useCallback(
    (imageId: string) => {
      if (!confirm("Remove this image from the part?")) {
        return;
      }
      setError(null);
      startTransition(async () => {
        const result = await deletePartImage(imageId);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.refresh();
      });
    },
    [router],
  );

  const onSetCard = useCallback(
    (imageId: string) => {
      setError(null);
      startTransition(async () => {
        const result = await setPartCardImage(partId, imageId);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.refresh();
      });
    },
    [partId, router],
  );

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Pictures</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Uploaded files are stored for this part ({sorted.length}/{MAX_PART_IMAGES}). The card image for lists can be any
        picture below or an external URL in the form above.
      </p>

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        action={async (formData) => {
          setError(null);
          formData.set("partId", partId);
          const result = await addPartImages(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          router.refresh();
        }}
      >
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="part-images-upload" className={labelClass}>
            Add images
          </label>
          <input
            ref={fileInputRef}
            id="part-images-upload"
            name="files"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            disabled={remaining <= 0}
            className={inputClass}
          />
        </div>
        <UploadImagesButton disabled={remaining <= 0} />
      </form>
      {remaining <= 0 ? (
        <p className="mt-2 text-xs text-zinc-300">Image limit reached.</p>
      ) : null}

      {sorted.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {sorted.map((img) => {
            const isCard = cardImageUrl === img.url;
            return (
              <li
                key={img.id}
                className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-950/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- dynamic app URLs */}
                <img
                  src={img.url}
                  alt=""
                  className="mx-auto max-h-48 w-full object-contain p-2"
                  loading="lazy"
                />
                <div className="flex flex-wrap gap-2 border-t border-zinc-200 p-2 dark:border-zinc-700">
                  {!isCard ? (
                    <button
                      type="button"
                      disabled={actionPending}
                      onClick={() => onSetCard(img.id)}
                      className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Use as card image
                    </button>
                  ) : (
                    <span className="rounded-lg bg-zinc-900/60 px-2 py-1 text-xs font-medium text-zinc-100 ring-1 ring-zinc-600/35">
                      Card image
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={actionPending}
                    onClick={() => onDelete(img.id)}
                    className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-zinc-950 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm italic text-zinc-500 dark:text-zinc-400">No uploaded pictures yet.</p>
      )}
    </section>
  );
}
