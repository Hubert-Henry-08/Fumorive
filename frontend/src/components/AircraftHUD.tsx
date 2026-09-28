import { useAircraftStore } from '../stores/aircraftStore'
import './AircraftHUD.css'

export function AircraftHUD() {
  const { speed, altitude, throttle, engineRunning, isAirborne, pitch, roll, yaw } = useAircraftStore()

  return (
    <div className="aircraft-hud">
      <div className="aircraft-hud-panel">
        <div className="hud-row">
          <div className="hud-label">SPD</div>
          <div className="hud-value">{Math.round(speed)} <span className="hud-unit">km/h</span></div>
        </div>
        <div className="hud-row">
          <div className="hud-label">ALT</div>
          <div className="hud-value">{altitude.toFixed(1)} <span className="hud-unit">m</span></div>
        </div>
        <div className="hud-row">
          <div className="hud-label">THR</div>
          <div className="hud-value">{Math.round(throttle * 100)} <span className="hud-unit">%</span></div>
        </div>
        
        <div className="hud-divider" />
        
        <div className="hud-row">
          <div className="hud-label">PITCH</div>
          <div className="hud-value">{pitch.toFixed(1)}°</div>
        </div>
        <div className="hud-row">
          <div className="hud-label">ROLL</div>
          <div className="hud-value">{roll.toFixed(1)}°</div>
        </div>
        <div className="hud-row">
          <div className="hud-label">HDG</div>
          <div className="hud-value">{Math.round(yaw % 360)}°</div>
        </div>

        <div className="hud-divider" />

        <div className="hud-status">
          <div className={`status-indicator ${engineRunning ? 'active' : 'inactive'}`}>
            ENG {engineRunning ? 'ON' : 'OFF'}
          </div>
          <div className={`status-indicator ${isAirborne ? 'active' : 'inactive'}`}>
            {isAirborne ? 'AIRBORNE' : 'GROUND'}
          </div>
        </div>
      </div>
    </div>
  )
}
