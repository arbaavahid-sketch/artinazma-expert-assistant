import { ArrowUpRight, FlaskConical } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./assistant-start.module.css";

type AssistantStartProps = {
  isEn: boolean;
  children: ReactNode;
  suggestions: ReactNode;
};

export default function AssistantStart({ isEn, children, suggestions }: AssistantStartProps) {
  return (
    <div className={styles.start}>
      <section className={styles.hero} aria-labelledby="assistant-start-title">
        <div className={styles.heroHeading}>
          <span className={styles.brandMark}><FlaskConical size={21} aria-hidden="true" /></span>
          <h2 id="assistant-start-title">{isEn ? "Ask Artin" : "از آرتین بپرسید"}</h2>
          <p>
            {isEn
              ? "Find a method, compare instruments or make sense of a test result."
              : "یک روش آزمون پیدا کنید، تجهیزات را مقایسه کنید یا نتیجهٔ آزمایش را بررسی کنید."}
          </p>
        </div>
        <div className={styles.composeArea}>{children}</div>
      </section>
      {suggestions}
      <div className={styles.workspaceLink}>
        <Link href="/calculators/workspace">
          {isEn ? "Open lab workspace" : "ورود به فضای کار آزمایشگاه"}
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
