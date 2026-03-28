import { format, getDaysInMonth, startOfMonth, addDays, getDay, isSameDay, isWeekend, differenceInDays, subDays } from 'date-fns';

// Minimum leave threshold to affect target (7 days)
const LEAVE_THRESHOLD = 7;

/**
 * Calculate target shifts based on SENIORITY (1-10 scale) AND leave days
 * Seniority 1 = Most junior, gets MOST shifts
 * Seniority 10 = Most senior, gets LEAST shifts
 * 
 * Only LEAVE days (not "unavailable" preference days) affect the target
 * And only if leave days >= LEAVE_THRESHOLD (7 days)
 */
const calculateSeniorityTargets = (staffList, totalShiftsNeeded, daysInMonth) => {
    if (staffList.length === 0) return {};

    // Seniority weight: lower seniority = higher weight (more shifts)
    // Seniority 1 -> weight 10, Seniority 10 -> weight 1
    const getWeight = (seniority) => 11 - seniority;

    // Calculate each staff's leave days and weighted value
    const staffData = staffList.map(staff => {
        // Only count LEAVE days (not unavailability which is just preference)
        const leaveDays = staff.leaveDays?.length || 0;
        const activeDays = daysInMonth - leaveDays;

        // Only apply availability ratio if leave >= threshold
        const availabilityRatio = leaveDays >= LEAVE_THRESHOLD
            ? activeDays / daysInMonth
            : 1; // No reduction if less than threshold

        const weight = getWeight(staff.seniority);
        const adjustedWeight = weight * availabilityRatio;

        return {
            id: staff.id,
            weight,
            activeDays,
            leaveDays,
            availabilityRatio,
            adjustedWeight,
            targetReduced: leaveDays >= LEAVE_THRESHOLD
        };
    });

    // Calculate total adjusted weight
    const totalAdjustedWeight = staffData.reduce((sum, s) => sum + s.adjustedWeight, 0);

    // Base unit: how many shifts per adjusted weight point
    const baseUnit = totalShiftsNeeded / totalAdjustedWeight;

    // Calculate individual targets
    const targets = {};
    const targetDetails = {};

    staffData.forEach(data => {
        const rawTarget = baseUnit * data.adjustedWeight;
        const target = Math.round(rawTarget);
        targets[data.id] = target;
        targetDetails[data.id] = {
            target,
            rawTarget,
            activeDays: data.activeDays,
            leaveDays: data.leaveDays,
            availabilityRatio: data.availabilityRatio,
            targetReduced: data.targetReduced
        };
    });

    return { targets, targetDetails };
};

/**
 * Get seniority group label for display
 */
const getSeniorityGroup = (seniority) => {
    return `Kıdem ${seniority}`;
};

// Helper to check if staff is resting (checks both PAST and FUTURE assignments)
const isResting = (staffId, targetDate, schedule, requiredDayGap) => {
    // Check X days before and X days after
    // If requiredDayGap is 4, we check 1, 2, 3 days diff.

    for (let i = 1; i < requiredDayGap; i++) {
        // Check Past
        const pastDate = subDays(targetDate, i);
        const pastString = format(pastDate, 'yyyy-MM-dd');
        if (schedule[pastString]?.find(s => s.id === staffId)) return true;

        // Check Future
        const futureDate = addDays(targetDate, i);
        const futureString = format(futureDate, 'yyyy-MM-dd');
        if (schedule[futureString]?.find(s => s.id === staffId)) return true;
    }
    return false;
};

