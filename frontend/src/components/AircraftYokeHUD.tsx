import { useAircraftStore } from '../stores/aircraftStore'
import './AircraftYokeHUD.css'

export function AircraftYokeHUD() {
  const { pitch, roll } = useAircraftStore()

  // Pitch moves the horizon up/down. Roll rotates the horizon.
  // We'll limit pitch visual range to roughly +/- 45 degrees for standard HUD size
  const pitchOffset = Math.max(-45, Math.min(45, pitch)) * 2 // 2px per degree

  return (
    <div className="aircraft-yoke-hud">
      <div className="attitude-indicator">
        <div 
          className="horizon"
          style={{
            transform: `rotate(${-roll}deg) translateY(${pitchOffset}px)`
          }}
        >
          <div className="sky"></div>
          <div className="ground"></div>
          
          {/* Pitch lines */}
          <div className="pitch-lines">
            <div className="pitch-line" style={{ top: '20px' }}>20</div>
            <div className="pitch-line" style={{ top: '40px' }}>10</div>
            <div className="pitch-line zero" style={{ top: '60px' }}></div>
            <div className="pitch-line" style={{ top: '80px' }}>-10</div>
            <div className="pitch-line" style={{ top: '100px' }}>-20</div>
          </div>
        </div>

        {/* Static airplane reticle */}
        <div className="aircraft-reticle">
          <div className="reticle-wing left"></div>
          <div className="reticle-center"></div>
          <div className="reticle-wing right"></div>
        </div>
      </div>
    </div>
  )
}
