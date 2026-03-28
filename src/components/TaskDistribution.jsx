import React, { useState, useRef } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { distributeTaskColumn } from '../utils/taskDistributionAlgorithm';
import TaskColumnConfig from './TaskColumnConfig';

const TaskDistribution = ({ staffList, schedule, constraints, tasks, setTasks, onSaveToHistory, setConstraints }) => {
    const [hiddenColumns, setHiddenColumns] = useState(constraints.hiddenTaskColumns || []);
    const [configColumnIndex, setConfigColumnIndex] = useState(null);
    const [activeStatsTab, setActiveStatsTab] = useState(0);
    const [editingCell, setEditingCell] = useState(null); // {dateString, columnIdx, subIdx}
    const [leaveColumnName, setLeaveColumnName] = useState(constraints.leaveColumnName || 'İzinli');
    const [editingLeaveColumnName, setEditingLeaveColumnName] = useState(false);
    const [draggedColumnIdx, setDraggedColumnIdx] = useState(null);
    const touchTargetRef = useRef(null);

    const handleColumnReorder = (fromIdx, toIdx) => {
        if (fromIdx === toIdx) return;

        const newCols = [...taskColumns];
        const [movedCol] = newCols.splice(fromIdx, 1);
        newCols.splice(toIdx, 0, movedCol);

        // Reorder config
        const newConfig = {};
        const oldConfig = constraints.taskColumnConfig || {};

        const oldToNewMap = {};
        for (let i = 0; i < taskColumns.length; i++) {
            if (i === fromIdx) oldToNewMap[i] = toIdx;
            else if (fromIdx < toIdx && i > fromIdx && i <= toIdx) oldToNewMap[i] = i - 1;
            else if (fromIdx > toIdx && i >= toIdx && i < fromIdx) oldToNewMap[i] = i + 1;
            else oldToNewMap[i] = i;
        }

        Object.keys(oldConfig).forEach(k => {
            const oldK = parseInt(k);
            if (oldToNewMap[oldK] !== undefined) {
                newConfig[oldToNewMap[oldK]] = oldConfig[oldK];
            }
        });

        // Reorder hidden
        const newHidden = hiddenColumns.map(oldK => oldToNewMap[oldK]).filter(k => k !== undefined);
        setHiddenColumns(newHidden);

        // Reorder tasks
        const newTasks = {};
        Object.keys(tasks).forEach(date => {
            newTasks[date] = {};
            Object.keys(tasks[date]).forEach(k => {
                const oldK = parseInt(k);
                if (oldToNewMap[oldK] !== undefined) {
                    newTasks[date][oldToNewMap[oldK]] = tasks[date][oldK];
                }
            });
        });

        setTasks(newTasks);
        setConstraints(prev => ({
            ...prev,
            taskColumns: newCols,
            taskColumnConfig: newConfig,
            hiddenTaskColumns: newHidden
        }));
    };

    // Helper: Get Seniority Color (from Stitch Design System)
    const getSeniorityColor = (seniority) => {
        if (!seniority) return 'var(--on-surface-variant)';
        const colors = {
            1: '#ef4444', 2: '#f97316', 3: '#f59e0b', 4: '#eab308', 5: '#84cc16',
            6: '#22c55e', 7: '#10b981', 8: '#14b8a6', 9: '#06b6d4', 10: '#3b82f6'
        };
        return colors[seniority] || 'var(--on-surface-variant)';
    };

    const handlePrint = () => {
        window.print();
    };

    // Initialize month
    const selectedDate = constraints.selectedMonth ? new Date(constraints.selectedMonth + '-01') : new Date();
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const taskColumns = constraints.taskColumns || [];
    const shiftColumnNames = constraints.shiftColumnNames || ['Nöbetçi 1', 'Nöbetçi 2'];

    // Find max assigned staff for any day in the current schedule
    let maxAssigned = 2; // Default to 2
    if (schedule && days.length > 0) {
        maxAssigned = Math.max(
            ...days.map(day => {
                const dateString = format(day, 'yyyy-MM-dd');
                return schedule[dateString]?.length || 0;
            })
        );
        if (maxAssigned < 2) maxAssigned = 2; // Always show at least 2 columns
    }

    // Helper: Check if date is a Turkish public holiday
    const isTurkishHoliday = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();

        const fixedHolidays = [
            { month: 1, day: 1 }, { month: 4, day: 23 }, { month: 5, day: 1 },
            { month: 5, day: 19 }, { month: 7, day: 15 }, { month: 8, day: 30 }, { month: 10, day: 29 },
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

    // Helper: Get row background color based on day type
    const getRowClass = (date) => {
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = isTurkishHoliday(date);

        if (isHoliday) return 'holiday-row';
        if (isWeekend) return 'weekend-row';
        return '';
    };

    // Helper: Get available staff for a specific day and task
    const getAvailableStaff = (dateString, currentTaskIndex, currentSubIdx) => {
        const dayDate = new Date(dateString);
        const prevDate = subDays(dayDate, 1);
        const prevDateString = format(prevDate, 'yyyy-MM-dd');

        const prevShiftStaff = schedule && schedule[prevDateString] ? schedule[prevDateString] : [];
        const prevShiftIds = prevShiftStaff.map(s => s.id);

        const dayTasks = tasks[dateString] || {};

        return staffList.map(staff => {
            let status = 'available';
            let reason = '';

            // 1. Check Leave
            const isLeave = staff.leaveDays && staff.leaveDays.includes(dateString);
            const isUnavailable = staff.unavailability && staff.unavailability.includes(dateString);
            if (isLeave) {
                status = 'busy';
                reason = 'İzinli';
            } else if (isUnavailable) {
                status = 'busy';
                reason = 'Müsait Değil';
            }
            // 2. Check Previous Night Shift
            else if (prevShiftIds.includes(staff.id)) {
                status = 'busy';
                reason = 'Nöbet Ertesi';
            }
            // 3. Check Other Task Columns
            else {
                for (let idx = 0; idx < taskColumns.length; idx++) {
                    const assigned = dayTasks[idx];
                    const assignedArray = Array.isArray(assigned) ? assigned : (assigned ? [assigned] : []);

                    if (idx === currentTaskIndex) {
                        // Check other slots in the SAME column
                        if (assignedArray.some((id, sIdx) => id === staff.id && sIdx !== currentSubIdx)) {
                            status = 'busy';
                            reason = 'Aynı Görev (Diğer Slot)';
                            break;
                        }
                    } else {
                        // Check other columns
                        if (assignedArray.includes(staff.id)) {
                            status = 'busy';
                            reason = 'Başka Görev';
                            break;
                        }
                    }
                }
            }

            return { ...staff, status, reason };
        });
    };

    // Toggle column visibility
    const toggleColumnVisibility = (columnIndex) => {
        const newHidden = hiddenColumns.includes(columnIndex)
            ? hiddenColumns.filter(i => i !== columnIndex)
            : [...hiddenColumns, columnIndex];

        setHiddenColumns(newHidden);

        // Save to constraints
        setConstraints(prev => ({
            ...prev,
            hiddenTaskColumns: newHidden
        }));
    };

    // Auto-distribute for a column
    const handleAutoDistribute = (columnIndex, fillEmptyOnly) => {
        const columnConfig = constraints.taskColumnConfig?.[columnIndex] || {};

        if (!columnConfig.eligibleStaffIds && !columnConfig.eligibleSeniorities) {
            alert('Bu sütun için önce ayarları yapılandırın (⚙️ butonuna tıklayın)');
            return;
        }

        const confirmMsg = fillEmptyOnly
            ? 'Boş hücreleri otomatik doldurmak istiyor musunuz?'
            : 'Mevcut atamaları silip sıfırdan dağıtmak istiyor musunuz?';

        if (!window.confirm(confirmMsg)) return;

        const newTasks = distributeTaskColumn({
            days,
            staffList,
            schedule,
            currentTasks: tasks,
            columnConfig,
            columnIndex,
            fillEmptyOnly
        });

        setTasks(newTasks);
    };

    // Save leave column name to constraints
    const handleLeaveColumnNameChange = (newName) => {
        setLeaveColumnName(newName);
        setConstraints(prev => ({
            ...prev,
            leaveColumnName: newName
        }));
    };

    // Get staff on leave for a specific day
    const getLeaveStaff = (dateString) => {
        return staffList.filter(staff => staff.leaveDays && staff.leaveDays.includes(dateString));
    };

    // Calculate day-based statistics for a specific column (person x weekday)
    const calculateColumnDayStats = (columnIndex) => {
        const stats = {};

        staffList.forEach(staff => {
            stats[staff.id] = {
                name: staff.name,
                seniority: staff.seniority,
                days: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }, // Sunday=0, Monday=1, ..., Saturday=6
                total: 0
            };
        });

        days.forEach(day => {
            const dateString = format(day, 'yyyy-MM-dd');
            const dayTasks = tasks[dateString] || {};
            const dayOfWeek = day.getDay();

            const assigned = dayTasks[columnIndex];
            if (assigned) {
                const ids = Array.isArray(assigned) ? assigned : [assigned];
                ids.forEach(id => {
                    if (stats[id]) {
                        stats[id].days[dayOfWeek]++;
                        stats[id].total++;
                    }
                });
            }
        });

        return Object.values(stats).sort((a, b) => b.seniority - a.seniority);
    };



    if (taskColumns.length === 0) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                <h3>Henüz görev sütunu eklenmemiş.</h3>
                <p style={{ color: 'var(--on-surface-variant)' }}>Lütfen "Ayarlar" sekmesinden görev tanımlarını (Ameliyat, Servis vb.) ekleyin.</p>
            </div>
        );
    }

    return (
        <div className="card" style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>Günlük Görev Dağılımı</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handlePrint} className="btn btn-secondary btn-sm">
                        🖨️ Yazdır
                    </button>
                    {onSaveToHistory && (
                        <button onClick={onSaveToHistory} className="btn btn-primary btn-sm">
                            💾 Kaydet
                        </button>
                    )}
                </div>
            </div>

            <div className="print-area">
                <table className="data-table" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    <thead>
                        <tr>
                            <th>Tarih</th>
                            {Array.from({ length: maxAssigned }).map((_, i) => (
                                <th key={`shift-col-${i}`}>
                                    {shiftColumnNames[i] || `Nöbetçi ${i + 1}`}
                                </th>
                            ))}
                            {taskColumns.map((col, idx) => {
                                if (hiddenColumns.includes(idx)) return null;

                                const config = constraints.taskColumnConfig?.[idx] || {};
                                const maxPerDay = config.maxPerDay || 1;

                                // Create sub-columns
                                return Array.from({ length: maxPerDay }).map((_, subIdx) => (
                                    <th
                                        key={`${idx}-${subIdx}`}
                                        style={{
                                            cursor: subIdx === 0 ? 'grab' : 'default',
                                            opacity: draggedColumnIdx === idx ? 0.5 : 1,
                                            userSelect: 'none'
                                        }}
                                        draggable={subIdx === 0}
                                        onDragStart={(e) => {
                                            if (subIdx === 0) setDraggedColumnIdx(idx);
                                        }}
                                        onDragOver={(e) => {
                                            if (subIdx === 0) e.preventDefault();
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            if (subIdx === 0 && draggedColumnIdx !== null && draggedColumnIdx !== idx) {
                                                handleColumnReorder(draggedColumnIdx, idx);
                                            }
                                            setDraggedColumnIdx(null);
                                        }}
                                        onDragEnd={() => setDraggedColumnIdx(null)}
                                        onTouchStart={(e) => {
                                            if (subIdx === 0) {
                                                setDraggedColumnIdx(idx);
                                                touchTargetRef.current = null;
                                                e.currentTarget.style.opacity = '0.5';
                                            }
                                        }}
                                        onTouchMove={(e) => {
                                            if (draggedColumnIdx === null) return;
                                            if (subIdx === 0) e.preventDefault();

                                            const touch = e.touches[0];
                                            const el = document.elementFromPoint(touch.clientX, touch.clientY);
                                            if (el) {
                                                const th = el.closest('th');
                                                if (th) {
                                                    const targetIdx = th.getAttribute('data-colidx');
                                                    if (targetIdx !== null && targetIdx !== String(draggedColumnIdx)) {
                                                        touchTargetRef.current = parseInt(targetIdx);
                                                    }
                                                }
                                            }
                                        }}
                                        onTouchEnd={(e) => {
                                            if (draggedColumnIdx !== null && touchTargetRef.current !== null && draggedColumnIdx !== touchTargetRef.current) {
                                                handleColumnReorder(draggedColumnIdx, touchTargetRef.current);
                                            }
                                            e.currentTarget.style.opacity = '1';
                                            setDraggedColumnIdx(null);
                                            touchTargetRef.current = null;
                                        }}
                                        data-colidx={idx}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {subIdx === 0 && <span style={{ color: 'var(--primary)', marginRight: '2px', cursor: 'grab' }}>⋮⋮</span>}
                                            <span>{col}{maxPerDay > 1 ? ` ${subIdx + 1}` : ''}</span>
                                            {subIdx === 0 && (
                                                <div className="no-print" style={{ display: 'flex', gap: '2px', marginLeft: 'auto' }}>
                                                    <button
                                                        onClick={() => setConfigColumnIndex(idx)}
                                                        className="btn-icon"
                                                        title="Ayarlar"
                                                    >
                                                        ⚙️
                                                    </button>
                                                    <button
                                                        onClick={() => handleAutoDistribute(idx, true)}
                                                        className="btn-icon"
                                                        title="Boşları Doldur"
                                                    >
                                                        ➕
                                                    </button>
                                                    <button
                                                        onClick={() => handleAutoDistribute(idx, false)}
                                                        className="btn-icon"
                                                        title="Sıfırdan Dağıt"
                                                    >
                                                        🔄
                                                    </button>
                                                    <button
                                                        onClick={() => toggleColumnVisibility(idx)}
                                                        className="btn-icon"
                                                        title="Gizle"
                                                    >
                                                        👁️
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </th>
                                ));
                            })}
                            {/* Leave Column Header */}
                            <th style={{ background: 'var(--surface-container-high)', borderLeft: '2px solid var(--surface-container-highest)' }}>
                                {editingLeaveColumnName ? (
                                    <input
                                        type="text"
                                        value={leaveColumnName}
                                        onChange={(e) => setLeaveColumnName(e.target.value)}
                                        onBlur={() => {
                                            setEditingLeaveColumnName(false);
                                            handleLeaveColumnNameChange(leaveColumnName);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                setEditingLeaveColumnName(false);
                                                handleLeaveColumnNameChange(leaveColumnName);
                                            }
                                        }}
                                        autoFocus
                                        style={{
                                            fontSize: '0.7rem',
                                            padding: '2px 4px',
                                            border: '1px solid var(--primary)',
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'var(--surface-container)',
                                            color: 'var(--on-surface)',
                                            width: '80px'
                                        }}
                                    />
                                ) : (
                                    <span
                                        onClick={() => setEditingLeaveColumnName(true)}
                                        style={{ cursor: 'pointer' }}
                                        title="Sütun adını değiştirmek için tıklayın"
                                    >
                                        {leaveColumnName} ✏️
                                    </span>
                                )}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {days.map(day => {
                            const dateString = format(day, 'yyyy-MM-dd');
                            const dayName = format(day, 'd MMM EEE', { locale: tr });
                            const dayTasks = tasks[dateString] || {};

                            // Get staff on shift for this day (sorted by seniority)
                            const shiftStaff = schedule && schedule[dateString] ? [...schedule[dateString]] : [];
                            shiftStaff.sort((a, b) => b.seniority - a.seniority);

                            const rowClass = getRowClass(day);

                            return (
                                <tr key={dateString} className={rowClass}>
                                    <td style={{ fontWeight: '600', color: 'var(--on-surface-variant)' }}>{dayName}</td>

                                    {/* Shift Columns */}
                                    {Array.from({ length: maxAssigned }).map((_, i) => {
                                        const staffMember = shiftStaff[i];
                                        return (
                                            <td key={`shift-cell-${dateString}-${i}`} style={{ color: staffMember ? getSeniorityColor(staffMember.seniority) : 'inherit', fontWeight: '500' }}>
                                                {staffMember ? staffMember.name : '-'}
                                            </td>
                                        );
                                    })}

                                    {taskColumns.map((col, idx) => {
                                        if (hiddenColumns.includes(idx)) return null;

                                        const config = constraints.taskColumnConfig?.[idx] || {};
                                        const maxPerDay = config.maxPerDay || 1;
                                        const assignedIds = dayTasks[idx];
                                        const assignedArray = Array.isArray(assignedIds) ? assignedIds : (assignedIds ? [assignedIds] : []);

                                        return Array.from({ length: maxPerDay }).map((_, subIdx) => {
                                            const assignedId = assignedArray[subIdx];
                                            const allStaffStatus = getAvailableStaff(dateString, idx, subIdx);
                                            const freeStaff = allStaffStatus.filter(s => s.status === 'available');
                                            const busyStaff = allStaffStatus.filter(s => s.status === 'busy');

                                            const isEditing = editingCell?.dateString === dateString &&
                                                editingCell?.columnIdx === idx &&
                                                editingCell?.subIdx === subIdx;

                                            const assignedStaff = staffList.find(s => s.id === assignedId);

                                            return (
                                                <td key={`${idx}-${subIdx}`} style={{ minWidth: '100px', cursor: 'pointer' }} onClick={() => {
                                                    if (!isEditing) setEditingCell({ dateString, columnIdx: idx, subIdx });
                                                }}>
                                                    {isEditing ? (
                                                        <select
                                                            value={assignedId || ""}
                                                            autoFocus
                                                            onBlur={() => setEditingCell(null)}
                                                            onChange={(e) => {
                                                                const newId = e.target.value ? parseInt(e.target.value) : null;
                                                                setTasks(prev => {
                                                                    const dayTasks = prev[dateString] || {};
                                                                    const currentAssigned = dayTasks[idx];
                                                                    const currentArray = Array.isArray(currentAssigned) ? currentAssigned : (currentAssigned ? [currentAssigned] : []);

                                                                    const newArray = [...currentArray];
                                                                    if (newId) {
                                                                        newArray[subIdx] = newId;
                                                                    } else {
                                                                        newArray.splice(subIdx, 1);
                                                                    }

                                                                    const filtered = newArray.filter(id => id != null);

                                                                    return {
                                                                        ...prev,
                                                                        [dateString]: {
                                                                            ...dayTasks,
                                                                            [idx]: filtered.length > 0 ? filtered : undefined
                                                                        }
                                                                    };
                                                                });
                                                                setEditingCell(null);
                                                            }}
                                                            style={{
                                                                width: '100%',
                                                                padding: '4px',
                                                                fontSize: '0.75rem',
                                                                background: 'var(--surface-container-highest)',
                                                                color: 'var(--on-surface)',
                                                                border: '1px solid var(--primary)',
                                                                borderRadius: 'var(--radius-sm)',
                                                                outline: 'none'
                                                            }}
                                                        >
                                                            <option value="">-</option>
                                                            <optgroup label="✅ Müsait Olanlar">
                                                                {freeStaff.map(s => (
                                                                    <option key={s.id} value={s.id} style={{ color: getSeniorityColor(s.seniority) }}>
                                                                        {s.name}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                            <optgroup label="❌ Meşgul / İzinli">
                                                                {busyStaff.map(s => (
                                                                    <option key={s.id} value={s.id} disabled style={{ color: 'var(--on-surface-variant)' }}>
                                                                        {s.name} ({s.reason})
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        </select>
                                                    ) : (
                                                        <div
                                                            className="avail-cell"
                                                            style={{
                                                                padding: '4px 6px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: assignedStaff ? '600' : '400',
                                                                color: assignedStaff ? getSeniorityColor(assignedStaff.seniority) : 'var(--on-surface-variant)',
                                                                background: assignedStaff ? 'transparent' : 'var(--surface-container-lowest)',
                                                                border: assignedStaff ? `1px solid ${getSeniorityColor(assignedStaff.seniority)}` : '1px dashed var(--surface-container-highest)',
                                                                borderRadius: 'var(--radius-sm)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                minHeight: '24px'
                                                            }}
                                                        >
                                                            {assignedStaff ? assignedStaff.name : '-'}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        });
                                    })}

                                    {/* Leave Column */}
                                    <td style={{
                                        color: 'var(--error)',
                                        whiteSpace: 'nowrap',
                                        fontSize: '0.7rem',
                                        borderLeft: '2px solid var(--surface-container-highest)'
                                    }}>
                                        {getLeaveStaff(dateString).map(s => s.name).join(', ') || '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>


                {/* Per-Column Statistics with Tabs */}
                <div className="card no-print" style={{ marginTop: '24px', background: 'var(--surface-container)' }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem' }}>📊 Görev İstatistikleri</h4>

                    {/* Tab Navigation */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        {taskColumns.map((col, idx) => {
                            if (hiddenColumns.includes(idx)) return null;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => setActiveStatsTab(idx)}
                                    className={`mode-btn${activeStatsTab === idx ? ' active-required' : ''}`}
                                >
                                    {col}
                                </button>
                            );
                        })}
                    </div>

                    {/* Statistics Table for Active Column */}
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ fontSize: '0.75rem' }}>
                            <thead>
                                <tr>
                                    <th>Personel</th>
                                    <th style={{ textAlign: 'center' }}>Pzt</th>
                                    <th style={{ textAlign: 'center' }}>Sal</th>
                                    <th style={{ textAlign: 'center' }}>Çar</th>
                                    <th style={{ textAlign: 'center' }}>Per</th>
                                    <th style={{ textAlign: 'center' }}>Cum</th>
                                    <th style={{ textAlign: 'center', background: 'rgba(102, 217, 204, 0.05)' }}>Cmt</th>
                                    <th style={{ textAlign: 'center', background: 'rgba(102, 217, 204, 0.05)' }}>Paz</th>
                                    <th style={{ textAlign: 'center', color: 'var(--primary)' }}>Toplam</th>
                                </tr>
                            </thead>
                            <tbody>
                                {calculateColumnDayStats(activeStatsTab).map(stat => (
                                    <tr key={stat.name}>
                                        <td style={{ fontWeight: '600', color: getSeniorityColor(stat.seniority) }}>
                                            {stat.name}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>{stat.days[1] || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>{stat.days[2] || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>{stat.days[3] || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>{stat.days[4] || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>{stat.days[5] || '-'}</td>
                                        <td className="weekend-row" style={{ textAlign: 'center' }}>{stat.days[6] || '-'}</td>
                                        <td className="weekend-row" style={{ textAlign: 'center' }}>{stat.days[0] || '-'}</td>
                                        <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--primary)' }}>
                                            {stat.total}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Hidden Columns Info */}
                {hiddenColumns.length > 0 && (
                    <div className="hint-bar no-print" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontWeight: '600' }}>👁️ Gizli Sütunlar:</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {hiddenColumns.map(idx => (
                                <div key={idx} className="task-col-tag">
                                    <span>{taskColumns[idx]}</span>
                                    <button
                                        onClick={() => toggleColumnVisibility(idx)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 0 }}
                                    >
                                        [+ Göster]
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Configuration Modal */}
            {configColumnIndex !== null && (
                <TaskColumnConfig
                    columnIndex={configColumnIndex}
                    columnName={taskColumns[configColumnIndex]}
                    constraints={constraints}
                    setConstraints={setConstraints}
                    staffList={staffList}
                    onClose={() => setConfigColumnIndex(null)}
                />
            )}
        </div>
    );
};

export default TaskDistribution;
