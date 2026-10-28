// Curve: XP = 50 * level * (level - 1)
export const levelFor = (xp) => (xp > 0 ? Math.max(1, Math.floor((1 + Math.sqrt(1 + 4 * xp / 50)) / 2)) : 1);

export const thresholdFor = (level) => 50 * level * (level - 1);
