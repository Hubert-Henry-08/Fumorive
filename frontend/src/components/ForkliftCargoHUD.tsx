import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCargoStore } from '../stores/cargoStore'
import { useViolationStore } from '../stores/violationStore'
import { useSessionStore } from '../stores/sessionStore'
import { sessionApi } from '../api/session'

/**
 * ForkliftCargoHUD
 * ================
 * HUD khusus map `forklift-testing`:
 * - Progress CARGO DELIVERY (mis. "CARGO 7 / 12") + progress bar
 * - Overlay MISSION COMPLETE saat 12/12 (auto-redirect ke hasil analisis)
 * Progress CARGO terpisah dari POINT pelanggaran (violationStore) — point
 * tidak diubah, tidak di-serve sebagai reward cargo.
 */
export function ForkliftCargoHUD() {
  const navigate = useNavigate()
  const delivered = useCargoStore((s) => s.delivered)
  const total = useCargoStore((s) => s.total)
  const isMissionComplete = useCargoStore((s) => s.isMissionComplete)

  const totalViolationPoints = useViolationStore((s) => s.totalPoints)
  const violations = useViolationStore((s) => s.violations)
  const sessionId = useSessionStore((s) => s.sessionId)

  const startRef = useRef<number>(0)
  const [completionTime, setCompletionTime] = useState(0)
  const [countdown, setCountdown] = useState(8)
  const [isNavigating, setIsNavigating] = useState(false)

  // HUD hanya dipasang saat game berjalan (forklift-testing) → mount = start.
  useEffect(() => {
    startRef.current = Date.now()
  }, [])

  // Kunci waktu selesai saat 12/12 tercapai.
  useEffect(() => {
    if (isMissionComplete) {
      setCompletionTime(Math.max(1, Math.round((Date.now() - startRef.current) / 1000)))
    }
  }, [isMissionComplete])

  const navigateToResults = useCallback(async () => {
    if (isNavigating) return
    setIsNavigating(true)

    const elapsed =
      completionTime || Math.max(1, Math.round((Date.now() - startRef.current) / 1000))
    const currentTime = new Date()
    const sessionStartTime = new Date(currentTime.getTime() - elapsed * 1000)

    const completionData = {
      sessionId: sessionId || `session_${Date.now()}`,
      routeName: 'Forklift Testing',
      startTime: sessionStartTime,
      endTime: currentTime,
      checkpointsReached: delivered,
      totalCheckpoints: total,
      violations: violations.map((v) => ({
        type: v.type,
        points: v.points,
        timestamp: new Date(v.timestamp),
        description: v.description,
      })),
      totalViolationPoints,
      eegData: [],
      faceData: [],
      averageSpeed: 0,
      maxSpeed: 0,
      totalDistance: 0,
    }

    // Tutup session di backend (pola sama dengan WaypointHUD).
    try {
      if (sessionId && !sessionId.startsWith('session_')) {
        await sessionApi.complete(sessionId, {
          duration_seconds: elapsed,
          alert_count: violations.length,
          settings: {
            routeName: 'Forklift Testing',
            violations: completionData.violations,
            totalViolationPoints,
            reachedCount: delivered,
            missedCount: 0,
          },
        })
        console.log('✅ Forklift session completed in backend')
      }
    } catch (error) {
      console.warn('⚠️ Could not complete forklift session in backend:', error)
    }

    useViolationStore.getState().resetViolations()
    navigate('/session-results', { state: completionData })
  }, [isNavigating, sessionId, delivered, total, violations, totalViolationPoints, navigate, completionTime])

  // Auto-redirect countdown setelah mission complete (mulai dari 8s saat muncul).
  useEffect(() => {
    if (!isMissionComplete) return
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          navigateToResults()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isMissionComplete, navigateToResults])

  const progressPercent = total > 0 ? Math.min(100, (delivered / total) * 100) : 0

  if (isMissionComplete) {
    return (
      <div style={styles.completionOverlay}>
        <div style={styles.completionCard}>
          <div style={styles.completionIcon}>🏁</div>
          <h2 style={styles.completionTitle}>MISSION COMPLETE!</h2>
          <p style={styles.completionRoute}>
            SEMUA CARGO BERHASIL DIANGKUT • {delivered}/{total}
          </p>
          <div style={styles.completionStats}>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Waktu</span>
              <span style={styles.statValue}>{formatTime(completionTime)}</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Cargo</span>
              <span style={styles.statValue}>{delivered}/{total}</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Pelanggaran</span>
              <span style={{
                ...styles.statValue,
                color: totalViolationPoints === 0 ? '#34d399' : totalViolationPoints < 30 ? '#fbbf24' : '#ef4444',
              }}>
                {totalViolationPoints} poin ({violations.length}x)
              </span>
            </div>
          </div>
          <button
            onClick={navigateToResults}
            disabled={isNavigating}
            style={{
              ...styles.button,
              opacity: isNavigating ? 0.7 : 1,
              cursor: isNavigating ? 'not-allowed' : 'pointer',
            }}
          >
            {isNavigating ? 'Memproses...' : `Lihat Hasil Analisis (${countdown}s)`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.icon}>📦</span>
        <span style={styles.title}>CARGO DELIVERY</span>
      </div>
      <div style={styles.progressBarBg}>
        <div style={{ ...styles.progressBarFill, width: `${progressPercent}%` }} />
      </div>
      <div style={styles.row}>
        <span style={styles.label}>Cargo</span>
        <span style={styles.value}>{delivered} / {total}</span>
      </div>
      <div style={styles.hint}>
        Angkut 12 cargo dari STORAGE AREA ke DROP-OFF AREA (12 slot hijau)
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// ============================================
// STYLES
// ============================================
const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: '1rem',
    left: '1rem',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(34, 197, 94, 0.35)',
    borderRadius: '12px',
    padding: '0.8rem 1rem',
    minWidth: '240px',
    maxWidth: '300px',
    color: '#fff',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    zIndex: 900,
    userSelect: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    marginBottom: '0.5rem',
    paddingBottom: '0.4rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  icon: {
    fontSize: '1rem',
  },
  title: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: '0.08em',
  },
  progressBarBg: {
    width: '100%',
    height: '8px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: '4px',
    marginBottom: '0.6rem',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: '4px',
    transition: 'width 0.4s ease',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.4rem',
  },
  label: {
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.6)',
  },
  value: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#22c55e',
  },
  hint: {
    fontSize: '0.68rem',
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.4,
  },
  completionOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  completionCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: '2px solid rgba(34, 197, 94, 0.5)',
    borderRadius: '20px',
    padding: '2.5rem 3rem',
    textAlign: 'center' as const,
    maxWidth: '420px',
  },
  completionIcon: {
    fontSize: '4rem',
    marginBottom: '0.5rem',
  },
  completionTitle: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: '#22c55e',
    margin: '0 0 0.3rem 0',
    letterSpacing: '0.1em',
  },
  completionRoute: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: '1.5rem',
  },
  completionStats: {
    display: 'flex',
    gap: '1.5rem',
    justifyContent: 'center',
    marginBottom: '1.5rem',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.3rem',
  },
  statLabel: {
    fontSize: '0.72rem',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  statValue: {
    fontSize: '1.3rem',
    fontWeight: 'bold',
    color: '#fff',
  },
  button: {
    marginTop: '0.5rem',
    padding: '12px 32px',
    background: 'linear-gradient(135deg, #16a34a, #22c55e)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 15px rgba(34, 197, 94, 0.4)',
  } as React.CSSProperties,
}