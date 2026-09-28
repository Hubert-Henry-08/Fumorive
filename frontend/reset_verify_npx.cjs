const { chromium } = require('puppeteer-core')

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--window-size=480,270', '--mute-audio'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 480, height: 270 })

  const logs = []
  page.on('console', (m) => {
    const t = m.text()
    if (/DemoScene|AircraftSystem|aircraft|spawn|reset|error/i.test(t)) logs.push('C: ' + t.slice(0, 140))
  })
  page.on('pageerror', (e) => logs.push('PE: ' + e.message))

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle2', timeout: 90000 })
  await page.waitForFunction(
    () => window.__demoScene && window.__demoScene.aircraftSystem && window.__demoScene.airportMap,
    { timeout: 60000 }
  )
  await new Promise((r) => setTimeout(r, 1200))

  const read = () =>
    page.evaluate(() => {
      const s = window.__demoScene.aircraftSystem
      const p = s.getPosition()
      return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) }
    })

  const initial = await read()
  console.log('INITIAL ' + JSON.stringify(initial))

  // Fly away to get off the spawn point (taxi + takeoff)
  await page.keyboard.down('Shift')
  await page.keyboard.press('k')
  await new Promise((r) => setTimeout(r, 700))
  await page.keyboard.down('ArrowDown')
  await new Promise((r) => setTimeout(r, 5000))
  await page.keyboard.up('ArrowDown')
  await page.keyboard.up('Shift')
  const before = await read()
  console.log('BEFORE-RESET ' + JSON.stringify(before))

  // Press R (reset)
  await page.keyboard.press('r')
  await new Promise((r) => setTimeout(r, 900))
  const after = await read()
  console.log('AFTER-RESET ' + JSON.stringify(after))

  const zOk = Math.abs(after.z - -200) < 40
  const xOk = Math.abs(after.x) < 65
  const yLevel = Math.abs(after.y - 0) < 6
  console.log('RESET.RUNWAY_Z=' + zOk)
  console.log('RESET.RUNWAY_X=' + xOk)
  console.log('RESET.LEVEL_Y=' + yLevel)
  console.log('RESET.TOTAL=' + (zOk && xOk && yLevel))

  await page.screenshot({ path: 'C:/Users/widja/AppData/Local/Temp/opencode/shots/reset_fix_runway.png' })
  await browser.close()
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
