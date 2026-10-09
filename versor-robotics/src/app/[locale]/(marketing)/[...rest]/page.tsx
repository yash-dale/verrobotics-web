import { notFound } from "next/navigation";

/** Any unknown path inside a language shows that language's not-found page (with the header and footer). */
export default function CatchAll() {
  notFound();
}
