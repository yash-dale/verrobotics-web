import { C } from "@/lib/palette";

const mono = { fontFamily: '"Space Mono", ui-monospace, monospace' } as const;
const ink = { stroke: C.ink, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

const Frame = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <svg viewBox="0 0 320 180" role="img" aria-label={label} style={{ display: "block", width: "100%", height: "auto" }}>
    <rect width="320" height="180" fill={C.deep} />
    {children}
  </svg>
);

/** Top-down rover used by several diagrams. Faces +x. */
const MiniRover = () => (
  <g>
    <rect x="-12" y="-9" width="8" height="3.5" rx="1.5" fill={C.ink} />
    <rect x="-12" y="5.5" width="8" height="3.5" rx="1.5" fill={C.ink} />
    <rect x="4" y="-9" width="8" height="3.5" rx="1.5" fill={C.ink} />
    <rect x="4" y="5.5" width="8" height="3.5" rx="1.5" fill={C.ink} />
    <rect x="-14" y="-7" width="28" height="14" rx="5" fill={C.tomato} {...ink} strokeWidth="2" />
    <rect x="5" y="-4.5" width="4" height="3" rx="1" fill={C.cream} />
    <rect x="5" y="1.5" width="4" height="3" rx="1" fill={C.cream} />
  </g>
);

/* 1 ─ Follow me: operator walks a loop, rover trails a few steps behind */
export function FollowMeDiagram() {
  const loop = "M70 90C70 40 120 34 160 34C210 34 250 40 250 90C250 140 210 146 160 146C120 146 70 140 70 90Z";
  return (
    <Frame label="Top-down map: a rover follows its operator around a field">
      <defs>
        <path id="fm-loop" d={loop} />
      </defs>
      <use href="#fm-loop" fill="none" stroke={C.cream} strokeOpacity="0.28" strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round" />

      {/* rover (trailing) */}
      <g>
        <animateMotion dur="9s" repeatCount="indefinite" rotate="auto">
          <mpath href="#fm-loop" />
        </animateMotion>
        <MiniRover />
      </g>

      {/* operator (leading) */}
      <g>
        <animateMotion dur="9s" begin="-1.5s" repeatCount="indefinite" rotate="auto">
          <mpath href="#fm-loop" />
        </animateMotion>
        <circle r="9" fill="none" stroke={C.amber} strokeWidth="2">
          <animate attributeName="r" values="8;22" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0" dur="1.8s" repeatCount="indefinite" />
        </circle>
        <ellipse rx="4.5" ry="9" fill={C.amber} {...ink} strokeWidth="2" />
        <circle r="4" fill={C.cream} {...ink} strokeWidth="2" />
      </g>

      <circle cx="26" cy="160" r="4" fill={C.sprout}>
        <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />
      </circle>
      <text x="38" y="164" fontSize="11" fontWeight="700" letterSpacing="1.5" fill={C.cream} {...mono}>
        FOLLOWING
      </text>
    </Frame>
  );
}

/* 2 ─ Autonomous spraying: boom sweeps a crop field and leaves it wet */
export function SprayDiagram() {
  const rowsY = [36, 72, 108, 144];
  const cols = Array.from({ length: 15 }, (_, i) => 20 + i * 20);
  return (
    <Frame label="Top-down map: a spraying rover drives across crop rows and wets them">
      {rowsY.map((y) =>
        cols.map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill={C.sprout} opacity="0.9" />),
      )}

      <g>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.88;1" dur="6s" repeatCount="indefinite" />
        <rect x="0" y="0" width="0" height="180" fill={C.steel} opacity="0.4">
          <animate attributeName="width" from="0" to="340" dur="6s" repeatCount="indefinite" />
        </rect>
      </g>

      <g>
        <animateTransform attributeName="transform" type="translate" from="0 0" to="340 0" dur="6s" repeatCount="indefinite" />
        {rowsY.map((y) => (
          <g key={y}>
            <path d={`M12 ${y - 9}q8 9 0 18`} fill="none" stroke={C.cream} strokeWidth="2.4" strokeLinecap="round" />
            <path d={`M19 ${y - 14}q11 14 0 28`} fill="none" stroke={C.cream} strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
          </g>
        ))}
        <rect x="-5" y="12" width="10" height="156" rx="3" fill={C.amber} {...ink} strokeWidth="2.5" />
        {rowsY.map((y) => (
          <circle key={y} cx="5" cy={y} r="3.6" fill={C.tomato} {...ink} strokeWidth="1.8" />
        ))}
        <line x1="-5" y1="90" x2="-18" y2="90" {...ink} strokeWidth="4" />
        <rect x="-44" y="72" width="28" height="36" rx="7" fill={C.tomato} {...ink} strokeWidth="2.5" />
        <rect x="-26" y="79" width="5" height="6" rx="1.5" fill={C.cream} />
        <rect x="-26" y="95" width="5" height="6" rx="1.5" fill={C.cream} />
      </g>
    </Frame>
  );
}

