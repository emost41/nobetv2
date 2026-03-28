import React, { useState } from 'react';
import { isWeekend, parseISO } from 'date-fns';

const Statistics = ({ staffList, schedule, constraints }) => {
    const [showLogs, setShowLogs] = useState(true);

    if (!schedule) return null;

    // Get algorithm logs
    const logs = schedule._logs || [];

    // Calculate stats with weekday/weekend breakdown
    const stats = staffList.map(staff => {
        let shiftCount = 0;
        let weekdayShifts = 0;
        let weekendShifts = 0;

        Object.entries(schedule).forEach(([dateString, assigned]) => {
            if (dateString.startsWith('_')) return;
            if (assigned.find(s => s.id === staff.id)) {
                shiftCount++;
                const date = parseISO(dateString);
                if (isWeekend(date)) {
                    weekendShifts++;
                } else {
                    weekdayShifts++;
                }
            }
        });

        const staffStat = schedule._staffStats?.[staff.id];
        const targetShifts = staffStat?.targetShifts || 0;
        const targetDiff = shiftCount - targetShifts;
        const targetDetails = schedule._targetDetails?.[staff.id];

        return {
            ...staff,
            shiftCount,
            weekdayShifts,
            weekendShifts,
            targetShifts,
            targetDiff,
            totalHours: shiftCount * (constraints?.shiftDuration || 8),
            leaveDays: targetDetails?.leaveDays || 0,
            targetReduced: targetDetails?.targetReduced || false
        };
    });

    stats.sort((a, b) => a.seniority - b.seniority);

    // 10-step Red-Violet Gradient (Infrared Style)
    const getSeniorityColor = (seniority) => {
        const colors = {
            1: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#fca5a5' },
            2: { bg: 'rgba(249, 115, 22, 0.15)', border: '#f97316', text: '#fdba74' },
            3: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fcd34d' },
            4: { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#fde047' },
            5: { bg: 'rgba(132, 204, 22, 0.15)', border: '#84cc16', text: '#bef264' },
            6: { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#86efac' },
            7: { bg: 'rgba(6, 182, 212, 0.15)', border: '#06b6d4', text: '#67e8f9' },
            8: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#93c5fd' },
            9: { bg: 'rgba(99, 102, 241, 0.15)', border: '#6366f1', text: '#a5b4fc' },
            10: { bg: 'rgba(139, 92, 246, 0.15)', border: '#8b5cf6', text: '#c4b5fd' }
        };
        return colors[seniority] || colors[10];
    };

    const totalShifts = stats.reduce((a, b) => a + b.shiftCount, 0);
    const totalWeekday = stats.reduce((a, b) => a + b.weekdayShifts, 0);
    const totalWeekend = stats.reduce((a, b) => a + b.weekendShifts, 0);

    return (
        <div className="card" style={{ marginTop: '20px' }}>
            <h3 style={{ marginBottom: '20px' }}>📊 İstatistikler ve Rapor</h3>

            {/* Seniority Legend */}
            <div className="settings-section" style={{ marginBottom: '20px', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--on-surface-variant)', marginRight: '8px' }}>Kıdem Skalası:</span>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => {
                    const c = getSeniorityColor(s);
                    return (
                        <span key={s} className="seniority-badge" style={{ backgroundColor: c.bg, color: c.text }}>
                            {s}
                        </span>
                    );
                })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {/* Staff Stats */}
                <div>
                    <h4 style={{ color: 'var(--on-surface-variant)', marginBottom: '12px', fontSize: '0.9rem' }}>Personel Durumu</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '6px' }}>
                        {staffList.map(staff => {
                            const stat = stats.find(s => s.id === staff.id);
                            if (!stat) return null;
                            const colors = getSeniorityColor(staff.seniority);

                            const percent = Math.min(100, Math.round((stat.shiftCount / stat.targetShifts) * 100));
                            const isTargetMet = stat.shiftCount === stat.targetShifts;
                            const isOver = stat.shiftCount > stat.targetShifts;

                            return (
                                <div key={staff.id} style={{
                                    padding: '10px 12px',
                                    borderRadius: 'var(--radius-md)',
                                    backgroundColor: 'var(--surface-container-high)',
                                    borderLeft: `3px solid ${colors.border}`,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{
                                            fontWeight: '600',
                                            color: 'var(--on-surface)',
                                            fontSize: '0.85rem',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {staff.name} <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>(K:{staff.seniority})</span>
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
                                            Haftasonu: {stat.weekendShifts} | Haftaiçi: {stat.weekdayShifts}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{
                                            fontSize: '1rem',
                                            fontWeight: '700',
                                            fontFamily: 'var(--font-headline)',
                                            color: isOver ? 'var(--error)' : (isTargetMet ? 'var(--primary)' : 'var(--on-surface)')
                                        }}>
                                            {stat.shiftCount} <span style={{ fontSize: '0.72rem', fontWeight: '400', color: 'var(--on-surface-variant)' }}>/ {stat.targetShifts}</span>
                                        </div>
                                        <div className="progress-track" style={{ width: '50px', marginTop: '4px', marginLeft: 'auto' }}>
                                            <div className="progress-fill" style={{
                                                width: `${percent}%`,
                                                background: isOver ? 'var(--error)' : `linear-gradient(90deg, ${colors.border}, var(--primary))`
                                            }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Algorithm Report */}
                <div>
                    <h4 style={{ color: 'var(--on-surface-variant)', marginBottom: '12px', fontSize: '0.9rem' }}>Algoritma Raporu</h4>
                    <div style={{ maxHeight: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {logs.map((log, idx) => {
                            let logClass = 'log-entry';
                            if (log.type === 'error') logClass += ' log-entry--error';
                            else if (log.type === 'warning') logClass += ' log-entry--warning';
                            else if (log.type === 'success') logClass += ' log-entry--success';
                            else if (log.type === 'info') logClass += ' log-entry--info';

                            return (
                                <div key={idx} className={logClass}>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: '1rem', lineHeight: 1 }}>{log.icon}</span>
                                        <div>
                                            <div style={{ color: 'var(--on-surface)', lineHeight: '1.4', fontSize: '0.82rem' }}>
                                                {log.message}
                                            </div>
                                            {log.details && (
                                                <div style={{ marginTop: '3px', fontSize: '0.72rem', color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>
                                                    {log.details}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {logs.length === 0 && (
                            <div style={{ color: 'var(--on-surface-variant)', fontStyle: 'italic', padding: '10px', fontSize: '0.85rem' }}>
                                Henüz rapor oluşturulmadı.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Statistics;
