import { createAvatar } from "@dicebear/core";
import { thumbs } from "@dicebear/collection";

// All non-transparent background colours from DiceBear thumbs style
const BG_COLORS = [
  "b6e3f4",
  "c0aede",
  "d1d4f9",
  "ffd5dc",
  "ffdfbf",
  "00acc1",
  "e91e63",
  "9c27b0",
  "673ab7",
  "3f51b5",
  "2196f3",
  "03a9f4",
  "009688",
  "4caf50",
  "8bc34a",
  "cddc39",
  "ffc107",
  "ff9800",
  "ff5722",
  "795548",
];

// Shape colours for the thumbs character body — varied palette so avatars
// don't all end up the same blue
const SHAPE_COLORS = [
  "ff595e",
  "ff924c",
  "ffca3a",
  "8ac926",
  "52b788",
  "1982c4",
  "6a4c93",
  "f72585",
  "ff006e",
  "fb5607",
  "3a86ff",
  "06d6a0",
  "ef476f",
  "ffd166",
  "56cfe1",
  "ff70a6",
  "80b918",
  "ffb703",
  "4cc9f0",
  "c77dff",
];

function getAvatarSvg(seed: string, size = 36): string {
  const avatar = createAvatar(thumbs, {
    seed,
    size,
    backgroundType: ["solid"],
    backgroundColor: BG_COLORS,
    shapeColor: SHAPE_COLORS,
  });
  return avatar.toString();
}

export function getAvatarDataUri(seed: string, size = 36): string {
  const svg = getAvatarSvg(seed, size);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
