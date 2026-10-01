/**
 * Snapshot of a RewardSystem for the React context.
 *
 * Kept free of React so it can be tested without a renderer.
 *
 * @param {import('dopaminejs').RewardSystem} rewards
 */
export function buildState(rewards) {
    // Before init() has loaded a player the reward system has nothing to
    // report, and its getters throw.
    if (!rewards.player) {
        return { player: {}, level: 1, xp: 0, progress: 0, achievements: [] };
    }

    const { player } = rewards;

    // getXPForNextLevel() returns { total, needed, progress }, where progress
    // is the position within the current level, 0 to 1.
    const next = rewards.getXPForNextLevel();
    const progress = Number.isFinite(next?.progress)
        ? Math.min(1, Math.max(0, next.progress))
        : 0;

    return {
        player,
        level: player.level ?? 1,
        xp: player.xp ?? 0,
        progress,
        achievements: rewards.getUnlockedAchievements(),
    };
}
