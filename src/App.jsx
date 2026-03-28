import React, { useState, useEffect } from 'react';
import StaffManager from './components/StaffManager';
import ConstraintsForm from './components/ConstraintsForm';
import UnavailabilityGrid from './components/UnavailabilityGrid';
import Scheduler from './components/Scheduler';
import Statistics from './components/Statistics';

import ExportTools from './components/ExportTools';
import TaskDistribution from './components/TaskDistribution';

function App() {
    // Load initial state from localStorage if available
    const [staffList, setStaffList] = useState(() => {
        const saved = localStorage.getItem('staffList');
        return saved ? JSON.parse(saved) : [];
    });

    const [constraints, setConstraints] = useState(() => {
        const saved = localStorage.getItem('constraints');
        const defaultConstraints = {
            dailyNeeds: {
                Monday: 2,
                Tuesday: 2,
                Wednesday: 2,
                Thursday: 2,
                Friday: 2,
                Saturday: 2,
                Sunday: 2
            },
            shiftDuration: 8,
            holidays: [],
            minShiftsPerMonth: 0,
            maxShiftsPerMonth: 20,
            minRestHours: 11,
            selectedMonth: new Date().toISOString().slice(0, 7),
            beneficialDays: [],
            beneficialDaysThreshold: 4,
            slotSystem: {
                enabled: false,
                slot1Seniorities: [6, 5, 4],

                slot2Seniorities: [3, 2, 1]
            },
            taskColumns: [],
            taskColumnConfig: {},
            shiftColumnNames: ['Nöbetçi 1', 'Nöbetçi 2'],
            hiddenTaskColumns: []
        };

        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return {
                    ...defaultConstraints,
                    ...parsed,
                    dailyNeeds: { ...defaultConstraints.dailyNeeds, ...(parsed.dailyNeeds || {}) },

                    slotSystem: { ...defaultConstraints.slotSystem, ...(parsed.slotSystem || {}) },
                    taskColumns: parsed.taskColumns || [],
                    taskColumnConfig: parsed.taskColumnConfig || {},
                    shiftColumnNames: parsed.shiftColumnNames || defaultConstraints.shiftColumnNames,
                    hiddenTaskColumns: parsed.hiddenTaskColumns || []
                };
            } catch (e) {
                console.error("Ayarlar yüklenirken hata oluştu:", e);
                return defaultConstraints;
            }
        }

        return defaultConstraints;
    });

    const [schedule, setSchedule] = useState(() => {
        const saved = localStorage.getItem('currentSchedule');
        try {
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error("Çizelge yüklenirken hata oluştu:", e);
            return null;
        }
    });

    const [scheduleHistory, setScheduleHistory] = useState(() => {
        const saved = localStorage.getItem('scheduleHistory');
        try {
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error("Geçmiş yüklenirken hata oluştu:", e);
            return [];
        }
    });

    const [tasks, setTasks] = useState(() => {
        const saved = localStorage.getItem('tasks');
        try {
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error("Görevler yüklenirken hata oluştu:", e);
            return {};
        }
    });

    const [activeTab, setActiveTab] = useState('staff');

    // Save to localStorage whenever state changes
    useEffect(() => {
        localStorage.setItem('staffList', JSON.stringify(staffList));
    }, [staffList]);

    useEffect(() => {
        localStorage.setItem('constraints', JSON.stringify(constraints));
    }, [constraints]);

    useEffect(() => {
        if (schedule) {
            localStorage.setItem('currentSchedule', JSON.stringify(schedule));
        } else {
            localStorage.removeItem('currentSchedule');
        }
    }, [schedule]);

    useEffect(() => {
        localStorage.setItem('scheduleHistory', JSON.stringify(scheduleHistory));
    }, [scheduleHistory]);

    useEffect(() => {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }, [tasks]);

    const saveScheduleToHistory = () => {
        if (!schedule) return;

        const timestamp = new Date().toLocaleString('tr-TR');
        const monthName = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' })
            .format(new Date(constraints.selectedMonth + '-01'));

        const newEntry = {
            id: Date.now(),
            name: `${monthName} (${timestamp})`,

            schedule: schedule,
            constraints: { ...constraints },
            staffList: [...staffList],
            tasks: { ...tasks }
        };

        setScheduleHistory(prev => [newEntry, ...prev]);
    };

    const loadScheduleFromHistory = (entry) => {
        if (window.confirm('Bu çizelgeyi yüklemek mevcut çalışmanızı değiştirecektir. Devam edilsin mi?')) {
            setSchedule(entry.schedule);
            setConstraints(entry.constraints);

            setStaffList(entry.staffList);
            setTasks(entry.tasks || {});
            setActiveTab('schedule');
        }
    };

    const deleteScheduleFromHistory = (id) => {
        if (window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
            setScheduleHistory(prev => prev.filter(item => item.id !== id));
        }
    };

    const tabs = [
        { id: 'staff', label: 'Personel', icon: '👥' },
        { id: 'unavailability', label: 'Müsaitlik', icon: '📅' },
        { id: 'constraints', label: 'Ayarlar', icon: '⚙️' },
        { id: 'schedule', label: 'Çizelge', icon: '📊' },
        { id: 'tasks', label: 'Görevler', icon: '📋' },
        { id: 'export', label: 'Dışa Aktar', icon: '💾' }
    ];

    const activeTabData = tabs.find(t => t.id === activeTab);

    return (
        <div className="app-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">📋</div>
                    <div className="sidebar-logo-text">
                        Vardiya
                        <span>Çizelge Sistemi</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`nav-item${activeTab === tab.id ? ' active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="nav-icon">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="sidebar-bottom">
                    {activeTab !== 'schedule' && (
                        <button
                            className="sidebar-cta"
                            onClick={() => setActiveTab('schedule')}
                        >
                            <span>📊</span>
                            <span>Çizelgeye Git</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Area */}
            <div className="main-area">
                <header className="top-bar">
                    <div className="top-bar-title">
                        {activeTabData?.icon} {activeTabData?.label}
                    </div>
                    <div className="top-bar-actions">
                        <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                            {staffList.length} personel
                        </span>
                    </div>
                </header>

                <main className="main-content animate-in" key={activeTab}>
                    {activeTab === 'staff' && (
                        <StaffManager staffList={staffList} setStaffList={setStaffList} />
                    )}
                    {activeTab === 'unavailability' && (
                        <UnavailabilityGrid
                            staffList={staffList}
                            setStaffList={setStaffList}
                            selectedMonth={constraints.selectedMonth}
                        />
                    )}
                    {activeTab === 'constraints' && (
                        <ConstraintsForm
                            constraints={constraints}
                            setConstraints={setConstraints}
                            tasks={tasks}
                            setTasks={setTasks}
                        />
                    )}
                    {activeTab === 'schedule' && (
                        <>
                            <Scheduler
                                staffList={staffList}
                                constraints={constraints}
                                schedule={schedule}
                                setSchedule={setSchedule}
                                onSaveToHistory={saveScheduleToHistory}
                            />
                            {schedule && (
                                <>
                                    <Statistics
                                        staffList={staffList}
                                        schedule={schedule}
                                        constraints={constraints}
                                    />
                                    <ExportTools
                                        schedule={schedule}
                                        staffList={staffList}
                                        history={scheduleHistory}
                                        onLoadHistory={loadScheduleFromHistory}
                                        onDeleteHistory={deleteScheduleFromHistory}
                                    />
                                </>
                            )}
                            {!schedule && scheduleHistory.length > 0 && (
                                <p style={{ textAlign: 'center', color: 'var(--on-surface-variant)', marginTop: '2rem', fontSize: '0.85rem' }}>
                                    Geçmiş çizelgeleri "Dışa Aktar" sekmesinden yönetebilirsiniz.
                                </p>
                            )}
                        </>
                    )}
                    {activeTab === 'export' && (
                        <div className="card">
                            <h3 style={{ marginBottom: '16px' }}>💾 Veri Yönetimi ve Yedekleme</h3>
                            <ExportTools
                                schedule={schedule}
                                staffList={staffList}
                                history={scheduleHistory}
                                onLoadHistory={loadScheduleFromHistory}
                                onDeleteHistory={deleteScheduleFromHistory}
                            />
                        </div>
                    )}
                    {activeTab === 'tasks' && (
                        <TaskDistribution
                            staffList={staffList}
                            schedule={schedule}
                            constraints={constraints}
                            setConstraints={setConstraints}
                            tasks={tasks}
                            setTasks={setTasks}
                            onSaveToHistory={saveScheduleToHistory}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;
