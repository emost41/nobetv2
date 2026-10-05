import { format, getWeek, getDay } from 'date-fns';

const isTurkishHoliday = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const fixedHolidays = [
        { month: 1, day: 1 }, { month: 4, day: 23 }, { month: 5, day: 1 },
        { month: 5, day: 19 }, { month: 7, day: 15 }, { month: 8, day: 30 },
        { month: 10, day: 29 },
    ];

    const religiousHolidays2024 = [
        { month: 4, day: 10 }, { month: 4, day: 11 }, { month: 4, day: 12 },
        { month: 6, day: 16 }, { month: 6, day: 17 }, { month: 6, day: 18 }, { month: 6, day: 19 },
    ];

    const religiousHolidays2025 = [
        { month: 3, day: 30 }, { month: 3, day: 31 }, { month: 4, day: 1 },
        { month: 6, day: 6 }, { month: 6, day: 7 }, { month: 6, day: 8 }, { month: 6, day: 9 },
    ];

    const checkHoliday = (holidays) => holidays.some(h => h.month === month && h.day === day);

    if (checkHoliday(fixedHolidays)) return true;
    if (year === 2024 && checkHoliday(religiousHolidays2024)) return true;
    if (year === 2025 && checkHoliday(religiousHolidays2025)) return true;

    return false;
};

/**
 * Distribution philosophy:
 * - Hard constraints are never violated.
 * - Repeated work in the same week is strongly avoided.
 * - Total task counts are kept as equal as the calendar allows.
 * - Within equal total counts, weekdays are balanced.
 * - If an extra task is unavoidable, senior staff are preferred among otherwise
 *   equally fair candidates.
 * - The result is deterministic: the same input produces the same distribution.
 *
 * The algorithm makes an initial assignment and then performs local improvement
 * passes ("swaps") over the whole month. This is deliberately more global than
 * choosing the best person one day at a time.
 */
