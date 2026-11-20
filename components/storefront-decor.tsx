import type { SVGProps } from "react";

type DecorProps = SVGProps<SVGSVGElement>;

export function BowIcon(props: DecorProps) {
  return (
    <svg viewBox="0 0 64 40" fill="none" aria-hidden="true" {...props}>
      <path d="M30 18C22 6 6 1 4 9c-2 7 4 16 14 15 5-.5 9-3 12-6Z" fill="currentColor" />
      <path d="M34 18c8-12 24-17 26-9 2 7-4 16-14 15-5-.5-9-3-12-6Z" fill="currentColor" />
      <path d="M28 21c-3 6-8 13-12 17 4 1 8-1 11-4l3-7M36 21c3 6 8 13 12 17-4 1-8-1-11-4l-3-7" fill="currentColor" opacity=".85" />
      <rect x="26" y="13" width="12" height="11" rx="5" fill="currentColor" />
      <path d="M11 10c3-1 8 1 12 5M53 10c-3-1-8 1-12 5" stroke="#fff" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
      <path d="M29 16c1.5-1 4.5-1 6 0" stroke="#fff" strokeOpacity=".6" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function HeartIcon(props: DecorProps) {
  return (
    <svg viewBox="0 0 24 22" aria-hidden="true" {...props}>
      <path d="M12 21.2 10.6 20C5.4 15.3 2 12.2 2 8.4 2 5.3 4.4 3 7.4 3c1.7 0 3.4.8 4.6 2.1C13.2 3.8 14.9 3 16.6 3 19.6 3 22 5.3 22 8.4c0 3.8-3.4 6.9-8.6 11.6L12 21.2Z" fill="currentColor" />
    </svg>
  );
}

export function SparkleIcon(props: DecorProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 0c.7 6.3 5.7 11.3 12 12-6.3.7-11.3 5.7-12 12-.7-6.3-5.7-11.3-12-12C6.3 11.3 11.3 6.3 12 0Z" fill="currentColor" />
    </svg>
  );
}
