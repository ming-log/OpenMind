import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

function IconBase({ size = 18, children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {children}
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

export function NewDocumentIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 14h6" />
      <path d="M9 17h4" />
    </IconBase>
  );
}

export function ZoomInArrowIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 5 5" />
      <path d="M9 12 12 9" />
      <path d="M12 9v3" />
      <path d="M12 9H9" />
    </IconBase>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
    </IconBase>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </IconBase>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 20h14" />
    </IconBase>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M20 20v-4h-4" />
    </IconBase>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.3a2 2 0 1 1-4 0V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.7a2 2 0 1 1 0-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.3a2 2 0 1 1 4 0V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.3a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </IconBase>
  );
}

export function PaletteIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3a9 9 0 0 0 0 18h1.5a1.8 1.8 0 0 0 1.2-3.2 1.8 1.8 0 0 1 1.2-3.2H17a4 4 0 0 0 4-4.2C20.8 6.3 17.1 3 12 3Z" />
      <circle cx="7.5" cy="10" r="0.8" />
      <circle cx="10" cy="7.5" r="0.8" />
      <circle cx="14" cy="7.8" r="0.8" />
      <circle cx="16.6" cy="10.8" r="0.8" />
    </IconBase>
  );
}

export function MapIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6.5 9 4l6 2.5 5-2.5v13.5l-5 2.5-6-2.5-5 2.5V6.5Z" />
      <path d="M9 4v13.5" />
      <path d="M15 6.5V20" />
    </IconBase>
  );
}

export function FileTextIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </IconBase>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m15 18-6-6 6-6" />
    </IconBase>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9 18 6-6-6-6" />
    </IconBase>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </IconBase>
  );
}

export function XIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m18 6-12 12" />
      <path d="m6 6 12 12" />
    </IconBase>
  );
}

export function AutoLayoutIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="4" rx="1.2" width="6" x="9" y="3" />
      <rect height="4" rx="1.2" width="6" x="4" y="10" />
      <rect height="4" rx="1.2" width="6" x="14" y="10" />
      <rect height="4" rx="1.2" width="6" x="9" y="17" />
      <path d="M12 7v3" />
      <path d="M10 12h4" />
      <path d="M12 14v3" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
    </IconBase>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
    </IconBase>
  );
}

export function FrameIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect height="14" rx="2" width="14" x="5" y="5" />
      <path d="M8 5V3" />
      <path d="M16 5V3" />
      <path d="M8 21v-2" />
      <path d="M16 21v-2" />
    </IconBase>
  );
}

export function AddChildNodeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M9.5 7H13a4 4 0 0 1 4 4v3.5" />
    </IconBase>
  );
}

export function AddSiblingNodeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="7" cy="12" r="2.5" />
      <circle cx="17" cy="12" r="2.5" />
      <path d="M9.5 12h5" />
    </IconBase>
  );
}

export function AddParentNodeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="7" cy="17" r="2.5" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M9.5 17H13a4 4 0 0 0 4-4V9.5" />
    </IconBase>
  );
}

export function FocusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 3H4a1 1 0 0 0-1 1v4" />
      <path d="M16 3h4a1 1 0 0 1 1 1v4" />
      <path d="M21 16v4a1 1 0 0 1-1 1h-4" />
      <path d="M8 21H4a1 1 0 0 1-1-1v-4" />
      <path d="m8 8-5-5" />
      <path d="m16 8 5-5" />
      <path d="m16 16 5 5" />
      <path d="m8 16-5 5" />
    </IconBase>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4" />
      <path d="m8.6 13.5 6.8 4" />
    </IconBase>
  );
}

export function StatusDotIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className="status-dot-icon"
      fill="currentColor"
      height={8}
      viewBox="0 0 8 8"
      width={8}
      {...props}
    >
      <circle cx="4" cy="4" r="3" />
    </svg>
  );
}

export function NoteDotIcon(props: IconProps) {
  return (
    <IconBase className="note-dot-icon" size={14} {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 13h6.5" />
      <path d="M8.5 16h4.5" />
    </IconBase>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="m2 2 20 20" />
    </IconBase>
  );
}
