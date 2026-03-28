import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { tr } from 'date-fns/locale';

const ExportTools = ({ schedule, staffList, history, onLoadHistory, onDeleteHistory, tasks, constraints }) => {
    const [copied, setCopied] = useState(false);

    const generateTableData = () => {
        if (!schedule) return { rows: [], monthTitle: '' };
        const firstDate = Object.keys(schedule).filter(k => !k.startsWith('_'))[0];
        if (!firstDate) return [];

        const selectedDate = new Date(firstDate);
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const monthTitle = format(selectedDate, 'MMMM yyyy', { locale: tr });

        let maxAssigned = 2;
        days.forEach(day => {
            const dateString = format(day, 'yyyy-MM-dd');
            const assigned = schedule[dateString] || [];
            if (assigned.length > maxAssigned) {
                maxAssigned = assigned.length;
            }
        });

        const rows = [];
        const header = ['Tarih', 'Gün'];
        const shiftColumnNames = constraints?.shiftColumnNames || ['Nöbetçi 1', 'Nöbetçi 2'];
        for (let i = 1; i <= maxAssigned; i++) {
            header.push(shiftColumnNames[i - 1] || `Nöbetçi ${i}`);
        }

        const taskColumns = constraints?.taskColumns || [];
        taskColumns.forEach(col => header.push(col));
        rows.push(header);

        days.forEach(day => {
            const dateString = format(day, 'yyyy-MM-dd');
            const assigned = schedule[dateString] || [];
            const dayName = format(day, 'EEEE', { locale: tr });
            const dateFormatted = format(day, 'd MMMM', { locale: tr });

            const row = [dateFormatted, dayName];
            for (let i = 0; i < maxAssigned; i++) {
                if (assigned[i]) {
                    row.push(assigned[i].name || `${assigned[i].firstName} ${assigned[i].lastName}`);
                } else {
                    row.push('-');
                }
            }

            const dayTasks = tasks ? (tasks[dateString] || {}) : {};
            taskColumns.forEach((_, idx) => {
                const staffId = dayTasks[idx];
                if (staffId) {
                    const staff = staffList.find(s => s.id === staffId);
                    row.push(staff ? (staff.name || `${staff.firstName} ${staff.lastName}`) : '?');
                } else {
                    row.push('');
                }
            });

            rows.push(row);
        });

        return { rows, monthTitle };
    };

    const copyAsTable = () => {
        const { rows, monthTitle } = generateTableData();
        let text = `Vardiya Çizelgesi - ${monthTitle}\n\n`;
        text += rows.map(row => row.join('\t')).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const downloadAsExcel = () => {
        const { rows, monthTitle } = generateTableData();
        const BOM = '\uFEFF';
        let csv = BOM;
        csv += `Vardiya Çizelgesi - ${monthTitle}\n\n`;
        csv += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `vardiya_${format(new Date(), 'yyyy-MM')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleBackupDownload = () => {
        const data = {
            staffList: localStorage.getItem('staffList'),
            constraints: localStorage.getItem('constraints'),
            currentSchedule: localStorage.getItem('currentSchedule'),
            scheduleHistory: localStorage.getItem('scheduleHistory'),
            tasks: localStorage.getItem('tasks'),
            timestamp: new Date().toISOString(),
            version: '2.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `vardiya_yedek_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleBackupUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.confirm('Bu işlem mevcut verilerinizi silip yedekten geri yükleyecektir. Emin misiniz?')) {
            e.target.value = null;
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.staffList) localStorage.setItem('staffList', data.staffList);
                if (data.constraints) localStorage.setItem('constraints', data.constraints);
                if (data.currentSchedule) localStorage.setItem('currentSchedule', data.currentSchedule);
                if (data.scheduleHistory) localStorage.setItem('scheduleHistory', data.scheduleHistory);
                if (data.tasks) localStorage.setItem('tasks', data.tasks);

                alert('Yedek başarıyla yüklendi! Sayfa yenileniyor...');
                window.location.reload();
            } catch (error) {
                alert('Dosya okunamadı veya hatalı format!');
                console.error(error);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div>
            <h3 style={{ marginBottom: '16px' }}>📥 Dışa Aktar</h3>

            {schedule ? (
                <>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button onClick={copyAsTable} className="btn btn-ghost">
                            {copied ? '✓ Kopyalandı!' : '📋 Panoya Kopyala'}
                        </button>
                        <button onClick={downloadAsExcel} className="btn btn-secondary">
                            📊 Excel/CSV İndir
                        </button>
                    </div>
                    <div className="hint-bar" style={{ marginTop: '12px' }}>
                        💡 Panoya kopyalayıp Google Sheets veya Excel'e yapıştırabilirsiniz.
                    </div>
                </>
            ) : (
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>
                    Dışa aktarmak için önce bir çizelge oluşturun veya geçmişten yükleyin.
                </p>
            )}

            {history && history.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                    <h3 style={{ marginBottom: '12px' }}>📂 Oluşturulan Listeler</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {history.map(item => (
                            <div key={item.id} className="history-item">
                                <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                                    {item.name}
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button onClick={() => onLoadHistory(item)} className="btn btn-ghost btn-sm">
                                        📖 Aç
                                    </button>
                                    <button onClick={() => onDeleteHistory(item.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }}>
                                        🗑️ Sil
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Backup Section */}
            <div style={{ marginTop: '24px' }}>
                <h3 style={{ marginBottom: '12px' }}>💾 Veri Yedekleme</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={handleBackupDownload} className="btn btn-secondary">
                        ⬇️ Yedeği İndir
                    </button>
                    <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
                        <button className="btn btn-ghost">
                            ⬆️ Yedeği Yükle
                        </button>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleBackupUpload}
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                opacity: 0,
                                width: '100%',
                                height: '100%',
                                cursor: 'pointer'
                            }}
                        />
                    </div>
                </div>
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.78rem', marginTop: '8px' }}>
                    Tüm verilerinizi (personel, ayarlar, geçmiş) bilgisayarınıza indirip saklayabilir, daha sonra geri yükleyebilirsiniz.
                </p>
            </div>
        </div>
    );
};

export default ExportTools;
