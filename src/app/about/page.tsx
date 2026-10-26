import type { Metadata } from "next";

import { ContactForm } from "@/components/contact-form";
import { Container, Eyebrow } from "@/components/container";

export const metadata: Metadata = {
  title: "About",
  description:
    "Daniel Isaksen photographs weather, coast, and quiet rooms from Bergen.",
};

export default function AboutPage() {
  return (
    <main id="content">
      <Container className="py-14 sm:py-20">
        <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-24">
          <article>
            <Eyebrow>About</Eyebrow>
            <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-6xl">
              Daniel Isaksen
            </h1>
            <div className="mt-8 max-w-xl space-y-5 text-base leading-relaxed sm:text-lg">
              <p>
                I photograph along the west coast of Norway, mostly when the weather is
                undecided. The work is available light: rooms, harbors, roads, and the
                hour before a day commits.
              </p>
              <p>
                Pictures are kept here as a working archive, in small groups. Prints are
                made occasionally, and commissions are unhurried.
              </p>
              <p>The studio is in Bergen.</p>
            </div>
          </article>
          <aside>
            <h2 className="font-display text-3xl tracking-tight">A note</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              For prints or a commission. The note is saved in the studio on this server,
              not sent as email.
            </p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </aside>
        </div>
      </Container>
    </main>
  );
}
