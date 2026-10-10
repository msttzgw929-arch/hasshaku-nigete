// Screenshots at several belly levels and wobble phases while walking: node tools/verify_belly.js
const puppeteer = require('puppeteer-core');
const PORT = process.env.PORT || 8932;
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction('window.__ready === true', { timeout: 90000 });
  await p.click('#startBtn'); await new Promise(r => setTimeout(r, 1500));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (const lvl of [1, 3, 6, 10]) {
    await p.evaluate((lvl) => { const d = window.__dbg; while (d.H.stage < lvl - 1) d.stageUp(); d.H.state = 'grow'; d.H.stateT = 0.01; }, lvl);
    await sleep(3500);
    for (let k = 0; k < 3; k++) {
      await p.evaluate(() => { const { H, player } = window.__dbg; player.inv = 99; const R = 0.92 * 340 / 1254 * H.height * H.bodyS * H.bellyS; H.pos.set(player.pos.x, 0, player.pos.z - (14 + R * 2.6)); H.state = 'chase'; H.vel.set(0, 0, 3); player.yaw = 0; player.pitch = 0.18 + Math.min(0.35, H.stage * 0.03); });
      await sleep(400 + k * 230);
      if (k === 2) await p.evaluate(() => { const J = window.__dbg.H.jig; J.vy += 2.5; J.vx += 2.2; J.rip = 1.5; });
      await sleep(k === 2 ? 90 : 0);
      const info = await p.evaluate(() => { const { H } = window.__dbg; return { st: H.stage + 1, jy: +H.jig.y.toFixed(3), jx: +H.jig.x.toFixed(3), walk: +H.walk.toFixed(2), belly: +H.bellyS.toFixed(2) }; });
      const f = `shots/belly_L${lvl}_${k}.png`; await p.screenshot({ path: f }); console.log(f, JSON.stringify(info));
    }
  }
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none'); await b.close();
})();
