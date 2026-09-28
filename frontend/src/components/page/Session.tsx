// src/pages/Session.tsx
import { useState, useEffect } from 'react'
import { GameCanvas } from '../GameCanvas'
import { LoadingScreen } from '../LoadingScreen'
import { DebugOverlay } from '../DebugOverlay'
import { GraphicsSettings } from '../GraphicsSettings'
import { ControlsHUD } from '../ControlsHUD'
import { SteeringWheelHUD } from '../SteeringWheelHUD'
import { SpeedometerHUD } from '../SpeedometerHUD'
import { DriftMeter } from '../DriftMeter'
import { MapSelection } from '../MapSelection'
import { CameraFatigueMonitor } from '../CameraFatigueMonitor'
import { EEGMonitoringWidget } from '../EEGMonitoringWidget'
import { AlertNotification } from '../AlertNotification'
import { FusionScoreDisplay } from '../FusionScoreDisplay'
import { ViolationHUD } from '../ViolationHUD'
import { WrongWayWarning } from '../WrongWayWarning'
import { GearHUD } from '../GearHUD'
import { WaypointHUD } from '../WaypointHUD'
import { ForkliftCargoHUD } from '../ForkliftCargoHUD'
import { AircraftHUD } from '../AircraftHUD'
import { AircraftYokeHUD } from '../AircraftYokeHUD'
import { TutorialPopup } from '../TutorialPopup'
import { useGameStore } from '../../stores/gameStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useWaypointStore } from '../../stores/waypointStore'
import { useViolationStore } from '../../stores/violationStore'
import { Copy, Check } from 'lucide-react'
import '../../App.css'

export default function Session() {
  const { gameState, setGameState } = useGameStore()
  const { sessionId, initializeSession } = useSessionStore()
  const selectedMap = useGameStore((s) => s.selectedMap)
  const [showSettings, setShowSettings] = useState(false)
  const [showMapSelection, setShowMapSelection] = useState(true)
  const [gameStarted, setGameStarted] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [cameraFatigueScore, setCameraFatigueScore] = useState(0)
  const [eegEnabled, setEegEnabled] = useState(true)
  const [eegCognitiveState, setEegCognitiveState] = useState<'alert' | 'drowsy' | 'fatigued' | undefined>()
  const [sessionCopied, setSessionCopied] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)

  // Initialize session on mount
  useEffect(() => {
    initializeSession()
  }, [initializeSession])

  const handleStartGame = () => {
    setShowMapSelection(false)
    setGameStarted(true)
    setShowTutorial(true)
    // Reset pelanggaran setiap mulai sesi baru
    useViolationStore.getState().resetViolations()
  }

  const handleBackToMapSelect = () => {
    setShowMapSelection(true)
    setGameStarted(false)
    setGameState('loading')
    useWaypointStore.getState().resetWaypoints()
    useViolationStore.getState().resetViolations()
  }

  return (
    <div className="app">
      {/* Session ID Banner - always visible when session exists */}
      {sessionId && gameStarted && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          borderRadius: '0 0 12px 12px',
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderTop: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>SESSION ID:</span>
          <code style={{
            fontSize: '12px',
            color: '#38bdf8',
            fontFamily: 'monospace',
            userSelect: 'all',
            cursor: 'text',
            letterSpacing: '0.3px',
          }}>
            {sessionId}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(sessionId)
              setSessionCopied(true)
              setTimeout(() => setSessionCopied(false), 2000)
            }}
            style={{
              background: sessionCopied ? '#059669' : '#334155',
              border: '1px solid ' + (sessionCopied ? '#10b981' : '#475569'),
              borderRadius: '6px',
              padding: '3px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'white',
              fontSize: '11px',
              transition: 'all 0.2s',
            }}
            title="Copy Session ID untuk paste di terminal EEG"
          >
            {sessionCopied ? <Check size={12} /> : <Copy size={12} />}
            {sessionCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {/* Tutorial Popup - shown when game first starts */}
      {showTutorial && gameStarted && (
        <TutorialPopup onClose={() => setShowTutorial(false)} mapType={selectedMap} />
      )}

      {/* Global Alert Notifications - always active when game started */}
      {gameStarted && <AlertNotification />}

      {/* Map Selection Screen - shown before game starts */}
      {showMapSelection && (
        <MapSelection onStartGame={handleStartGame} />
      )}

      {/* Game Canvas - only render when game started */}
      {gameStarted && <GameCanvas />}
      
      {/* Loading Screen - only show after map selection, during game load */}
      {gameStarted && <LoadingScreen />}
      
      <DebugOverlay />

      {gameState === 'paused' && gameStarted && (
        <div className="pause-menu">
          <div className="pause-content">
            <h2>PAUSED</h2>
            <button
              className="menu-button"
              onClick={() => setGameState('playing')}
            >
              Resume
            </button>
            <button
              className="menu-button"
              onClick={() => setShowSettings(true)}
            >
              Settings
            </button>
            <button
              className="menu-button"
              onClick={handleBackToMapSelect}
              style={{ marginTop: '1rem', backgroundColor: '#6b7280' }}
            >
              Ganti Map
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <GraphicsSettings onClose={() => setShowSettings(false)} />
      )}

      {gameState === 'playing' && gameStarted && (
        <>
          {/* Controls HUD - shows current control mode and key bindings */}
          <ControlsHUD />
          
          {selectedMap === 'pesawat-testing' ? (
            <>
              {/* Aircraft specific HUDs */}
              <AircraftHUD />
              <AircraftYokeHUD />
            </>
          ) : (
            <>
              {/* Car specific HUDs */}
              <SpeedometerHUD />
              <GearHUD />
              <DriftMeter />
              <SteeringWheelHUD />
            </>
          )}

          {selectedMap !== 'pesawat-testing' && (
            <>
              {/* Violation tracker - next to speedometer */}
              <ViolationHUD />

              {/* Wrong-way warning overlay */}
              <WrongWayWarning />
            </>
          )}

          {/* Waypoint/Checkpoint navigation HUD - shown for all maps */}
          <WaypointHUD />

          {/* Cargo delivery progress & MISSION COMPLETE (khusus forklift-testing) */}
          {selectedMap === 'forklift-testing' && <ForkliftCargoHUD />}

          {/* Camera Fatigue Monitor - bottom right corner */}
          <CameraFatigueMonitor 
            isEnabled={cameraEnabled}
            onToggle={() => setCameraEnabled(!cameraEnabled)}
            onFatigueScoreChange={setCameraFatigueScore}
          />

          {/* EEG Monitoring Widget - top right corner */}
          {eegEnabled && (
            <EEGMonitoringWidget
              sessionId={sessionId}
              defaultPosition="top-right"
              onStateChange={setEegCognitiveState}
            />
          )}

          {/* Multimodal Fusion Score — bottom left */}
          <FusionScoreDisplay cameraFatigueScore={cameraFatigueScore} />
        </>
      )}

      {/* Show camera toggle button when game started but not playing */}
      {gameStarted && gameState !== 'playing' && (
        <CameraFatigueMonitor 
          isEnabled={cameraEnabled}
          onToggle={() => setCameraEnabled(!cameraEnabled)}
          onFatigueScoreChange={setCameraFatigueScore}
        />
      )}
    </div>
  )
}
