import { format, getWeek, getDay } from 'date-fns';

/**
 * Helper: Check if date is a Turkish public holiday
 */
const isTurkishHoliday = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const fixedHolidays = [
        { month: 1, day: 1 },
        { month: 4, day: 23 },
        { month: 5, day: 1 },
        { month: 5, day: 19 },
        { month: 7, day: 15 },
        { month: 8, day: 30 },
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
 * Auto-distribute tasks for a specific column based on configuration
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
        equalDistribution = false
    } = columnConfig;

    let eligibleStaff = staffList.filter(staff => {
        if (eligibleStaffIds.length > 0) {
            return eligibleStaffIds.includes(staff.id);
        }
        if (eligibleSeniorities.length > 0) {
            return eligibleSeniorities.includes(staff.seniority);
        }
        return false;
    });

    if (eligibleStaff.length === 0) {
        console.warn('No eligible staff found for distribution');
        return newTasks;
    }

    const targetDays = days.filter(day => {
        if (isTurkishHoliday(day)) return false;
        if (targetWeekdays.length === 0) return true;
        const dayOfWeek = getDay(day);
        return targetWeekdays.includes(dayOfWeek);
    });

    const staffAssignments = {};
    eligibleStaff.forEach(staff => {
        staffAssignments[staff.id] = {
            count: 0,
            weeks: new Set(),
            days: [],
            weekdayCounts: {}
        };
    });

    const registerAssignment = (staffId, day) => {
        if (!staffAssignments[staffId]) return;
        const weekday = getDay(day);
        staffAssignments[staffId].count++;
        staffAssignments[staffId].weeks.add(getWeek(day));
        staffAssignments[staffId].days.push(format(day, 'yyyy-MM-dd'));
        staffAssignments[staffId].weekdayCounts[weekday] =
            (staffAssignments[staffId].weekdayCounts[weekday] || 0) + 1;
    };

    // Always count existing assignments so fillEmptyOnly and regenerated distributions
    // use the same fairness information.
    targetDays.forEach(day => {
        const dateString = format(day, 'yyyy-MM-dd');
        const dayTasks = newTasks[dateString] || {};
        const assignedStaffIds = dayTasks[columnIndex] || [];

        if (Array.isArray(assignedStaffIds)) {
            assignedStaffIds.forEach(staffId => registerAssignment(staffId, day));
        }
    });

    const totalSlots = targetDays.length * maxPerDay;
    const targetPerPerson = Math.floor(totalSlots / eligibleStaff.length);

    targetDays.forEach(day => {
        const dateString = format(day, 'yyyy-MM-dd');
        const weekNumber = getWeek(day);
        const weekday = getDay(day);

        if (fillEmptyOnly) {
            const dayTasks = newTasks[dateString] || {};
            if (dayTasks[columnIndex] && Array.isArray(dayTasks[columnIndex]) && dayTasks[columnIndex].length > 0) {
                return;
            }
        }

        const availableStaff = getAvailableStaffForDay(
            day,
            eligibleStaff,
            schedule,
            newTasks,
            columnIndex
        );

        if (availableStaff.length === 0) {
            console.warn(`No available staff for ${dateString}`);
            return;
        }

        const selectedStaff = selectStaffForDay(
            availableStaff,
            staffAssignments,
            dateString,
            weekNumber,
            weekday,
            maxPerDay,
            targetPerPerson,
            preferredSeniorityMix,
            equalDistribution
        );

        if (!newTasks[dateString]) {
            newTasks[dateString] = {};
        }
        newTasks[dateString][columnIndex] = selectedStaff.map(s => s.id);

        selectedStaff.forEach(staff => registerAssignment(staff.id, day));
    });

    return newTasks;
}

function getAvailableStaffForDay(day, eligibleStaff, schedule, tasks, columnIndex) {
    const dateString = format(day, 'yyyy-MM-dd');

    return eligibleStaff.filter(staff => {
        if (staff.leaveDays && staff.leaveDays.includes(dateString)) return false;
        if (staff.unavailability && staff.unavailability.includes(dateString)) return false;

        const prevDate = new Date(day);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateString = format(prevDate, 'yyyy-MM-dd');
        const prevShiftStaff = schedule && schedule[prevDateString] ? schedule[prevDateString] : [];
        if (prevShiftStaff.some(s => s.id === staff.id)) return false;

        const dayTasks = tasks[dateString] || {};
        for (let idx in dayTasks) {
            if (parseInt(idx) !== columnIndex) {
                const assignedIds = Array.isArray(dayTasks[idx]) ? dayTasks[idx] : [dayTasks[idx]];
                if (assignedIds.includes(staff.id)) return false;
            }
        }

        return true;
    });
}

