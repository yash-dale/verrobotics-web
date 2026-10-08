import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RoverToy from "@/components/RoverToy";
import SmoothAnchors from "@/components/SmoothAnchors";

/** Chrome shared by the public marketing pages. Other route groups (login, dashboard…) can have their own layout. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <RoverToy />
      <SmoothAnchors />
    </>
  );
}
