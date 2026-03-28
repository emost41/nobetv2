import { format, getWeek, getDay } from 'date-fns';

/**
 * Helper: Check if date is a Turkish public holiday
 */
const isTurkishHoliday = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Fixed holidays
    const fixedHolidays = [
        { month: 1, day: 1 },   // Yılbaşı
        { month: 4, day: 23 },  // 23 Nisan
        { month: 5, day: 1 },   // İşçi Bayramı
        { month: 5, day: 19 },  // 19 Mayıs
        { month: 7, day: 15 },  // 15 Temmuz
        { month: 8, day: 30 },  // 30 Ağustos
        { month: 10, day: 29 }, // 29 Ekim
    ];

    // Religious holidays (approximate - these change yearly)
    const religiousHolidays2024 = [
        { month: 4, day: 10 }, { month: 4, day: 11 }, { month: 4, day: 12 }, // Ramazan 2024
        { month: 6, day: 16 }, { month: 6, day: 17 }, { month: 6, day: 18 }, { month: 6, day: 19 }, // Kurban 2024
    ];

    const religiousHolidays2025 = [
        { month: 3, day: 30 }, { month: 3, day: 31 }, { month: 4, day: 1 }, // Ramazan 2025
        { month: 6, day: 6 }, { month: 6, day: 7 }, { month: 6, day: 8 }, { month: 6, day: 9 }, // Kurban 2025
    ];

    const checkHoliday = (holidays) => holidays.some(h => h.month === month && h.day === day);

    if (checkHoliday(fixedHolidays)) return true;
    if (year === 2024 && checkHoliday(religiousHolidays2024)) return true;
    if (year === 2025 && checkHoliday(religiousHolidays2025)) return true;

    return false;
};

/**
 * Auto-distribute tasks for a specific column based on configuration
 * @param {Object} params
 * @param {Array} params.days - Array of Date objects for the month
 * @param {Array} params.staffList - All staff members
 * @param {Object} params.schedule - Current shift schedule
 * @param {Object} params.currentTasks - Current task assignments
 * @param {Object} params.columnConfig - Configuration for this column
 * @param {number} params.columnIndex - Index of the column being distributed
 * @param {boolean} params.fillEmptyOnly - If true, only fill empty cells
 * @returns {Object} New task assignments for this column
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

    // Get configuration
    const {
        eligibleStaffIds = [],
        eligibleSeniorities = [],
        targetWeekdays = [], // [1, 3, 4, 5] for Mon, Wed, Thu, Fri (0=Sunday)
        maxPerDay = 3,
        preferredSeniorityMix = [] // e.g., [7, 5, 4] - preferred seniority levels per slot
    } = columnConfig;

    // Filter eligible staff
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

    // Filter days to target weekdays and EXCLUDE holidays
    const targetDays = days.filter(day => {
        // Skip holidays for task distribution
        if (isTurkishHoliday(day)) return false;

        if (targetWeekdays.length === 0) return true;
        const dayOfWeek = getDay(day);
        return targetWeekdays.includes(dayOfWeek);
    });

    // Initialize staff assignment tracking
    const staffAssignments = {};
    eligibleStaff.forEach(staff => {
        staffAssignments[staff.id] = {
            count: 0,
            weeks: new Set(),
            days: []
        };
    });

    // If fillEmptyOnly, count existing assignments
    if (fillEmptyOnly) {
        targetDays.forEach(day => {
            const dateString = format(day, 'yyyy-MM-dd');
            const dayTasks = newTasks[dateString] || {};
            const assignedStaffIds = dayTasks[columnIndex] || [];

            if (Array.isArray(assignedStaffIds)) {
                assignedStaffIds.forEach(staffId => {
                    if (staffAssignments[staffId]) {
                        staffAssignments[staffId].count++;
                        staffAssignments[staffId].weeks.add(getWeek(day));
                        staffAssignments[staffId].days.push(dateString);
                    }
                });
            }
        });
    }

    // Calculate target count per person (equal distribution)
    const totalSlots = targetDays.length * maxPerDay;
    const targetPerPerson = Math.floor(totalSlots / eligibleStaff.length);
    const remainder = totalSlots % eligibleStaff.length;

    // Distribute tasks
    targetDays.forEach(day => {
        const dateString = format(day, 'yyyy-MM-dd');
        const weekNumber = getWeek(day);

        // Skip if fillEmptyOnly and already has assignments
        if (fillEmptyOnly) {
            const dayTasks = newTasks[dateString] || {};
            if (dayTasks[columnIndex] && Array.isArray(dayTasks[columnIndex]) && dayTasks[columnIndex].length > 0) {
                return; // Skip this day
            }
        }

        // Get available staff for this day
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

        // Select staff for this day
        const selectedStaff = selectStaffForDay(
            availableStaff,
            staffAssignments,
            weekNumber,
            maxPerDay,
            targetPerPerson,
            preferredSeniorityMix
        );

        // Assign to tasks
        if (!newTasks[dateString]) {
            newTasks[dateString] = {};
        }
        newTasks[dateString][columnIndex] = selectedStaff.map(s => s.id);

        // Update tracking
        selectedStaff.forEach(staff => {
            staffAssignments[staff.id].count++;
            staffAssignments[staff.id].weeks.add(weekNumber);
            staffAssignments[staff.id].days.push(dateString);
        });
    });

    return newTasks;
}

/**
 * Get staff available for a specific day (checks leave, unavailability, previous shift)
 */
