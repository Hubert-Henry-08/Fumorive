import { useEffect, useState } from 'react'
import { useGameStore } from '../stores/gameStore'

// Helper function to get camera mode display name
function getCameraModeDisplay(mode: string): string {
  switch (mode) {
    case 'third-person':
      return '3rd Person'
    case 'first-person':
      return '1st Person'
    case 'free':
      return 'Free'
    default:
      return mode
  }
}

export function ControlsHUD() {
  const { controlMode, cameraMode, engineRunning, transmissionMode, currentGear, selectedMap } = useGameStore()
  const [isVisible, setIsVisible] = useState(true)
  const [wheelConnected, setWheelConnected] = useState(false)
  const [wheelSupported, setWheelSupported] = useState(false)
  const [showWheelSettings, setShowWheelSettings] = useState(false)
  const [calibrationMessage, setCalibrationMessage] = useState('')
  
  const isAircraft = selectedMap === 'pesawat-testing'

  // Gamepad connection is intentionally polled: browsers only expose devices after interaction.
  useEffect(() => {
    const check = () => {
      const supported = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'
      setWheelSupported(supported)
      setWheelConnected(supported && Array.from(navigator.getGamepads()).some(Boolean))
    }
    check()
    const timer = window.setInterval(check, 800)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const result = (event: Event) => {
      const detail = (event as CustomEvent<{ kind: string; captured: boolean }>).detail
      setCalibrationMessage(detail?.captured ? `Posisi pedal ${detail.kind === 'throttle' ? 'gas' : 'rem'} lepas tersimpan. Sekarang tahan penuh lalu klik Deteksi.` : 'Controller belum terdeteksi.')
    }
    window.addEventListener('fumorive:wheel-rest-captured', result)
    return () => window.removeEventListener('fumorive:wheel-rest-captured', result)
  }, [])

  useEffect(() => {
    const result = (event: Event) => {
      const detail = (event as CustomEvent<{ kind: string; detected: boolean }>).detail
      setCalibrationMessage(detail?.detected ? `Axis ${detail.kind === 'throttle' ? 'gas' : 'rem'} tersimpan.` : 'Axis belum terdeteksi. Tahan pedal penuh lalu coba lagi.')
    }
    window.addEventListener('fumorive:wheel-calibration-result', result)
    return () => window.removeEventListener('fumorive:wheel-calibration-result', result)
  }, [])

  const selectMode = (mode: 'keyboard' | 'mouse' | 'wheel') => window.dispatchEvent(new CustomEvent('fumorive:control-mode', { detail: { mode } }))
  const saveWheelSettings = (settings: Record<string, unknown>) => window.dispatchEvent(new CustomEvent('fumorive:wheel-settings', { detail: settings }))
  const detectPedal = (kind: 'throttle' | 'brake') => window.dispatchEvent(new CustomEvent('fumorive:wheel-detect-pedal', { detail: { kind } }))
  const capturePedalRest = (kind: 'throttle' | 'brake') => window.dispatchEvent(new CustomEvent('fumorive:wheel-capture-rest', { detail: { kind } }))
  const wheelButtonFields = [['engine', 'Mesin (L1)', 4], ['camera', 'Kamera (R1)', 5], ['horn', 'Klakson (L2)', 6], ['dropCargo', 'Drop box (R2)', 7], ['forkUp', 'Fork naik (△)', 3], ['forkDown', 'Fork turun (□)', 2], ['tiltBackward', 'Tilt naik (○)', 1], ['tiltForward', 'Tilt turun (×)', 0]] as const

return (
    <div style={{
      ...styles.wrapper,
      transform: isVisible ? 'translateX(0)' : 'translateX(calc(100% - 24px))',
    }}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        style={styles.toggleButton}
        title={isVisible ? 'Hide Controls' : 'Show Controls'}
      >
        {isVisible ? '›' : '‹'}
      </button>
      
      <div style={styles.container}>
      {/* Engine Status Indicator */}
      <div style={styles.modeSection}>
        <div style={styles.modeLabel}>ENGINE</div>
        <div style={styles.modeValue}>
          <span style={engineRunning ? styles.engineOn : styles.engineOff}>
            {engineRunning ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {isAircraft ? (
        // Aircraft-specific controls
        <>
          <div style={styles.divider} />
          <div style={styles.controlsSection}>
            <div style={styles.sectionTitle}>AIRCRAFT CONTROLS</div>
            <div style={styles.controlGroup}>
              <div style={styles.controlRow}>
                <span style={styles.keyBadgeEngine}>K</span>
                <span style={styles.controlDesc}>Engine Start/Stop</span>
              </div>
              <div style={styles.controlRow}>
                <span style={styles.keyBadge}>SHIFT</span>
                <span style={styles.controlDesc}>Throttle Up</span>
              </div>
              <div style={styles.controlRow}>
                <span style={styles.keyBadge}>CTRL</span>
                <span style={styles.controlDesc}>Throttle Down</span>
              </div>
              <div style={styles.controlRow}>
                <span style={styles.keyBadge}>↑</span>
                <span style={styles.controlDesc}>Pitch Down (Nose Down)</span>
              </div>
              <div style={styles.controlRow}>
                <span style={styles.keyBadge}>↓</span>
                <span style={styles.controlDesc}>Pitch Up (Nose Up)</span>
              </div>
              <div style={styles.controlRow}>
                <span style={styles.keyBadge}>←</span>
                <span style={styles.controlDesc}>Roll Left</span>
              </div>
              <div style={styles.controlRow}>
                <span style={styles.keyBadge}>→</span>
                <span style={styles.controlDesc}>Roll Right</span>
              </div>
              <div style={styles.controlRow}>
                <span style={styles.keyBadge}>Q</span>
                <span style={styles.controlDesc}>Yaw Left (Rudder)</span>
              </div>
              <div style={styles.controlRow}>
                <span style={styles.keyBadge}>E</span>
                <span style={styles.controlDesc}>Yaw Right (Rudder)</span>
              </div>
              <div style={styles.controlRow}>
                <span style={styles.keyBadge}>SPACE</span>
                <span style={styles.controlDesc}>Brake</span>
              </div>
            </div>
          </div>

          <div style={styles.divider} />
          <div style={styles.controlsSection}>
            <div style={styles.sectionTitle}>CAMERA</div>
            <div style={styles.controlRow}>
              <span style={styles.keyBadgeHighlight}>V</span>
              <span style={styles.controlDesc}>Toggle Chase/Cockpit</span>
            </div>
          </div>

          <div style={styles.divider} />
          <div style={styles.controlsSection}>
            <div style={styles.sectionTitle}>UTILITY</div>
            <div style={styles.controlGroup}>
              <div style={styles.controlRow}>
                <span style={styles.keyBadgeHighlight}>R</span>
                <span style={styles.controlDesc}>Reset Aircraft</span>
              </div>
            </div>
          </div>
</>
      ) : (
        // Car-specific controls
        <>
          {/* Control Mode Indicator */}
          <div style={styles.modeSection}>
            <div style={styles.modeLabel}>STEERING</div>
            <div style={styles.modeValue}>
              {controlMode === 'keyboard' ? (
                <span style={styles.keyboardMode}>KEYBOARD</span>
              ) : controlMode === 'mouse' ? (
                <span style={styles.mouseMode}>MOUSE</span>
              ) : controlMode === 'wheel' ? (
                <div style={styles.controlRow}>
                  <span style={styles.mouseBadge}>Wheel</span>
                  <span style={styles.controlDesc}>Setir dan pedal</span>
                </div>
              ) : (
                <span style={styles.wheelMode}>CONTROLLER</span>
              )}
            </div>
          </div>

          <div style={styles.divider} />
          <div style={styles.controlsSection}>
            <div style={styles.sectionTitle}>INPUT MODE</div>
            <div style={styles.modeButtons}>
              {(['keyboard', 'mouse', 'wheel'] as const).map((mode) => (
                <button key={mode} onClick={() => selectMode(mode)} style={{ ...styles.modeButton, ...(controlMode === mode ? styles.modeButtonActive : {}) }}>
                  {mode === 'wheel' ? 'WHEEL' : mode.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={wheelConnected ? styles.hint : styles.hintWarning}>
              {wheelSupported ? (wheelConnected ? 'Controller terhubung' : 'Controller belum terhubung — keyboard fallback') : 'Browser tidak mendukung Gamepad API'}
            </div>
            <button onClick={() => setShowWheelSettings(!showWheelSettings)} style={styles.settingsButton}>Kalibrasi / Mapping</button>
            {showWheelSettings && (
              <div style={styles.wheelSettings}>
                <label>Dead zone <input type="number" min="0" max="0.5" step="0.01" defaultValue="0.05" onChange={(e) => saveWheelSettings({ deadZone: Number(e.target.value) })} /></label>
                <label>Axis setir <input type="number" min="0" defaultValue="0" onChange={(e) => saveWheelSettings({ steeringAxis: Number(e.target.value) })} /></label>
                <label>Axis gas <input type="number" min="0" defaultValue="1" onChange={(e) => saveWheelSettings({ throttleAxis: Number(e.target.value) })} /></label>
                <label>Axis rem <input type="number" min="0" defaultValue="2" onChange={(e) => saveWheelSettings({ brakeAxis: Number(e.target.value) })} /></label>
                <button type="button" onClick={() => capturePedalRest('throttle')} style={styles.settingsButton}>1. Lepas gas: Simpan posisi diam</button>
                <button type="button" onClick={() => detectPedal('throttle')} style={styles.settingsButton}>2. Tahan gas: Deteksi Gas</button>
                <button type="button" onClick={() => capturePedalRest('brake')} style={styles.settingsButton}>1. Lepas rem: Simpan posisi diam</button>
                <button type="button" onClick={() => detectPedal('brake')} style={styles.settingsButton}>2. Tahan rem: Deteksi Rem</button>
                {calibrationMessage && <small>{calibrationMessage}</small>}
                <div>Nomor tombol:</div>
                {wheelButtonFields.map(([action, label, defaultButton]) => <label key={action}>{label} <input type="number" min="0" defaultValue={defaultButton} onChange={(e) => saveWheelSettings({ buttons: { [action]: Number(e.target.value) } })} /></label>)}
                <small>Nomor axis berbeda tiap controller. Cek dengan kalibrasi Windows (`joy.cpl`). Mapping tombol tersimpan per browser.</small>
              </div>
            )}
          </div>

          {/* Camera Mode Indicator */}
          <div style={styles.modeSection}>
            <div style={styles.modeLabel}>CAMERA</div>
            <div style={styles.modeValue}>
              <span style={cameraMode === 'free' ? styles.freeMode : styles.cameraMode}>
                {getCameraModeDisplay(cameraMode).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Transmission Mode Indicator */}
          <div style={styles.modeSection}>
            <div style={styles.modeLabel}>TRANSMISI</div>
            <div style={styles.modeValue}>
              <span style={transmissionMode === 'automatic' ? styles.autoMode : styles.manualMode}>
                {transmissionMode === 'automatic' ? 'AUTO' : 'MANUAL'}
              </span>
            </div>
          </div>
        </>
      )}

      {!isAircraft && (
        <>
          <div style={styles.divider} />

          {/* Controls Guide */}
          <div style={styles.controlsSection}>
            <div style={styles.sectionTitle}>CONTROLS</div>
            
            {/* Movement */}
            <div style={styles.controlGroup}>
              <div style={styles.controlRow}>
                <span style={styles.keyBadge}>W</span>
                <span style={styles.controlDesc}>
                  {transmissionMode === 'manual' && currentGear === -1 ? 'Mundur (R)' : 'Maju'}
                </span>
              </div>
              <div style={styles.controlRow}>
                <span style={styles.keyBadge}>S</span>
                <span style={styles.controlDesc}>
                  {transmissionMode === 'manual' ? 'Rem' : 'Mundur / Rem'}
                </span>
              </div>
            </div>

            {/* Steering */}
            <div style={styles.controlGroup}>
              {controlMode === 'keyboard' ? (
                <>
                  <div style={styles.controlRow}>
                    <span style={styles.keyBadge}>A</span>
                    <span style={styles.controlDesc}>Belok Kiri</span>
                  </div>
                  <div style={styles.controlRow}>
                    <span style={styles.keyBadge}>D</span>
                    <span style={styles.controlDesc}>Belok Kanan</span>
                  </div>
                </>
              ) : (
                <div style={styles.controlRow}>
                  <span style={styles.mouseBadge}>Mouse</span>
                  <span style={styles.controlDesc}>Geser untuk belok</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={styles.controlGroup}>
              <div style={styles.controlRow}>
                <span style={styles.keyBadge}>SPACE</span>
                <span style={styles.controlDesc}>Rem</span>
              </div>
              <div style={styles.controlRow}>
                <span style={styles.keyBadge}>SHIFT</span>
                <span style={styles.controlDesc}>Klakson</span>
              </div>
            </div>
          </div>

          <div style={styles.divider} />

          {/* Toggle Keys */}
          <div style={styles.toggleSection}>
            <div style={styles.sectionTitle}>TOGGLE</div>
            <div style={styles.controlRow}>
              <span style={styles.keyBadgeEngine}>K</span>
              <span style={styles.controlDesc}>Start/Stop Engine</span>
            </div>
            <div style={styles.controlRow}>
              <span style={styles.keyBadgeHighlight}>C</span>
              <span style={styles.controlDesc}>Ganti Mode Steering</span>
            </div>
            <div style={styles.controlRow}>
              <span style={styles.keyBadge}>V</span>
              <span style={styles.controlDesc}>Ganti Kamera</span>
            </div>
            <div style={styles.controlRow}>
              <span style={styles.keyBadgeGear}>X</span>
              <span style={styles.controlDesc}>Ganti Transmisi (A/M)</span>
            </div>
            {selectedMap === 'forklift-testing' && (
              <>
                <div style={styles.divider} />
                <div style={styles.controlsSection}>
                  <div style={styles.sectionTitle}>FORKLIFT</div>
                  <div style={styles.controlGroup}>
                    <div style={styles.controlRow}>
                      <span style={styles.keyBadgeHighlight}>T</span>
                      <span style={styles.controlDesc}>Fork Naik</span>
                    </div>
                    <div style={styles.controlRow}>
                      <span style={styles.keyBadgeHighlight}>G</span>
                      <span style={styles.controlDesc}>Fork Turun</span>
                    </div>
                    <div style={styles.controlRow}>
                      <span style={styles.keyBadgeHighlight}>Y</span>
                      <span style={styles.controlDesc}>Tilt Maju</span>
                    </div>
                    <div style={styles.controlRow}>
                      <span style={styles.keyBadgeHighlight}>H</span>
                      <span style={styles.controlDesc}>Tilt Mundur</span>
                    </div>
                  </div>
                </div>
              </>
            )}
            {selectedMap === 'forklift-testing' && (
              <div style={styles.controlRow}>
                <span style={styles.keyBadgeHighlight}>R</span>
                <span style={styles.controlDesc}>Reset Cargo Test</span>
              </div>
            )}
          </div>

          {/* Manual gear controls */}
          {transmissionMode === 'manual' && (
            <>
              <div style={styles.divider} />
              <div style={styles.controlsSection}>
                <div style={styles.sectionTitle}>GIGI (MANUAL)</div>
                <div style={styles.controlGroup}>
                  <div style={styles.controlRow}>
                    <span style={styles.keyBadgeGear}>E</span>
                    <span style={styles.controlDesc}>Naik Gigi</span>
                  </div>
                  <div style={styles.controlRow}>
                    <span style={styles.keyBadgeGear}>Q</span>
                    <span style={styles.controlDesc}>Turun Gigi</span>
                  </div>
                </div>
                <div style={styles.hint}>
                  R ← N → 1 → 2 → 3 → 4 → 5
                </div>
              </div>
            </>
          )}

          {/* Hints */}
          {controlMode === 'mouse' && cameraMode !== 'free' && (
            <>
              <div style={styles.divider} />
              <div style={styles.hint}>
                Gerakkan mouse ke kiri/kanan untuk steering yang lebih halus
              </div>
            </>
          )}
          
          {cameraMode === 'free' && (
            <>
              <div style={styles.divider} />
              <div style={styles.hint}>
                Mouse untuk kamera. Steering otomatis kembali ke tengah.
              </div>
            </>
          )}

          {!engineRunning && (
            <>
              <div style={styles.divider} />
              <div style={styles.hintWarning}>
                Tekan K untuk menyalakan mesin!
              </div>
            </>
          )}
        </>
      )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'fixed',
    bottom: '1rem',
    right: '1rem',
    display: 'flex',
    alignItems: 'flex-start',
    zIndex: 100,
    transition: 'transform 0.3s ease-in-out',
  },
  toggleButton: {
    width: '24px',
    height: '48px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRight: 'none',
    borderRadius: '8px 0 0 8px',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '1rem',
    backdropFilter: 'blur(10px)',
    transition: 'background-color 0.2s',
  },
  container: {
    padding: '0.75rem 1rem',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '0.75rem',
    color: '#fff',
    backdropFilter: 'blur(10px)',
    minWidth: '180px',
    maxWidth: '220px',
    // The controller mapper can be longer than the gameplay hints. Keep it
    // inside the browser viewport instead of letting it run below the screen.
    maxHeight: 'calc(100vh - 2rem)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  },
  modeSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  modeLabel: {
    fontSize: '0.65rem',
    opacity: 0.6,
    letterSpacing: '0.05em',
  },
  modeValue: {
    fontWeight: 'bold',
  },
  keyboardMode: {
    color: '#60a5fa', // Blue
  },
  mouseMode: {
    color: '#34d399', // Green
  },
  wheelMode: { color: '#fbbf24' },
  modeButtons: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' },
  modeButton: { fontSize: '0.58rem', padding: '4px 5px', borderRadius: '4px', border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.08)', color: '#fff', cursor: 'pointer' },
  modeButtonActive: { background: 'rgba(96,165,250,.35)', borderColor: '#60a5fa' },
  settingsButton: { fontSize: '0.62rem', padding: '3px 0', border: 0, background: 'transparent', color: '#93c5fd', cursor: 'pointer', textDecoration: 'underline' },
  wheelSettings: { display: 'grid', gap: '4px', marginTop: '5px', fontSize: '0.62rem', paddingBottom: '8px' },
  cameraMode: {
    color: '#a78bfa', // Purple
  },
  freeMode: {
    color: '#fbbf24', // Yellow/Orange
  },
  autoMode: {
    color: '#60a5fa', // Blue
  },
  manualMode: {
    color: '#fbbf24', // Yellow
  },
  engineOn: {
    color: '#34d399', // Green
  },
  engineOff: {
    color: '#ef4444', // Red
  },
  divider: {
    height: '1px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    margin: '0.5rem 0',
  },
  controlsSection: {
    marginBottom: '0.25rem',
  },
  sectionTitle: {
    fontSize: '0.6rem',
    opacity: 0.5,
    letterSpacing: '0.1em',
    marginBottom: '0.5rem',
  },
  controlGroup: {
    marginBottom: '0.5rem',
  },
  controlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.25rem',
  },
  keyBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '24px',
    height: '20px',
    padding: '0 6px',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: '4px',
    fontSize: '0.65rem',
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  keyBadgeHighlight: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '24px',
    height: '20px',
    padding: '0 6px',
    backgroundColor: 'rgba(52, 211, 153, 0.3)', // Green highlight
    border: '1px solid rgba(52, 211, 153, 0.5)',
    borderRadius: '4px',
    fontSize: '0.65rem',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#34d399',
  },
  keyBadgeEngine: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '24px',
    height: '20px',
    padding: '0 6px',
    backgroundColor: 'rgba(239, 68, 68, 0.3)', // Red highlight
    border: '1px solid rgba(239, 68, 68, 0.5)',
    borderRadius: '4px',
    fontSize: '0.65rem',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#ef4444',
  },
  keyBadgeGear: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '24px',
    height: '20px',
    padding: '0 6px',
    backgroundColor: 'rgba(251, 191, 36, 0.3)',
    border: '1px solid rgba(251, 191, 36, 0.5)',
    borderRadius: '4px',
    fontSize: '0.65rem',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#fbbf24',
  },
  mouseBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '24px',
    height: '20px',
    padding: '0 8px',
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    border: '1px solid rgba(52, 211, 153, 0.4)',
    borderRadius: '4px',
    fontSize: '0.65rem',
    fontWeight: 'bold',
    color: '#34d399',
  },
  controlDesc: {
    opacity: 0.8,
    fontSize: '0.7rem',
  },
  toggleSection: {},
  hint: {
    fontSize: '0.6rem',
    opacity: 0.5,
    lineHeight: 1.4,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  hintWarning: {
    fontSize: '0.7rem',
    color: '#ef4444',
    lineHeight: 1.4,
    textAlign: 'center',
    fontWeight: 'bold',
  },
}
