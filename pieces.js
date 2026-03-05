export const COLORS = [
  "#fdd835", // yellow
  "#fb8c00", // orange
  "#e53935", // red
  "#1e88e5", // blue
  "#fbc02d", // amber
  "#43a047", // green
  "#8e24aa", // purple
  "#26a69a", // teal
  "#f57c00", // deep orange
  "#5e35b1"  // indigo
];

export const COLOR = {
  yellow: COLORS[0],
  orange: COLORS[1],
  red: COLORS[2],
  blue: COLORS[3],
  amber: COLORS[4],
  green: COLORS[5],
  purple: COLORS[6],
  teal: COLORS[7],
  deepOrange: COLORS[8],
  indigo: COLORS[9]
};

// Each entry describes a preset piece with a matching glossy color and rarity weight.
export const PIECE_SET = [
  // Singles & lines
  { name:"single", cells:[[0,0]], color:COLOR.yellow, weight: 2 },

  { name:"1x2", cells:[[0,0],[0,1]], color:COLOR.orange, weight: 3 },
  { name:"2x1", cells:[[0,0],[1,0]], color:COLOR.orange, weight: 3 },

  { name:"1x3", cells:[[0,0],[0,1],[0,2]], color:COLOR.red, weight: 2 },
  { name:"3x1", cells:[[0,0],[1,0],[2,0]], color:COLOR.red, weight: 2 },

  { name:"1x4", cells:[[0,0],[0,1],[0,2],[0,3]], color:COLOR.blue, weight: 1.5 },
  { name:"4x1", cells:[[0,0],[1,0],[2,0],[3,0]], color:COLOR.blue, weight: 1.5 },

  // Square
  { name:"2x2", cells:[[0,0],[0,1],[1,0],[1,1]], color:COLOR.amber, weight: 2.5 },

  // T shapes (4 rotations)
  { name:"T-up",    cells:[[0,0],[0,1],[0,2],[1,1]], color:COLOR.purple, weight: 2 },
  { name:"T-right", cells:[[0,0],[1,0],[2,0],[1,1]], color:COLOR.purple, weight: 2 },
  { name:"T-down",  cells:[[1,0],[1,1],[1,2],[0,1]], color:COLOR.purple, weight: 2 },
  { name:"T-left",  cells:[[0,1],[1,1],[2,1],[1,0]], color:COLOR.purple, weight: 2 },

  // L / J variants
  { name:"L",     cells:[[0,0],[1,0],[2,0],[2,1]], color:COLOR.blue, weight: 2 },
  { name:"J",     cells:[[0,1],[1,1],[2,1],[2,0]], color:COLOR.green, weight: 2 },
  { name:"L-top", cells:[[0,0],[0,1],[1,0],[2,0]], color:COLOR.blue, weight: 1.5 },
  { name:"J-top", cells:[[0,0],[0,1],[1,1],[2,1]], color:COLOR.green, weight: 1.5 },

  // S / Z
  { name:"Z", cells:[[0,0],[0,1],[1,1],[1,2]], color:COLOR.red, weight: 1.5 },
  { name:"S", cells:[[1,0],[0,1],[1,1],[0,2]], color:COLOR.teal, weight: 1.5 },

  // Rectangles (2×3 / 3×2)
  { name:"2x3", cells:[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], color:COLOR.deepOrange, weight: 1.2 },
  { name:"3x2", cells:[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]], color:COLOR.deepOrange, weight: 1.2 },

  // Rare: 3-step “stairs”
  { name:"stairs-3", cells:[[0,0],[1,0],[1,1],[2,1],[2,2]], color:COLOR.indigo, weight: 0.4 }
];

export function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= (item.weight || 1);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

