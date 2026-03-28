import React, { useState } from 'react';

const TaskColumnConfig = ({ columnIndex, columnName, constraints, setConstraints, staffList, onClose }) => {
    const config = constraints.taskColumnConfig?.[columnIndex] || {
        eligibleStaffIds: [],
        eligibleSeniorities: [],
        targetWeekdays: [1, 3, 4, 5],
        maxPerDay: 3,
        preferredSeniorityMix: []
    };

    const [selectionMode, setSelectionMode] = useState(
        config.eligibleStaffIds.length > 0 ? 'individual' : 'seniority'
    );
    const [selectedStaffIds, setSelectedStaffIds] = useState(config.eligibleStaffIds || []);
    const [selectedSeniorities, setSelectedSeniorities] = useState(config.eligibleSeniorities || []);
    const [targetWeekdays, setTargetWeekdays] = useState(config.targetWeekdays || [1, 3, 4, 5]);
    const [maxPerDay, setMaxPerDay] = useState(config.maxPerDay || 3);
    const [preferredMix, setPreferredMix] = useState(
        config.preferredSeniorityMix?.join(',') || ''
    );

    const weekdayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

    const handleSave = () => {
        const newConfig = {
            eligibleStaffIds: selectionMode === 'individual' ? selectedStaffIds : [],
            eligibleSeniorities: selectionMode === 'seniority' ? selectedSeniorities : [],
            targetWeekdays,
            maxPerDay,
            preferredSeniorityMix: preferredMix ? preferredMix.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : []
        };

        setConstraints(prev => ({
            ...prev,
            taskColumnConfig: {
                ...(prev.taskColumnConfig || {}),
                [columnIndex]: newConfig
            }
        }));

        onClose();
    };

    const toggleStaff = (staffId) => {
        setSelectedStaffIds(prev =>
            prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
        );
    };

    const toggleSeniority = (seniority) => {
        setSelectedSeniorities(prev =>
            prev.includes(seniority) ? prev.filter(s => s !== seniority) : [...prev, seniority]
        );
    };

    const toggleWeekday = (day) => {
        setTargetWeekdays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const staffBySeniority = {};
    staffList.forEach(staff => {
        if (!staffBySeniority[staff.seniority]) {
            staffBySeniority[staff.seniority] = [];
        }
        staffBySeniority[staff.seniority].push(staff);
    });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <h3 style={{ marginBottom: '20px' }}>"{columnName}" Sütunu Ayarları</h3>

                {/* Selection Mode */}
                <div className="settings-section" style={{ marginBottom: '16px' }}>
                    <h4>Seçim Modu</h4>
                    <div className="mode-btn-group">
                        <button
                            className={`mode-btn${selectionMode === 'seniority' ? ' active-required' : ''}`}
                            onClick={() => setSelectionMode('seniority')}
                        >
                            Kıdeme Göre
                        </button>
                        <button
                            className={`mode-btn${selectionMode === 'individual' ? ' active-required' : ''}`}
                            onClick={() => setSelectionMode('individual')}
                        >
                            Kişi Bazlı
                        </button>
                    </div>
                </div>

                {/* Seniority Selection */}
                {selectionMode === 'seniority' && (
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ marginBottom: '8px' }}>Dahil Edilecek Kıdemler</label>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {Object.keys(staffBySeniority).sort((a, b) => b - a).map(seniority => {
                                const sen = parseInt(seniority);
                                const isSelected = selectedSeniorities.includes(sen);
                                return (
                                    <button
                                        key={sen}
                                        onClick={() => toggleSeniority(sen)}
                                        className="day-pill"
                                        style={{
                                            background: isSelected ? 'rgba(102, 217, 204, 0.2)' : undefined,
                                            color: isSelected ? 'var(--primary)' : undefined,
                                            padding: '8px 12px'
                                        }}
                                    >
                                        K{sen} ({staffBySeniority[sen].length})
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Individual Selection */}
                {selectionMode === 'individual' && (
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ marginBottom: '8px' }}>Dahil Edilecek Kişiler</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '6px' }}>
                            {staffList.map(staff => {
                                const isSelected = selectedStaffIds.includes(staff.id);
                                return (
                                    <label
                                        key={staff.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '6px 10px',
                                            borderRadius: 'var(--radius-md)',
                                            background: isSelected ? 'rgba(102, 217, 204, 0.1)' : 'var(--surface-container)',
                                            cursor: 'pointer',
                                            fontSize: '0.82rem',
                                            transition: 'background 0.15s'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleStaff(staff.id)}
                                            style={{ accentColor: 'var(--primary)' }}
                                        />
                                        <span>{staff.name}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Target Weekdays */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ marginBottom: '8px' }}>Hedef Günler</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {weekdayNames.map((name, idx) => {
                            const isSelected = targetWeekdays.includes(idx);
                            return (
                                <button
                                    key={idx}
                                    onClick={() => toggleWeekday(idx)}
                                    className={`day-pill${isSelected ? ' active' : ''}`}
                                    style={{ padding: '8px 12px' }}
                                >
                                    {name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Max Per Day */}
                <div style={{ marginBottom: '16px' }}>
                    <label>Günlük Maksimum Kişi Sayısı</label>
                    <input
                        type="number"
                        value={maxPerDay}
                        onChange={(e) => setMaxPerDay(parseInt(e.target.value))}
                        min="1"
                        max="10"
                        style={{ width: '100px' }}
                    />
                </div>

                {/* Preferred Seniority Mix */}
                <div style={{ marginBottom: '20px' }}>
                    <label>Tercih Edilen Kıdem Karışımı (opsiyonel)</label>
                    <input
                        type="text"
                        value={preferredMix}
                        onChange={(e) => setPreferredMix(e.target.value)}
                        placeholder="Örn: 7,5,4"
                    />
                    <p style={{ fontSize: '0.72rem', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                        Her güne bu kıdemlerden birer kişi atamaya çalışır (virgülle ayırın)
                    </p>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} className="btn btn-ghost">
                        İptal
                    </button>
                    <button onClick={handleSave} className="btn btn-primary">
                        Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskColumnConfig;
