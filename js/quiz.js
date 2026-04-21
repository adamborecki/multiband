/* Quiz — multiple choice questions with instant feedback */
(function () {
  'use strict';

  const QUESTIONS = [
    {
      q: "What problem does a multiband compressor solve that a single-band compressor doesn't?",
      options: [
        "It makes audio louder overall.",
        "It lets you compress different frequency ranges independently, so a loud low end doesn't pull down the mids and highs.",
        "It replaces the need for an EQ entirely.",
        "It removes background noise."
      ],
      correct: 1,
      explain: "A single-band compressor reacts to whatever is loudest across the full spectrum. A multiband splits the signal into frequency bands and compresses each one separately, so a boomy bass note doesn't duck your vocals."
    },
    {
      q: "With a ratio of 4:1 and a threshold of -20 dB, what happens to a signal that peaks at -12 dB going in?",
      options: [
        "Nothing — it's below the threshold.",
        "It comes out at about -12 dB.",
        "It comes out at about -18 dB.",
        "It comes out at about -20 dB."
      ],
      correct: 2,
      explain: "The signal is 8 dB over threshold. At 4:1, that 8 dB becomes 2 dB above threshold at the output. -20 + 2 = -18 dB (ignoring knee and makeup gain)."
    },
    {
      q: "Typical crossover for splitting bass from mids?",
      options: [
        "20–40 Hz",
        "120–250 Hz",
        "1–2 kHz",
        "8–12 kHz"
      ],
      correct: 1,
      explain: "Most kick drums, bass guitars, and sub energy live below roughly 150–250 Hz. The mid/high crossover typically lands in the 2–5 kHz range where presence and air take over."
    },
    {
      q: "You want to de-ess a vocal. How should you set up a band for that?",
      options: [
        "Wide low band, high ratio, slow attack.",
        "Narrow high band around 5–9 kHz, high ratio, fast attack.",
        "Mid band only, slow attack and release.",
        "Compress all three bands equally."
      ],
      correct: 1,
      explain: "Sibilants ('s', 'sh', 't') are short, bright transients. A narrow high-band with a fast attack and high ratio catches them without dulling the rest of the voice."
    },
    {
      q: "Which of these is a common giveaway of too much multiband compression?",
      options: [
        "Mix sounds flat, dynamics feel sucked out.",
        "Mix gets a wider stereo image.",
        "Bass frequencies disappear entirely.",
        "The tempo slows down."
      ],
      correct: 0,
      explain: "Heavy compression on every band leaves no breathing room. Micro-dynamics — the small loud/soft variations that make a mix feel alive — get crushed."
    },
    {
      q: "A mastering engineer uses a multiband compressor with ratios around 1.5:1–2:1 and low-threshold, slow settings on each band. What are they most likely going for?",
      options: [
        "Heavy creative pumping for an EDM drop.",
        "Transparent 'glue' — subtle cohesion across the mix.",
        "De-essing a lead vocal.",
        "Removing hum from a live recording."
      ],
      correct: 1,
      explain: "Gentle ratios, low thresholds, and slow attack/release = transparent compression that nudges everything together without being obvious. That's the classic mastering 'glue' use."
    },
    {
      q: "You hear the bass ducking audibly every time the kick hits. Which knob would help first?",
      options: [
        "Lower the ratio on the mid band.",
        "Shorten the attack on the high band.",
        "Lengthen the release on the low band so compression recovers less aggressively between hits.",
        "Raise the crossover between mid and high."
      ],
      correct: 2,
      explain: "'Pumping within a band' is usually caused by fast release + aggressive ratio on a band with rhythmic content. Lengthening the release smooths the recovery."
    },
    {
      q: "True or false: multiband compression can replace EQ.",
      options: [
        "True — you can shape any frequency response with it.",
        "False — EQ fixes static balance problems; compression fixes dynamic ones.",
        "True, as long as you use enough bands.",
        "False — they do literally the same thing."
      ],
      correct: 1,
      explain: "If a frequency range is always too loud, use EQ. Multiband compression shines when a range is sometimes too loud — i.e. a dynamic problem, not a tonal one."
    },
    {
      q: "Soloing the low band on a multiband compressor lets you hear…",
      options: [
        "The output of only the low-band compressor (the content below the low/mid crossover).",
        "The entire mix with the low band muted.",
        "A pitch-shifted version of the signal.",
        "A mono sum of all three bands."
      ],
      correct: 0,
      explain: "Solo = listen to that band alone. Useful for setting crossovers (does it contain what you want?) and for dialing in a band's threshold/ratio without the rest of the mix masking your hearing."
    },
    {
      q: "Phase smearing from crossovers is usually…",
      options: [
        "A major problem that you should always correct manually.",
        "Inaudible with modern Linkwitz–Riley designs, but can add up if you chain several multiband processors.",
        "Caused by the compressor, not the filters.",
        "Only present in digital plugins."
      ],
      correct: 1,
      explain: "Good crossovers (LR4) sum to a flat amplitude response with only minor phase shift. It's usually inaudible. Stacking many multiband plugins in a chain, or using steeper/poorly-designed crossovers, is where it starts to matter."
    },
  ];

  function render(root) {
    root.innerHTML = '';
    const state = {
      answered: new Array(QUESTIONS.length).fill(false),
      chosen:   new Array(QUESTIONS.length).fill(null),
      correct:  0,
    };

    QUESTIONS.forEach((item, qi) => {
      const card = document.createElement('div');
      card.className = 'quiz-question';
      card.innerHTML = `<h3>${qi + 1}. ${escape(item.q)}</h3>`;

      const opts = document.createElement('div');
      opts.className = 'quiz-options';
      item.options.forEach((text, oi) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.type = 'button';
        btn.textContent = text;
        btn.addEventListener('click', () => {
          if (state.answered[qi]) return;
          state.answered[qi] = true;
          state.chosen[qi] = oi;
          const correct = oi === item.correct;
          if (correct) state.correct++;
          btn.classList.add(correct ? 'correct' : 'wrong');
          if (!correct) {
            const correctBtn = opts.children[item.correct];
            correctBtn.classList.add('correct');
          }
          Array.from(opts.children).forEach(c => c.disabled = true);
          explain.classList.add('show');
          updateScore();
        });
        opts.appendChild(btn);
      });

      const explain = document.createElement('div');
      explain.className = 'quiz-explain';
      explain.textContent = item.explain;

      card.appendChild(opts);
      card.appendChild(explain);
      root.appendChild(card);
    });

    const score = document.createElement('div');
    score.className = 'quiz-score';
    score.innerHTML = `Score: <span class="big">0 / ${QUESTIONS.length}</span>`;
    root.appendChild(score);

    // Summary / clipboard controls
    const summary = buildSummaryBlock({
      title: 'Quiz Summary',
      generate: () => buildQuizSummary(state),
    });
    root.appendChild(summary);

    function updateScore() {
      const answeredCount = state.answered.filter(Boolean).length;
      score.innerHTML = `Score: <span class="big">${state.correct} / ${QUESTIONS.length}</span>`;
      if (answeredCount === QUESTIONS.length) {
        const pct = Math.round(100 * state.correct / QUESTIONS.length);
        let msg;
        if (pct >= 90) msg = "Mastered it.";
        else if (pct >= 70) msg = "Solid grasp.";
        else if (pct >= 50) msg = "Getting there — revisit the guided section.";
        else msg = "Give the guided section another pass.";
        score.innerHTML += `<div style="margin-top:6px;color:var(--muted);font-size:14px;">${msg}</div>`;
      }
    }
  }

  function buildQuizSummary(state) {
    const answered = state.answered.filter(Boolean).length;
    const pct = answered === 0 ? 0 : Math.round(100 * state.correct / QUESTIONS.length);
    const lines = [];
    lines.push('Multiband Compression — Quiz Summary');
    lines.push(`Date: ${new Date().toLocaleString()}`);
    lines.push(`Score: ${state.correct} / ${QUESTIONS.length} (${pct}%)`);
    lines.push(`Questions answered: ${answered} / ${QUESTIONS.length}`);
    lines.push('');
    QUESTIONS.forEach((q, i) => {
      const chosen = state.chosen[i];
      const correctIdx = q.correct;
      let status;
      if (chosen == null) status = 'unanswered';
      else if (chosen === correctIdx) status = 'CORRECT';
      else status = 'wrong';
      lines.push(`${i + 1}. ${q.q}`);
      if (chosen != null) lines.push(`   Your answer: ${q.options[chosen]}`);
      else lines.push(`   Your answer: (skipped)`);
      lines.push(`   Correct answer: ${q.options[correctIdx]}`);
      lines.push(`   Result: ${status}`);
      lines.push('');
    });
    return lines.join('\n');
  }

  function escape(s) {
    return s.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // Shared summary/copy UI (also used by Challenge.js via window.SummaryUI)
  function buildSummaryBlock({ title, generate }) {
    const wrap = document.createElement('div');
    wrap.className = 'summary-block';
    const row = document.createElement('div');
    row.className = 'summary-actions';
    const genBtn = document.createElement('button');
    genBtn.className = 'btn primary';
    genBtn.type = 'button';
    genBtn.textContent = 'Generate summary';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn';
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy to clipboard';
    copyBtn.disabled = true;
    const status = document.createElement('span');
    status.className = 'summary-status';
    row.appendChild(genBtn);
    row.appendChild(copyBtn);
    row.appendChild(status);

    const ta = document.createElement('textarea');
    ta.className = 'summary-textarea';
    ta.readOnly = true;
    ta.placeholder = `Click "Generate summary" to build a copyable ${title.toLowerCase()}.`;

    genBtn.addEventListener('click', () => {
      ta.value = generate();
      copyBtn.disabled = false;
      status.textContent = 'Ready to copy.';
      ta.scrollTop = 0;
    });

    copyBtn.addEventListener('click', async () => {
      if (!ta.value) return;
      try {
        await navigator.clipboard.writeText(ta.value);
        status.textContent = 'Copied ✓';
      } catch {
        ta.select();
        document.execCommand && document.execCommand('copy');
        status.textContent = 'Copied (fallback) ✓';
      }
      setTimeout(() => { status.textContent = ''; }, 2500);
    });

    wrap.appendChild(row);
    wrap.appendChild(ta);
    return wrap;
  }

  window.SummaryUI = { buildSummaryBlock };
  window.Quiz = { render };
})();
