import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Gamepad2,
    History,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    User,
    Activity,
    Brain,
    Eye,
    Timer,
    TrendingUp,
    AlertTriangle,
    Target,
    Gauge,
    Calendar,
    Clock,
    Search,
    BarChart3,
    Sliders,
    Bell,
    Shield,
    Database,
    Info,
    Trash2,
    Flag
} from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { useEEGStore } from '../../stores/eegStore';
import { useSessionStore } from '../../stores/sessionStore';
import { EEG_DOWNLOAD_URL } from '../../config/api';
import './Dashboard.css';

type TabView = 'overview' | 'history' | 'profile' | 'settings';

interface SavedSession {
    sessionId: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    routeName?: string;
    totalWaypoints?: number;
    reachedCount?: number;
    missedCount?: number;
    completionTime?: number;
    violations?: any[];
    totalViolationPoints?: number;
    eegData?: any[];
    gameMetrics?: any;
    savedAt: string;
    stats?: any;
    violationStats?: any;
}

const Dashboard = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [activeTab, setActiveTab] = useState<TabView>('overview');
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useUserStore();
    const [fullName, setFullName] = useState(user?.full_name || '');
    const [isSaving, setIsSaving] = useState(false);
    const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

    // History state
    const [sessionHistory, setSessionHistory] = useState<SavedSession[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // EEG Store
    const isConnected = useEEGStore((state) => state.isConnected);
    const currentMetrics = useEEGStore((state) => state.currentMetrics);
    const dataHistory = useEEGStore((state) => state.dataHistory);
    const getAverageMetrics = useEEGStore((state) => state.getAverageMetrics);

    // Session Store
    const sessionId = useSessionStore((state) => state.sessionId);
    const [sessionIdCopied, setSessionIdCopied] = useState(false);

    // Graph data state
    const [graphData, setGraphData] = useState<any[]>([]);

    // Settings state (persisted to localStorage)
    const loadSettings = () => {
        try {
            const saved = localStorage.getItem('fumorive_settings');
            if (saved) return JSON.parse(saved);
        } catch { }
        return {
            eegDevice: 'Not Connected',
            cameraDevice: 'Built-in Camera',
            samplingRate: '256 Hz (Recommended)',
            warningThreshold: 60,
            criticalThreshold: 80,
            perClosThreshold: 80,
            audioAlerts: true,
            visualEffects: true,
            hapticFeedback: false,
            saveSessionData: true,
            shareAnonymousData: false,
        };
    };
    const [settings, setSettings] = useState(loadSettings);

    const updateSetting = (key: string, value: any) => {
        setSettings((prev: any) => {
            const updated = { ...prev, [key]: value };
            localStorage.setItem('fumorive_settings', JSON.stringify(updated));
            return updated;
        });
    };

    const handleExportData = () => {
        const data = { sessions: sessionHistory, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fumorive_data_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleClearAllData = () => {
        if (window.confirm('Hapus semua data sesi? Tindakan ini tidak dapat dibatalkan.')) {
            localStorage.removeItem('sessionHistory');
            setSessionHistory([]);
        }
    };

    const storageUsedKB = useMemo(() => {
        try {
            const raw = localStorage.getItem('sessionHistory') || '';
            return (new Blob([raw]).size / 1024).toFixed(1);
        } catch { return '0'; }
    }, [sessionHistory]);

    // Generate sample data for demo
    const generateSampleData = () => {
        const samples = [];
        for (let i = 0; i < 100; i++) {
            samples.push({
                timestamp: new Date(Date.now() - (100 - i) * 1000).toISOString(),
                eegFatigueScore: 2 + Math.sin(i / 10) * 3 + (Math.random() - 0.5) * 1,
                deltaPower: 1 + Math.sin(i / 15) * 0.5 + (Math.random() - 0.5) * 0.3,
                thetaPower: 1.5 + Math.sin(i / 12) * 0.7 + (Math.random() - 0.5) * 0.4,
                alphaPower: 2.5 + Math.sin(i / 8) * 1 + (Math.random() - 0.5) * 0.5,
                betaPower: 2 + Math.sin(i / 10) * 0.8 + (Math.random() - 0.5) * 0.4,
                gammaPower: 1.2 + Math.sin(i / 20) * 0.6 + (Math.random() - 0.5) * 0.3,
            });
        }
        return samples;
    };

    const generateSampleSessionData = () => {
        const startTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
        const eegData = [];

        // Generate 300 samples for 30-minute session
        for (let i = 0; i < 300; i++) {
            eegData.push({
                timestamp: new Date(startTime.getTime() + (i * 6000)).toISOString(), // Every 6 seconds
                eegFatigueScore: 2 + Math.sin(i / 30) * 4 + (Math.random() - 0.5) * 1.5,
                deltaPower: 0.8 + Math.sin(i / 50) * 0.6 + (Math.random() - 0.5) * 0.3,
                thetaPower: 1.2 + Math.sin(i / 40) * 0.8 + (Math.random() - 0.5) * 0.4,
                alphaPower: 2 + Math.sin(i / 35) * 1.2 + (Math.random() - 0.5) * 0.6,
                betaPower: 2.5 + Math.sin(i / 30) * 1 + (Math.random() - 0.5) * 0.5,
                gammaPower: 1 + Math.sin(i / 60) * 0.7 + (Math.random() - 0.5) * 0.3,
            });
        }

        return {
            sessionId: `session_${Date.now()}`,
            startTime: startTime.toISOString(),
            endTime: new Date().toISOString(),
            duration: 30 * 60, // 30 minutes in seconds
            eegData: eegData,
            gameMetrics: {
                averageSpeed: 65 + Math.random() * 20,
                maxSpeed: 120 + Math.random() * 20,
                collisions: Math.floor(Math.random() * 5),
                laneDeviations: Math.floor(Math.random() * 15),
                totalDistance: 32.5 + Math.random() * 5,
            }
        };
    };

    const handleViewSampleResults = () => {
        const sampleData = generateSampleSessionData();
        navigate('/session-results', { state: sampleData });
    };

    // Sync state with user data when it loads
    useEffect(() => {
        if (user?.full_name) {
            setFullName(user.full_name);
        }
    }, [user?.full_name]);

    // Load session history from localStorage
    useEffect(() => {
        const loadHistory = () => {
            try {
                const saved = localStorage.getItem('sessionHistory');
                if (saved) {
                    const sessions = JSON.parse(saved) as SavedSession[];
                    setSessionHistory(sessions);
                }
            } catch (error) {
                console.error('Failed to load session history:', error);
            }
        };
        loadHistory();

        // Listen for storage changes (in case another tab updates)
        window.addEventListener('storage', loadHistory);
        return () => window.removeEventListener('storage', loadHistory);
    }, []);

    // Check if navigated with tab state
    useEffect(() => {
        const state = location.state as { tab?: TabView } | null;
        if (state?.tab) {
            setActiveTab(state.tab);
            // Clear the state
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Calculate history statistics
    const historyStats = useMemo(() => {
        if (sessionHistory.length === 0) {
            return {
                totalSessions: 0,
                totalHours: '0',
                avgFatigue: '--',
                totalAlerts: 0
            };
        }

        const totalDuration = sessionHistory.reduce((sum, s) => sum + (s.duration || s.completionTime || 0), 0);
        const totalHours = (totalDuration / 3600).toFixed(1);

        const allFatigueScores = sessionHistory
            .filter(s => s.stats?.avgFatigue)
            .map(s => parseFloat(s.stats.avgFatigue));
        const avgFatigue = allFatigueScores.length > 0
            ? (allFatigueScores.reduce((a, b) => a + b, 0) / allFatigueScores.length).toFixed(2)
            : '--';

        const totalAlerts = sessionHistory.reduce((sum, s) => sum + (s.violations?.length || 0), 0);

        return {
            totalSessions: sessionHistory.length,
            totalHours,
            avgFatigue,
            totalAlerts
        };
    }, [sessionHistory]);

    // Filter sessions by search
    const filteredSessions = useMemo(() => {
        if (!searchQuery.trim()) return sessionHistory;
        const query = searchQuery.toLowerCase();
        return sessionHistory.filter(s =>
            s.routeName?.toLowerCase().includes(query) ||
            s.sessionId.toLowerCase().includes(query) ||
            new Date(s.startTime).toLocaleDateString().includes(query)
        );
    }, [sessionHistory, searchQuery]);

    // Handle view session details
    const handleViewSession = (session: SavedSession) => {
        navigate('/session-results', { state: session });
    };

    // Handle delete session
    const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Apakah Anda yakin ingin menghapus sesi ini?')) {
            const updated = sessionHistory.filter(s => s.sessionId !== sessionId);
            setSessionHistory(updated);
            localStorage.setItem('sessionHistory', JSON.stringify(updated));
        }
    };

    // Update graph data from EEG store
    useEffect(() => {
        // Use real data if available, otherwise use sample data
        const historyToUse = dataHistory.length > 0 ? dataHistory : generateSampleData();

        // Prepare graph data from history (last 100 samples)
        const recentHistory = historyToUse.slice(-100);
        const graphPoints = recentHistory.map((item: any) => ({
            timestamp: new Date(item.timestamp).getTime(),
            delta: item.deltaPower || 0,
            theta: item.thetaPower || 0,
            alpha: item.alphaPower || 0,
            beta: item.betaPower || 0,
            gamma: item.gammaPower || 0,
        }));
        setGraphData(graphPoints);
    }, [currentMetrics, dataHistory, getAverageMetrics]);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        setProfileSuccess(null);
        try {
            await useUserStore.getState().updateProfile({ full_name: fullName });
            setProfileSuccess('Nama berhasil diperbarui!');
            setTimeout(() => setProfileSuccess(null), 3000);
        } catch (error: any) {
            console.error('Update profile error:', error);
            alert(`Gagal memperbarui profil: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const navItems = [
        { icon: <LayoutDashboard size={20} />, label: 'Overview', tab: 'overview' as TabView },
        { icon: <History size={20} />, label: 'History', tab: 'history' as TabView },
        { icon: <User size={20} />, label: 'Profile', tab: 'profile' as TabView },
        { icon: <Settings size={20} />, label: 'Settings', tab: 'settings' as TabView },
        // { icon: <Camera size={20} />, label: 'Face Recognition', action: () => navigate('/face-recognition') },
        { icon: <Gamepad2 size={20} />, label: 'Live Session', action: () => navigate('/session') },
    ];

    return (
        <div className="dashboard-container">
            {/* Sidebar */}
            <aside className={`sidebar ${isSidebarOpen ? 'expanded' : 'collapsed'}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">Fumorive</div>
                    <button className="sidebar-toggle" onClick={toggleSidebar}>
                        {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item, index) => (
                        <div
                            key={index}
                            className={`nav-item ${item.tab && activeTab === item.tab ? 'active' : ''}`}
                            onClick={() => {
                                if (item.tab) {
                                    setActiveTab(item.tab);
                                } else if (item.action) {
                                    item.action();
                                }
                            }}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                        </div>
                    ))}

                    <div style={{ flex: 1 }}></div>

                    <div className="nav-item" onClick={async () => {
                        await logout();
                        navigate('/login');
                    }} style={{ color: '#ef4444' }}>
                        <span className="nav-icon"><LogOut size={20} /></span>
                        <span className="nav-label">Logout</span>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="dashboard-main">
                <header className="dashboard-header">
                    <div className="header-title">
                        <h1>
                            {activeTab === 'overview' && `Halo, ${user?.full_name || 'Driver'}`}
                            {activeTab === 'history' && 'Session History'}
                            {activeTab === 'profile' && 'User Profile'}
                            {activeTab === 'settings' && 'Settings'}
                        </h1>
                        <p>{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>

                    <div className="header-actions">
                        <div
                            className="user-profile"
                            onClick={() => setActiveTab('profile')}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="user-avatar" style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: user?.profile_picture ? '#e0e7ff' : '#f1f5f9',
                                fontSize: user?.profile_picture ? '1.2rem' : '1rem'
                            }}>
                                {user?.profile_picture || <User size={18} />}
                            </div>
                            <span className="user-name">{user?.full_name || 'Guest User'}</span>
                        </div>
                    </div>
                </header>

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* ── WELCOME BANNER ────────────────────────────────────── */}


                        {/* ── STAT SUMMARY CARDS ────────────────────────────────── */}


                        {/* ── ACTIVE SESSION ID (contextual) ────────────────────── */}
                        {sessionId && (
                            <div className="widget-card" style={{ background: '#0f172a', border: '1.5px solid #3b82f6' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        background: '#1e3a5f', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
                                    }}>🧠</div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active Session ID</div>
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Paste ID ini ke terminal EEG untuk menghubungkan Muse 2</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                                    <code style={{ flex: 1, fontSize: '0.95rem', color: '#38bdf8', fontFamily: '"Cascadia Code", "Fira Code", monospace', wordBreak: 'break-all', userSelect: 'all' }}>
                                        {sessionId}
                                    </code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(sessionId);
                                            setSessionIdCopied(true);
                                            setTimeout(() => setSessionIdCopied(false), 2000);
                                        }}
                                        style={{
                                            background: sessionIdCopied ? '#059669' : '#3b82f6',
                                            color: 'white', border: 'none', borderRadius: '8px',
                                            padding: '8px 16px', cursor: 'pointer', fontWeight: 600,
                                            fontSize: '0.85rem', display: 'flex', alignItems: 'center',
                                            gap: '6px', transition: 'all 0.2s', flexShrink: 0
                                        }}
                                    >
                                        {sessionIdCopied ? '✓ Copied!' : '📋 Copy ID'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── SECTION: CARA MENJALANKAN SISTEM ─────────────────── */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>Cara Menjalankan Sistem</span>
                                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                            </div>
                            <div className="widget-card" style={{ padding: '1.5rem 2rem', border: '2px dashed #cbd5e1', background: '#f8fafc', boxShadow: 'none' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {[
                                        {
                                            step: '01',
                                            icon: '🧠',
                                            title: 'Setup EEG Headset (Muse 2)',
                                            desc: (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <span>Download dan ekstrak EEG Server Package. Lalu double-click file <code>start_eeg.bat</code>. Kenakan Muse 2 dan pastikan Bluetooth aktif.</span>
                                                    <a
                                                        href={EEG_DOWNLOAD_URL}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        download
                                                        style={{
                                                            alignSelf: 'flex-start', background: '#4f46e5',
                                                            color: 'white', border: 'none', borderRadius: '8px',
                                                            padding: '8px 16px', cursor: 'pointer', fontWeight: 600,
                                                            fontSize: '0.85rem', display: 'flex', alignItems: 'center',
                                                            gap: '6px', transition: 'all 0.2s', flexShrink: 0,
                                                            textDecoration: 'none'
                                                        }}
                                                    >
                                                        ⬇ Download EEG Server Package
                                                    </a>
                                                </div>
                                            ),
                                            color: '#4f46e5',
                                            bg: '#eef2ff',
                                            border: '#c7d2fe'
                                        },
                                        {
                                            step: '02',
                                            icon: '🧠',
                                            title: 'Pilih Map Simulasi Mengemudi',
                                            desc: 'Masuk ke halaman Live Session dan pilih map simulasi mengemudi yang akan dimainkan.',
                                            color: '#0891b2',
                                            bg: '#ecfeff',
                                            border: '#a5f3fc'
                                        },
                                        {
                                            step: '03',
                                            icon: '📷',
                                            title: 'Aktifkan Kamera',
                                            desc: 'Pastikan webcam terhubung dan izin kamera sudah diberikan. Posisikan wajah agar terlihat jelas untuk face & eye detection.',
                                            color: '#7c3aed',
                                            bg: '#f5f3ff',
                                            border: '#ddd6fe'
                                        },
                                        {
                                            step: '04',
                                            icon: '🎮',
                                            title: 'Mulai Sesi & Paste Session ID',
                                            desc: 'Klik "Mulai Sesi Baru", pilih map, lalu copy Session ID yang muncul di banner atas dan paste ke terminal EEG yang sudah berjalan.',
                                            color: '#f59e0b',
                                            bg: '#fffbeb',
                                            border: '#fde68a'
                                        },
                                        {
                                            step: '05',
                                            icon: '🚨',
                                            title: 'Pantau & Respons Alert',
                                            desc: 'Sistem menganalisis brain waves + visual cues secara real-time. Segera berhenti & istirahat jika alert kelelahan muncul.',
                                            color: '#ef4444',
                                            bg: '#fff1f2',
                                            border: '#fecdd3'
                                        }
                                    ].map((s, i, arr) => (
                                        <div key={s.step} style={{ display: 'flex', gap: '1rem', alignItems: 'stretch' }}>
                                            {/* Left: number + vertical line */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                                <div style={{
                                                    width: '32px', height: '32px', borderRadius: '50%',
                                                    background: s.bg, border: `1.5px solid ${s.border}`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.8rem', fontWeight: 800, color: s.color, flexShrink: 0
                                                }}>
                                                    {s.step}
                                                </div>
                                                {i < arr.length - 1 && (
                                                    <div style={{ width: '1.5px', flex: 1, background: '#e2e8f0', margin: '4px 0' }} />
                                                )}
                                            </div>
                                            {/* Right: content */}
                                            <div style={{ paddingBottom: i < arr.length - 1 ? '1.25rem' : 0, paddingTop: '0.3rem' }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.2rem' }}>{s.title}</div>
                                                <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.6 }}>{s.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── SECTION: STATUS SISTEM ────────────────────────────── */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>Status Sistem</span>
                                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                            </div>
                            <div className="stats-row">
                                {[
                                    {
                                        label: 'Total Sesi',
                                        value: String(historyStats.totalSessions),
                                        sub: 'sesi tercatat',
                                        icon: <History size={20} />,
                                        bg: '#ede9fe', iconColor: '#7c3aed', valColor: '#4c1d95'
                                    },
                                    {
                                        label: 'Total Waktu',
                                        value: historyStats.totalHours + 'j',
                                        sub: 'jam berkendara',
                                        icon: <Clock size={20} />,
                                        bg: '#dbeafe', iconColor: '#2563eb', valColor: '#1e3a8a'
                                    },
                                    {
                                        label: 'Avg. Fatigue',
                                        value: historyStats.avgFatigue === '--' ? '--' : historyStats.avgFatigue,
                                        sub: 'rata-rata skor',
                                        icon: <Brain size={20} />,
                                        bg: '#fef3c7', iconColor: '#d97706', valColor: '#78350f'
                                    },
                                    {
                                        label: 'EEG Status',
                                        value: isConnected ? 'Online' : 'Offline',
                                        sub: isConnected ? 'sedang terhubung' : 'belum terhubung',
                                        icon: <Activity size={20} />,
                                        bg: isConnected ? '#dcfce7' : '#fee2e2',
                                        iconColor: isConnected ? '#16a34a' : '#dc2626',
                                        valColor: isConnected ? '#14532d' : '#7f1d1d'
                                    }
                                ].map((s) => (
                                    <div key={s.label} className="widget-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '48px', height: '48px', borderRadius: '14px',
                                            background: s.bg, display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0, color: s.iconColor
                                        }}>
                                            {s.icon}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{s.label}</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.valColor, lineHeight: 1.2 }}>{s.value}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{s.sub}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                        </div>

                        {/* ── SECTION: MONITORING REAL-TIME ─────────────────────── */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>Monitoring Real-time</span>
                                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                            </div>
                            <div className="dashboard-grid">
                                {/* Brain Waves */}
                                <div className="widget-card span-2">
                                    <div className="widget-title">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Brain size={18} color="#2563eb" />
                                            <span>Brain Wave Activity (Muse 2 EEG)</span>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', padding: '3px 10px', background: currentMetrics ? '#dcfce7' : '#f1f5f9', color: currentMetrics ? '#15803d' : '#64748b', borderRadius: '999px', fontWeight: 600 }}>
                                            {currentMetrics ? '● Live' : '○ No Data'}
                                        </span>
                                    </div>

                                    {/* Mini bar chart */}
                                    {graphData.length > 0 && (
                                        <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                                            <div style={{ height: '100px', display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
                                                {graphData.slice(-80).map((point: any, idx: number) => {
                                                    const maxVal = Math.max(...graphData.map((p: any) => Math.max(p.alpha, p.beta, p.theta)));
                                                    const h = Math.max((point.alpha / (maxVal || 1)) * 100, 5);
                                                    return (
                                                        <div key={idx} style={{ flex: 1, height: `${h}%`, background: `hsl(${140 + (point.alpha / (maxVal || 1)) * 60}, 60%, 50%)`, borderRadius: '1px', opacity: 0.85 }} />
                                                    );
                                                })}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.4rem', textAlign: 'center' }}>Alpha Power — últimas 80 amostras</div>
                                        </div>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                                        {[
                                            { name: 'Delta', range: '1-4Hz', key: 'deltaPower', color: '#8b5cf6', desc: 'Deep Sleep', bg: '#f5f3ff' },
                                            { name: 'Theta', range: '4-8Hz', key: 'thetaPower', color: '#06b6d4', desc: 'Drowsy', bg: '#ecfeff' },
                                            { name: 'Alpha', range: '8-13Hz', key: 'alphaPower', color: '#10b981', desc: 'Relaxed', bg: '#f0fdf4' },
                                            { name: 'Beta', range: '13-30Hz', key: 'betaPower', color: '#f59e0b', desc: 'Focused', bg: '#fffbeb' },
                                            { name: 'Gamma', range: '30-50Hz', key: 'gammaPower', color: '#ef4444', desc: 'Alert', bg: '#fff1f2' }
                                        ].map((wave) => {
                                            const val = currentMetrics && currentMetrics[wave.key as keyof typeof currentMetrics]
                                                ? (currentMetrics[wave.key as keyof typeof currentMetrics] as number).toFixed(2)
                                                : '--';
                                            return (
                                                <div key={wave.name} style={{ padding: '0.75rem', background: wave.bg, borderRadius: '10px', textAlign: 'center', border: `1.5px solid ${wave.color}22` }}>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: wave.color, marginBottom: '0.2rem' }}>{val}</div>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{wave.name}</div>
                                                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{wave.range}</div>
                                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>{wave.desc}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Fatigue Analysis */}
                                <div className="widget-card span-1">
                                    <div className="widget-title">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Eye size={18} color="#d97706" />
                                            <span>Analisis Kelelahan</span>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', padding: '3px 10px', background: currentMetrics ? '#dcfce7' : '#f1f5f9', color: currentMetrics ? '#15803d' : '#64748b', borderRadius: '999px', fontWeight: 600 }}>
                                            {currentMetrics ? '● Live' : '○ Standby'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ padding: '1rem', borderRadius: '12px', background: '#fffbeb', border: '1px solid #fde68a' }}>
                                            <div style={{ fontSize: '0.8rem', color: '#92400e', marginBottom: '0.25rem', fontWeight: 600 }}>EEG Fatigue Score</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#b45309' }}>{currentMetrics?.eegFatigueScore ? (currentMetrics.eegFatigueScore as number).toFixed(2) : '--'}</div>
                                            <div style={{ height: '6px', background: '#fef9c3', borderRadius: '4px', marginTop: '0.5rem', overflow: 'hidden' }}>
                                                <div style={{ width: `${currentMetrics?.eegFatigueScore ? Math.min((currentMetrics.eegFatigueScore as number) * 10, 100) : 0}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #f59e0b, #ef4444)', transition: 'width 0.5s' }} />
                                            </div>
                                        </div>
                                        <div style={{ padding: '1rem', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                            <div style={{ fontSize: '0.8rem', color: '#166534', marginBottom: '0.25rem', fontWeight: 600 }}>Attention (Beta Power)</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#15803d' }}>{currentMetrics?.betaPower ? (currentMetrics.betaPower as number).toFixed(2) : '--'}</div>
                                        </div>
                                        <div style={{ padding: '1rem', borderRadius: '12px', background: '#dbeafe', border: '1px solid #bfdbfe' }}>
                                            <div style={{ fontSize: '0.8rem', color: '#1e40af', marginBottom: '0.25rem', fontWeight: 600 }}>Theta / Alpha Ratio</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1d4ed8' }}>{currentMetrics?.thetaAlphaRatio ? (currentMetrics.thetaAlphaRatio as number).toFixed(2) : '--'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── FATIGUE TIMELINE ──────────────────────────────────── */}
                        {(isConnected || dataHistory.length > 0) && (
                            <div className="widget-card">
                                <div className="widget-title">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <TrendingUp size={18} color="#dc2626" />
                                        <span>Fatigue Score Timeline {!isConnected && '(Data Sesi)'}</span>
                                    </div>
                                </div>
                                <div style={{ height: '160px', display: 'flex', alignItems: 'flex-end', gap: '1px', background: '#f8fafc', padding: '0.5rem', borderRadius: '8px', marginBottom: '0.75rem', overflow: 'hidden' }}>
                                    {dataHistory.slice(-100).map((item: any, idx: number) => {
                                        const score = item.eegFatigueScore || 0;
                                        const height = Math.min(Math.max((score / 10) * 100, 3), 95);
                                        const warnLine = settings.warningThreshold / 10;
                                        const critLine = settings.criticalThreshold / 10;
                                        const color = score < warnLine ? '#10b981' : score < critLine ? '#f59e0b' : '#ef4444';
                                        return (
                                            <div key={idx} title={`Score: ${score.toFixed(2)} — ${new Date(item.timestamp).toLocaleTimeString('id-ID')}`}
                                                style={{ flex: 1, height: `${height}%`, background: color, borderRadius: '2px', opacity: 0.75, cursor: 'pointer' }} />
                                        );
                                    })}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}>
                                    <span>5 menit lalu</span>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        {[['#10b981', 'Alert'], ['#f59e0b', 'Drowsy'], ['#ef4444', 'Fatigued']].map(([c, l]) => (
                                            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span style={{ width: '10px', height: '10px', background: c, borderRadius: '2px', display: 'inline-block' }} />{l}
                                            </span>
                                        ))}
                                    </div>
                                    <span>Sekarang</span>
                                </div>
                            </div>
                        )}

                        {(!isConnected && dataHistory.length === 0) && (
                            <div className="widget-card" style={{ background: '#f9fafb', border: '2px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '160px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <TrendingUp size={36} color="#cbd5e1" style={{ marginBottom: '0.75rem' }} />
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Fatigue Score Timeline</p>
                                    <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>Hubungkan EEG atau mulai sesi game untuk melihat grafik</p>
                                </div>
                            </div>
                        )}

                        {/* ── SECTION: AKSI & SESI TERAKHIR ────────────────────── */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>Aksi & Sesi Terakhir</span>
                                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                            </div>
                            <div className="dashboard-grid">

                                {/* Driving Performance */}
                                <div className="widget-card span-2">
                                    <div className="widget-title">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Gauge size={18} color="#7c3aed" />
                                            <span>Performa Mengemudi</span>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', padding: '3px 10px', background: '#fef2f2', color: '#991b1b', borderRadius: '999px', fontWeight: 600 }}>Awaiting Session</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                                        {[
                                            { label: 'Lane Deviation', value: '-- cm', icon: <Target size={16} />, color: '#3b82f6', bg: '#eff6ff' },
                                            { label: 'Speed Consist.', value: '-- %', icon: <Gauge size={16} />, color: '#10b981', bg: '#f0fdf4' },
                                            { label: 'Reaction Time', value: '-- ms', icon: <Timer size={16} />, color: '#f59e0b', bg: '#fffbeb' },
                                            { label: 'Alert Count', value: '--', icon: <AlertTriangle size={16} />, color: '#ef4444', bg: '#fff1f2' }
                                        ].map((m) => (
                                            <div key={m.label} style={{ padding: '1rem', background: m.bg, borderRadius: '12px' }}>
                                                <div style={{ color: m.color, marginBottom: '0.5rem' }}>{m.icon}</div>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b' }}>{m.value}</div>
                                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>{m.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                                        <button onClick={() => navigate('/session')} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg,#6366f1,#7c3aed)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                            <Gamepad2 size={16} /> Mulai Sesi Baru
                                        </button>
                                        <button onClick={handleViewSampleResults} style={{ flex: 1, padding: '10px', background: 'white', color: '#6366f1', border: '1.5px solid #6366f1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                            <BarChart3 size={16} /> Lihat Contoh Hasil
                                        </button>
                                    </div>
                                </div>

                                {/* Last Session */}
                                <div className="widget-card span-1">

                                    {/* Fatigue Score Timeline Graph */}
                                    {(isConnected || dataHistory.length > 0) && (
                                        <div className="widget-card" style={{ gridColumn: 'span 3' }}>
                                            <div className="widget-title">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <TrendingUp size={20} color="#ef4444" />
                                                    <span>Fatigue Score Timeline {!isConnected && '(Session Data)'}</span>
                                                </div>
                                            </div>
                                            <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '1px', background: '#f8fafc', padding: '0.5rem', borderRadius: '8px', marginBottom: '1rem', overflow: 'hidden' }}>
                                                {(() => {
                                                    const historyToUse = dataHistory.length > 0 ? dataHistory : [];
                                                    return historyToUse.slice(-100).map((item: any, idx: number) => {
                                                        const score = item.eegFatigueScore || 0;
                                                        const height = Math.min(Math.max((score / 10) * 100, 3), 95);
                                                        const warnLine = settings.warningThreshold / 10;
                                                        const critLine = settings.criticalThreshold / 10;
                                                        const color = score < warnLine ? '#10b981' : score < critLine ? '#f59e0b' : '#ef4444';
                                                        return (
                                                            <div
                                                                key={idx}
                                                                title={`Score: ${score.toFixed(2)} at ${new Date(item.timestamp).toLocaleTimeString('id-ID')}`}
                                                                style={{
                                                                    flex: 1,
                                                                    height: `${height}%`,
                                                                    background: color,
                                                                    borderRadius: '2px',
                                                                    opacity: 0.7,
                                                                    cursor: 'pointer'
                                                                }}
                                                            />
                                                        );
                                                    });
                                                })()}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                                                <span>5 min ago</span>
                                                <span style={{ display: 'flex', gap: '1rem' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '2px' }}></span>
                                                        Alert
                                                    </span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '2px' }}></span>
                                                        Drowsy
                                                    </span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px' }}></span>
                                                        Fatigued
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                    )}




                                    {/* Last Session */}
                                    <div className="widget-title">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <History size={18} color="#64748b" />
                                            <span>Sesi Terakhir</span>
                                        </div>
                                    </div>
                                    {sessionHistory.length > 0 ? (() => {
                                        const last = sessionHistory[0];
                                        const durationMin = Math.floor((last.duration || last.completionTime || 0) / 60);
                                        return (
                                            <div style={{ cursor: 'pointer' }} onClick={() => handleViewSession(last)}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg,#6366f1,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <Flag size={20} color="white" />
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last.routeName || 'Sesi Mengemudi'}</div>
                                                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                                            {new Date(last.startTime).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} · {durationMin} menit
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                                    {last.reachedCount !== undefined && (
                                                        <span style={{ padding: '3px 8px', background: '#f0fdf4', color: '#10b981', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                                                            ✓ {last.reachedCount}/{last.totalWaypoints} checkpoint
                                                        </span>
                                                    )}
                                                    <span style={{ padding: '3px 8px', background: (last.totalViolationPoints || 0) === 0 ? '#f0fdf4' : '#fef2f2', color: (last.totalViolationPoints || 0) === 0 ? '#10b981' : '#ef4444', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                                                        ⚠️ {last.totalViolationPoints || 0} pelanggaran
                                                    </span>
                                                </div>
                                                <button className="btn-primary" style={{ width: '100%', padding: '9px', fontSize: '0.85rem' }}
                                                    onClick={(e) => { e.stopPropagation(); setActiveTab('history'); }}>
                                                    Lihat Semua ({sessionHistory.length})
                                                </button>
                                            </div>
                                        );
                                    })() : (
                                        <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#64748b' }}>
                                            <Calendar size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.2 }} />
                                            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem' }}>Belum ada sesi tercatat</p>
                                            <button className="btn-primary" style={{ padding: '9px 18px', fontSize: '0.85rem' }} onClick={() => navigate('/session')}>
                                                Mulai Sesi
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Safety Tips */}
                                <div className="widget-card span-3" style={{ background: 'linear-gradient(135deg, #fff7ed, #fef2f2)', border: '1.5px solid #fed7aa' }}>
                                    <div className="widget-title" style={{ marginBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <AlertTriangle size={18} color="#ea580c" />
                                            <span style={{ color: '#9a3412' }}>Tips Keselamatan Berkendara</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                                        {[
                                            { n: 1, title: 'Istirahat Teratur', desc: 'Berhenti setiap 2 jam atau 200 km' },
                                            { n: 2, title: 'Cek Signal Quality', desc: 'Pastikan headset EEG terpasang benar' },
                                            { n: 3, title: 'Respons Alert', desc: 'Segera berhenti saat peringatan muncul' },
                                            { n: 4, title: 'Fokus Berkendara', desc: 'Hindari multitasking saat monitoring' }
                                        ].map((t) => (
                                            <div key={t.n} style={{ display: 'flex', gap: '0.75rem', alignItems: 'start', padding: '0.75rem', background: 'rgba(255,255,255,0.7)', borderRadius: '10px' }}>
                                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: '0.8rem', color: '#9a3412' }}>{t.n}</div>
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7c2d12', marginBottom: '2px' }}>{t.title}</div>
                                                    <div style={{ fontSize: '0.78rem', color: '#9a3412', lineHeight: 1.4 }}>{t.desc}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </div>

                    </div>
                )}

                {/* HISTORY TAB */}
                {activeTab === 'history' && (
                    <div className="dashboard-content">
                        {/* Filter & Search */}
                        <div className="widget-card" style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                    <input
                                        type="text"
                                        placeholder="Cari sesi..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px 10px 40px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '0.9rem'
                                        }}
                                    />
                                </div>
                                <button
                                    onClick={() => navigate('/session')}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', border: 'none', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    <Gamepad2 size={18} />
                                    <span>Sesi Baru</span>
                                </button>
                            </div>
                        </div>

                        {/* Session Statistics Overview */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem', color: '#64748b' }}>
                            {[
                                { label: 'Total Sesi', value: historyStats.totalSessions.toString(), icon: <BarChart3 size={20} />, color: '#3b82f6' },
                                { label: 'Total Jam', value: `${historyStats.totalHours}h`, icon: <Clock size={20} />, color: '#10b981' },
                                { label: 'Rata-rata Fatigue', value: historyStats.avgFatigue, icon: <TrendingUp size={20} />, color: '#f59e0b' },
                                { label: 'Total Pelanggaran', value: historyStats.totalAlerts.toString(), icon: <AlertTriangle size={20} />, color: '#ef4444' }
                            ].map((stat) => (
                                <div key={stat.label} className="widget-card" style={{ textAlign: 'center' }}>
                                    <div style={{ color: stat.color, marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}>{stat.icon}</div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1e293b' }}>{stat.value}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{stat.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Session Comparison Chart */}
                        {sessionHistory.length >= 2 && (() => {
                            const last5 = [...sessionHistory].slice(0, 5).reverse(); // oldest → newest
                            const maxFatigue = 10;
                            const maxViolations = Math.max(...last5.map(s => s.violations?.length || 0), 1);
                            const barW = 48;
                            const barGap = 20;
                            const chartH = 120;
                            const chartW = last5.length * (barW + barGap) - barGap;

                            return (
                                <div className="widget-card" style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <BarChart3 size={18} color="#6366f1" />
                                            Perbandingan Sesi (Terakhir {last5.length})
                                        </div>
                                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b' }}>
                                            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#6366f1', borderRadius: 2, marginRight: 4 }} />Fatigue</span>
                                            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#ef4444', borderRadius: 2, marginRight: 4 }} />Pelanggaran</span>
                                        </div>
                                    </div>

                                    {/* SVG Chart */}
                                    <div style={{ overflowX: 'auto' }}>
                                        <svg
                                            width={Math.max(chartW + 60, 400)}
                                            height={chartH + 70}
                                            style={{ display: 'block', margin: '0 auto' }}
                                        >
                                            {/* Y-axis grid lines */}
                                            {[0, 2.5, 5, 7.5, 10].map((val) => {
                                                const y = 8 + chartH - (val / maxFatigue) * chartH;
                                                return (
                                                    <g key={val}>
                                                        <line x1={30} x2={30 + chartW} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4,3" />
                                                        <text x={24} y={y + 4} fontSize={9} fill="#94a3b8" textAnchor="end">{val}</text>
                                                    </g>
                                                );
                                            })}

                                            {/* Bars */}
                                            {last5.map((session, i) => {
                                                const fatigue = parseFloat(session.stats?.avgFatigue || '0');
                                                const violations = session.violations?.length || 0;
                                                const x = 30 + i * (barW + barGap);

                                                const fatigueH = Math.max(2, (fatigue / maxFatigue) * chartH);
                                                const violH = Math.max(2, (violations / maxViolations) * chartH);

                                                const fatigueColor = fatigue < 3 ? '#22c55e' : fatigue < 6 ? '#f59e0b' : '#ef4444';
                                                const date = new Date(session.startTime);
                                                const label = `${date.getDate()}/${date.getMonth() + 1}`;
                                                const timeLabel = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

                                                return (
                                                    <g key={session.sessionId}>
                                                        {/* Fatigue bar */}
                                                        <rect
                                                            x={x}
                                                            y={8 + chartH - fatigueH}
                                                            width={barW * 0.55}
                                                            height={fatigueH}
                                                            rx={3}
                                                            fill={fatigueColor}
                                                            opacity={0.85}
                                                        />
                                                        {/* Fatigue value label */}
                                                        <text
                                                            x={x + barW * 0.275}
                                                            y={8 + chartH - fatigueH - 4}
                                                            fontSize={9}
                                                            fill={fatigueColor}
                                                            textAnchor="middle"
                                                            fontWeight={700}
                                                        >
                                                            {fatigue.toFixed(1)}
                                                        </text>

                                                        {/* Violations bar */}
                                                        <rect
                                                            x={x + barW * 0.58}
                                                            y={8 + chartH - violH}
                                                            width={barW * 0.4}
                                                            height={violH}
                                                            rx={3}
                                                            fill="#ef4444"
                                                            opacity={0.7}
                                                        />
                                                        {violations > 0 && (
                                                            <text
                                                                x={x + barW * 0.78}
                                                                y={8 + chartH - violH - 4}
                                                                fontSize={9}
                                                                fill="#ef4444"
                                                                textAnchor="middle"
                                                                fontWeight={700}
                                                            >
                                                                {violations}
                                                            </text>
                                                        )}

                                                        {/* X-axis label */}
                                                        <text x={x + barW / 2} y={8 + chartH + 14} fontSize={10} fill="#475569" textAnchor="middle" fontWeight={600}>{label}</text>
                                                        <text x={x + barW / 2} y={8 + chartH + 26} fontSize={9} fill="#94a3b8" textAnchor="middle">{timeLabel}</text>

                                                        {/* Current session indicator */}
                                                        {i === last5.length - 1 && (
                                                            <text x={x + barW / 2} y={8 + chartH + 38} fontSize={8} fill="#6366f1" textAnchor="middle" fontWeight={700}>TERBARU</text>
                                                        )}
                                                    </g>
                                                );
                                            })}

                                            {/* Trend line for fatigue */}
                                            {last5.length >= 2 && (() => {
                                                const points = last5.map((s, i) => {
                                                    const fatigue = parseFloat(s.stats?.avgFatigue || '0');
                                                    const x = 30 + i * (barW + barGap) + barW * 0.275;
                                                    const y = 8 + chartH - (fatigue / maxFatigue) * chartH;
                                                    return `${x},${y}`;
                                                }).join(' ');
                                                return <polyline points={points} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4,3" opacity={0.6} />;
                                            })()}
                                        </svg>
                                    </div>

                                    {/* Trend insight */}
                                    {(() => {
                                        const scores = last5.map(s => parseFloat(s.stats?.avgFatigue || '0'));
                                        if (scores.length < 2) return null;
                                        const trend = scores[scores.length - 1] - scores[0];
                                        const improving = trend < -0.5;
                                        const worsening = trend > 0.5;
                                        return (
                                            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: improving ? '#f0fdf4' : worsening ? '#fef2f2' : '#f8fafc', fontSize: 12, color: improving ? '#16a34a' : worsening ? '#dc2626' : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <TrendingUp size={14} />
                                                {improving
                                                    ? `Tren membaik 📉 — fatigue turun ${Math.abs(trend).toFixed(1)} poin dari sesi pertama ke terbaru.`
                                                    : worsening
                                                        ? `Tren memburuk 📈 — fatigue naik ${trend.toFixed(1)} poin. Pertimbangkan istirahat lebih.`
                                                        : 'Fatigue relatif stabil antar sesi.'}
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })()}

                        {/* Session List */}
                        <div className="widget-card">
                            <div className="widget-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Riwayat Sesi ({filteredSessions.length})</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {filteredSessions.length === 0 ? (
                                    /* Empty State */
                                    <div style={{
                                        padding: '3rem 2rem',
                                        textAlign: 'center',
                                        color: '#64748b'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.75rem',
                                            marginBottom: '1.5rem'
                                        }}>

                                        </div>
                                        <Calendar size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>
                                            {searchQuery ? 'Tidak ada sesi yang cocok' : 'Belum Ada Sesi'}
                                        </h3>
                                        <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
                                            {searchQuery ? 'Coba kata kunci lain' : 'Mulai sesi baru untuk melihat data mengemudi dan fatigue Anda di sini'}
                                        </p>
                                        {!searchQuery && (
                                            <button
                                                className="btn-primary"
                                                style={{ marginTop: '1.5rem', padding: '10px 24px' }}
                                                onClick={() => navigate('/session')}
                                            >
                                                Mulai Sesi Pertama
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    /* Session Cards */
                                    filteredSessions.map((session) => {
                                        const startDate = new Date(session.startTime);
                                        const duration = session.duration || session.completionTime || 0;
                                        const durationMin = Math.floor(duration / 60);
                                        const durationSec = Math.floor(duration % 60);
                                        const violationCount = session.violations?.length || 0;
                                        const violationPoints = session.totalViolationPoints || 0;

                                        return (
                                            <div
                                                key={session.sessionId}
                                                onClick={() => handleViewSession(session)}
                                                style={{
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '10px',
                                                    overflow: 'hidden',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    background: 'white'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                                                onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                                            >
                                                {/* Main Row */}
                                                <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    {/* Icon */}
                                                    <div style={{
                                                        width: '48px',
                                                        height: '48px',
                                                        borderRadius: '10px',
                                                        background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}>
                                                        <Flag size={24} color="white" />
                                                    </div>

                                                    {/* Info */}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '1rem', marginBottom: '0.25rem' }}>
                                                            {session.routeName || 'Sesi Mengemudi'}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b' }}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <Calendar size={14} />
                                                                {startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <Clock size={14} />
                                                                {startDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <Timer size={14} />
                                                                {durationMin}:{durationSec.toString().padStart(2, '0')}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Stats Badges */}
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                        {session.reachedCount !== undefined && (
                                                            <div style={{
                                                                padding: '0.35rem 0.75rem',
                                                                background: '#f0fdf4',
                                                                borderRadius: '6px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 600,
                                                                color: '#10b981'
                                                            }}>
                                                                <Target size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                                {session.reachedCount}/{session.totalWaypoints}
                                                            </div>
                                                        )}
                                                        <div style={{
                                                            padding: '0.35rem 0.75rem',
                                                            background: violationPoints === 0 ? '#f0fdf4' : violationPoints < 30 ? '#fef3c7' : '#fef2f2',
                                                            borderRadius: '6px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600,
                                                            color: violationPoints === 0 ? '#10b981' : violationPoints < 30 ? '#f59e0b' : '#ef4444'
                                                        }}>
                                                            <AlertTriangle size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                            {violationCount}x ({violationPoints} poin)
                                                        </div>
                                                        {session.stats?.avgFatigue && (
                                                            <div style={{
                                                                padding: '0.35rem 0.75rem',
                                                                background: parseFloat(session.stats.avgFatigue) < 3 ? '#eff6ff' : parseFloat(session.stats.avgFatigue) < 6 ? '#fef3c7' : '#fef2f2',
                                                                borderRadius: '6px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 600,
                                                                color: parseFloat(session.stats.avgFatigue) < 3 ? '#3b82f6' : parseFloat(session.stats.avgFatigue) < 6 ? '#f59e0b' : '#ef4444'
                                                            }}>
                                                                <Brain size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                                {session.stats.avgFatigue}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={(e) => handleDeleteSession(session.sessionId, e)}
                                                        style={{
                                                            padding: '0.5rem',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: '#9ca3af',
                                                            borderRadius: '6px',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
                                                        title="Hapus sesi"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>

                                                    {/* View indicator */}
                                                    <ChevronRight size={20} color="#9ca3af" />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* PROFILE TAB */}
                {activeTab === 'profile' && (
                    <div className="dashboard-content">

                        {/* ── PROFILE HEADER ─────────────────────────────── */}
                        <div className="widget-card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)', border: '1.5px solid #dbeafe' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                                {/* Avatar */}
                                <div style={{
                                    width: '80px', height: '80px', borderRadius: '50%',
                                    background: user?.profile_picture ? '#e0e7ff' : 'linear-gradient(135deg, #6366f1, #7c3aed)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: user?.profile_picture ? '2.5rem' : '2rem',
                                    color: 'white', fontWeight: 800, flexShrink: 0,
                                    boxShadow: '0 4px 15px rgba(99,102,241,0.3)'
                                }}>
                                    {user?.profile_picture
                                        ? user.profile_picture
                                        : (user?.full_name?.[0] || 'U').toUpperCase()
                                    }
                                </div>

                                {/* Name & meta */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#1e293b' }}>{user?.full_name || 'User'}</h2>
                                        <span style={{
                                            padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize',
                                            background: user?.role === 'admin' ? '#fef3c7' : user?.role === 'researcher' ? '#f0fdf4' : '#eff6ff',
                                            color: user?.role === 'admin' ? '#92400e' : user?.role === 'researcher' ? '#15803d' : '#1d4ed8',
                                            border: `1px solid ${user?.role === 'admin' ? '#fde68a' : user?.role === 'researcher' ? '#bbf7d0' : '#bfdbfe'}`
                                        }}>{user?.role || 'student'}</span>
                                        {user?.oauth_provider && (
                                            <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
                                                🔗 {user.oauth_provider.charAt(0).toUpperCase() + user.oauth_provider.slice(1)} OAuth
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.88rem', color: '#64748b' }}>{user?.email}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                        Bergabung {user?.created_at ? new Date(user.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : '--'}
                                    </div>
                                </div>

                                {/* Session stats */}
                                <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0 }}>
                                    {[
                                        { label: 'Total Sesi', value: historyStats.totalSessions },
                                        { label: 'Total Jam', value: `${historyStats.totalHours}j` },
                                        { label: 'Avg Fatigue', value: historyStats.avgFatigue },
                                    ].map(s => (
                                        <div key={s.label} style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4f46e5' }}>{s.value}</div>
                                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>

                            {/* ── EDIT PROFILE ──────────────────────────────── */}
                            <div className="widget-card">
                                <div className="widget-title" style={{ marginBottom: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <User size={18} color="#6366f1" />
                                        <span style={{ color: '#1e293b', fontWeight: 600 }}>Informasi Profil</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nama Lengkap</label>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', color: '#1e293b', transition: 'border-color 0.2s', outline: 'none', boxSizing: 'border-box' }}
                                            onFocus={e => e.target.style.borderColor = '#6366f1'}
                                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                            placeholder="Masukkan nama lengkap"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
                                        <input
                                            type="email"
                                            value={user?.email || ''}
                                            disabled
                                            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed', boxSizing: 'border-box' }}
                                        />
                                        <p style={{ margin: '0.3rem 0 0', fontSize: '0.77rem', color: '#94a3b8' }}>Email tidak dapat diubah</p>
                                    </div>
                                    {profileSuccess && (
                                        <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '0.875rem', color: '#15803d', fontWeight: 600 }}>
                                            ✓ {profileSuccess}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={isSaving || fullName === user?.full_name}
                                        style={{
                                            padding: '11px 20px', background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
                                            color: 'white', border: 'none', borderRadius: '8px',
                                            cursor: (isSaving || fullName === user?.full_name) ? 'not-allowed' : 'pointer',
                                            fontWeight: 700, fontSize: '0.95rem',
                                            opacity: (isSaving || fullName === user?.full_name) ? 0.6 : 1,
                                            transition: 'opacity 0.2s'
                                        }}
                                    >
                                        {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {/* SETTINGS TAB */}
                {activeTab === 'settings' && (
                    <div className="dashboard-content">

                        {/* Device Configuration */}
                        <div className="widget-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
                            <div className="widget-title" style={{ marginBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Activity size={20} color="#3b82f6" />
                                    <span style={{ color: '#1e293b', fontWeight: 600 }}>Konfigurasi Perangkat</span>
                                </div>
                                <span style={{ fontSize: '0.75rem', padding: '3px 10px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '999px', fontWeight: 600 }}>Info Only</span>
                            </div>
                            <div style={{ padding: '0.75rem 1rem', background: '#eff6ff', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.6 }}>
                                ⓘ Konfigurasi hardware EEG & sampling rate dikelola langsung di <code style={{ background: '#dbeafe', padding: '1px 5px', borderRadius: '4px' }}>eeg-processing/config.py</code> dan dijalankan via terminal. Frontend tidak dapat mengontrol hardware secara langsung.
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {[
                                    { label: 'EEG Headset', value: isConnected ? 'Muse 2 — Terhubung via LSL' : 'Muse 2 — Belum Terhubung', valueColor: isConnected ? '#16a34a' : '#94a3b8', desc: 'Hubungkan dengan menjalankan: python server.py --session-id <ID>' },
                                    { label: 'Sampling Rate', value: '256 Hz (Muse 2 default)', valueColor: '#1e293b', desc: 'Diatur di eeg-processing/config.py → SAMPLING_RATE = 256.0' },
                                    { label: 'Filter Frekuensi', value: '1–40 Hz (Bandpass)', valueColor: '#1e293b', desc: 'Diatur di config.py → LOWCUT_FREQ = 1.0, HIGHCUT_FREQ = 40.0' },
                                    { label: 'Notch Filter', value: '50 Hz (PLI Indonesia)', valueColor: '#1e293b', desc: 'Diatur di config.py → NOTCH_FREQ = 50.0' },
                                ].map(row => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{row.label}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>{row.desc}</div>
                                        </div>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: row.valueColor, whiteSpace: 'nowrap', flexShrink: 0 }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Detection Thresholds */}
                        <div className="widget-card" style={{ marginBottom: '1.5rem' }}>
                            <div className="widget-title" style={{ marginBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Sliders size={20} color="#f59e0b" />
                                    <span style={{ color: '#1e293b', fontWeight: 600 }}>Ambang Batas Deteksi</span>
                                </div>
                            </div>
                            <div style={{ padding: '0.75rem 1rem', background: '#fffbeb', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#92400e', lineHeight: 1.6 }}>
                                ⓘ <strong>Warning & Critical</strong> mempengaruhi <strong>warna tampilan</strong> grafik fatigue score di Dashboard (hijau → kuning → merah).
                                Threshold ini <strong>tidak</strong> mengubah klasifikasi EEG server — klasifikasi di server tetap: ≥40 = drowsy, ≥70 = fatigued (diatur di <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: '4px' }}>eeg-processing/server.py</code>).
                                <br />PERCLOS dikelola sepenuhnya oleh backend, tidak dibaca dari sini.
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {[
                                    { key: 'warningThreshold', label: 'Warning Threshold', color: '#f59e0b', scope: '🖥 Tampilan dashboard' },
                                    { key: 'criticalThreshold', label: 'Critical Threshold', color: '#ef4444', scope: '🖥 Tampilan dashboard' },
                                    { key: 'perClosThreshold', label: 'PERCLOS Threshold', color: '#8b5cf6', scope: '🔒 Info only — dikelola backend' },
                                ].map(t => (
                                    <div key={t.key}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                            <div>
                                                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{t.label}</label>
                                                <span style={{ marginLeft: '8px', fontSize: '0.72rem', color: t.key === 'perClosThreshold' ? '#94a3b8' : '#64748b' }}>{t.scope}</span>
                                            </div>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: t.color }}>{settings[t.key]}%</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="100"
                                            value={settings[t.key]}
                                            onChange={e => updateSetting(t.key, Number(e.target.value))}
                                            disabled={t.key === 'perClosThreshold'}
                                            style={{ width: '100%', accentColor: t.color, opacity: t.key === 'perClosThreshold' ? 0.4 : 1, cursor: t.key === 'perClosThreshold' ? 'not-allowed' : 'pointer' }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            {/* Notifications */}
                            <div className="widget-card">
                                <div className="widget-title">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Bell size={20} color="#10b981" />
                                        <span style={{ color: '#1e293b', fontWeight: 600 }}>Notifikasi</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {([
                                        { key: 'audioAlerts', label: 'Audio Alerts', desc: 'Bunyi peringatan saat kelelahan terdeteksi' },
                                        { key: 'visualEffects', label: 'Visual Effects', desc: 'Efek visual overlay pada layar game' },
                                        { key: 'hapticFeedback', label: 'Haptic Feedback', desc: 'Getar perangkat (jika didukung)' },
                                    ] as const).map(n => (
                                        <label key={n.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={settings[n.key]}
                                                onChange={e => updateSetting(n.key, e.target.checked)}
                                                style={{ marginTop: '3px', accentColor: '#10b981' }}
                                            />
                                            <div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{n.label}</div>
                                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{n.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Data & Privacy */}
                            <div className="widget-card">
                                <div className="widget-title">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Shield size={20} color="#8b5cf6" />
                                        <span style={{ color: '#1e293b', fontWeight: 600 }}>Data & Privasi</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {([
                                        { key: 'saveSessionData', label: 'Simpan Data Sesi', desc: 'Riwayat sesi disimpan di localStorage' },
                                        { key: 'shareAnonymousData', label: 'Bagikan Data Anonim', desc: 'Kirim data tanpa identitas untuk penelitian' },
                                    ] as const).map(n => (
                                        <label key={n.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={settings[n.key]}
                                                onChange={e => updateSetting(n.key, e.target.checked)}
                                                style={{ marginTop: '3px', accentColor: '#8b5cf6' }}
                                            />
                                            <div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{n.label}</div>
                                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{n.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                    <button
                                        onClick={handleExportData}
                                        disabled={sessionHistory.length === 0}
                                        style={{ marginTop: '0.5rem', padding: '9px 16px', border: '1px solid #8b5cf6', borderRadius: '8px', background: 'white', cursor: sessionHistory.length === 0 ? 'not-allowed' : 'pointer', fontSize: '0.9rem', color: '#8b5cf6', fontWeight: 600, opacity: sessionHistory.length === 0 ? 0.5 : 1 }}
                                    >
                                        ⬇ Export Semua Data (.json)
                                    </button>
                                </div>
                            </div>

                            {/* System Info */}
                            <div className="widget-card">
                                <div className="widget-title">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Info size={20} color="#64748b" />
                                        <span style={{ color: '#1e293b', fontWeight: 600 }}>Info Sistem</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                                    {[
                                        { label: 'Versi Aplikasi', value: '1.0.0', valueColor: '#1e293b' },
                                        { label: 'Backend', value: 'FastAPI (localhost:8000)', valueColor: '#1e293b' },
                                        { label: 'EEG / LSL', value: isConnected ? 'Terhubung' : 'Tidak Terhubung', valueColor: isConnected ? '#16a34a' : '#ef4444' },
                                        { label: 'EEG Server', value: 'localhost:8765 (WS)', valueColor: '#1e293b' },
                                    ].map(row => (
                                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#64748b' }}>{row.label}</span>
                                            <span style={{ fontWeight: 600, color: row.valueColor }}>{row.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Database */}
                            <div className="widget-card">
                                <div className="widget-title">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Database size={20} color="#06b6d4" />
                                        <span style={{ color: '#1e293b', fontWeight: 600 }}>Penyimpanan Lokal</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#64748b' }}>Storage Digunakan</span>
                                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{storageUsedKB} KB</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#64748b' }}>Sesi Tersimpan</span>
                                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{sessionHistory.length}</span>
                                    </div>
                                    <button
                                        onClick={handleClearAllData}
                                        disabled={sessionHistory.length === 0}
                                        style={{ marginTop: '0.5rem', padding: '9px 16px', border: '1px solid #fecaca', borderRadius: '8px', background: '#fff1f2', cursor: sessionHistory.length === 0 ? 'not-allowed' : 'pointer', fontSize: '0.9rem', color: '#ef4444', fontWeight: 600, opacity: sessionHistory.length === 0 ? 0.5 : 1 }}
                                    >
                                        🗑 Hapus Semua Data
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
