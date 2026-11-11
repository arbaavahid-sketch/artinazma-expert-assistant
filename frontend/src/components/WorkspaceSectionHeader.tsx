import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./workspace-pages.module.css";

export default function WorkspaceSectionHeader({
  icon: Icon,
  label,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className={styles.masthead}>
      <div className={styles.eyebrow}><Icon size={17} aria-hidden="true" />{label}</div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </header>
  );
}
