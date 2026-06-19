import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../stores/gameStore'
import type { MapType } from '../game/types/map.types'
import { EEG_DOWNLOAD_URL } from '../config/api'

interface MapInfo {
  id: MapType
  name: string
  description: string
  thumbnail: string
}

const maps: MapInfo[] = [
  {
    id: 'solo-city' as MapType,
    name: 'Solo City',
    description: 'Kota urban dengan gedung-gedung, jalan raya, dan banyak obstacle. Cocok untuk pengalaman berkendara yang menantang.',
    thumbnail: '🏙️',
  },
  {
    id: 'sriwedari-park' as MapType,
    name: 'Sriwedari Park',
    description: 'Taman terbuka yang luas dengan sedikit obstacle. Sempurna untuk berlatih dan menguji kendaraan dengan bebas.',
    thumbnail: '🌳',
  },
]

interface MapSelectionProps {
  onStartGame: () => void
}

export function MapSelection({ onStartGame }: MapSelectionProps) {
  const navigate = useNavigate()
  const { selectedMap, setSelectedMap } = useGameStore()
  const [showEEGGuide, setShowEEGGuide] = useState(false)

  const handleMapSelect = (mapId: MapType) => {
    setSelectedMap(mapId)
  }

  const handleStartGame = () => {
    onStartGame()
  }

  const handleBackToDashboard = () => {
    navigate('/dashboard')
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <h1 style={styles.title}>PILIH MAP</h1>
        <p style={styles.subtitle}>Pilih map untuk memulai permainan</p>

        <div style={styles.mapGrid}>
          {maps.map((map) => (
            <div
              key={map.id}
              style={{
                ...styles.mapCard,
                ...(selectedMap === map.id ? styles.mapCardSelected : {}),
              }}
              onClick={() => handleMapSelect(map.id)}
            >
              <div style={styles.mapThumbnail}>{map.thumbnail}</div>
              <div style={styles.mapInfo}>
                <h2 style={styles.mapName}>{map.name}</h2>
                <p style={styles.mapDescription}>{map.description}</p>
              </div>
              {selectedMap === map.id && (
                <div style={styles.selectedBadge}>TERPILIH</div>
              )}
            </div>
          ))}
        </div>

        <div style={styles.buttonGroup}>
          <button style={styles.startButton} onClick={handleStartGame}>
            MULAI GAME
          </button>
          <button style={styles.backButton} onClick={handleBackToDashboard}>
            KEMBALI KE DASHBOARD
          </button>
        </div>

        {/* EEG pill toggle button */}
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
          <button
            style={styles.eegToggleBtn}
            onClick={() => setShowEEGGuide((v) => !v)}
          >
            🧠 Punya Muse 2? Setup EEG Server &nbsp;↗
          </button>
        </div>

        {/* EEG Setup Guide floating overlay */}
        {showEEGGuide && (
          <>
            {/* Backdrop */}
            <div
              style={styles.eegBackdrop}
              onClick={() => setShowEEGGuide(false)}
            />
            {/* Floating panel */}
            <div style={styles.eegFloatingPanel}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '0.95rem' }}>🧠 Setup EEG Server (Muse 2)</span>
                <button
                  onClick={() => setShowEEGGuide(false)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                >✕</button>
              </div>

              <p style={{ margin: '0 0 12px', color: '#94a3b8', fontSize: '0.82rem' }}>
                EEG Server berjalan di komputer lokal kamu karena butuh akses hardware Muse 2.
              </p>

              {[
                {
                  num: '1', color: '#38bdf8',
                  title: 'Download EEG Server Package',
                  desc: 'Download package dan extract ke folder mana saja.',
                  action: (
                    <a href={EEG_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" download style={styles.downloadLink}>
                      ⬇ Download EEG Package
                    </a>
                  ),
                },
                {
                  num: '2', color: '#a78bfa',
                  title: 'Jalankan start_eeg.bat',
                  desc: 'Double-click start_eeg.bat. Pastikan Muse 2 nyala & Bluetooth aktif.',
                  action: <code style={styles.codeSnippet}>📂 eeg-server / start_eeg.bat</code>,
                },
                {
                  num: '3', color: '#34d399',
                  title: 'Paste Session ID',
                  desc: 'Copy Session ID dari banner atas game, lalu paste ke terminal EEG.',
                  action: null,
                },
              ].map((step) => (
                <div key={step.num} style={styles.eegStep}>
                  <div style={{ ...styles.eegStepNum, background: step.color + '22', color: step.color, borderColor: step.color + '44' }}>
                    {step.num}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.875rem', marginBottom: '2px' }}>{step.title}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: step.action ? '6px' : 0 }}>{step.desc}</div>
                    {step.action}
                  </div>
                </div>
              ))}

              <div style={styles.eegNote}>
                💡 Tanpa Muse 2, aplikasi tetap jalan normal dengan monitoring kamera saja.
              </div>
            </div>
          </>
        )}

        <div style={styles.controlsHint}>
          <p>Kontrol: K untuk nyalakan mesin | WASD untuk bergerak | SPACE/SHIFT untuk rem | V untuk kamera | C untuk steering</p>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  container: {
    maxWidth: '900px',
    width: '90%',
    padding: '2rem',
    textAlign: 'center',
  },
  title: {
    fontSize: '3rem',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '0.5rem',
    letterSpacing: '0.1em',
    textShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: '2rem',
  },
  mapGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  mapCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    padding: '1.5rem',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden',
  },
  mapCardSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3b82f6',
    boxShadow: '0 0 30px rgba(59, 130, 246, 0.3)',
  },
  mapThumbnail: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  mapInfo: {
    textAlign: 'left',
  },
  mapName: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '0.5rem',
  },
  mapDescription: {
    fontSize: '0.9rem',
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 1.5,
  },
  selectedBadge: {
    position: 'absolute',
    top: '1rem',
    right: '1rem',
    backgroundColor: '#3b82f6',
    color: '#fff',
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    letterSpacing: '0.05em',
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: '1rem',
  },
  startButton: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    padding: '1rem 3rem',
    fontSize: '1.25rem',
    fontWeight: 'bold',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    letterSpacing: '0.1em',
    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)',
  },
  backButton: {
    backgroundColor: 'rgba(107, 114, 128, 0.8)',
    color: '#fff',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    padding: '1rem 2.5rem',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    letterSpacing: '0.05em',
  },
  controlsHint: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
  },
  // ── EEG Setup Overlay ──────────────────────────────────────────────
  eegToggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(139, 92, 246, 0.12)',
    border: '1px solid rgba(139, 92, 246, 0.35)',
    borderRadius: '999px',
    padding: '7px 18px',
    color: '#c4b5fd',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  eegBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(3px)',
    zIndex: 1100,
  },
  eegFloatingPanel: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '420px',
    maxWidth: '92vw',
    background: '#0f172a',
    border: '1px solid rgba(139, 92, 246, 0.35)',
    borderRadius: '16px',
    padding: '20px',
    zIndex: 1101,
    boxShadow: '0 0 60px rgba(139, 92, 246, 0.2), 0 25px 50px rgba(0,0,0,0.6)',
  },
  eegStep: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px',
  },
  eegStepNum: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.8rem',
    flexShrink: 0,
    marginTop: '1px',
  },
  downloadLink: {
    display: 'inline-block',
    background: 'rgba(56, 189, 248, 0.15)',
    border: '1px solid rgba(56, 189, 248, 0.4)',
    borderRadius: '6px',
    padding: '4px 12px',
    color: '#38bdf8',
    fontSize: '0.8rem',
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
  },
  codeSnippet: {
    display: 'inline-block',
    background: 'rgba(167, 139, 250, 0.1)',
    border: '1px solid rgba(167, 139, 250, 0.25)',
    borderRadius: '6px',
    padding: '4px 10px',
    color: '#a78bfa',
    fontSize: '0.78rem',
    fontFamily: 'monospace',
  },
  eegNote: {
    marginTop: '12px',
    padding: '10px 14px',
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: '8px',
    color: '#6ee7b7',
    fontSize: '0.8rem',
    lineHeight: 1.5,
  },
}