/* 3 ─ ASR: a spoken command, a spoken reply, live waveform */
export function AsrDiagram() {
  const bars = Array.from({ length: 19 }, (_, i) => i);
  return (
    <Frame label="A spoken command, 'Spray rows three to six', and the robot's spoken reply">
      <g>
        <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.06;0.85;0.92;1" dur="8s" repeatCount="indefinite" />
        <rect x="20" y="14" width="214" height="34" rx="12" fill={C.cream} {...ink} strokeWidth="2.5" />
        <path d="M40 48l-5 11l17-11z" fill={C.cream} {...ink} strokeWidth="2.5" />
        <rect x="36" y="46" width="14" height="4" fill={C.cream} />
        <text x="34" y="36" fontSize="12" fontWeight="700" fill={C.ink} {...mono}>
          “Spray rows three to six.”
        </text>
      </g>
      <g>
        <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.3;0.37;0.85;0.92;1" dur="8s" repeatCount="indefinite" />
        <rect x="86" y="62" width="214" height="34" rx="12" fill={C.amber} {...ink} strokeWidth="2.5" />
        <path d="M278 96l5 11l-17-11z" fill={C.amber} {...ink} strokeWidth="2.5" />
        <rect x="266" y="94" width="14" height="4" fill={C.amber} />
        <text x="100" y="84" fontSize="12" fontWeight="700" fill={C.ink} {...mono}>
          Copy. Starting now.
        </text>
      </g>
      {bars.map((i) => {
        const x = 24 + i * 15;
        return (
          <rect
            key={i}
            className="rv-bar"
            x={x}
            y="130"
            width="8"
            height="36"
            rx="4"
            fill={i % 4 === 0 ? C.amber : C.sprout}
            style={{
              transformOrigin: `${x + 4}px 148px`,
              animationDelay: `${(i * 0.17) % 1.1}s`,
              animationDuration: `${0.8 + (i % 5) * 0.13}s`,
            }}
          />
        );
      })}
    </Frame>
  );
}

/* 4 ─ Waypoints: pins on a map, rover drives them in order */
export function WaypointDiagram() {
  const pts: [number, number][] = [
    [40, 140],
    [100, 60],
    [190, 110],
    [270, 40],
  ];
  const path = `M${pts.map((p) => p.join(" ")).join("L")}`;
  const pulses = [0.32, 0.65, 0.88];
  return (
    <Frame label="A map with four numbered waypoints; the rover drives them in order">
      <path d="M0 45H320M0 90H320M0 135H320M80 0V180M160 0V180M240 0V180" stroke={C.cream} strokeOpacity="0.09" strokeWidth="1.5" />
      <path d={path} fill="none" stroke={C.cream} strokeOpacity="0.45" strokeWidth="2.5" strokeDasharray="4 7" strokeLinecap="round" strokeLinejoin="round" />

      {pulses.map((f, i) => (
        <circle key={i} cx={pts[i + 1][0]} cy={pts[i + 1][1]} r="11" fill="none" stroke={C.amber} strokeWidth="2.5">
          <animate attributeName="r" values="11;11;30;30" keyTimes={`0;${f};${f + 0.1};1`} dur="7s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0;0.9;0;0" keyTimes={`0;${f};${f + 0.002};${f + 0.1};1`} dur="7s" repeatCount="indefinite" />
        </circle>
      ))}

      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="11" fill={i === 0 ? C.sprout : C.amber} {...ink} strokeWidth="2.5" />
          <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="700" fill={C.ink} {...mono}>
            {i + 1}
          </text>
        </g>
      ))}

      <g>
        <animateMotion path={path} dur="7s" repeatCount="indefinite" rotate="auto" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.04;0.93;1" dur="7s" repeatCount="indefinite" />
        <MiniRover />
      </g>
    </Frame>
  );
}
