import type { SVGProps } from "react";

/** BNAB mark: overlapping budget envelopes. Uses currentColor. */
export function BnabMark({
  className,
  title = "BNAB",
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
      {...props}
    >
      <title>{title}</title>
      <path
        d="M14 16h30c2.2 0 4 1.8 4 4v26c0 2.2-1.8 4-4 4H14c-2.2 0-4-1.8-4-4V20c0-2.2 1.8-4 4-4Z"
        fill="currentColor"
        opacity="0.38"
      />
      <path
        d="M20 12h30c2.8 0 5 2.2 5 5v28c0 2.8-2.2 5-5 5H20c-2.8 0-5-2.2-5-5V17c0-2.8 2.2-5 5-5Z"
        fill="currentColor"
      />
      <path
        d="M15 18.5 33.8 31.1c1 .65 2.4.65 3.4 0L55 18.5"
        stroke="#052e1a"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.28"
      />
      <path
        d="M20 12h30c.55 0 1.1.1 1.6.28L36.7 24.5c-1.1.75-2.5.75-3.6 0L18.4 12.28C18.9 12.1 19.45 12 20 12Z"
        fill="#ffffff"
        opacity="0.2"
      />
    </svg>
  );
}

type LogoProps = {
  className?: string;
  markClassName?: string;
  showTagline?: boolean;
  compact?: boolean;
};

/** Wordmark + mark for headers and marketing surfaces. */
export function BnabLogo({
  className = "",
  markClassName = "size-9",
  showTagline = false,
  compact = false,
}: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-xl text-accent"
        aria-hidden
      >
        <BnabMark className={markClassName} />
      </span>
      <div className="min-w-0 leading-tight">
        <p
          className={`font-semibold tracking-tight text-fg ${
            compact ? "text-base" : "text-lg"
          }`}
        >
          BNAB
        </p>
        {showTagline ? (
          <p className="truncate text-[11px] font-medium tracking-wide text-fg-muted">
            Bogza Needs A Budget
          </p>
        ) : null}
      </div>
    </div>
  );
}