export function distributeTaskColumn({
    days,
    staffList,
    schedule,
    currentTasks,
    columnConfig,
    columnIndex,
    fillEmptyOnly = false
}) {
    const newTasks = { ...currentTasks };

    const {
        eligibleStaffIds = [],
        eligibleSeniorities = [],
        targetWeekdays = [],
        maxPerDay = 3,
        preferredSeniorityMix = [],
        equalDistribution = false,
        weeklyService = false
    } = columnConfig;

    const eligibleStaff = staffList.filter(staff => {
        if (eligibleStaffIds.length > 0) return eligibleStaffIds.includes(staff.id);
        if (eligibleSeniorities.length > 0) return eligibleSeniorities.includes(staff.seniority);
        return false;
    });

    if (eligibleStaff.length === 0) {
        console.warn('No eligible staff found for distribution');
        return newTasks;
    }

    if (weeklyService && eligibleSeniorities.length === 2 && eligibleStaffIds.length === 0) {
        return distributeWeeklyService(days, staffList, schedule, currentTasks, columnConfig, columnIndex, fillEmptyOnly);
    }

    const targetDays = days
        .filter(day => {
            if (isTurkishHoliday(day)) return false;
            if (targetWeekdays.length === 0) return true;
            return targetWeekdays.includes(getDay(day));
        })
        .sort((a, b) => a - b);

    const staffById = Object.fromEntries(eligibleStaff.map(s => [s.id, s]));
    const assignment = new Map();

    const getDateString = day => format(day, 'yyyy-MM-dd');

    const getAvailableIds = day => {
        const dateString = getDateString(day);

        return eligibleStaff
            .filter(staff => {
                if (staff.leaveDays?.includes(dateString)) return false;
                if (staff.unavailability?.includes(dateString)) return false;

                const prevDate = new Date(day);
                prevDate.setDate(prevDate.getDate() - 1);
                const prevDateString = getDateString(prevDate);
                const prevShiftStaff = schedule?.[prevDateString] || [];
                if (prevShiftStaff.some(s => s.id === staff.id)) return false;

                const dayTasks = newTasks[dateString] || {};
                for (const idx in dayTasks) {
                    if (parseInt(idx) === columnIndex) continue;
                    const ids = Array.isArray(dayTasks[idx]) ? dayTasks[idx] : [dayTasks[idx]];
                    if (ids.includes(staff.id)) return false;
                }

                return true;
            })
            .map(staff => staff.id);
    };

    const availableByDate = new Map();
    targetDays.forEach(day => {
        availableByDate.set(getDateString(day), getAvailableIds(day));
    });

    const registerExisting = () => {
        targetDays.forEach(day => {
            const date = getDateString(day);
            const existing = newTasks[date]?.[columnIndex];

            if (Array.isArray(existing) && existing.length > 0) {
                assignment.set(date, [...existing].filter(id => staffById[id]));
            } else {
                assignment.set(date, []);
            }
        });
    };

    registerExisting();

    // "Sıfırdan dağıt" means we intentionally discard only this column's
    // existing assignments. Other task columns remain untouched.
    if (!fillEmptyOnly) {
        targetDays.forEach(day => {
            const date = getDateString(day);
            assignment.set(date, []);
            if (newTasks[date]) {
                const copy = { ...newTasks[date] };
                delete copy[columnIndex];
                newTasks[date] = copy;
            }
        });
    }

    const counts = createStats(eligibleStaff);
    if (fillEmptyOnly) {
        assignment.forEach((ids, date) => {
            const day = targetDays.find(d => getDateString(d) === date);
            ids.forEach(id => addStats(counts, id, day));
        });
    }

    const daysToFill = targetDays.filter(day => {
        const date = getDateString(day);
        return assignment.get(date).length < maxPerDay;
    });

    /*
     * Scarce days first. If a day has only 4 possible people, it gets planned
     * before a day with 12 possible people. This reduces the chance that early
     * greedy choices consume the only fair candidates for a later constrained day.
     */
    const planningDays = [...daysToFill].sort((a, b) => {
        const aa = availableByDate.get(getDateString(a)).length;
        const bb = availableByDate.get(getDateString(b)).length;
        if (aa !== bb) return aa - bb;
        return a - b;
    });

    if (equalDistribution) {
        planningDays.forEach(day => {
            const date = getDateString(day);
            const selected = assignment.get(date) || [];
            const available = availableByDate.get(date) || [];

            while (selected.length < maxPerDay) {
                const candidates = available
                    .filter(id => !selected.includes(id))
                    .sort((a, b) => compareCandidates(
                        staffById[a], staffById[b], counts, day, targetDays,
                        preferredSeniorityMix
                    ));

                if (candidates.length === 0) break;

                const chosen = choosePreferredSeniority(candidates, staffById, preferredSeniorityMix, selected);
                selected.push(chosen);
                addStats(counts, chosen, day);
            }

            assignment.set(date, selected);
        });

        // Whole-month repair: repeatedly move a task when doing so improves the
        // global distribution. This is what prevents "4 Wednesdays vs 0 Thursdays"
        // patterns surviving merely because the first pass happened to choose them.
        optimizeAssignments({
            assignment,
            targetDays,
            availableByDate,
            staffById,
            maxPerDay,
            preferredSeniorityMix
        });
    } else {
        // Legacy/non-equal mode remains deterministic but still respects hard
        // constraints and preferred seniority.
        planningDays.sort((a, b) => a - b);
        planningDays.forEach(day => {
            const date = getDateString(day);
            const selected = assignment.get(date) || [];
            const available = availableByDate.get(date) || [];

            while (selected.length < maxPerDay) {
                const candidates = available
                    .filter(id => !selected.includes(id))
                    .sort((a, b) => {
                        const ac = counts[a].count;
                        const bc = counts[b].count;
                        if (ac !== bc) return ac - bc;
                        return (staffById[b].seniority || 0) - (staffById[a].seniority || 0);
                    });

                if (!candidates.length) break;
                const chosen = choosePreferredSeniority(candidates, staffById, preferredSeniorityMix, selected);
                selected.push(chosen);
                addStats(counts, chosen, day);
            }

            assignment.set(date, selected);
        });
    }

    // Write the final plan back.
    assignment.forEach((ids, date) => {
        if (!newTasks[date]) newTasks[date] = {};
        if (ids.length > 0) newTasks[date][columnIndex] = ids;
        else {
            const copy = { ...newTasks[date] };
            delete copy[columnIndex];
            newTasks[date] = copy;
        }
    });

    return newTasks;
}


