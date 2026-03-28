import React, { useState } from 'react';

const StaffManager = ({ staffList, setStaffList }) => {
    const [formData, setFormData] = useState({
        id: null,
        name: '',
        seniority: 5,
        priority: 'Medium',
        unavailability: []
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const [bulkText, setBulkText] = useState('');

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleRangeChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: parseInt(value, 10) });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isEditing) {
            setStaffList(staffList.map(staff => staff.id === formData.id ? formData : staff));
            closeModal();
        } else {
            setStaffList([...staffList, { ...formData, id: Date.now() }]);
            setFormData({
                id: null,
                name: '',
                seniority: 5,
                priority: 'Medium',
                unavailability: []
            });
        }
    };

    const openModal = (staff = null) => {
        if (staff) {
            const staffName = staff.name || `${staff.firstName || ''} ${staff.lastName || ''}`.trim();
            setFormData({ ...staff, name: staffName });
            setIsEditing(true);
        } else {
            setFormData({ id: null, name: '', seniority: 5, priority: 'Medium', unavailability: [] });
            setIsEditing(false);
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setIsEditing(false);
    };

    const handleDelete = (id) => {
        if (window.confirm('Bu personeli silmek istediğinize emin misiniz?')) {
            setStaffList(staffList.filter(staff => staff.id !== id));
        }
    };

    const handleBulkImport = () => {
        if (!bulkText.trim()) return;
        const names = bulkText.split(/[\n,\t]+/).map(n => n.trim()).filter(n => n.length > 0);
        if (names.length === 0) return;

        const newStaff = names.map((name, idx) => ({
            id: Date.now() + idx,
            name,
            seniority: 5,
            priority: 'Medium',
            unavailability: []
        }));

        setStaffList([...staffList, ...newStaff]);
        setBulkText('');
        setIsBulkImportOpen(false);
    };

    const handleQuickUpdate = (staffId, field, value) => {
        setStaffList(staffList.map(staff =>
            staff.id === staffId ? { ...staff, [field]: value } : staff
        ));
    };

    const clearAllStaff = () => {
        if (window.confirm('Tüm personeli silmek istediğinize emin misiniz?')) {
            setStaffList([]);
        }
    };

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

    return (
        <div>
            <div className="toolbar">
                <h3>👥 Personel Listesi <span style={{ color: 'var(--on-surface-variant)', fontWeight: 'normal', fontSize: '0.9rem' }}>({staffList.length})</span></h3>
                <div className="toolbar-actions">
                    <button onClick={() => setIsBulkImportOpen(true)} className="btn btn-ghost">
                        📋 Toplu Ekle
                    </button>
                    <button onClick={() => openModal()} className="btn btn-primary">
                        + Yeni Personel
                    </button>
                </div>
            </div>

            {staffList.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">👥</div>
                        <p>Henüz personel eklenmedi.<br />
                            <span style={{ fontSize: '0.85rem' }}>"Toplu Ekle" ile liste yapıştırın veya tek tek ekleyin.</span>
                        </p>
                    </div>
                </div>
            ) : (
                <div className="card" style={{ overflowX: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.82rem', margin: 0 }}>
                            Kıdemi kaydırarak hızlıca ayarlayabilirsiniz.
                        </p>
                        <button onClick={clearAllStaff} className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }}>
                            🗑️ Tümünü Sil
                        </button>
                    </div>
                    <table className="data-table" style={{ minWidth: '500px' }}>
                        <thead>
                            <tr>
                                <th>Ad Soyad</th>
                                <th style={{ width: '200px' }}>Kıdem (1-10)</th>
                                <th style={{ width: '60px' }}>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffList.map(staff => {
                                const colors = getSeniorityColor(staff.seniority);
                                return (
                                    <tr key={staff.id}>
                                        <td style={{ fontWeight: '500' }}>
                                            {staff.name || `${staff.firstName} ${staff.lastName}`}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="10"
                                                    value={staff.seniority}
                                                    onChange={(e) => handleQuickUpdate(staff.id, 'seniority', parseInt(e.target.value, 10))}
                                                    style={{ flex: 1 }}
                                                />
                                                <span
                                                    className="seniority-badge"
                                                    style={{
                                                        backgroundColor: colors.bg,
                                                        color: colors.text,
                                                    }}
                                                >
                                                    {staff.seniority}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                className="icon-btn"
                                                onClick={() => handleDelete(staff.id)}
                                                title="Sil"
                                                style={{ color: 'var(--error)' }}
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Single Staff Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginBottom: '20px' }}>{isEditing ? '✏️ Personel Düzenle' : '+ Yeni Personel'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '16px' }}>
                                <label>Ad Soyad</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                    autoFocus
                                    placeholder="Örn: Ahmet Yılmaz"
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Kıdem Sırası</span>
                                    <strong style={{ color: getSeniorityColor(formData.seniority).text }}>{formData.seniority}</strong>
                                </label>
                                <input
                                    type="range"
                                    name="seniority"
                                    min="1"
                                    max="10"
                                    value={formData.seniority}
                                    onChange={handleRangeChange}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--on-surface-variant)' }}>
                                    <span>1 (En çok nöbet)</span>
                                    <span>10 (En az nöbet)</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={closeModal} className="btn btn-ghost" style={{ flex: 1 }}>
                                    İptal
                                </button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                    {isEditing ? 'Kaydet' : 'Ekle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {isBulkImportOpen && (
                <div className="modal-overlay" onClick={() => { setIsBulkImportOpen(false); setBulkText(''); }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
                        <h3 style={{ marginBottom: '8px' }}>📋 Toplu Personel Ekle</h3>
                        <p style={{ color: 'var(--on-surface-variant)', marginBottom: '16px', fontSize: '0.85rem' }}>
                            Her satıra bir isim yazın veya Excel'den yapıştırın.
                        </p>

                        <textarea
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                            placeholder={`Emre Yıldırım\nMert Koç\nYılkı Sönmez\n...`}
                            style={{ minHeight: '180px', resize: 'vertical' }}
                            autoFocus
                        />

                        <div className="hint-bar" style={{ marginTop: '12px', marginBottom: 0 }}>
                            💡 Varsayılan kıdem: 5. Tabloda hızlıca düzenleyebilirsiniz.
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                            <button
                                type="button"
                                onClick={() => { setIsBulkImportOpen(false); setBulkText(''); }}
                                className="btn btn-ghost"
                                style={{ flex: 1 }}
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleBulkImport}
                                className="btn btn-primary"
                                style={{ flex: 1 }}
                                disabled={!bulkText.trim()}
                            >
                                Ekle ({bulkText.split(/[\n,\t]+/).filter(n => n.trim()).length} kişi)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffManager;
