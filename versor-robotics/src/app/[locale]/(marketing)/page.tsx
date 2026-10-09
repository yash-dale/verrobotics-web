import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import Hero from "@/components/Hero";
import Vision from "@/components/Vision";
import VideoSection from "@/components/VideoSection";
import Products from "@/components/Products";
import Features from "@/components/Features";
import Contact from "@/components/Contact";
import JoinUs from "@/components/JoinUs";
import Game from "@/components/Game";
import { alternatesFor } from "@/i18n/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale) };
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale); // the root layout has already 404ed anything else
  return (
    <>
      <Hero />
      <Vision />
      <VideoSection />
      <Products />
      <Features />
      <Contact />
      <JoinUs />
      <Game />
    </>
  );
}