function distributeWeeklyService(days, staffList, schedule, currentTasks, columnConfig, columnIndex, fillEmptyOnly) {
    const result = { ...currentTasks };

    // Weekly service mode is a strict two-group scheduler:
    // every service day gets exactly ONE upper-seniority + ONE lower-seniority person.
    // equalDistribution is deliberately ignored here.
    const seniors = [...(columnConfig.eligibleSeniorities || [])].sort((a, b) => b - a);
    if (seniors.length !== 2) return result;

    const upper = staffList.filter(s => s.seniority === seniors[0]);
    const lower = staffList.filter(s => s.seniority === seniors[1]);
    if (!upper.length || !lower.length) return result;

    const weekdays = columnConfig.targetWeekdays || [];
    const targets = days
        .filter(d => {
            if (isTurkishHoliday(d)) return false;
            return weekdays.length === 0 || weekdays.includes(getDay(d));
        })
        .sort((a, b) => a - b);

    if (!targets.length) return result;

    const dateOf = d => format(d, 'yyyy-MM-dd');

    const hasNightDuty = (staff, day) => {
        const previous = new Date(day);
        previous.setDate(previous.getDate() - 1);
        const previousDate = dateOf(previous);
        return (schedule?.[previousDate] || []).some(x => x.id === staff.id);
    };

    const hasHardConflict = (staff, day, date) => {
        if (staff.leaveDays?.includes(date)) return true;
        if (staff.unavailability?.includes(date)) return true;
        if (hasNightDuty(staff, day)) return true;

        // A person doing another task that day (e.g. surgery) cannot also
        // be the weekly service person.
        const dayTasks = result[date] || {};
        for (const idx of Object.keys(dayTasks)) {
            if (parseInt(idx, 10) === columnIndex) continue;
            const ids = Array.isArray(dayTasks[idx]) ? dayTasks[idx] : [dayTasks[idx]];
            if (ids.includes(staff.id)) return true;
        }

        return false;
    };

    const getWeekKey = day => {
        // Monday-based calendar week. Using the week's Monday as the key also
        // handles month boundaries without mixing two different weeks.
        const monday = new Date(day);
        const offset = (monday.getDay() + 6) % 7;
        monday.setDate(monday.getDate() - offset);
        return dateOf(monday);
    };

    const weekKeys = [...new Set(targets.map(getWeekKey))];

    // Count how many service-weeks each person has already received and use
    // this only after the night-duty burden has been considered.
    const serviceWeeks = {};
    staffList.forEach(s => { serviceWeeks[s.id] = 0; });

    // Existing weekly assignments are counted so "fill empty only" remains stable.
    targets.forEach(day => {
        const date = dateOf(day);
        const ids = Array.isArray(result[date]?.[columnIndex])
            ? result[date][columnIndex]
            : (result[date]?.[columnIndex] ? [result[date][columnIndex]] : []);

        ids.forEach(id => {
            if (serviceWeeks[id] !== undefined) serviceWeeks[id]++;
        });
    });

    const pairForWeek = (weekKey, previousPair) => {
        let best = null;

        for (const u of upper) {
            for (const l of lower) {
                // Prefer pairs whose members have fewer night duties during
                // this calendar week.
                const weekNights = countNightDutiesInWeek(u, weekKey, schedule)
                    + countNightDutiesInWeek(l, weekKey, schedule);

                // If there is another viable pair, avoid repeating the exact
                // same pair in consecutive weeks.
                const repeatedPair = previousPair &&
                    previousPair.u.id === u.id &&
                    previousPair.l.id === l.id ? 1 : 0;

                const score = [
                    weekNights,
                    repeatedPair,
                    serviceWeeks[u.id] + serviceWeeks[l.id],
                    serviceWeeks[u.id],
                    serviceWeeks[l.id],
                    String(u.id),
                    String(l.id)
                ];

                if (!best || compareScore(score, best.score) < 0) {
                    best = { u, l, score };
                }
            }
        }

        return best;
    };

    const pairs = {};
    let previousPair = null;

    for (const weekKey of weekKeys) {
        const pair = pairForWeek(weekKey, previousPair);
        if (!pair) continue;

        pairs[weekKey] = pair;
        serviceWeeks[pair.u.id]++;
        serviceWeeks[pair.l.id]++;
        previousPair = pair;
    }

    const chooseForDay = (preferred, group, day) => {
        const date = dateOf(day);

        // Keep the weekly pair whenever possible.
        if (!hasHardConflict(preferred, day, date)) {
            return preferred.id;
        }

        // A conflict (leave, unavailability, post-call, surgery/other task)
        // may split the pair for ONE DAY only. Replacement must come from
        // exactly the same seniority group.
        const alternatives = group
            .filter(s => s.id !== preferred.id)
            .filter(s => !hasHardConflict(s, day, date))
            .sort((a, b) => {
                const aNight = countNightDutiesInWeek(a, getWeekKey(day), schedule);
                const bNight = countNightDutiesInWeek(b, getWeekKey(day), schedule);
                if (aNight !== bNight) return aNight - bNight;
                if (serviceWeeks[a.id] !== serviceWeeks[b.id]) {
                    return serviceWeeks[a.id] - serviceWeeks[b.id];
                }
                return String(a.id).localeCompare(String(b.id));
            });

        return alternatives[0]?.id || null;
    };

    for (const day of targets) {
        const date = dateOf(day);

        if (fillEmptyOnly && result[date]?.[columnIndex]) {
            continue;
        }

        const pair = pairs[getWeekKey(day)];
        if (!pair) continue;

        const upperId = chooseForDay(pair.u, upper, day);
        const lowerId = chooseForDay(pair.l, lower, day);

        // Never allow upper+upper, lower+lower, duplicate IDs, or a one-person
        // service assignment. If either group has no valid person, leave the
        // day unassigned rather than violating a hard rule.
        if (!upperId || !lowerId || upperId === lowerId) {
            if (result[date]) {
                const copy = { ...result[date] };
                delete copy[columnIndex];
                result[date] = copy;
            }
            continue;
        }

        if (!result[date]) result[date] = {};
        result[date][columnIndex] = [upperId, lowerId];
    }

    return result;
}

