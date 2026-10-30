import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { WorkArchive } from "@/components/work-archive";

// The archive's own voice: a serif for the title, names and captions, a light sans for everything else.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Work — Flittle",
  description: "Selected software projects by Flittle: web apps, internal tools, websites and integrations, in the round.",
};

export default function WorkPage() {
  return (
    <main className={`${playfair.variable} ${inter.variable}`}>
      <WorkArchive />
    </main>
  );
}
