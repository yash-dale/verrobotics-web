import { C } from "@/lib/palette";

type BotProps = { className?: string; title?: string };

const stroke = { stroke: C.ink, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/**
 * Little rover: the mascot, header logo and footer. A cube on four wheels with a spray mast on its right side.
 * Faces right, so the mast (with its row of nozzles) is the side we see.
 */
export function RoverBot({ className, title = "Versor rover" }: BotProps) {
  return (
    <svg viewBox="0 0 120 76" className={className} role="img" aria-label={title}>
      <ellipse cx="60" cy="72.5" rx="48" ry="3.5" fill="rgba(0,0,0,0.28)" />

      {/* far-side wheels peeking out behind the near ones */}
      {[31, 83].map((cx) => (
        <circle key={`far${cx}`} cx={cx} cy="55" r="10.5" fill="#0b1413" />
      ))}

      {/* antenna + beacon */}
      <line x1="82" y1="15" x2="82" y2="6" {...stroke} strokeWidth="2.4" />
      <circle className="rv-beacon" cx="82" cy="5" r="3.3" fill={C.amber} {...stroke} strokeWidth="2" />

      {/* roof tank */}
      <rect x="24" y="4" width="32" height="12" rx="6" fill={C.sprout} {...stroke} strokeWidth="3" />
      <path d="M33 5v10M47 5v10" stroke={C.ink} strokeWidth="2" opacity="0.7" />

      {/* cube body + roof lid */}
      <rect x="14" y="21" width="86" height="33" rx="9" fill={C.tomato} {...stroke} strokeWidth="3.5" />
      <rect x="18" y="14" width="78" height="10" rx="4.5" fill={C.cream} {...stroke} strokeWidth="3" />
      <rect x="17" y="43" width="80" height="5" rx="2.5" fill={C.amber} />
      <rect x="19" y="49" width="76" height="3" rx="1.5" fill={C.tomatoDark} />

      {/* face (front) and tail lamp (rear) */}
      <rect x="93" y="26" width="9" height="17" rx="3.5" fill={C.ink} />
      <circle cx="97.5" cy="31" r="2.2" fill={C.cream} />
      <circle cx="97.5" cy="38" r="2.2" fill={C.cream} />
      <rect x="11" y="27" width="4" height="6" rx="1.5" fill="#ff6a45" {...stroke} strokeWidth="1.6" />

      {/* spray mast on the right side: five nozzles pointing at us, with a little mist */}
      <rect x="53" y="22" width="14" height="5" rx="2" fill={C.ink} />
      <rect x="53" y="43" width="14" height="5" rx="2" fill={C.ink} />
      <rect x="56.5" y="9" width="7" height="52" rx="3.5" fill={C.steel} {...stroke} strokeWidth="2.4" />
      {[14, 24.5, 35, 45.5, 56].map((cy) => (
        <g key={cy}>
          <circle cx="60" cy={cy} r="3.8" fill={C.amber} {...stroke} strokeWidth="1.8" />
          <circle cx="60" cy={cy} r="1.2" fill={C.ink} />
        </g>
      ))}
      {[
        [67, 11, 1.1],
        [71, 17, 0.9],
        [69, 28, 1.2],
        [74, 31, 0.8],
        [68, 39, 1],
        [73, 46, 1.1],
        [67, 52, 0.9],
        [72, 58, 0.8],
      ].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={C.cream} opacity="0.85" />
      ))}

      {/* near-side wheels (the two that turn) */}
      {[36, 86].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="59" r="12.5" fill={C.ink} />
          <g className="rv-wheel" style={{ transformOrigin: `${cx}px 59px` }}>
            <circle cx={cx} cy="59" r="7" fill={C.steel} />
            <path d={`M${cx} 52.5V65.5M${cx - 6.5} 59H${cx + 6.5}`} stroke={C.ink} strokeWidth="2.2" strokeLinecap="round" />
            <circle cx={cx} cy="59" r="2" fill={C.amber} />
          </g>
        </g>
      ))}
    </svg>
  );
}

