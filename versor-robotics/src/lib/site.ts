/**
 * ──────────────────────────────────────────────────────────────
 *  EDIT ME — everything you are likely to change lives in here.
 *  Placeholder copy is marked (placeholder).
 * ──────────────────────────────────────────────────────────────
 */
interface SiteConfig {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  video: { src: string; poster: string; youtubeId: string };
  forms: {
    join: { url: string; embedUrl: string };
    contact: {
      action: string;
      fields: { name: string; email: string; interest: string; message: string };
    };
  };
}

export const site: SiteConfig = {
  name: "Versor Robotics",
  tagline: "Autonomous machines for the fields of tomorrow.",

  // (placeholder) contact details
  email: "hello@versorrobotics.farm",
  phone: "+1 (555) 010-4040",
  address: "Barn 7, Greenfield AgTech Park",

  /* ── VIDEO ───────────────────────────────────────────────────
   * Option A (self-hosted): drop your file at  public/videos/versor-demo.mp4
   *   and (optionally) a poster image at       public/videos/poster.jpg
   * Option B (YouTube):     put the 11-character video id in `youtubeId`
   *   e.g. for https://youtu.be/dQw4w9WgXcQ  →  youtubeId: "dQw4w9WgXcQ"
   * If youtubeId is set it wins. If neither works, a "coming soon" TV shows.
   */
  video: {
    src: "/videos/versor-demo.mp4",
    poster: "/videos/poster.jpg",
    youtubeId: "",
  },

  /* ── GOOGLE FORMS ────────────────────────────────────────────
   * join:    paste your form's share link. "Apply now" and every role open it.
   *          Optional `embedUrl` shows the form inline on the page
   *          (Google Forms → Send → </> Embed HTML → copy the iframe src).
   * contact: the styled contact form posts straight into a Google Form.
   *          See README.md → "Connect the contact form" for the 3 steps.
   *          While `action` is empty, the form falls back to opening the
   *          visitor's email app (mailto) so nothing is ever lost.
   */
  forms: {
    join: {
      url: "", // e.g. "https://forms.gle/xxxxxxxx"
      embedUrl: "", // e.g. "https://docs.google.com/forms/d/e/XXXX/viewform?embedded=true"
    },
    contact: {
      action: "", // e.g. "https://docs.google.com/forms/d/e/XXXX/formResponse"
      fields: {
        name: "", // e.g. "entry.1111111111"
        email: "", // e.g. "entry.2222222222"
        interest: "", // e.g. "entry.3333333333"
        message: "", // e.g. "entry.4444444444"
      },
    },
  },
};

/** (placeholder) products — names, codes and copy are yours to rename */
export const products = [
  {
    id: "carrier",
    index: "3.1",
    code: "VR-01",
    kind: "Collaborative mobile robot",
    name: "Field-Mate", // working name: rename it here, nowhere else
    tagline:
      "A mobile robot that gets around on its own, follows you as you work, and goes wherever you guide it by hand.",
    points: [
      "Moves around on its own",
      "Follows you through the field",
      "A light touch guides it anywhere, no hard pushing",
    ],
  },
  {
    id: "spray",
    index: "3.2",
    code: "VR-02",
    kind: "Spraying robot",
    name: "Spray-Runner",
    tagline:
      "A wide boom of precision nozzles that sprays exactly where you tell it, row after row.",
    points: [
      "Multi-nozzle boom, built for tight rows",
      "Waypoint and row-following autonomy",
      "Voice-command ready",
    ],
  },
] as const;

export const features = [
  {
    id: "follow",
    title: "Autonomous Follow-Me",
    text: "The robot locks onto its operator and walks the field with them, carrying crates, tools or a full tank. Want it somewhere else? A light touch of the hand guides it there.",
  },
  {
    id: "spray",
    title: "Autonomous Spraying",
    text: "Set the rows, press go. The boom drives the lines and sprays along the path with nobody at the controls.",
  },
  {
    id: "asr",
    title: "ASR Module",
    text: "Talk to your robot. Onboard speech recognition turns plain spoken commands into actions, even with gloves on and the engine running.",
  },
  {
    id: "waypoint",
    title: "Waypoint Navigation",
    text: "Drop pins on the map and the robot drives the route in order: stop by stop, row by row, and back home.",
  },
] as const;

/** (placeholder) open roles */
export const roles = [
  { title: "Robotics Engineer (Manipulation)", team: "Hardware", where: "Onsite" },
  { title: "Perception Engineer (Crop Vision)", team: "AI", where: "Hybrid" },
  { title: "Field Operations Lead", team: "Deployments", where: "Onsite" },
  { title: "Farm Partnerships Manager", team: "Growth", where: "Remote" },
] as const;

/** Nav + section order. `id` matches the anchor id of each chapter. */
export const nav = [
  { id: "vision", label: "Vision" },
  { id: "video", label: "Video" },
  { id: "products", label: "Products" },
  { id: "features", label: "Features" },
  { id: "contact", label: "Contact" },
  { id: "join", label: "Join us" },
  { id: "play", label: "Play" },
] as const;