function countNightDutiesInWeek(staff, weekKey, schedule) {
    return Object.keys(schedule || {}).reduce((count, dateString) => {
        const day = new Date(dateString + 'T00:00:00');
        const monday = new Date(day);
        const offset = (monday.getDay() + 6) % 7;
        monday.setDate(monday.getDate() - offset);

        const key = format(monday, 'yyyy-MM-dd');
        if (key !== weekKey) return count;

        return count + ((schedule[dateString] || []).some(x => x.id === staff.id) ? 1 : 0);
    }, 0);
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

function createStats(staffList) {
    const stats = {};
    staffList.forEach(staff => {
        stats[staff.id] = {
            count: 0,
            weekdayCounts: {},
            weeks: {},
            dates: []
        };
    });
    return stats;
}

function addStats(stats, id, day) {
    if (!stats[id]) return;
    const weekday = getDay(day);
    const week = getWeek(day);

    stats[id].count++;
    stats[id].weekdayCounts[weekday] = (stats[id].weekdayCounts[weekday] || 0) + 1;
    stats[id].weeks[week] = (stats[id].weeks[week] || 0) + 1;
    stats[id].dates.push(format(day, 'yyyy-MM-dd'));
}

function removeStats(stats, id, day) {
    if (!stats[id]) return;
    const weekday = getDay(day);
    const week = getWeek(day);

    stats[id].count--;
    stats[id].weekdayCounts[weekday] = Math.max(0, (stats[id].weekdayCounts[weekday] || 0) - 1);
    stats[id].weeks[week] = Math.max(0, (stats[id].weeks[week] || 0) - 1);
    stats[id].dates = stats[id].dates.filter(d => d !== format(day, 'yyyy-MM-dd'));
}

function isPreviousCalendarDay(stats, day) {
    const date = getDateString(day);
    const prev = new Date(day);
    prev.setDate(prev.getDate() - 1);
    const prevDate = format(prev, 'yyyy-MM-dd');
    return stats.dates.includes(prevDate);
}

function getDateString(day) {
    return format(day, 'yyyy-MM-dd');
}

function compareCandidates(a, b, stats, day, targetDays, preferredMix) {
    const aS = stats[a.id];
    const bS = stats[b.id];
    const weekday = getDay(day);
    const week = getWeek(day);

    // Total count is the first fairness axis: a junior with 0 must beat a
    // senior with 1 when the task load is being equalized.
    if (aS.count !== bS.count) return aS.count - bS.count;

    // Once total counts are equal, distribute the current weekday.
    const aw = aS.weekdayCounts[weekday] || 0;
    const bw = bS.weekdayCounts[weekday] || 0;
    if (aw !== bw) return aw - bw;

    // Avoid second task in the same week.
    const aWeek = aS.weeks[week] || 0;
    const bWeek = bS.weeks[week] || 0;
    if ((aWeek > 0) !== (bWeek > 0)) return aWeek > 0 ? 1 : -1;

    // Avoid consecutive task days, but only as a soft preference.
    const ac = isPreviousCalendarDay(aS, day);
    const bc = isPreviousCalendarDay(bS, day);
    if (ac !== bc) return ac ? 1 : -1;

    // Seniority is used only after fairness is tied. Higher seniority wins.
    if ((a.seniority || 0) !== (b.seniority || 0)) {
        return (b.seniority || 0) - (a.seniority || 0);
    }

    return String(a.id).localeCompare(String(b.id));
}

function choosePreferredSeniority(candidates, staffById, preferredMix, selected) {
    if (!preferredMix?.length) return candidates[0];

    for (const seniority of preferredMix) {
        const match = candidates.find(id =>
            !selected.includes(id) && staffById[id].seniority === seniority
        );
        if (match) return match;
    }

    return candidates[0];
}

/**
 * Local-search optimizer.
 *
 * We never swap on a hard-constraint violation. A swap is accepted only when
 * the global fairness score improves. A few passes are enough for the small
 * monthly problem sizes used by the app.
 */
function optimizeAssignments({
    assignment,
    targetDays,
    availableByDate,
    staffById,
    maxPerDay,
    preferredSeniorityMix
}) {
    const stats = createStats(Object.values(staffById));
    assignment.forEach((ids, date) => {
        const day = targetDays.find(d => getDateString(d) === date);
        ids.forEach(id => addStats(stats, id, day));
    });

    let currentScore = globalScore(stats, targetDays, staffById);

    for (let pass = 0; pass < 8; pass++) {
        let improved = false;

        for (const day of targetDays) {
            const date = getDateString(day);
            const ids = assignment.get(date) || [];

            for (let slot = 0; slot < ids.length; slot++) {
                const oldId = ids[slot];

                for (const newId of availableByDate.get(date) || []) {
                    if (newId === oldId || ids.includes(newId)) continue;

                    // Try replacing one person on this day.
                    removeStats(stats, oldId, day);
                    addStats(stats, newId, day);
                    ids[slot] = newId;

                    const nextScore = globalScore(stats, targetDays, staffById);

                    if (nextScore < currentScore) {
                        currentScore = nextScore;
                        improved = true;
                        break;
                    }

                    // Revert.
                    ids[slot] = oldId;
                    removeStats(stats, newId, day);
                    addStats(stats, oldId, day);
                }
            }
        }

        if (!improved) break;
    }
}

function globalScore(stats, targetDays, staffById) {
    const people = Object.values(stats);
    if (!people.length) return 0;

    const totalCounts = people.map(s => s.count);
    const maxCount = Math.max(...totalCounts);
    const minCount = Math.min(...totalCounts);

    // Total fairness is deliberately dominant.
    let score = (maxCount - minCount) * 100000;
    score += people.reduce((sum, s) => sum + s.count * s.count * 100, 0);

    // Weekday fairness: minimize spread for each weekday.
    const weekdays = [...new Set(targetDays.map(getDay))];
    for (const weekday of weekdays) {
        const counts = people.map(s => s.weekdayCounts[weekday] || 0);
        const max = Math.max(...counts);
        const min = Math.min(...counts);
        score += (max - min) * 10000;
        score += counts.reduce((sum, c) => sum + c * c, 0) * 10;
    }

    // Same-week repetition is expensive but not impossible.
    for (const person of people) {
        Object.values(person.weeks).forEach(count => {
            if (count > 1) score += (count - 1) * 3000;
        });
    }

    // Consecutive task days are a softer penalty.
    for (const person of people) {
        const dates = [...person.dates].sort();
        for (let i = 1; i < dates.length; i++) {
            const prev = new Date(dates[i - 1] + 'T00:00:00');
            const current = new Date(dates[i] + 'T00:00:00');
            if (Math.round((current - prev) / 86400000) === 1) score += 300;
        }
    }

    // Seniority is intentionally NOT a primary fairness axis. It only affects
    // tie-breaking in candidate selection, so a senior can receive the extra
    // task only after overall load has been equalized.
    return score;
}