const berry = (cx: number, cy: number, r = 8) => (
  <g key={`${cx}-${cy}`}>
    <circle cx={cx} cy={cy} r={r} fill={C.tomato} {...stroke} strokeWidth="2.5" />
    <path
      d={`M${cx - 5} ${cy - r + 1}q5-5 10 0q-5 3.5-10 0z`}
      fill={C.sprout}
      {...stroke}
      strokeWidth="1.6"
    />
    <circle cx={cx - 2.5} cy={cy + 1} r="0.9" fill={C.cream} />
    <circle cx={cx + 2.5} cy={cy + 3} r="0.9" fill={C.cream} />
  </g>
);

/**
 * Collaborative mobile robot, side view facing right: a low wheeled carrier with a crate on its deck
 * and a touch handle at the back that the operator holds to guide it.
 */
export function CarrierBot({ className, title = "Collaborative mobile robot" }: BotProps) {
  return (
    <svg viewBox="0 0 220 150" className={className} role="img" aria-label={title}>
      <ellipse cx="108" cy="146" rx="86" ry="4" fill="rgba(0,0,0,0.28)" />

      {/* far-side wheels peeking out behind the near ones */}
      {[66, 158].map((cx) => (
        <circle key={`far${cx}`} cx={cx} cy="121" r="15" fill="#0b1413" />
      ))}

      {/* touch handle: a curved bar rising from the rear, grip on top, pulses where the hand goes */}
      <path d="M48 98L36 52Q33 42 23 42H17" fill="none" stroke={C.ink} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M48 98L36 52Q33 42 23 42H17" fill="none" stroke={C.steel} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="11" y="35.5" width="24" height="13" rx="6.5" fill={C.tomato} {...stroke} strokeWidth="3" />
      <path d="M17 39.5v5M23 39.5v5M29 39.5v5" stroke={C.ink} strokeWidth="1.8" opacity="0.55" />
      <g className="rv-fan" fill="none" stroke={C.amber} strokeWidth="2.4" strokeLinecap="round">
        <path d="M14 27q9-6 18 0" />
        <path d="M9 21q14-9 28 0" opacity="0.6" />
      </g>

      {/* antenna + beacon over the front sensor */}
      <line x1="170" y1="93" x2="170" y2="82" {...stroke} strokeWidth="2.6" />
      <circle className="rv-beacon" cx="170" cy="79" r="3.8" fill={C.amber} {...stroke} strokeWidth="2.2" />

      {/* produce peeking over the crate, then the crate itself */}
      {berry(88, 55)}
      {berry(105, 51, 8.5)}
      {berry(122, 55)}
      <rect x="68" y="57" width="76" height="36" rx="3.5" fill={C.amber} {...stroke} strokeWidth="3" />
      <path d="M68 69H144M68 81H144" stroke={C.ink} strokeWidth="2" opacity="0.5" />
      <path d="M80 59V91M132 59V91" stroke={C.ink} strokeWidth="2" opacity="0.35" />
      <rect x="97" y="62" width="18" height="5" rx="2.5" fill={C.ink} opacity="0.75" />

      {/* low chassis: cream deck plate on a green body */}
      <rect x="32" y="91" width="150" height="9" rx="4.5" fill={C.cream} {...stroke} strokeWidth="3" />
      <rect x="26" y="98" width="160" height="28" rx="11" fill={C.sprout} {...stroke} strokeWidth="3.5" />
      <rect x="38" y="114" width="64" height="5" rx="2.5" fill={C.sproutDark} />

      {/* front sensor face and rear lamp */}
      <rect x="158" y="103" width="22" height="14" rx="5" fill={C.ink} />
      <circle cx="165" cy="110" r="2.4" fill={C.cream} />
      <circle cx="173" cy="110" r="2.4" fill={C.cream} />
      <rect x="23" y="103" width="5" height="8" rx="2" fill="#ff6a45" {...stroke} strokeWidth="1.6" />

      {/* near-side wheels */}
      {[58, 150].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="126" r="17" fill={C.ink} />
          <g className="rv-wheel" style={{ transformOrigin: `${cx}px 126px` }}>
            <circle cx={cx} cy="126" r="9.5" fill={C.steel} />
            <path d={`M${cx} 117.5V134.5M${cx - 8.5} 126H${cx + 8.5}`} stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" />
            <circle cx={cx} cy="126" r="2.6" fill={C.amber} />
          </g>
        </g>
      ))}
    </svg>
  );
}

