/* Session tracker + unified summary generator */
(function () {
  'use strict';

  const TABS = ['guided', 'playground', 'quiz', 'challenge'];

  const fmtDur = ms => {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  };
  const fmtDb    = v => `${v >= 0 ? '+' : ''}${(+v).toFixed(1)} dB`;
  const fmtHz    = v => v == null ? '—' : (v >= 1000 ? `${(+v / 1000).toFixed(2)} kHz` : `${Math.round(v)} Hz`);
  const fmtMs    = v => `${((+v) * 1000).toFixed(0)} ms`;
  const fmtRatio = v => `${(+v).toFixed(1)}:1`;

  const S = {
    startedAt: Date.now(),
    currentTab: null,
    currentTabSince: null,
    tabs: Object.fromEntries(TABS.map(t => [t, {
      visits: 0, totalMs: 0, clicks: 0, sliderMoves: 0,
    }])),

    guided: {
      refresherThreshold: null, refresherRatio: null,
      crossoverLow: null, crossoverHigh: null,
    },

    playground: {
      demosTried: new Set(),
      presetsApplied: [],
      playSessions: 0,
      totalPlayMs: 0,
      lastPlayStart: null,
      bypassToggles: 0,
      soloUsed: false,
      muteUsed: false,
      fileUploaded: null,
    },

    // Populated by other modules at render time
    quizGetState: null,        // () => { correct, chosen[], questions[] }
    challengeGetState: null,   // () => [{ title, brief, questions[], responses[] }]
    playgroundGetState: null,  // () => { xoLow, xoHigh, outputDb, mbc }

    // ---- Tab lifecycle ----
    setTab(name) {
      const now = Date.now();
      if (this.currentTab && this.currentTabSince != null) {
        this.tabs[this.currentTab].totalMs += now - this.currentTabSince;
      }
      if (!this.tabs[name]) return;
      this.currentTab = name;
      this.currentTabSince = now;
      this.tabs[name].visits++;
    },

    attachPanel(name, panelEl) {
      if (!panelEl || !this.tabs[name]) return;
      panelEl.addEventListener('click', e => {
        if (e.target.closest('button, .quiz-option')) this.tabs[name].clicks++;
      }, true);
      panelEl.addEventListener('change', e => {
        const t = e.target;
        if (t && t.tagName === 'INPUT' && t.type === 'range') this.tabs[name].sliderMoves++;
      }, true);
    },

    // ---- Playground hooks ----
    notePlayStart(demoKey) {
      this.playground.demosTried.add(demoKey);
      this.playground.playSessions++;
      this.playground.lastPlayStart = Date.now();
    },
    notePlayStop() {
      if (this.playground.lastPlayStart != null) {
        this.playground.totalPlayMs += Date.now() - this.playground.lastPlayStart;
        this.playground.lastPlayStart = null;
      }
    },
    notePreset(name) { this.playground.presetsApplied.push(name); },
    noteBypass()     { this.playground.bypassToggles++; },
    noteSolo()       { this.playground.soloUsed = true; },
    noteMute()       { this.playground.muteUsed = true; },
    noteFileUpload(n){ this.playground.fileUploaded = n; },

    // ---- Summary ----
    generateSummary() {
      // Tick the currently active tab so its elapsed time is counted
      const now = Date.now();
      if (this.currentTab && this.currentTabSince != null) {
        this.tabs[this.currentTab].totalMs += now - this.currentTabSince;
        this.currentTabSince = now;
      }
      if (this.playground.lastPlayStart != null) {
        this.playground.totalPlayMs += now - this.playground.lastPlayStart;
        this.playground.lastPlayStart = now;
      }

      const lines = [];
      lines.push('═══════════════════════════════════════════════════');
      lines.push('  Multiband Compression — Session Summary');
      lines.push('═══════════════════════════════════════════════════');
      lines.push(`Generated:  ${new Date().toLocaleString()}`);
      lines.push(`Session:    ${fmtDur(now - this.startedAt)} total`);
      lines.push('');

      lines.push('── Activity by tab ──');
      TABS.forEach(t => {
        const s = this.tabs[t];
        lines.push(
          `  ${t.padEnd(11)} visits=${s.visits}, ` +
          `time=${fmtDur(s.totalMs).padStart(6)}, ` +
          `clicks=${s.clicks}, slider moves=${s.sliderMoves}`
        );
      });
      lines.push('');

      // ---- Guided ----
      lines.push('── Guided ──');
      const g = this.guided;
      const refTouched = (g.refresherThreshold != null) || (g.refresherRatio != null);
      if (refTouched) {
        const t = g.refresherThreshold != null ? `${g.refresherThreshold.toFixed(1)} dB` : '(default)';
        const r = g.refresherRatio != null ? fmtRatio(g.refresherRatio) : '(default)';
        lines.push(`  Refresher widget (final): threshold=${t}, ratio=${r}`);
      } else {
        lines.push('  Refresher widget: not adjusted');
      }
      const xoTouched = (g.crossoverLow != null) || (g.crossoverHigh != null);
      if (xoTouched) {
        const lo = g.crossoverLow != null ? fmtHz(g.crossoverLow) : '(default)';
        const hi = g.crossoverHigh != null ? fmtHz(g.crossoverHigh) : '(default)';
        lines.push(`  Crossover widget (final): low/mid=${lo}, mid/high=${hi}`);
      } else {
        lines.push('  Crossover widget: not adjusted');
      }
      lines.push('');

      // ---- Playground ----
      lines.push('── Playground ──');
      const p = this.playground;
      lines.push(`  Demos tried:     ${p.demosTried.size ? Array.from(p.demosTried).join(', ') : '(none)'}`);
      lines.push(`  Play time:       ${fmtDur(p.totalPlayMs)} across ${p.playSessions} session(s)`);
      lines.push(`  Presets applied: ${p.presetsApplied.length ? p.presetsApplied.join(', ') : '(none)'}`);
      lines.push(`  Bypass toggled:  ${p.bypassToggles}x`);
      lines.push(`  Solo used: ${p.soloUsed ? 'yes' : 'no'} | Mute used: ${p.muteUsed ? 'yes' : 'no'}`);
      lines.push(`  File uploaded:   ${p.fileUploaded || '(none)'}`);

      if (this.playgroundGetState) {
        try {
          const pg = this.playgroundGetState();
          lines.push(`  Final crossovers: low/mid=${fmtHz(pg.xoLow)}, mid/high=${fmtHz(pg.xoHigh)}`);
          lines.push(`  Final output gain: ${fmtDb(pg.outputDb)}`);
          if (pg.mbc) {
            for (const band of ['low', 'mid', 'high']) {
              const b = pg.mbc.bands[band];
              const makeupDb = 20 * Math.log10(Math.max(1e-9, b.makeup.gain.value));
              lines.push(
                `    ${band.toUpperCase().padEnd(4)} T=${fmtDb(b.comp.threshold.value)}, ` +
                `R=${fmtRatio(b.comp.ratio.value)}, ` +
                `A=${fmtMs(b.comp.attack.value)}, ` +
                `Rel=${fmtMs(b.comp.release.value)}, ` +
                `Makeup=${fmtDb(makeupDb)}`
              );
            }
          } else {
            lines.push('  Final band state: engine never initialized (no audio played)');
          }
        } catch (e) { lines.push(`  (could not read playground state: ${e.message})`); }
      }
      lines.push('');

      // ---- Quiz ----
      lines.push('── Quiz ──');
      if (this.quizGetState) {
        const qs = this.quizGetState();
        const answered = qs.chosen.filter(c => c != null).length;
        const pct = Math.round(100 * qs.correct / qs.questions.length);
        lines.push(`  Score: ${qs.correct} / ${qs.questions.length} (${pct}%)`);
        lines.push(`  Answered: ${answered} / ${qs.questions.length}`);
        lines.push('');
        qs.questions.forEach((q, i) => {
          const chosen = qs.chosen[i];
          let status;
          if (chosen == null) status = 'unanswered';
          else if (chosen === q.correct) status = 'CORRECT';
          else status = 'wrong';
          lines.push(`  ${i + 1}. ${q.q}`);
          lines.push(`     Your answer:   ${chosen != null ? q.options[chosen] : '(skipped)'}`);
          lines.push(`     Correct answer: ${q.options[q.correct]}`);
          lines.push(`     Result: ${status}`);
          lines.push('');
        });
      } else {
        lines.push('  (quiz not opened)');
        lines.push('');
      }

      // ---- Challenge ----
      lines.push('── Challenge ──');
      if (this.challengeGetState) {
        const cs = this.challengeGetState();
        cs.forEach(sc => {
          lines.push(`  ▸ ${sc.title}`);
          sc.questions.forEach((q, i) => {
            const a = (sc.responses[i] || '').trim();
            lines.push(`    Q${i + 1}: ${q}`);
            lines.push(`    A:  ${a || '(no response)'}`);
          });
          lines.push('');
        });
      } else {
        lines.push('  (challenge not opened)');
      }

      lines.push('═══════════════════════════════════════════════════');
      return lines.join('\n');
    },
  };

  window.Session = S;
})();