function getAvailableStaffForDay(day, eligibleStaff, schedule, tasks, columnIndex) {
    const dateString = format(day, 'yyyy-MM-dd');

    return eligibleStaff.filter(staff => {
        // PRIORITY 1: Check leave days
        if (staff.leaveDays && staff.leaveDays.includes(dateString)) {
            return false;
        }

        // PRIORITY 2: Check unavailability
        if (staff.unavailability && staff.unavailability.includes(dateString)) {
            return false;
        }

        // Check if worked previous night shift
        const prevDate = new Date(day);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateString = format(prevDate, 'yyyy-MM-dd');
        const prevShiftStaff = schedule && schedule[prevDateString] ? schedule[prevDateString] : [];
        if (prevShiftStaff.some(s => s.id === staff.id)) {
            return false;
        }

        // Check if already assigned to another task this day
        const dayTasks = tasks[dateString] || {};
        for (let idx in dayTasks) {
            if (parseInt(idx) !== columnIndex) {
                const assignedIds = Array.isArray(dayTasks[idx]) ? dayTasks[idx] : [dayTasks[idx]];
                if (assignedIds.includes(staff.id)) {
                    return false;
                }
            }
        }

        return true;
    });
}

/**
 * Select staff for a specific day based on distribution rules
 */
function selectStaffForDay(
    availableStaff,
    staffAssignments,
    weekNumber,
    maxPerDay,
    targetPerPerson,
    preferredSeniorityMix
) {
    const selected = [];
    // Shuffle candidates first to provide variety when priorities are equal
    const candidates = [...availableStaff].sort(() => Math.random() - 0.5);

    // Sort candidates by priority
    candidates.sort((a, b) => {
        const aData = staffAssignments[a.id];
        const bData = staffAssignments[b.id];

        // Priority 1: Below target count (Fairness)
        // We want everyone to reach the target first
        const aUnderTarget = aData.count < targetPerPerson;
        const bUnderTarget = bData.count < targetPerPerson;
        if (aUnderTarget !== bUnderTarget) {
            return aUnderTarget ? -1 : 1;
        }

        // Priority 2: Seniority (Higher seniority first - User request)
        // If both are under target or both are over target, pick the senior one first
        if (a.seniority !== b.seniority) {
            return b.seniority - a.seniority;
        }

        // Priority 3: Total count (lower count first for same seniority)
        if (aData.count !== bData.count) {
            return aData.count - bData.count;
        }

        // Priority 4: Not worked this week yet (Spreading)
        const aWorkedThisWeek = aData.weeks.has(weekNumber);
        const bWorkedThisWeek = bData.weeks.has(weekNumber);
        if (aWorkedThisWeek !== bWorkedThisWeek) {
            return aWorkedThisWeek ? 1 : -1;
        }

        return 0;
    });

    // If preferred seniority mix is specified, try to pick those first among the best candidates
    if (preferredSeniorityMix && preferredSeniorityMix.length > 0) {
        // We only look at the top candidates (those with lowest counts) to maintain fairness
        const topCandidates = candidates.filter(c =>
            staffAssignments[c.id].count <= targetPerPerson
        );

        for (const targetSeniority of preferredSeniorityMix) {
            if (selected.length >= maxPerDay) break;

            const match = topCandidates.find(c =>
                c.seniority === targetSeniority && !selected.includes(c)
            );
            if (match) {
                selected.push(match);
            }
        }
    }

    // Fill remaining slots with best candidates from the sorted list
    for (const candidate of candidates) {
        if (selected.length >= maxPerDay) break;
        if (!selected.includes(candidate)) {
            selected.push(candidate);
        }
    }

    return selected;
}
