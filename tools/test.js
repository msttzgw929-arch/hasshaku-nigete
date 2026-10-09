// headless smoke test + screenshots: node tools/test.js
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto('http://localhost:8931/', { waitUntil: 'load' });
  try { await p.waitForFunction('window.__ready === true', { timeout: 40000 }); } catch (e) { console.log('NOT READY', errs.join('\n'), await p.evaluate(()=>document.getElementById('loading').textContent)); await b.close(); return; }
  await new Promise(r => setTimeout(r, 1500));
  await p.screenshot({ path: 'shots/01_title.png' });
  await p.click('#startBtn');
  await new Promise(r => setTimeout(r, 2500));
  // put her in front of the player at medium distance
  await p.evaluate(() => { const { H, player } = window.__dbg; H.pos.set(player.pos.x, 0, player.pos.z - 16); player.yaw = 0; player.pitch = 0.35; player.inv = 99; });
  await new Promise(r => setTimeout(r, 2500));
  await p.screenshot({ path: 'screenshot.png' });
  await p.evaluate(() => { window.__dbg.stageUp(); window.__dbg.stageUp(); window.__dbg.stageUp(); const { H, player } = window.__dbg; H.pos.set(player.pos.x, 0, player.pos.z - 30); });
  await new Promise(r => setTimeout(r, 5000));
  await p.screenshot({ path: 'shots/03_giant.png' });
  await p.evaluate(() => { const { player } = window.__dbg; player.inv = 0; window.__dbg.catchPlayer(); });
  await new Promise(r => setTimeout(r, 1200));
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 400); await new Promise(r => setTimeout(r, 120)); }
  await p.screenshot({ path: 'shots/04_grab.png' });
  for (let i = 0; i < 30; i++) { await p.keyboard.press('Space'); await new Promise(r => setTimeout(r, 60)); }
  const st = await p.evaluate(() => ({ state: window.__dbg.game.state, hs: window.__dbg.H.state, destroyed: window.__dbg.buildings.filter(b => !b.alive).length, speedCap: window.__dbg.player.speed * 0.65 }));
  console.log('after mash:', JSON.stringify(st));
  await new Promise(r => setTimeout(r, 4000));
  await p.screenshot({ path: 'shots/05_after.png' });
  // speed check at high stage: she must stay <= 65% of player speed
  const sp = await p.evaluate(async () => { const { H, player, stageUp } = window.__dbg; for (let i = 0; i < 6; i++) stageUp(); H.state = 'chase'; player.inv = 99; H.pos.set(player.pos.x, 0, player.pos.z - 60); let mx = 0; for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 100)); H.state = H.state === 'grab' ? 'chase' : H.state; mx = Math.max(mx, H.speed); } return { maxHasshaku: mx, player: player.speed, stage: H.stage + 1 }; });
  console.log('speed:', JSON.stringify(sp));
  await p.evaluate(() => { const { H, player } = window.__dbg; H.pos.set(player.pos.x, 0, player.pos.z - 45); player.yaw = 0; player.pitch = 0.3; });
  await new Promise(r => setTimeout(r, 1500));
  await p.screenshot({ path: 'shots/06_stage10.png' });
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
