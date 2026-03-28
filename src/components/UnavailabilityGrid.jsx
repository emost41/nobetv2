import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, getDay } from 'date-fns';
import { tr } from 'date-fns/locale';

const UnavailabilityGrid = ({ staffList, setStaffList, selectedMonth }) => {
    // 3 modes: 'unavailable' (preference), 'leave' (real leave - affects target), 'required' (must work)
    const [selectionMode, setSelectionMode] = useState('unavailable');

    const selectedDate = selectedMonth ? new Date(selectedMonth + '-01') : new Date();
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const days = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);
    const monthTitle = format(selectedDate, 'MMMM yyyy', { locale: tr });

    const handleCellClick = (staffId, dateString) => {
        setStaffList(prevList =>
            prevList.map(staff => {
                if (staff.id !== staffId) return staff;

                const unavailability = staff.unavailability || [];
                const leaveDays = staff.leaveDays || [];
                const requiredDays = staff.requiredDays || [];

                if (selectionMode === 'unavailable') {
                    const isUnavailable = unavailability.includes(dateString);
                    return {
                        ...staff,
                        unavailability: isUnavailable
                            ? unavailability.filter(d => d !== dateString)
                            : [...unavailability, dateString],
                        leaveDays: leaveDays.filter(d => d !== dateString),
                        requiredDays: requiredDays.filter(d => d !== dateString)
                    };
                } else if (selectionMode === 'leave') {
                    const isLeave = leaveDays.includes(dateString);
                    return {
                        ...staff,
                        leaveDays: isLeave
                            ? leaveDays.filter(d => d !== dateString)
                            : [...leaveDays, dateString],
                        unavailability: unavailability.filter(d => d !== dateString),
                        requiredDays: requiredDays.filter(d => d !== dateString)
                    };
                } else {
                    const isRequired = requiredDays.includes(dateString);
                    return {
                        ...staff,
                        requiredDays: isRequired
                            ? requiredDays.filter(d => d !== dateString)
                            : [...requiredDays, dateString],
                        unavailability: unavailability.filter(d => d !== dateString),
                        leaveDays: leaveDays.filter(d => d !== dateString)
                    };
                }
            })
        );
    };

    const isUnavailable = (staff, dateString) => staff.unavailability?.includes(dateString);
    const isLeave = (staff, dateString) => staff.leaveDays?.includes(dateString);
    const isRequired = (staff, dateString) => staff.requiredDays?.includes(dateString);

    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

    const getSeniorityColor = (seniority) => {
        if (seniority <= 2) return '#ef4444';
        if (seniority <= 4) return '#f59e0b';
        if (seniority <= 6) return '#22c55e';
        if (seniority <= 8) return '#3b82f6';
        return '#8b5cf6';
    };

    if (staffList.length === 0) {
        return (
            <div className="card">
                <div className="empty-state">
                    <div className="empty-state-icon">📅</div>
                    <p>Müsaitlik tablosu için önce personel ekleyin.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card" style={{ overflowX: 'auto' }}>
            <div className="toolbar">
                <div>
                    <h3>📅 Müsaitlik Takvimi</h3>
                    <div className="month-badge" style={{ marginTop: '6px' }}>
                        {monthTitle}
                    </div>
                </div>
                <button
                    onClick={() => {
                        if (window.confirm(`${monthTitle} için tüm müsaitlik/izin verilerini sıfırlamak istediğinize emin misiniz?`)) {
                            setStaffList(prevList => prevList.map(staff => {
                                const validDays = days.map(d => format(d, 'yyyy-MM-dd'));
                                return {
                                    ...staff,
                                    unavailability: (staff.unavailability || []).filter(d => !validDays.includes(d)),
                                    leaveDays: (staff.leaveDays || []).filter(d => !validDays.includes(d)),
                                    requiredDays: (staff.requiredDays || []).filter(d => !validDays.includes(d))
                                };
                            }));
                        }
                    }}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--error)' }}
                >
                    🗑️ Aktif Ayı Sıfırla
                </button>
            </div>

            {/* Selection Mode Toggle */}
            <div className="mode-btn-group" style={{ marginBottom: '16px' }}>
                <span style={{ fontWeight: '500', padding: '0 8px', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', fontSize: '0.8rem' }}>Mod:</span>
                <button
                    className={`mode-btn${selectionMode === 'unavailable' ? ' active-leave' : ''}`}
                    onClick={() => setSelectionMode('unavailable')}
                >
                    ✕ Müsait Değil
                </button>
                <button
                    className={`mode-btn${selectionMode === 'leave' ? ' active-unavailable' : ''}`}
                    onClick={() => setSelectionMode('leave')}
                >
                    🏖️ İzinli
                </button>
                <button
                    className={`mode-btn${selectionMode === 'required' ? ' active-required' : ''}`}
                    onClick={() => setSelectionMode('required')}
                >
                    ✓ Nöbet Yazılsın
                </button>
            </div>

            {/* Helper Text */}
            <div className="hint-bar" style={{ marginBottom: '16px' }}>
                {selectionMode === 'unavailable' && (
                    <span>🔴 <strong>Müsait Değil:</strong> Tercih olarak işaretlenir, nöbet hedefini ETKİLEMEZ</span>
                )}
                {selectionMode === 'leave' && (
                    <span>🟡 <strong>İzinli:</strong> Gerçek izin günleri, 7+ gün ise nöbet hedefini DÜŞÜRÜR</span>
                )}
                {selectionMode === 'required' && (
                    <span>🟢 <strong>Nöbet Yazılsın:</strong> Bu günlerde mutlaka nöbet atanır</span>
                )}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: `160px repeat(${days.length}, minmax(32px, 1fr))`,
                gap: '2px',
                fontSize: '0.75rem',
                minWidth: 'max-content'
            }}>
                {/* Header */}
                <div style={{
                    fontWeight: '600',
                    padding: '8px',
                    backgroundColor: 'var(--surface-container-high)',
                    borderRadius: 'var(--radius-sm) 0 0 0',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    color: 'var(--on-surface-variant)',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                }}>
                    Personel
                </div>
                {days.map((day, idx) => {
                    const isWknd = isWeekend(day);
                    const dayOfWeek = getDay(day);
                    return (
                        <div
                            key={idx}
                            className={`schedule-day-header${isWknd ? ' weekend' : ''}`}
                            style={{ padding: '4px 2px' }}
                        >
                            <div>{format(day, 'd')}</div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.7 }}>{dayNames[dayOfWeek]}</div>
                        </div>
                    );
                })}

                {/* Staff Rows */}
                {staffList.map((staff, staffIdx) => (
                    <React.Fragment key={staff.id}>
                        <div style={{
                            padding: '8px',
                            backgroundColor: staffIdx % 2 === 0 ? 'var(--surface-container)' : 'var(--surface-container-low)',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                            borderLeft: `3px solid ${getSeniorityColor(staff.seniority)}`
                        }}>
                            <span style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '130px',
                                fontSize: '0.8rem'
                            }}>
                                {staff.name || `${staff.firstName} ${staff.lastName}`}
                            </span>
                        </div>

                        {days.map((day) => {
                            const dateString = format(day, 'yyyy-MM-dd');
                            const unavailable = isUnavailable(staff, dateString);
                            const leave = isLeave(staff, dateString);
                            const required = isRequired(staff, dateString);
                            const isWknd = isWeekend(day);

                            let cellClass = 'avail-cell';
                            if (isWknd) cellClass += ' weekend';
                            if (unavailable) cellClass += ' unavailable';
                            else if (leave) cellClass += ' leave';
                            else if (required) cellClass += ' required';

                            let icon = null;
                            if (unavailable) icon = <span>✕</span>;
                            else if (leave) icon = <span>🏖️</span>;
                            else if (required) icon = <span>✓</span>;

                            return (
                                <div
                                    key={`${staff.id}-${dateString}`}
                                    className={cellClass}
                                    onClick={() => handleCellClick(staff.id, dateString)}
                                    style={{
                                        minHeight: '28px',
                                        fontSize: unavailable || required ? '0.7rem' : '0.65rem'
                                    }}
                                >
                                    {icon}
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>

            {/* Legend */}
            <div className="legend-bar" style={{ marginTop: '16px' }}>
                <div className="legend-item">
                    <div className="legend-swatch" style={{ background: 'rgba(102, 217, 204, 0.15)' }} />
                    <span>Hafta Sonu</span>
                </div>
                <div className="legend-item">
                    <div className="legend-swatch avail-cell unavailable" style={{ width: '14px', height: '14px' }} />
                    <span>Müsait Değil (Tercih)</span>
                </div>
                <div className="legend-item">
                    <div className="legend-swatch avail-cell leave" style={{ width: '14px', height: '14px' }} />
                    <span>İzinli (Hedefi Etkiler)</span>
                </div>
                <div className="legend-item">
                    <div className="legend-swatch avail-cell required" style={{ width: '14px', height: '14px' }} />
                    <span>Nöbet Yazılsın</span>
                </div>
            </div>
        </div>
    );
};

export default UnavailabilityGrid;
