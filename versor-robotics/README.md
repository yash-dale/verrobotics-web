# Versor Robotics — landing page

Next.js 16 (App Router) + TypeScript. Beyond `lucide-react` icons the only runtime dependency is `three` (for the 3D rover); all other animation is CSS, SVG and canvas.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (what Vercel runs)
```

## Deploy on Vercel

1. Push this folder to a GitHub repo.
2. On vercel.com → **Add New → Project** → import the repo. Framework is auto-detected as Next.js; no environment variables are needed.
3. Deploy. (Or from this folder: `npx vercel`.)

## Where to edit things

Almost everything you will want to change is in **`src/lib/site.ts`**: contact details, product names and copy, feature copy, open roles, nav, video and Google Form settings. Anything marked *(placeholder)* is sample text I wrote, so replace it with your real details before launch.

Brand colours are CSS variables at the top of `src/app/globals.css` (and mirrored in `src/lib/palette.ts` for the SVGs).

## Add your video

The video lives in a retro TV in the **Video** section. Pick one:

**A. Self-hosted file** (simplest)
1. Export an MP4 (H.264) and name it `versor-demo.mp4`.
2. Drop it in `public/videos/` (optional: a thumbnail at `public/videos/poster.jpg`).
3. Redeploy. That's it. Keep the file reasonably small (compress with HandBrake); for long or large videos use B or C.

**B. YouTube**
Open `src/lib/site.ts` and set the video id:
```ts
video: { src: "...", poster: "...", youtubeId: "dQw4w9WgXcQ" } // from youtu.be/dQw4w9WgXcQ
```

**C. Hosted elsewhere** (Vimeo file link, Cloudflare R2, Vercel Blob…)
Set `src` to the full `https://…mp4` URL.

Until a video exists, visitors see a "Demo reel coming soon" screen instead of a broken player.

## Google Forms

### Join us
Create a Google Form for applications, click **Send → link**, and paste it into `site.forms.join.url`. "Apply now" and every open role will open it in a new tab. To show the form inline on the page too, also paste the iframe `src` from **Send → `<>` Embed HTML** into `site.forms.join.embedUrl`.

Until a link is set, "Apply now" opens an email to `site.email` instead.

### Contact form (styled form that posts into a Google Form)
1. Create a Google Form with four questions, **short answer** unless noted: *Name*, *Email*, *Interested in*, *Message* (paragraph). Don't require sign-in and don't add file uploads.
2. Form action URL: take the form's link (`https://docs.google.com/forms/d/e/<FORM_ID>/viewform`) and change `viewform` to `formResponse`. Paste it into `site.forms.contact.action`.
3. Field ids: in the form editor click **⋮ → Get pre-filled link**, type a dummy answer into each question, click **Get link**. The URL contains `entry.123456789=…` for each question. Paste each id into `site.forms.contact.fields`.

Responses then land in the form's **Responses** tab (and a linked Google Sheet if you add one). Until `action` is set, the form opens the visitor's email app instead, so no enquiry is lost.

## How the interesting bits work

- **Spray wash** (`src/components/Chapter.tsx`, `src/lib/wash.ts`, `src/lib/waterFx.ts`): every section sticks to the screen while a steel boom of nozzles sweeps left → right as you scroll, washing away the previous colour and revealing the new section. The water front is a smooth, rippling curve (`edgeX` in `wash.ts`), the jets, mist, splashes, glossy wet film and the rivulets that run down afterwards are drawn on one canvas (`waterFx.ts`). It is scroll-linked (no scroll-jacking). Make the sweep longer or shorter with `WASH_SPAN` in `wash.ts` (viewport heights of scrolling) and the `.runway` height in `Chapter.module.css`; change nozzle spacing in `rowPx()`.
- **Nav links glide at a paced speed** (`src/components/SmoothAnchors.tsx`): clicking Vision / Products / … scrolls quickly between sections, then slows down so the wash of the section you asked for plays out in about 1.3 s. To make it slower or faster change `DEST` (seconds per destination wash) and `CRUISE` / `MID` in that file. Any wheel, touch or key press hands control straight back to the visitor.
- **3D rover** (`src/components/RoverToy.tsx`, `rover3d.ts`, `rover3d.config.ts`): a cube body, four wheels and a spray mast with five nozzles on its right side, built with three.js and loaded lazily so it doesn't slow the first paint. It drives around the screen by itself, turning like a real vehicle (front wheels steer, left/right wheels turn at different speeds, the body leans). Mouse, keyboard and scrolling do **not** stop it. The only thing that does is grabbing it: pick it up, drop it anywhere, and it stays put for `HOLD_MS` (10 s) before driving off again. It never drives onto, or sits on, anything marked `data-rover-avoid` (the video TV and the game cabinet). If a browser can't do WebGL it falls back to a flat SVG rover.
- **Field Run** (`src/components/Game.tsx`, `src/lib/fieldRun.ts`): the landscape lane-runner at the end of the page. **Enter** starts / restarts, **W / ↑** and **S / ↓** change lane, **D / →** boosts, **A / ←** brakes, **P / Esc** pauses. Keys only steer the game while it is on screen and being played, so typing in the contact form is never hijacked. On phones there are on-screen buttons plus swipe up/down. The best score is kept in the browser (`localStorage`). Obstacle mix, speed curve and spacing are at the top of `fieldRun.ts` and in `spawnWave()`.
- **Reduced motion**: if a visitor's OS asks for reduced motion, the sweep, marquee, nav glide and the rover's roaming are switched off (the rover can still be dragged).
- **Fonts**: Montserrat (headings/body) and Space Mono (small labels) are bundled via `@fontsource`, so there are no external font requests.
- **Adding pages later** (login, dashboard, …): the landing page lives in the `src/app/(marketing)` route group, which has its own layout (header, footer, rover), so new route groups can have a different layout without touching it.
