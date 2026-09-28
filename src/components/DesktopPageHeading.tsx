import type { ReactNode } from 'react';

interface DesktopPageHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

/** A consistent content heading for the desktop workspace. Phone pages keep their own headers. */
export function DesktopPageHeading({ eyebrow, title, description, action }: DesktopPageHeadingProps) {
  return (
    <header className="desktop-content-heading hidden lg:block">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {action && <div className="desktop-content-heading-action">{action}</div>}
    </header>
  );
}
