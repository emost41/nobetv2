import { format, getWeek, getDay } from 'date-fns';

// Existing helpers and distribution logic are intentionally preserved above.
// Weekly service mode is implemented as a strict two-role scheduler below.

function distributeWeeklyService(days, staffList, schedule, currentTasks, columnConfig, columnIndex, fillEmptyOnly) {
    const result = { ...currentTasks };
    const selected = [...(columnConfig.eligibleSeniorities || [])];
    if (selected.length !== 2) return result;

    const seniorities = [...selected].sort((a, b) => b - a);
    const upper = staffList.filter(s => s.seniority === seniorities[0]);
    const lower = staffList.filter(s => s.seniority === seniorities[1]);
    if (!upper.length || !lower.length) return result;

    const targetWeekdays = columnConfig.targetWeekdays || [];
    const targets = days
        .filter(day => !isTurkishHoliday(day))
        .filter(day => targetWeekdays.length === 0 || targetWeekdays.includes(getDay(day)))
        .sort((a, b) => a - b);
    const weeks = [...new Set(targets.map(getWeekKey))];

    const dateKey = d => format(d, 'yyyy-MM-dd');
    const hasNobet = (person, day) => {
        const prev = new Date(day);
        prev.setDate(prev.getDate() - 1);
        const shifts = schedule?.[dateKey(prev)] || [];
        return shifts.some(x => x.id === person.id);
    };
    const unavailable = (person, day) => {
        const key = dateKey(day);
        return person.leaveDays?.includes(key) || person.unavailability?.includes(key) || hasNobet(person, day);
    };

    const nobetCount = (person, week) => Object.keys(schedule || {}).reduce((n, key) => {
        const d = new Date(key + 'T00:00:00');
        if (getWeekKey(d) !== week) return n;
        return n + ((schedule[key] || []).some(x => x.id === person.id) ? 1 : 0);
    }, 0);

    const serviceUsed = {};
    staffList.forEach(s => { serviceUsed[s.id] = 0; });

    // Choose a WEEKLY PAIR first. No daily rule is allowed to change the roles.
    const pairs = {};
    weeks.forEach(week => {
        let best = null;
        upper.forEach(u => lower.forEach(l => {
            const uBadDays = targets.filter(d => getWeekKey(d) === week && unavailable(u, d)).length;
            const lBadDays = targets.filter(d => getWeekKey(d) === week && unavailable(l, d)).length;
            const score = [
                // Prefer a pair with no forced split, then fewer forced splits.
                (uBadDays > 0 ? 1 : 0) + (lBadDays > 0 ? 1 : 0),
                uBadDays + lBadDays,
                nobetCount(u, week) + nobetCount(l, week),
                serviceUsed[u.id] + serviceUsed[l.id],
                serviceUsed[u.id],
                serviceUsed[l.id],
                String(u.id),
                String(l.id)
            ];
            if (!best || compareScore(score, best.score) < 0) best = { u, l, score };
        }));
        if (best) {
            pairs[week] = best;
            serviceUsed[best.u.id]++;
            serviceUsed[best.l.id]++;
        }
    });

    // Daily replacement is STRICTLY within the same seniority group.
    const replacement = (person, group, day, week) => {
        if (!unavailable(person, day)) return person.id;
        const candidates = group
            .filter(x => x.id !== person.id && !unavailable(x, day))
            .sort((a, b) => {
                const aa = nobetCount(a, week), bb = nobetCount(b, week);
                if (aa !== bb) return aa - bb;
                if ((serviceUsed[a.id] || 0) !== (serviceUsed[b.id] || 0)) return (serviceUsed[a.id] || 0) - (serviceUsed[b.id] || 0);
                return String(a.id).localeCompare(String(b.id));
            });
        return candidates[0]?.id || null;
    };

    targets.forEach(day => {
        const key = dateKey(day);
        if (fillEmptyOnly && result[key]?.[columnIndex]) return;
        const pair = pairs[getWeekKey(day)];
        if (!pair) return;

        const upperId = replacement(pair.u, upper, day, getWeekKey(day));
        const lowerId = replacement(pair.l, lower, day, getWeekKey(day));
        const ids = [upperId, lowerId].filter(Boolean);

        // Hard invariant: exactly one selected upper and one selected lower role.
        if (ids.length !== 2 || ids[0] === ids[1]) return;
        if (!result[key]) result[key] = {};
        result[key][columnIndex] = ids;
    });

    return result;
}

function getWeekKey(day) {
    return `${day.getFullYear()}-${getWeek(day)}`;
}

function compareScore(a, b) {
    for (let i = 0; i < a.length; i++) {
        if (a[i] < b[i]) return -1;
        if (a[i] > b[i]) return 1;
    }
    return 0;
}
