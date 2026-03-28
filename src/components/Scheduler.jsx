import React, { useState } from 'react';
import { generateSchedule } from '../utils/schedulerAlgorithm';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isWeekend, subDays, addDays as addDaysFns } from 'date-fns';
import { tr } from 'date-fns/locale';

const Scheduler = ({ staffList, constraints, schedule, setSchedule, onSaveToHistory }) => {
    const [editingDay, setEditingDay] = useState(null);
    const [copied, setCopied] = useState(false);
    const [draggedItem, setDraggedItem] = useState(null);

    // Use selected month or default to current
    const selectedDate = constraints.selectedMonth ? new Date(constraints.selectedMonth + '-01') : new Date();
    const monthTitle = format(selectedDate, 'MMMM yyyy', { locale: tr });

    const handleGenerate = () => {
        if (staffList.length === 0) {
            alert('Lütfen önce personel ekleyin.');
            return;
        }
        const newSchedule = generateSchedule(staffList, constraints, selectedDate);
        setSchedule(newSchedule);
    };

    // Remove staff from a specific day
    const removeFromDay = (dateString, staffId) => {
        setSchedule(prev => ({
            ...prev,
            [dateString]: prev[dateString].filter(s => s.id !== staffId)
        }));
    };

    // Add staff to a specific day
    const addToDay = (dateString, staff) => {
        // Check availability
        if (staff.leaveDays?.includes(dateString)) {
            if (!window.confirm(`${staff.name} bu tarihte İZİNLİ görünüyor. Yine de eklemek istiyor musunuz?`)) return;
        }
        if (staff.unavailability?.includes(dateString)) {
            if (!window.confirm(`${staff.name} bu tarihte MÜSAİT DEĞİL olarak işaretlenmiş. Yine de eklemek istiyor musunuz?`)) return;
        }

        setSchedule(prev => ({
            ...prev,
            [dateString]: [...(prev[dateString] || []), staff]
        }));
        setEditingDay(null);
    };

    // Get available staff for adding (not already assigned that day)
    const getAvailableStaff = (dateString) => {
        const assigned = schedule[dateString] || [];
        const assignedIds = assigned.map(s => s.id);
        return staffList.filter(s => !assignedIds.includes(s.id));
    };

    // Copy schedule to clipboard
    const copyToClipboard = () => {
        if (!schedule) return;

        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

        let text = `Vardiya Çizelgesi - ${monthTitle}\n\n`;
        text += 'Tarih\tNöbetçi 1\tNöbetçi 2\n';
        text += '─'.repeat(60) + '\n';

        days.forEach(day => {
            const dateString = format(day, 'yyyy-MM-dd');
            const assigned = schedule[dateString] || [];

            const fullDate = format(day, 'd MMMM EEEE', { locale: tr });

            const staff1 = assigned[0] ? (assigned[0].name || `${assigned[0].firstName} ${assigned[0].lastName}`) : '-';
            const staff2 = assigned[1] ? (assigned[1].name || `${assigned[1].firstName} ${assigned[1].lastName}`) : '-';

            let extraStaff = '';
            if (assigned.length > 2) {
                extraStaff = '\t' + assigned.slice(2).map(s => s.name || `${s.firstName} ${s.lastName}`).join('\t');
            }

            text += `${fullDate}\t${staff1}\t${staff2}${extraStaff}\n`;
        });

        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // 10-step seniority colors
    const getSeniorityColor = (seniority) => {
        const colors = {
            1: '#ef4444',
            2: '#f97316',
            3: '#f59e0b',
            4: '#eab308',
            5: '#84cc16',
            6: '#22c55e',
            7: '#06b6d4',
            8: '#3b82f6',
            9: '#6366f1',
            10: '#8b5cf6'
        };
        return colors[seniority] || colors[10];
    };

    // Helper to check if staff is resting (checks both PAST and FUTURE assignments)
    const checkRestViolation = (staffId, targetDateStr) => {
        if (!schedule) return false;

        const targetDate = new Date(targetDateStr);
        const restDays = Math.ceil(constraints.minRestHours / 24);
        const requiredDayGap = 1 + restDays;

        for (let i = 1; i < requiredDayGap; i++) {
            const pastDate = subDays(targetDate, i);
            const pastString = format(pastDate, 'yyyy-MM-dd');
            if (schedule[pastString]?.find(s => s.id === staffId)) return true;

            const futureDate = addDaysFns(targetDate, i);
            const futureString = format(futureDate, 'yyyy-MM-dd');
            if (schedule[futureString]?.find(s => s.id === staffId)) return true;
        }
        return false;
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e, dateString, staff) => {
        setDraggedItem({ date: dateString, staff });
        e.dataTransfer.effectAllowed = 'move';
        e.target.style.opacity = '0.5';
    };

    const handleDragEnd = (e) => {
        e.target.style.opacity = '1';
        setDraggedItem(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetDate, targetStaff) => {
        e.preventDefault();

        if (!draggedItem) return;

        const { date: sourceDate, staff: sourceStaff } = draggedItem;

        if (sourceDate === targetDate && sourceStaff.id === targetStaff.id) return;

        if (sourceStaff.leaveDays?.includes(targetDate)) {
            if (!window.confirm(`${sourceStaff.name} ${targetDate} tarihinde İZİNLİ. Değişimi onaylıyor musunuz?`)) return;
        }
        if (sourceStaff.unavailability?.includes(targetDate)) {
            if (!window.confirm(`${sourceStaff.name} ${targetDate} tarihinde MÜSAİT DEĞİL. Değişimi onaylıyor musunuz?`)) return;
        }

        if (targetStaff.leaveDays?.includes(sourceDate)) {
            if (!window.confirm(`${targetStaff.name} ${sourceDate} tarihinde İZİNLİ. Değişimi onaylıyor musunuz?`)) return;
        }
        if (targetStaff.unavailability?.includes(sourceDate)) {
            if (!window.confirm(`${targetStaff.name} ${sourceDate} tarihinde MÜSAİT DEĞİL. Değişimi onaylıyor musunuz?`)) return;
        }

        setSchedule(prev => {
            const newSchedule = { ...prev };

            newSchedule[sourceDate] = newSchedule[sourceDate].filter(s => s.id !== sourceStaff.id);
            newSchedule[targetDate] = newSchedule[targetDate].filter(s => s.id !== targetStaff.id);

            newSchedule[sourceDate].push(targetStaff);
            newSchedule[targetDate].push(sourceStaff);

            return newSchedule;
        });
    };

    // Download settings log
    const downloadSettingsLog = () => {
        let log = `NOBET CIZELGESI AYARLARI - ${format(new Date(), 'dd.MM.yyyy HH:mm')}\n`;
        log += `============================================\n\n`;

        log += `1. GENEL KISITLAMALAR\n`;
        log += `---------------------\n`;
        log += `Ay: ${monthTitle}\n`;
        log += `Maksimum Nöbet: ${constraints.maxShiftsPerMonth}\n`;
        log += `Min Dinlenme: ${constraints.minRestHours} saat\n`;
        log += `Vardiya Süresi: ${constraints.shiftDuration} saat\n`;
        log += `Slot Sistemi: ${constraints.slotSystem?.enabled ? 'Aktif' : 'Pasif'}\n\n`;

        log += `2. GUNLUK IHTIYACLAR\n`;
        log += `--------------------\n`;
        Object.entries(constraints.dailyNeeds).forEach(([day, count]) => {
            log += `${day}: ${count} kişi\n`;
        });
        log += `\n`;

        log += `3. PERSONEL LISTESI (${staffList.length} Kişi)\n`;
        log += `----------------------------------------\n`;
        staffList.forEach(staff => {
            log += `[ID: ${staff.id}] ${staff.name}\n`;
            log += `   - Kıdem: ${staff.seniority}\n`;
            log += `   - Müsait Değil: ${staff.unavailability?.join(', ') || 'Yok'}\n`;
            log += `   - İzinli: ${staff.leaveDays?.join(', ') || 'Yok'}\n`;
            log += `   - Kesin Nöbet: ${staff.requiredDays?.join(', ') || 'Yok'}\n`;
            log += `\n`;
        });

        const blob = new Blob([log], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `nobet_ayarlari_${format(new Date(), 'yyyyMMdd_HHmm')}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderCalendar = () => {
        if (!schedule) return (
            <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <p>Çizelge oluşturmak için butona tıklayın</p>
            </div>
        );

        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const startDay = getDay(monthStart);
        const placeholders = Array.from({ length: startDay }).map((_, i) => <div key={`placeholder-${i}`} />);

        return (
            <div className="schedule-grid">
                {/* Day Headers */}
                {['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'].map((day, idx) => (
                    <div
                        key={day}
                        className={`schedule-day-header${idx === 0 || idx === 6 ? ' weekend' : ''}`}
                    >
                        {day}
                    </div>
                ))}

                {placeholders}

                {/* Days */}
                {days.map(day => {
                    const dateString = format(day, 'yyyy-MM-dd');
                    const assigned = schedule[dateString] || [];
                    const isWknd = isWeekend(day);
                    const isEditing = editingDay === dateString;
                    const isEmpty = assigned.length === 0;

                    let cellClass = 'day-cell';
                    if (isWknd) cellClass += ' weekend';
                    if (isEmpty && !isEditing) cellClass += ' empty';

                    return (
                        <div key={dateString} className={cellClass}>
                            <div className={`day-cell-number${isWknd ? ' weekend' : ''}`}>
                                <span>{format(day, 'd')}</span>
                                <button
                                    className="day-cell-edit-btn"
                                    onClick={() => setEditingDay(isEditing ? null : dateString)}
                                    title="Düzenle"
                                >
                                    {isEditing ? '✕' : '✏️'}
                                </button>
                            </div>

                            {/* Assigned Staff */}
                            <div>
                                {assigned.map(staff => {
                                    const color = getSeniorityColor(staff.seniority);
                                    const hasViolation = checkRestViolation(staff.id, dateString);

                                    return (
                                        <div
                                            key={staff.id}
                                            draggable={!isEditing}
                                            onDragStart={(e) => handleDragStart(e, dateString, staff)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, dateString, staff)}
                                            className={`staff-chip${hasViolation ? ' violation' : ''}`}
                                            style={{
                                                borderLeftColor: hasViolation ? undefined : color,
                                                cursor: isEditing ? 'default' : 'grab'
                                            }}
                                        >
                                            <span className="staff-chip-name">
                                                {staff.name || `${staff.firstName} ${staff.lastName?.charAt(0)}.`}
                                            </span>
                                            {isEditing && (
                                                <button
                                                    className="staff-chip-remove"
                                                    onClick={() => removeFromDay(dateString, staff.id)}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Add Staff Dropdown */}
                            {isEditing && (
                                <select
                                    className="cell-add-select"
                                    onChange={(e) => {
                                        const staff = staffList.find(s => s.id === parseInt(e.target.value));
                                        if (staff) addToDay(dateString, staff);
                                    }}
                                    value=""
                                >
                                    <option value="">+ Ekle...</option>
                                    {getAvailableStaff(dateString).map(staff => (
                                        <option key={staff.id} value={staff.id}>
                                            {staff.name} (K:{staff.seniority})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="card">
            <div className="toolbar">
                <div>
                    <h3>Aylık Çizelge</h3>
                    <div className="month-badge" style={{ marginTop: '6px' }}>
                        📅 {monthTitle}
                    </div>
                </div>
                <div className="toolbar-actions">
                    <button onClick={downloadSettingsLog} className="btn btn-ghost" title="Tüm ayarları ve personel listesini indir">
                        ⚙️ Ayarları İndir
                    </button>
                    {schedule && (
                        <button onClick={onSaveToHistory} className="btn btn-ghost" title="Çizelgeyi geçmişe kaydet">
                            💾 Kaydet
                        </button>
                    )}
                    {schedule && (
                        <button onClick={copyToClipboard} className="btn btn-ghost">
                            {copied ? '✓ Kopyalandı!' : '📋 Panoya Kopyala'}
                        </button>
                    )}
                    <button onClick={handleGenerate} className="btn btn-primary">
                        🔄 Çizelge Oluştur
                    </button>
                </div>
            </div>

            {schedule && (
                <div className="hint-bar">
                    <span>💡</span>
                    <span>İsimleri sürükleyip bırakarak yer değiştirebilirsiniz.</span>
                </div>
            )}

            {renderCalendar()}
        </div>
    );
};

export default Scheduler;