export const generateSchedule = (staffList, constraints, selectedDate = new Date()) => {
    const currentMonthStart = startOfMonth(selectedDate);
    const daysInMonth = getDaysInMonth(selectedDate);

    const schedule = {}; // DateString (YYYY-MM-DD) -> Array of Staff Objects
    const logs = []; // Algorithm decision logs

    // Initialize schedule with empty arrays for all days
    for (let i = 0; i < daysInMonth; i++) {
        const d = addDays(currentMonthStart, i);
        schedule[format(d, 'yyyy-MM-dd')] = [];
    }

    // Calculate total shifts needed for the month
    let totalShiftsNeeded = 0;
    for (let i = 0; i < daysInMonth; i++) {
        const currentDate = addDays(currentMonthStart, i);
        const dayName = format(currentDate, 'EEEE');
        totalShiftsNeeded += constraints.dailyNeeds[dayName] || 2;
    }

    // Calculate seniority-based targets
    const { targets: seniorityTargets, targetDetails } = calculateSeniorityTargets(
        staffList,
        totalShiftsNeeded,
        daysInMonth
    );

    // Log target adjustments
    staffList.forEach(staff => {
        const details = targetDetails[staff.id];
        if (details && details.targetReduced) {
            logs.push({
                type: 'info',
                icon: '🏖️',
                message: `${staff.name || staff.firstName}: ${details.leaveDays} gün izinli (≥${LEAVE_THRESHOLD}), hedef ${details.target} nöbete düşürüldü`
            });
        }
    });

    // Initialize stats
    const staffStats = {};
    staffList.forEach(staff => {
        staffStats[staff.id] = {
            id: staff.id,
            shiftCount: 0,
            lastShiftDate: null, // Note: This is less useful in 2-pass, we rely on schedule check
            weekendShifts: 0,
            weekdayShifts: 0,
            targetShifts: seniorityTargets[staff.id] || 0,
            seniorityGroup: getSeniorityGroup(staff.seniority),
            daysAssigned: {
                'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0, 'Saturday': 0, 'Sunday': 0
            },
            skippedReasons: []
        };
    });

    const getDayName = (date) => format(date, 'EEEE');

    // Calculate required gap
    const shiftEndDay = 1;
    const restDays = Math.ceil(constraints.minRestHours / 24);
    const requiredDayGap = shiftEndDay + restDays;

    logs.push({
        type: 'info',
        icon: '⏰',
        message: `Dinlenme: ${constraints.minRestHours} saat → Bir nöbet sonrası ${requiredDayGap} gün sonra yeni nöbet`
    });

    // ==========================================
    // PASS 1: ASSIGN REQUIRED SHIFTS (GLOBAL)
    // ==========================================
    for (let i = 0; i < daysInMonth; i++) {
        const currentDate = addDays(currentMonthStart, i);
        const dateString = format(currentDate, 'yyyy-MM-dd');
        const dayName = getDayName(currentDate);
        const isWknd = isWeekend(currentDate);
        const dayOfMonth = i + 1;

        staffList.forEach(staff => {
            if (staff.requiredDays && staff.requiredDays.includes(dateString)) {
                // Check if already assigned (shouldn't be, but sanity check)
                if (schedule[dateString].find(s => s.id === staff.id)) return;

                // Check Rest Constraint (against OTHER required shifts)
                if (isResting(staff.id, currentDate, schedule, requiredDayGap)) {
                    logs.push({
                        type: 'error',
                        icon: '🚫',
                        message: `${dayOfMonth}. gün: ${staff.name} için kesin istek vardı ama başka bir kesin nöbetle çakışıyor!`
                    });
                    return;
                }

                // Assign
                schedule[dateString].push(staff);

                // Update Stats
                const stats = staffStats[staff.id];
                stats.shiftCount++;
                stats.daysAssigned[dayName]++;
                if (isWknd) stats.weekendShifts++;
                else stats.weekdayShifts++;

                logs.push({
                    type: 'success',
                    icon: '🔒',
                    message: `${dayOfMonth}. gün: ${staff.name} kesin istek üzerine atandı.`
                });
            }
        });
    }

    // ==========================================
    // PASS 2: FILL REMAINING SLOTS
    // ==========================================
    for (let i = 0; i < daysInMonth; i++) {
        const currentDate = addDays(currentMonthStart, i);
        const dateString = format(currentDate, 'yyyy-MM-dd');
        const dayName = getDayName(currentDate);
        const isWknd = isWeekend(currentDate);
        const dayOfMonth = i + 1;

        const assignedForDay = schedule[dateString]; // Pre-filled from Pass 1
        let neededCount = constraints.dailyNeeds[dayName] || 2;

        // If already full/overfull from Pass 1, skip
        if (assignedForDay.length >= neededCount) continue;

        // Filter candidates
        let candidates = staffList.filter(staff => {
            // Already assigned today?
            if (assignedForDay.find(s => s.id === staff.id)) return false;

            const stats = staffStats[staff.id];

            // 1. Unavailability & Leave
            if (staff.unavailability && staff.unavailability.includes(dateString)) return false;
            if (staff.leaveDays && staff.leaveDays.includes(dateString)) return false;

            // 2. Max Shifts
            if (stats.shiftCount >= constraints.maxShiftsPerMonth) return false;

            // 3. Rest Time (Checks Past AND Future assignments)
            if (isResting(staff.id, currentDate, schedule, requiredDayGap)) return false;

            return true;
        });

        if (candidates.length < (neededCount - assignedForDay.length)) {
            logs.push({
                type: 'warning',
                icon: '⚠️',
                message: `${dayOfMonth}. gün: Yeterli personel yok!`
            });
        }

        // Scoring Helper
        const calculateScore = (staff) => {
            let score = 1000;
            const stats = staffStats[staff.id];

            // --- 0.5 Beneficial Days ---
            if (constraints.beneficialDays && constraints.beneficialDays.includes(dayName)) {
                const threshold = constraints.beneficialDaysThreshold || 4;
                if (staff.seniority >= threshold) {
                    score += staff.seniority * 1000;
                }
            }

            // --- 0.8 Urgency Score ---
            const remainingTarget = stats.targetShifts - stats.shiftCount;
            if (remainingTarget > 0) {
                // Simple remaining days estimation
                const remainingDaysInMonth = daysInMonth - i;
                const urgency = remainingTarget / (remainingDaysInMonth || 1);
                score += urgency * 5000;
            }

            // --- 1. Seniority-Based Target System ---
            const targetDiff = stats.targetShifts - stats.shiftCount;
            if (targetDiff > 0) {
                score += targetDiff * 2000;
            } else {
                score -= Math.abs(targetDiff) * 10000;
            }

            // --- 3. Weekend Distribution ---
            if (isWknd) {
                score -= Math.pow(staff.seniority, 4);
                score -= stats.weekendShifts * 5000;
                if (staff.seniority <= 3 && stats.weekendShifts <= 2) {
                    score += 15000;
                }
                const myWeekendShifts = stats.weekendShifts;
                staffList.forEach(otherStaff => {
                    if (otherStaff.id !== staff.id && otherStaff.seniority < staff.seniority) {
                        const otherStats = staffStats[otherStaff.id];
                        if (myWeekendShifts >= otherStats.weekendShifts) {
                            score -= 50000;
                        }
                    }
                });
            }

            // --- 4. Day of Week Variety ---
            const dayCount = stats.daysAssigned[dayName] || 0;
            score -= dayCount * 120;

            // --- 5. Randomness ---
            score += Math.floor(Math.random() * 20);

            return score;
        };

        // Fill remaining slots
        while (assignedForDay.length < neededCount && candidates.length > 0) {
            // --- DYNAMIC SENIORITY SUM FILTERING ---
            let filteredCandidates = candidates.filter(staff => {
                if (constraints.maxSenioritySum > 0) {
                    const currentSum = assignedForDay.reduce((sum, s) => sum + s.seniority, 0);
                    if (currentSum + staff.seniority > constraints.maxSenioritySum) return false;
                }
                if (constraints.minSenioritySum > 0 && assignedForDay.length === neededCount - 1) {
                    const currentSum = assignedForDay.reduce((sum, s) => sum + s.seniority, 0);
                    if (currentSum + staff.seniority < constraints.minSenioritySum) return false;
                }
                return true;
            });

            if (filteredCandidates.length === 0) {
                if (candidates.length > 0) {
                    logs.push({
                        type: 'warning',
                        icon: '⚖️',
                        message: `${dayOfMonth}. gün: Kıdem toplamı kuralı (Min:${constraints.minSenioritySum || '-'}, Max:${constraints.maxSenioritySum || '-'}) nedeniyle uygun personel seçilemedi!`
                    });
                }
                break;
            }

            // Calculate scores
            let candidatesWithScores = filteredCandidates.map(staff => ({
                staff,
                baseScore: calculateScore(staff)
            }));

            // Pairing Logic
            candidatesWithScores.forEach(cs => {
                cs.finalScore = cs.baseScore;
                if (assignedForDay.length > 0) {
                    const lastAssigned = assignedForDay[assignedForDay.length - 1];
                    const diff = Math.abs(cs.staff.seniority - lastAssigned.seniority);
                    if (diff === 0) cs.finalScore -= 500;
                    else cs.finalScore += diff * 1000;
                }
            });

            candidatesWithScores.sort((a, b) => b.finalScore - a.finalScore);

            const best = candidatesWithScores[0];
            assignedForDay.push(best.staff);

            // Update Stats
            const stats = staffStats[best.staff.id];
            stats.shiftCount++;
            stats.daysAssigned[dayName]++;
            if (isWknd) stats.weekendShifts++;
            else stats.weekdayShifts++;

            // Remove from candidates
            candidates = candidates.filter(c => c.id !== best.staff.id);
        }
    }

    // --- ANOMALY ANALYSIS ---
    const analyzeAnomalies = () => {
        const staffArray = Object.values(staffStats);
        staffArray.sort((a, b) => {
            const staffA = staffList.find(s => s.id === a.id);
            const staffB = staffList.find(s => s.id === b.id);
            return staffA.seniority - staffB.seniority;
        });

        for (let i = 0; i < staffArray.length; i++) {
            for (let j = i + 1; j < staffArray.length; j++) {
                const junior = staffArray[i];
                const senior = staffArray[j];
                const juniorStaff = staffList.find(s => s.id === junior.id);
                const seniorStaff = staffList.find(s => s.id === senior.id);

                if (juniorStaff.seniority === seniorStaff.seniority) continue;

                if (junior.shiftCount < senior.shiftCount) {
                    logs.push({
                        type: 'warning',
                        icon: '⚠️',
                        message: `ANOMALİ: ${juniorStaff.name} (Kıdem ${juniorStaff.seniority}) < ${seniorStaff.name} (Kıdem ${seniorStaff.seniority})`
                    });
                }
            }
        }
    };

    analyzeAnomalies();

    // Attach logs and stats
    schedule._logs = logs;
    schedule._staffStats = staffStats;
    schedule._targetDetails = targetDetails;

    return schedule;
};
