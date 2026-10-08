/**
 * Camera + sizing constants for the 3D rover. Kept separate from rover3d.ts so the page can use them
 * without pulling three.js into the main bundle (rover3d.ts is loaded lazily).
 */

/** On-screen size of the rover's canvas (CSS px) */
export const VIEW_W = 184;
export const VIEW_H = 152;

/** Camera: a perspective view from the front-right, looking down at ~34° */
export const FOV = 20; // vertical, degrees
export const DIST = 7.6; // camera distance from the look-at point (world units)
export const ELEV = (34 * Math.PI) / 180;
export const SIN_E = Math.sin(ELEV);
export const COS_E = Math.cos(ELEV);
export const TARGET_Y = 0.62; // height of the look-at point

const TAN_HALF = Math.tan((FOV * Math.PI) / 360);

/** Screen pixels per world unit at the look-at distance */
export const PX_PER_UNIT = VIEW_H / (2 * DIST * TAN_HALF);

/** Where the rover's ground point (its "feet") appears inside the canvas, in CSS px */
export const ORIGIN_X = VIEW_W / 2;
export const ORIGIN_Y = VIEW_H / 2 + ((TARGET_Y * COS_E) / ((DIST + TARGET_Y * SIN_E) * TAN_HALF)) * (VIEW_H / 2);

/** Distance between the left and right wheel centres / 2, and wheel radius (world units) */
export const HALF_TRACK = 0.64;
export const WHEEL_R = 0.27;