/** Spraying robot, front view: wide boom with a row of nozzles throwing spray. */
export function SprayerBot({ className, title = "Spraying robot" }: BotProps) {
  const nozzles = [22, 52, 82, 158, 188, 218];
  return (
    <svg viewBox="0 0 240 150" className={className} role="img" aria-label={title}>
      <ellipse cx="120" cy="146" rx="96" ry="4" fill="rgba(0,0,0,0.28)" />

      {/* spray fans */}
      {nozzles.map((x, i) => (
        <g key={x}>
          <path
            className="rv-fan"
            style={{ animationDelay: `${i * 0.18}s` }}
            d={`M${x} 82L${x - 16} 138L${x + 16} 138Z`}
            fill={C.cream}
          />
          {[-5, 4].map((dx, j) => (
            <circle
              key={j}
              className="rv-drop"
              style={{ animationDelay: `${i * 0.21 + j * 0.55}s` }}
              cx={x + dx}
              cy="90"
              r="2.2"
              fill={C.cream}
            />
          ))}
        </g>
      ))}

      {/* boom */}
      <rect x="8" y="62" width="224" height="11" rx="5.5" fill={C.amber} {...stroke} strokeWidth="3" />
      <path d="M30 64v7M56 64v7M82 64v7M158 64v7M184 64v7M210 64v7" stroke={C.ink} strokeWidth="2" opacity="0.45" />
      {nozzles.map((x) => (
        <g key={x}>
          <rect x={x - 3.5} y="73" width="7" height="8" rx="1.5" fill={C.ink} />
          <rect x={x - 5} y="79" width="10" height="4" rx="1.5" fill={C.tomato} {...stroke} strokeWidth="1.5" />
        </g>
      ))}

      {/* wheels */}
      <rect x="62" y="102" width="24" height="40" rx="9" fill={C.ink} />
      <rect x="154" y="102" width="24" height="40" rx="9" fill={C.ink} />
      <path d="M67 113H81M67 122H81M67 131H81M159 113H173M159 122H173M159 131H173" stroke={C.steel} strokeWidth="2.4" strokeLinecap="round" />

      {/* body + tank */}
      <path d="M92 46v-8q0-17 28-17t28 17v8z" fill={C.cream} {...stroke} strokeWidth="3.5" />
      <path d="M120 27q-6 8-6 12a6 6 0 0 0 12 0q0-4-6-12z" fill={C.steel} {...stroke} strokeWidth="2" />
      <rect x="84" y="44" width="72" height="68" rx="12" fill={C.steel} {...stroke} strokeWidth="3.5" />
      <rect x="94" y="68" width="52" height="22" rx="6" fill={C.ink} />
      <rect x="102" y="75" width="14" height="8" rx="2" fill={C.cream} />
      <rect x="124" y="75" width="14" height="8" rx="2" fill={C.cream} />
      <circle className="rv-beacon" cx="120" cy="101" r="4" fill={C.amber} {...stroke} strokeWidth="2" />
    </svg>
  );
}

/** A little sprout in the soil. */
export function SproutIcon({ className, title = "Sprout" }: BotProps) {
  return (
    <svg viewBox="0 0 100 150" className={className} role="img" aria-label={title}>
      <ellipse cx="50" cy="143" rx="34" ry="6" fill={C.soil} {...stroke} strokeWidth="3" />
      <g className="rv-sway">
        <path d="M50 140V66" stroke={C.ink} strokeWidth="11" strokeLinecap="round" />
        <path d="M50 140V66" stroke={C.sprout} strokeWidth="5" strokeLinecap="round" />
        <path d="M50 96C26 96 13 80 11 58C34 58 50 74 50 96Z" fill={C.sprout} {...stroke} strokeWidth="3.5" />
        <path d="M50 78C72 78 87 62 89 40C66 40 50 55 50 78Z" fill={C.sproutDark} {...stroke} strokeWidth="3.5" />
        <path d="M44 92Q30 80 22 66M56 74Q70 62 78 50" stroke={C.ink} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
      </g>
    </svg>
  );
}
