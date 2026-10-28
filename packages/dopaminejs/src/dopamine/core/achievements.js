export const builtinAchievements = () => ({
    first_game: {
        name: 'First Steps',
        description: 'Play your first game',
        icon: '\u{1F3AE}',
        xp: 50,
        check: (player) => player.totalGamesPlayed >= 1
    },
    level_5: {
        name: 'Rising Star',
        description: 'Reach level 5',
        icon: '\u{2B50}',
        xp: 100,
        check: (player) => player.level >= 5
    },
    level_10: {
        name: 'Expert Player',
        description: 'Reach level 10',
        icon: '\u{1F3C6}',
        xp: 250,
        check: (player) => player.level >= 10
    },
    streak_3: {
        name: 'Dedicated',
        description: 'Play 3 days in a row',
        icon: '\u{1F525}',
        xp: 100,
        check: (player) => player.streak.current >= 3
    },
    streak_7: {
        name: 'Unstoppable',
        description: 'Play 7 days in a row',
        icon: '\u{1F4A5}',
        xp: 300,
        check: (player) => player.streak.current >= 7
    }
});

// Reward XP of the built-ins, used to read a 2.x document when the caller
// has no definitions of its own.
export const BUILTIN_REWARDS = { first_game: 50, level_5: 100, level_10: 250, streak_3: 100, streak_7: 300 };

export const rewardsOf = (achievements) => {
    const rewards = {};
    for (const id of Object.keys(achievements)) {
        rewards[id] = Number.isFinite(achievements[id]?.xp) && achievements[id].xp > 0 ? achievements[id].xp : 0;
    }
    return rewards;
};
