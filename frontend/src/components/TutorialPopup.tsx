import React, { useState } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Brain,
  Camera,
  AlertTriangle,
  Gamepad2,
  Target,
  Package,
  Keyboard,
} from 'lucide-react'
import { useCargoStore } from '../stores/cargoStore'

interface TutorialPopupProps {
  onClose: () => void
  mapType?: string
}

interface TutorialPage {
  icon: React.ReactNode
  title: string
  content: React.ReactNode
  color: string
}

export function TutorialPopup({ onClose, mapType }: TutorialPopupProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const cargoDelivered = useCargoStore((s) => s.delivered)
  const cargoTotal = useCargoStore((s) => s.total)

  const genericPages: TutorialPage[] = [
    {
      icon: <Target size={36} />,
      title: 'Misi: Selesaikan Rute',
      color: '#6366f1',
      content: (
        <div>
          <p style={{ fontSize: '1rem', lineHeight: '1.7', color: '#e2e8f0', marginBottom: '1rem' }}>
            Selamat datang di <strong style={{ color: '#a5b4fc' }}>Fumorive</strong> — Simulasi mengemudi dengan monitoring kelelahan real-time!
          </p>
          <div style={{ background: 'rgba(99, 102, 241, 0.15)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(99, 102, 241, 0.3)', marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 8px', color: '#a5b4fc', fontSize: '0.95rem' }}>🎯 Tujuan Utama</h4>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.6' }}>
              Berkendara melewati semua <strong>checkpoint</strong> yang ditandai di peta hingga rute selesai.
              Setiap checkpoint memiliki penanda berwarna yang harus kamu lewati secara berurutan.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', padding: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🟢</div>
              <div style={{ fontSize: '0.8rem', color: '#6ee7b7' }}>Checkpoint aktif (tujuan)</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(245, 158, 11, 0.1)', borderRadius: '10px', padding: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🟡</div>
              <div style={{ fontSize: '0.8rem', color: '#fcd34d' }}>Checkpoint berikutnya</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(107, 114, 128, 0.1)', borderRadius: '10px', padding: '12px', border: '1px solid rgba(107, 114, 128, 0.2)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>⚪</div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Checkpoint terlewati</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: <Keyboard size={36} />,
      title: 'Kontrol Kendaraan',
      color: '#f59e0b',
      content: (
        <div>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#e2e8f0', marginBottom: '1rem' }}>
            Gunakan keyboard untuk mengendalikan kendaraan:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
            {[
              { key: 'W / ↑', desc: 'Gas / Maju', color: '#10b981' },
              { key: 'S / ↓', desc: 'Rem / Mundur', color: '#ef4444' },
              { key: 'A / ←', desc: 'Belok Kiri', color: '#3b82f6' },
              { key: 'D / →', desc: 'Belok Kanan', color: '#3b82f6' },
              { key: 'SHIFT', desc: 'Handbrake / Drift', color: '#f59e0b' },
              { key: 'ESC', desc: 'Pause Game', color: '#6b7280' },
            ].map((ctrl) => (
              <div
                key={ctrl.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <kbd
                  style={{
                    background: ctrl.color,
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    minWidth: '60px',
                    textAlign: 'center',
                    boxShadow: `0 2px 6px ${ctrl.color}40`,
                  }}
                >
                  {ctrl.key}
                </kbd>
                <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{ctrl.desc}</span>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderRadius: '10px', padding: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <p style={{ margin: 0, color: '#fcd34d', fontSize: '0.85rem' }}>
              💡 <strong>Tip:</strong> Patuhi rambu lalu lintas dan batas kecepatan. Pelanggaran akan dicatat dan mempengaruhi skor akhir!
            </p>
          </div>
        </div>
      ),
    },
    {
      icon: <Brain size={36} />,
      title: 'EEG Monitoring (Muse 2)',
      color: '#8b5cf6',
      content: (
        <div>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#e2e8f0', marginBottom: '1rem' }}>
            Punya headset <strong style={{ color: '#c4b5fd' }}>Muse 2 EEG</strong>? Sambungkan untuk monitoring aktivitas otak real-time.
            Tanpanya, app tetap jalan normal dengan monitoring kamera saja.
          </p>

          {/* 3-step setup */}
          <div style={{ display: 'grid', gap: '8px', marginBottom: '1rem' }}>
            {[
              { num: '1', color: '#38bdf8', text: 'Download EEG Package dari Dashboard → "Setup Muse 2"' },
              { num: '2', color: '#a78bfa', text: 'Double-click start_eeg.bat — pastikan Muse 2 & Bluetooth aktif' },
              { num: '3', color: '#34d399', text: 'Copy Session ID dari banner atas, paste ke terminal EEG' },
            ].map((s) => (
              <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: s.color + '25', color: s.color, border: `1px solid ${s.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', flexShrink: 0 }}>{s.num}</span>
                <span style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.5 }}>{s.text}</span>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(139, 92, 246, 0.12)', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(139, 92, 246, 0.25)', marginBottom: '10px' }}>
            <h4 style={{ margin: '0 0 6px', color: '#c4b5fd', fontSize: '0.88rem' }}>🧠 Gelombang Otak yang Dianalisis</h4>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['Delta (tidur)', 'Theta (ngantuk)', 'Alpha (rileks)', 'Beta (fokus)', 'Gamma (alert)'].map((band) => (
                <span key={band} style={{ background: 'rgba(255,255,255,0.08)', padding: '3px 9px', borderRadius: '6px', fontSize: '0.76rem', color: '#e2e8f0' }}>
                  {band}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px', padding: '10px 12px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <p style={{ margin: 0, color: '#7dd3fc', fontSize: '0.83rem' }}>
              💡 Panduan lengkap download & setup ada di halaman <strong>Pilih Map</strong> sebelum bermain.
            </p>
          </div>
        </div>
      ),
    },
    {
      icon: <Camera size={36} />,
      title: 'Face Recognition & Kamera',
      color: '#06b6d4',
      content: (
        <div>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#e2e8f0', marginBottom: '1rem' }}>
            Kamera akan memantau wajah kamu untuk mendeteksi tanda-tanda kelelahan secara visual.
          </p>
          <div style={{ display: 'grid', gap: '10px', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(6, 182, 212, 0.12)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
              <h4 style={{ margin: '0 0 6px', color: '#67e8f9', fontSize: '0.9rem' }}>👁️ Yang Dideteksi</h4>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.7' }}>
                <li><strong>Eye Aspect Ratio (EAR)</strong> — Mendeteksi mata menutup / mengedip</li>
                <li><strong>Yawn Detection</strong> — Mendeteksi menguap</li>
                <li><strong>Head Pose</strong> — Posisi kepala (menunduk = ngantuk)</li>
                <li><strong>Blink Rate</strong> — Frekuensi kedipan mata per menit</li>
              </ul>
            </div>
            <div style={{ background: 'rgba(6, 182, 212, 0.12)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
              <h4 style={{ margin: '0 0 6px', color: '#67e8f9', fontSize: '0.9rem' }}>🔒 Privasi</h4>
              <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.6' }}>
                Pemrosesan dilakukan langsung di browser (on-device). Video <strong>tidak</strong> dikirim ke server. Kamu bisa aktifkan/nonaktifkan kamera kapan saja.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: <AlertTriangle size={36} />,
      title: 'Sistem Peringatan & Skor',
      color: '#ef4444',
      content: (
        <div>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#e2e8f0', marginBottom: '1rem' }}>
            Sistem akan memberikan peringatan otomatis saat mendeteksi kelelahan dari gabungan data EEG dan kamera.
          </p>
          <div style={{ display: 'grid', gap: '10px', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
              <h4 style={{ margin: '0 0 8px', color: '#fca5a5', fontSize: '0.9rem' }}>⚠️ Jenis Alert</h4>
              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                {[
                  { level: 'INFO', color: '#3b82f6', desc: 'Tanda awal kelelahan ringan' },
                  { level: 'WARNING', color: '#f59e0b', desc: 'Penurunan konsentrasi terdeteksi' },
                  { level: 'CRITICAL', color: '#ef4444', desc: 'Kelelahan berat — segera istirahat!' },
                ].map(({ level, color, desc }) => (
                  <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: color, color: '#fff', padding: '2px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, minWidth: '75px', textAlign: 'center' }}>
                      {level}
                    </span>
                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.12)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <h4 style={{ margin: '0 0 6px', color: '#fcd34d', fontSize: '0.9rem' }}>📋 Fusion Score</h4>
              <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.6' }}>
                Skor kelelahan gabungan dari EEG (otak) + Kamera (wajah). Ditampilkan di kiri bawah layar saat bermain.
              </p>
            </div>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', padding: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <p style={{ margin: 0, color: '#6ee7b7', fontSize: '0.85rem' }}>
              ✅ Setelah melewati semua checkpoint, kamu akan melihat <strong>ringkasan sesi</strong> dengan statistik lengkap performa dan kelelahan.
            </p>
          </div>
        </div>
      ),
    },
  ]

  // =====================================================================
  // KHUSUS forklift-testing — popup MISSION & KONTROL (ADD, DON'T BREAK)
  // =====================================================================
  const forkliftMissionPage: TutorialPage = {
    icon: <Package size={36} />,
    title: 'Misi: Pindahkan Semua Cargo',
    color: '#22c55e',
    content: (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(34, 197, 94, 0.12)',
            borderRadius: '12px',
            padding: '14px 16px',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            marginBottom: '1rem',
          }}
        >
          <span style={{ color: '#86efac', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em' }}>PROGRESS CARGO</span>
          <span style={{ color: '#fff', fontSize: '1.6rem', fontWeight: 800 }}>
            {cargoDelivered} / {cargoTotal}
          </span>
        </div>

        <div
          style={{
            background: 'rgba(34, 197, 94, 0.15)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            marginBottom: '1rem',
          }}
        >
          <h4 style={{ margin: '0 0 8px', color: '#86efac', fontSize: '0.95rem' }}>🎯 Tujuan Utama</h4>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.6' }}>
            Pindahkan seluruh <strong style={{ color: '#86efac' }}>12 cargo</strong> dari area penyimpanan ke area penempatan menggunakan forklift.
          </p>
        </div>

        <h4 style={{ margin: '0 0 10px', color: '#86efac', fontSize: '0.95rem' }}>🛠️ Cara Menyelesaikan</h4>
        <div style={{ display: 'grid', gap: '8px' }}>
          {[
            { n: '1', t: 'Ambil Cargo', d: 'Arahkan forklift ke cargo dan masukkan fork ke bagian bawah cargo.' },
            { n: '2', t: 'Angkat Cargo', d: 'Gunakan T untuk menaikkan fork dan G untuk menurunkannya.' },
            { n: '3', t: 'Atur Posisi Fork', d: 'Gunakan Y untuk tilt maju dan H untuk tilt mundur.' },
            { n: '4', t: 'Bawa Cargo', d: 'Bawa cargo menuju area drop-off.' },
            { n: '5', t: 'Tempatkan Cargo', d: 'Letakkan cargo pada target yang tersedia.' },
            { n: '6', t: 'Selesaikan Misi', d: 'Pindahkan seluruh 12 cargo untuk menyelesaikan misi.' },
          ].map((s) => (
            <div
              key={s.n}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span
                style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#22c55e26', color: '#86efac', border: '1px solid #22c55e55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', flexShrink: 0 }}
              >
                {s.n}
              </span>
              <div>
                <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 700 }}>{s.t}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.5 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(34, 197, 94, 0.1)', borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(34, 197, 94, 0.2)', marginTop: '12px' }}>
          <p style={{ margin: 0, color: '#86efac', fontSize: '0.8rem', lineHeight: 1.6 }}>
            🗺️ <strong>Alur Area:</strong> START / SPAWN → STORAGE AREA → PICKUP → OPERATIONAL → MANEUVER → DROP-OFF AREA → 12 / 12 → MISSION COMPLETE
          </p>
        </div>
      </div>
    ),
  }

  const forkliftControlPage: TutorialPage = {
    icon: <Keyboard size={36} />,
    title: 'Kontrol Kendaraan',
    color: '#f59e0b',
    content: (
      <div>
        <h4 style={{ margin: '0 0 10px', color: '#fcd34d', fontSize: '0.9rem' }}>KONTROL KENDARAAN</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1.2rem' }}>
          {[
            { key: 'W', desc: 'Maju', color: '#10b981' },
            { key: 'S', desc: 'Mundur', color: '#ef4444' },
            { key: 'A', desc: 'Belok Kiri', color: '#3b82f6' },
            { key: 'D', desc: 'Belok Kanan', color: '#3b82f6' },
            { key: 'SPACE', desc: 'Rem', color: '#f59e0b' },
          ].map((ctrl) => (
            <div
              key={ctrl.key}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <kbd style={{ background: ctrl.color, color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'monospace', minWidth: '56px', textAlign: 'center', boxShadow: `0 2px 6px ${ctrl.color}40` }}>
                {ctrl.key}
              </kbd>
              <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{ctrl.desc}</span>
            </div>
          ))}
        </div>

        <h4 style={{ margin: '0 0 10px', color: '#c4b5fd', fontSize: '0.9rem' }}>KONTROL FORKLIFT</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
          {[
            { key: 'T', desc: 'Fork Naik', color: '#8b5cf6' },
            { key: 'G', desc: 'Fork Turun', color: '#8b5cf6' },
            { key: 'Y', desc: 'Tilt Maju', color: '#06b6d4' },
            { key: 'H', desc: 'Tilt Mundur', color: '#06b6d4' },
            { key: 'R', desc: 'Reset Cargo', color: '#ef4444' },
          ].map((ctrl) => (
            <div
              key={ctrl.key}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <kbd style={{ background: ctrl.color, color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'monospace', minWidth: '56px', textAlign: 'center', boxShadow: `0 2px 6px ${ctrl.color}40` }}>
                {ctrl.key}
              </kbd>
              <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{ctrl.desc}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderRadius: '10px', padding: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <p style={{ margin: 0, color: '#fcd34d', fontSize: '0.82rem', lineHeight: 1.6 }}>
            💡 ESC = Pause Game (sistem). Hindari tabrakan — collision menambah <strong>POIN pelanggaran</strong> (sistem existing, bukan reward cargo).
          </p>
        </div>
      </div>
    ),
  }

  const forkliftAlertPage: TutorialPage = {
    icon: <AlertTriangle size={36} />,
    title: 'Sistem Peringatan & Skor',
    color: '#ef4444',
    content: (
      <div>
        <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#e2e8f0', marginBottom: '1rem' }}>
          Sistem akan memberikan peringatan otomatis saat mendeteksi kelelahan dari gabungan data EEG dan kamera.
        </p>
        <div style={{ display: 'grid', gap: '10px', marginBottom: '1rem' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.12)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <h4 style={{ margin: '0 0 8px', color: '#fca5a5', fontSize: '0.9rem' }}>⚠️ Jenis Alert</h4>
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              {[
                { level: 'INFO', color: '#3b82f6', desc: 'Tanda awal kelelahan ringan' },
                { level: 'WARNING', color: '#f59e0b', desc: 'Penurunan konsentrasi terdeteksi' },
                { level: 'CRITICAL', color: '#ef4444', desc: 'Kelelahan berat — segera istirahat!' },
              ].map(({ level, color, desc }) => (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ background: color, color: '#fff', padding: '2px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, minWidth: '75px', textAlign: 'center' }}>
                    {level}
                  </span>
                  <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.12)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
            <h4 style={{ margin: '0 0 6px', color: '#fcd34d', fontSize: '0.9rem' }}>📋 Fusion Score</h4>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.6' }}>
              Skor kelelahan gabungan dari EEG (otak) + Kamera (wajah). Ditampilkan di kiri bawah layar saat bermain.
            </p>
          </div>
        </div>
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', padding: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <p style={{ margin: 0, color: '#6ee7b7', fontSize: '0.85rem' }}>
            ✅ Saat 12/12 cargo terpasang (MISSION COMPLETE), kamu akan melihat <strong>ringkasan sesi</strong> dengan statistik lengkap performa dan kelelahan.
          </p>
        </div>
      </div>
    ),
  }

  const pages: TutorialPage[] =
    mapType === 'forklift-testing'
      ? [forkliftMissionPage, forkliftControlPage, genericPages[2], genericPages[3], forkliftAlertPage]
      : genericPages

  const currentTutorial = pages[currentPage]
  const isLastPage = currentPage === pages.length - 1
  const isFirstPage = currentPage === 0

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          width: '640px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          background: '#0f172a',
          borderRadius: '20px',
          border: `2px solid ${currentTutorial.color}40`,
          boxShadow: `0 0 60px ${currentTutorial.color}20, 0 25px 50px rgba(0,0,0,0.5)`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'border-color 0.3s, box-shadow 0.3s',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: `${currentTutorial.color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: currentTutorial.color,
                border: `1px solid ${currentTutorial.color}40`,
              }}
            >
              {currentTutorial.icon}
            </div>
            <div>
              <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.25rem', fontWeight: 700 }}>
                {currentTutorial.title}
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {currentPage + 1} / {pages.length}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              padding: '8px',
              cursor: 'pointer',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            title="Tutup tutorial"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
              e.currentTarget.style.color = '#fca5a5'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.color = '#94a3b8'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {currentTutorial.content}
        </div>

        {/* Footer - Navigation */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Page dots */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {pages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx)}
                style={{
                  width: idx === currentPage ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: idx === currentPage ? currentTutorial.color : 'rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {!isFirstPage && (
              <button
                onClick={() => setCurrentPage((p) => p - 1)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  cursor: 'pointer',
                  color: '#cbd5e1',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              >
                <ChevronLeft size={16} />
                Kembali
              </button>
            )}
            {isLastPage ? (
              <button
                onClick={onClose}
                style={{
                  background: `linear-gradient(135deg, ${currentTutorial.color}, ${currentTutorial.color}cc)`,
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 24px',
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: `0 4px 16px ${currentTutorial.color}40`,
                }}
              >
                <Gamepad2 size={18} />
                Mulai Bermain!
              </button>
            ) : (
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                style={{
                  background: currentTutorial.color,
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  boxShadow: `0 4px 12px ${currentTutorial.color}30`,
                }}
              >
                Lanjut
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
