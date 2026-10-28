const DAY = 864e5;
const SHAPE = /^\d{4}-\d{2}-\d{2}$/;

// Calendar days are plain integers, so no clock zone or daylight saving
// change can move them.
const dayNum = (text) => {
    const date = new Date(0);
    date.setUTCFullYear(+text.slice(0, 4), +text.slice(5, 7) - 1, +text.slice(8));
    return date.getTime() / DAY;
};
const dayText = (num) => new Date(num * DAY).toISOString().slice(0, 10);

export const isDay = (text) => typeof text === 'string' && SHAPE.test(text) && dayText(dayNum(text)) === text;

export const shiftDay = (text, days) => dayText(dayNum(text) + days);

// Sorted and unique. With `today`, nothing older than 400 days counting today
// goes. The window comes from today, never from the newest entry, so a date in
// the future cannot push real history out. Without `today` nothing is dropped.
export function trimDays(days, today) {
    const sorted = [...new Set(days)].sort();
    if (!today) return sorted;
    const floor = dayNum(today) - 399;
    return sorted.filter((day) => dayNum(day) >= floor);
}

// Run of consecutive days ending today, or ending yesterday when today has
// no play yet. Days after today are ignored.
export function currentStreak(days, today) {
    const set = new Set(days);
    let at = set.has(today) ? today : shiftDay(today, -1);
    let count = 0;
    while (set.has(at)) {
        count++;
        at = shiftDay(at, -1);
    }
    return count;
}

export function longestRun(days) {
    let best = 0;
    let run = 0;
    let previous = NaN;
    for (const day of [...days].sort()) {
        const num = dayNum(day);
        run = num === previous + 1 ? run + 1 : 1;
        previous = num;
        if (run > best) best = run;
    }
    return best;
}

export const lastDayUntil = (days, today) => days.reduce((last, day) => (day <= today && (!last || day > last) ? day : last), undefined);
