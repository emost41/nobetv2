import React from 'react';

const ConstraintsForm = ({ constraints, setConstraints, tasks, setTasks }) => {
    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        setConstraints({
            ...constraints,
            [name]: type === 'number' ? parseInt(value, 10) : value
        });
    };

    const handleDailyNeedsChange = (day, value) => {
        setConstraints({
            ...constraints,
            dailyNeeds: {
                ...constraints.dailyNeeds,
                [day]: parseInt(value, 10)
            }
        });
    };

    const days = [
        { key: 'Monday', label: 'Pzt' },
        { key: 'Tuesday', label: 'Sal' },
        { key: 'Wednesday', label: 'Çar' },
        { key: 'Thursday', label: 'Per' },
        { key: 'Friday', label: 'Cum' },
        { key: 'Saturday', label: 'Cmt' },
        { key: 'Sunday', label: 'Paz' }
    ];

    const isWeekend = (day) => day === 'Saturday' || day === 'Sunday';

    return (
        <div className="card">
            <h3 style={{ marginBottom: '20px' }}>⚙️ Çizelge Ayarları</h3>

            {/* Month Selection */}
            <div style={{ marginBottom: '24px' }}>
                <label>Çizelge Ayı</label>
                <input
                    type="month"
                    name="selectedMonth"
                    value={constraints.selectedMonth}
                    onChange={handleInputChange}
                    style={{ maxWidth: '250px' }}
                />
            </div>

            {/* Daily Needs */}
            <div className="settings-section" style={{ marginBottom: '20px' }}>
                <h4>Günlük Personel İhtiyacı</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', maxWidth: '500px' }}>
                    {days.map(day => (
                        <div key={day.key} style={{ textAlign: 'center' }}>
                            <div style={{
                                marginBottom: '6px',
                                fontSize: '0.72rem',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: isWeekend(day.key) ? 'var(--primary)' : 'var(--on-surface-variant)'
                            }}>
                                {day.label}
                            </div>
                            <input
                                type="number"
                                min="0"
                                max="10"
                                value={constraints.dailyNeeds[day.key]}
                                onChange={(e) => handleDailyNeedsChange(day.key, e.target.value)}
                                style={{
                                    textAlign: 'center',
                                    padding: '10px 8px',
                                    fontWeight: '600',
                                    fontSize: '1rem',
                                    backgroundColor: isWeekend(day.key) ? 'rgba(102, 217, 204, 0.08)' : undefined
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Other Settings */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <div>
                    <label>Vardiya Süresi (saat)</label>
                    <input type="number" name="shiftDuration" value={constraints.shiftDuration} onChange={handleInputChange} min="1" max="24" />
                </div>

                <div>
                    <label>Max Vardiya/Ay</label>
                    <input type="number" name="maxShiftsPerMonth" value={constraints.maxShiftsPerMonth} onChange={handleInputChange} min="1" max="31" />
                </div>

                <div>
                    <label>Min Dinlenme (saat)</label>
                    <input type="number" name="minRestHours" value={constraints.minRestHours} onChange={handleInputChange} min="0" max="72" />
                    <p style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--on-surface-variant)' }}>
                        {constraints.minRestHours > 12 ? '(Arka arkaya nöbet yok)' : '(Arka arkaya nöbet izinli)'}
                    </p>
                </div>

                <div>
                    <label>Min Kıdem Toplamı</label>
                    <input type="number" name="minSenioritySum" value={constraints.minSenioritySum || ''} onChange={handleInputChange} min="0" placeholder="Örn: 5" />
                </div>

                <div>
                    <label>Max Kıdem Toplamı</label>
                    <input type="number" name="maxSenioritySum" value={constraints.maxSenioritySum || ''} onChange={handleInputChange} min="0" placeholder="Örn: 15" />
                </div>

                {/* Beneficial Days */}
                <div className="settings-section" style={{ gridColumn: '1 / -1' }}>
                    <h4>⭐ Kıdemli Öncelikli Günler</h4>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                        {days.map(day => (
                            <label key={day.key} className={`day-pill${constraints.beneficialDays?.includes(day.key) ? ' active' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={constraints.beneficialDays?.includes(day.key) || false}
                                    onChange={(e) => {
                                        const current = constraints.beneficialDays || [];
                                        const updated = e.target.checked
                                            ? [...current, day.key]
                                            : current.filter(d => d !== day.key);
                                        setConstraints({ ...constraints, beneficialDays: updated });
                                    }}
                                    style={{ display: 'none' }}
                                />
                                {day.label}
                            </label>
                        ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{ fontSize: '0.85rem', marginBottom: 0 }}>Minimum Kıdem Eşiği:</label>
                        <select
                            value={constraints.beneficialDaysThreshold || 4}
                            onChange={(e) => setConstraints({ ...constraints, beneficialDaysThreshold: parseInt(e.target.value, 10) })}
                            style={{ width: 'auto', padding: '6px 10px' }}
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                        <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                            (Seçilen günlerde bu kıdem ve üzeri öncelikli atanır)
                        </span>
                    </div>
                </div>

                {/* Slot System */}
                <div className="settings-section" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <label style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: 0 }}>
                            <input
                                type="checkbox"
                                checked={constraints.slotSystem?.enabled || false}
                                onChange={(e) => setConstraints({
                                    ...constraints,
                                    slotSystem: { ...constraints.slotSystem, enabled: e.target.checked }
                                })}
                                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                            />
                            ☑️ Slot Sistemini Aktif Et
                        </label>
                    </div>

                    {constraints.slotSystem?.enabled && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <h4 style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>📌 Slot 1 (1. Nöbetçi)</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(seniority => (
                                        <label key={`s1-${seniority}`}
                                            className="seniority-circle"
                                            style={{
                                                backgroundColor: constraints.slotSystem?.slot1Seniorities?.includes(seniority) ? 'var(--primary)' : 'var(--surface-container-highest)',
                                                color: constraints.slotSystem?.slot1Seniorities?.includes(seniority) ? 'var(--on-primary)' : 'var(--on-surface)'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={constraints.slotSystem?.slot1Seniorities?.includes(seniority) || false}
                                                onChange={(e) => {
                                                    const current = constraints.slotSystem?.slot1Seniorities || [];
                                                    const updated = e.target.checked
                                                        ? [...current, seniority]
                                                        : current.filter(s => s !== seniority);
                                                    setConstraints({
                                                        ...constraints,
                                                        slotSystem: { ...constraints.slotSystem, slot1Seniorities: updated }
                                                    });
                                                }}
                                                style={{ display: 'none' }}
                                            />
                                            {seniority}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 style={{ color: 'var(--tertiary)', fontSize: '0.9rem' }}>📌 Slot 2 (2. Nöbetçi)</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(seniority => (
                                        <label key={`s2-${seniority}`}
                                            className="seniority-circle"
                                            style={{
                                                backgroundColor: constraints.slotSystem?.slot2Seniorities?.includes(seniority) ? 'var(--tertiary)' : 'var(--surface-container-highest)',
                                                color: constraints.slotSystem?.slot2Seniorities?.includes(seniority) ? 'var(--on-primary)' : 'var(--on-surface)'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={constraints.slotSystem?.slot2Seniorities?.includes(seniority) || false}
                                                onChange={(e) => {
                                                    const current = constraints.slotSystem?.slot2Seniorities || [];
                                                    const updated = e.target.checked
                                                        ? [...current, seniority]
                                                        : current.filter(s => s !== seniority);
                                                    setConstraints({
                                                        ...constraints,
                                                        slotSystem: { ...constraints.slotSystem, slot2Seniorities: updated }
                                                    });
                                                }}
                                                style={{ display: 'none' }}
                                            />
                                            {seniority}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <p style={{ gridColumn: '1 / -1', margin: '10px 0 0 0', fontSize: '0.78rem', color: 'var(--on-surface-variant)' }}>
                                ⚠️ Slotlar birbirinden bağımsızdır. Eğer bir slot için uygun personel bulunamazsa, o pozisyon boş kalır.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Task Columns */}
            <div className="settings-section" style={{ marginTop: '20px' }}>
                <h4>📋 Görev Sütunları</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--on-surface-variant)', marginBottom: '12px' }}>
                    "Görevler" sekmesinde görünecek sütunları buradan belirleyebilirsiniz (Örn: Ameliyat 1, Servis, Poliklinik vb.).
                </p>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <input
                        type="text"
                        id="newTaskColumn"
                        placeholder="Yeni sütun adı..."
                        style={{ flex: 1 }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const val = e.target.value.trim();
                                if (val) {
                                    const current = constraints.taskColumns || [];
                                    if (!current.includes(val)) {
                                        setConstraints({ ...constraints, taskColumns: [...current, val] });
                                        e.target.value = '';
                                    }
                                }
                            }
                        }}
                    />
                    <button
                        onClick={() => {
                            const input = document.getElementById('newTaskColumn');
                            const val = input.value.trim();
                            if (val) {
                                const current = constraints.taskColumns || [];
                                if (!current.includes(val)) {
                                    setConstraints({ ...constraints, taskColumns: [...current, val] });
                                    input.value = '';
                                }
                            }
                        }}
                        className="btn btn-primary btn-sm"
                    >
                        Ekle
                    </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(constraints.taskColumns || []).map((col, idx) => (
                        <div key={idx} className="task-col-tag">
                            <span>{col}</span>
                            <button
                                className="task-col-remove"
                                onClick={() => {
                                    const currentCols = constraints.taskColumns || [];
                                    const newCols = currentCols.filter((_, i) => i !== idx);

                                    const newConfig = {};
                                    Object.keys(constraints.taskColumnConfig || {}).forEach(key => {
                                        const k = parseInt(key);
                                        if (k < idx) {
                                            newConfig[k] = constraints.taskColumnConfig[k];
                                        } else if (k > idx) {
                                            newConfig[k - 1] = constraints.taskColumnConfig[k];
                                        }
                                    });

                                    const newHidden = (constraints.hiddenTaskColumns || [])
                                        .filter(i => i !== idx)
                                        .map(i => i > idx ? i - 1 : i);

                                    setConstraints({
                                        ...constraints,
                                        taskColumns: newCols,
                                        taskColumnConfig: newConfig,
                                        hiddenTaskColumns: newHidden
                                    });

                                    if (typeof setTasks === 'function') {
                                        setTasks(prev => {
                                            const newTasks = {};
                                            Object.keys(prev).forEach(date => {
                                                const dayTasks = prev[date];
                                                const newDayTasks = {};
                                                Object.keys(dayTasks).forEach(key => {
                                                    const k = parseInt(key);
                                                    if (k < idx) {
                                                        newDayTasks[k] = dayTasks[k];
                                                    } else if (k > idx) {
                                                        newDayTasks[k - 1] = dayTasks[k];
                                                    }
                                                });
                                                if (Object.keys(newDayTasks).length > 0) {
                                                    newTasks[date] = newDayTasks;
                                                }
                                            });
                                            return newTasks;
                                        });
                                    }
                                }}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Shift Column Names */}
            <div className="settings-section" style={{ marginTop: '16px' }}>
                <h4>🏷️ Nöbetçi Sütun İsimleri</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--on-surface-variant)', marginBottom: '12px' }}>
                    Görev dağılımı tablosunda görünecek nöbetçi sütun isimlerini özelleştirin.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {(constraints.shiftColumnNames || ['Nöbetçi 1', 'Nöbetçi 2']).map((name, idx) => (
                        <div key={idx}>
                            <label>Sütun {idx + 1}</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => {
                                    const newNames = [...(constraints.shiftColumnNames || ['Nöbetçi 1', 'Nöbetçi 2'])];
                                    newNames[idx] = e.target.value;
                                    setConstraints({ ...constraints, shiftColumnNames: newNames });
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ConstraintsForm;
