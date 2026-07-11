import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EvidencePanelProps {
  icon: LucideIcon;
  eyebrow: string;
  children: ReactNode;
  className?: string;
}

export function EvidencePanel({
  icon: Icon,
  eyebrow,
  children,
  className,
}: EvidencePanelProps) {
  return (
    <section className={`panel explanation${className ? ` ${className}` : ""}`}>
      <div className="section-icon">
        <Icon />
      </div>
      <span className="eyebrow">{eyebrow}</span>
      {children}
    </section>
  );
}
