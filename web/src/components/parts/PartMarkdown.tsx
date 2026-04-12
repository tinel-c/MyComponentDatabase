"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const mdClass =
  "wiki-md max-w-none text-zinc-100 [&_a]:text-zinc-400 [&_a]:underline [&_a:hover]:text-zinc-300 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-600 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-zinc-950/80 [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_code]:text-zinc-100 [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-950 [&_pre]:p-3 [&_pre]:text-zinc-50 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-zinc-700 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-zinc-700 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6";

type Props = {
  markdown: string;
  className?: string;
};

export function PartMarkdown({ markdown, className = "" }: Props) {
  if (!markdown.trim()) return null;
  return (
    <div className={`min-w-0 overflow-x-auto ${mdClass} ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