/**
 * Select staff with this priority in equal-distribution mode:
 * 1) give the current weekday to people who have received it fewer times
 * 2) avoid a second task in the same calendar week when possible
 * 3) keep total task counts balanced
 * 4) avoid consecutive calendar days
 * 5) seniority as tie-breaker
 *
 * This prevents patterns such as one person receiving every Wednesday while
 * another receives every Thursday, even when total counts are equal.
 */
function selectStaffForDay(
    availableStaff,
    staffAssignments,
    currentDateString,
    weekNumber,
    weekday,
    maxPerDay,
    targetPerPerson,
    preferredSeniorityMix,
    equalDistribution = false
) {
    const selected = [];
    const candidates = [...availableStaff].sort(() => Math.random() - 0.5);

    const isPreviousCalendarDay = (staff) => {
        const lastDay = staffAssignments[staff.id].days.at(-1);
        if (!lastDay) return false;
        const lastDate = new Date(lastDay + 'T00:00:00');
        const currentDate = new Date(currentDateString + 'T00:00:00');
        return Math.round((currentDate - lastDate) / 86400000) === 1;
    };

    candidates.sort((a, b) => {
        const aData = staffAssignments[a.id];
        const bData = staffAssignments[b.id];

        if (equalDistribution) {
            // First level: distribute each weekday across the eligible people.
            // This is the key change from pure total-count balancing.
            const aWeekdayCount = aData.weekdayCounts[weekday] || 0;
            const bWeekdayCount = bData.weekdayCounts[weekday] || 0;
            if (aWeekdayCount !== bWeekdayCount) {
                return aWeekdayCount - bWeekdayCount;
            }

            // Prefer not to give someone two task days in the same week.
            const aWorkedThisWeek = aData.weeks.has(weekNumber);
            const bWorkedThisWeek = bData.weeks.has(weekNumber);
            if (aWorkedThisWeek !== bWorkedThisWeek) {
                return aWorkedThisWeek ? 1 : -1;
            }

            // Then keep the overall number of tasks balanced.
            if (aData.count !== bData.count) {
                return aData.count - bData.count;
            }

            // Consecutive calendar days remain a soft penalty.
            const aConsecutive = isPreviousCalendarDay(a);
            const bConsecutive = isPreviousCalendarDay(b);
            if (aConsecutive !== bConsecutive) {
                return aConsecutive ? 1 : -1;
            }
        } else {
            const aUnderTarget = aData.count < targetPerPerson;
            const bUnderTarget = bData.count < targetPerPerson;
            if (aUnderTarget !== bUnderTarget) {
                return aUnderTarget ? -1 : 1;
            }

            if (aData.count !== bData.count) {
                return aData.count - bData.count;
            }
        }

        if (a.seniority !== b.seniority) {
            return b.seniority - a.seniority;
        }

        if (aData.count !== bData.count) {
            return aData.count - bData.count;
        }

        return 0;
    });

    if (preferredSeniorityMix && preferredSeniorityMix.length > 0) {
        const minWeekdayCount = Math.min(
            ...candidates.map(c => staffAssignments[c.id].weekdayCounts[weekday] || 0)
        );

        let topCandidates = candidates.filter(c =>
            equalDistribution
                ? (staffAssignments[c.id].weekdayCounts[weekday] || 0) === minWeekdayCount
                : staffAssignments[c.id].count <= targetPerPerson
        );

        if (equalDistribution) {
            const notThisWeek = topCandidates.filter(c =>
                !staffAssignments[c.id].weeks.has(weekNumber)
            );
            if (notThisWeek.length > 0) topCandidates = notThisWeek;

            const nonConsecutive = topCandidates.filter(c => !isPreviousCalendarDay(c));
            if (nonConsecutive.length > 0) topCandidates = nonConsecutive;
        }

        for (const targetSeniority of preferredSeniorityMix) {
            if (selected.length >= maxPerDay) break;

            const match = topCandidates.find(c =>
                c.seniority === targetSeniority && !selected.includes(c)
            );
            if (match) selected.push(match);
        }
    }

    for (const candidate of candidates) {
        if (selected.length >= maxPerDay) break;
        if (!selected.includes(candidate)) selected.push(candidate);
    }

    return selected;
}
