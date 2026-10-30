import { InkHero } from "@/components/ink-hero";
import { MainStory } from "@/components/main-story";
import { LetsWorkTogether } from "@/components/ui/lets-work-section";

export default function Home() {
  return (
    <main className="w-full">
      <InkHero />
      <MainStory>
        <LetsWorkTogether />
      </MainStory>
    </main>
  );
}
