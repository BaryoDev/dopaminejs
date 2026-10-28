const pad = (value, width = 2) => String(value).padStart(width, '0');

// The only place that reads the system time. localDate is the local calendar
// day, never UTC.
export const systemClock = {
    now: () => Date.now(),
    localDate(ms = Date.now()) {
        const date = new Date(ms);
        return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
};
