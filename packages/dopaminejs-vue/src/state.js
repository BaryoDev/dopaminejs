/**
 * Snapshot of a RewardSystem for the Vue composable.
 *
 * Kept free of Vue so it can be tested without a component.
 *
 * @param {import('dopaminejs').RewardSystem} rewards
 */
export function buildState(rewards) {
    // Before init() has loaded a player the reward system has nothing to
    // report, and its getters throw.
    let player;
    try {
        player = rewards.snapshot();
    } catch {
        return { player: {}, level: 1, xp: 0, progress: 0, achievements: [] };
    }

    // getXPForNextLevel() returns { total, needed, progress }, where progress
    // is the position within the current level, 0 to 1, already clamped.
    const next = rewards.getXPForNextLevel();

    return {
        player,
        level: player.level ?? 1,
        xp: player.xp ?? 0,
        progress: next.progress,
        achievements: rewards.getUnlockedAchievements(),
    };
}
