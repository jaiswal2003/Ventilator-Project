// ─── NORMALIZATION HELPERS ──────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const norm = (v, lo, hi) => clamp((v - lo) / (hi - lo), 0, 1);

// ─── RISK SCORING MODEL ─────────────────────────────────────────────────────
// Each parameter contributes a weighted score toward SUCCESS (0–1 range).
// Final probability = weighted average clamped with calibration.

function computeScore(p) {
  const scores = {};

  // Derived
  const rsbi = p.rr / (p.vt / 1000); // breaths/min/L
  const pf   = p.pao2 / p.fio2;

  // 1. Age: younger is better
  scores.age = 1 - norm(p.age, 20, 90);

  // 2. BMI: 18.5–28 is optimal
  const bmiDist = p.bmi < 18.5 ? (18.5 - p.bmi) / 10 : p.bmi > 28 ? (p.bmi - 28) / 22 : 0;
  scores.bmi = Math.max(0, 1 - bmiDist);

  // 3. RR: 12–20 is normal; >30 is bad
  scores.rr = p.rr <= 20 ? 1 : 1 - norm(p.rr, 20, 35);

  // 4. VT: higher is better (>400 mL ideal)
  scores.vt = norm(p.vt, 150, 600);

  // 5. RSBI: <105 is favorable; <80 is excellent
  scores.rsbi = rsbi < 80 ? 1.0 : rsbi < 105 ? 0.75 : rsbi < 140 ? 0.35 : 0.05;

  // 6. FiO2: lower is better (<0.4)
  scores.fio2 = p.fio2 <= 0.40 ? 1 : 1 - norm(p.fio2, 0.40, 1.0);

  // 7. PEEP: ≤5 good, >10 bad
  scores.peep = p.peep <= 5 ? 1 : 1 - norm(p.peep, 5, 18);

  // 8. Pressure support: ≤8 good
  scores.ps = p.ps <= 8 ? 1 : 1 - norm(p.ps, 8, 25);

  // 9. Minute ventilation: 5–10 L/min ideal
  scores.mv = (p.mv >= 5 && p.mv <= 10) ? 1 : p.mv < 5 ? norm(p.mv, 0, 5) : 1 - norm(p.mv, 10, 20);

  // 10. PaO2: >80 is good
  scores.pao2 = norm(p.pao2, 50, 200);

  // 11. PaCO2: 35–45 normal; >55 bad
  const co2Score = (p.paco2 >= 35 && p.paco2 <= 45) ? 1 : p.paco2 < 35 ? 0.7 : 1 - norm(p.paco2, 45, 70);
  scores.paco2 = Math.max(0, co2Score);

  // 12. P/F ratio: >300 good, >200 moderate, <150 bad
  scores.pf = pf >= 300 ? 1 : pf >= 200 ? 0.65 : pf >= 150 ? 0.35 : 0.1;

  // 13. SpO2: >95 excellent
  scores.spo2 = p.spo2 >= 95 ? 1 : p.spo2 >= 90 ? 0.5 : 0.1;

  // 14. HR: 60–100 normal
  const hrScore = (p.hr >= 60 && p.hr <= 100) ? 1 : p.hr < 60 ? 0.6 : 1 - norm(p.hr, 100, 160);
  scores.hr = Math.max(0, hrScore);

  // 15. MAP: ≥65 required
  scores.map = p.map >= 65 ? 1 : norm(p.map, 40, 65);

  // 16. SBP: 90–160 ok
  scores.sbp = (p.sbp >= 90 && p.sbp <= 160) ? 1 : p.sbp < 90 ? 0.2 : 0.6;

  // 17. GCS: 13–15 ready
  scores.gcs = p.gcs >= 13 ? 1 : p.gcs >= 10 ? 0.55 : p.gcs >= 8 ? 0.2 : 0.0;

  // 18. RASS: -1 to 0 ideal for extubation
  scores.rass = (p.rass >= -1 && p.rass <= 0) ? 1 : p.rass < -1 ? Math.max(0, 1 - Math.abs(p.rass + 1) * 0.3) : Math.max(0, 1 - p.rass * 0.25);

  // 19. Hemoglobin: >8 acceptable, >10 good
  scores.hb = p.hb >= 10 ? 1 : p.hb >= 8 ? 0.6 : 0.2;

  // 20. Lactate: <2 good
  scores.lactate = p.lactate <= 2 ? 1 : p.lactate <= 4 ? 0.5 : 0.1;

  // 21. WBC: 4–12 normal
  scores.wbc = (p.wbc >= 4 && p.wbc <= 12) ? 1 : 0.4;

  // 22. Cough: 2=strong, 1=moderate, 0=weak
  scores.cough = p.cough === 2 ? 1 : p.cough === 1 ? 0.55 : 0.1;

  // 23. Secretions: 0=minimal, 1=moderate, 2=excessive
  scores.secretions = p.secretions === 0 ? 1 : p.secretions === 1 ? 0.5 : 0.1;

  // 24. Sex (minor factor)
  scores.sex = 0.5; // neutral

  // 25. Duration: <7 days good, 7–14 moderate, >14 risky
  scores.duration = p.duration <= 7 ? 1 : p.duration <= 14 ? 0.6 : 0.3;

  // ── Weights (must sum to 1) ──────────────────────────────────────────────
  const w = {
    age: 0.025, bmi: 0.02, rr: 0.055, vt: 0.055, rsbi: 0.07,
    fio2: 0.04, peep: 0.045, ps: 0.035, mv: 0.03,
    pao2: 0.045, paco2: 0.04, pf: 0.07,
    spo2: 0.055, hr: 0.03, map: 0.04, sbp: 0.02,
    gcs: 0.065, rass: 0.055,
    hb: 0.03, lactate: 0.04, wbc: 0.025,
    cough: 0.05, secretions: 0.04, sex: 0.005, duration: 0.03
  };

  let total = 0;
  for (const k in w) total += (scores[k] ?? 0.5) * w[k];

  // Calibration: sigmoid squish to realistic range (45%–95%)
  const raw = total;
  const calibrated = 0.45 + raw * 0.5;

  return { prob: clamp(calibrated, 0.05, 0.97), scores, rsbi, pf };
}

// ─── FACTOR ANALYSIS ────────────────────────────────────────────────────────
const factorMeta = [
  { key:'rsbi',       label:'RSBI',               color:'#ef4444' },
  { key:'pf',         label:'P/F Ratio',           color:'#2563eb' },
  { key:'gcs',        label:'GCS / Neuro',         color:'#8b5cf6' },
  { key:'spo2',       label:'SpO₂',                color:'#10b981' },
  { key:'cough',      label:'Cough Strength',      color:'#f59e0b' },
  { key:'secretions', label:'Secretions',          color:'#f59e0b' },
  { key:'rass',       label:'Sedation (RASS)',     color:'#06b6d4' },
  { key:'peep',       label:'PEEP',                color:'#3b82f6' },
  { key:'lactate',    label:'Lactate',             color:'#ef4444' },
  { key:'duration',   label:'Ventilation Duration',color:'#6b7280' },
];

// ─── RECOMMENDATION LOGIC ───────────────────────────────────────────────────
function getRecommendation(prob, scores) {
  const flags = [];
  if (scores.rsbi < 0.4) flags.push('High RSBI (rapid shallow breathing)');
  if (scores.pf   < 0.4) flags.push('Low P/F ratio (lung function concern)');
  if (scores.gcs  < 0.6) flags.push('GCS < 13 (airway protection risk)');
  if (scores.cough < 0.4) flags.push('Weak cough (aspiration risk)');
  if (scores.secretions < 0.4) flags.push('Excessive secretions');
  if (scores.rass < 0.4) flags.push('Heavy sedation (RASS < -2)');
  if (scores.lactate < 0.4) flags.push('Elevated lactate (tissue hypoxia)');
  if (scores.peep < 0.4) flags.push('High PEEP dependency');

  if (prob >= 0.75) {
    return {
      text: flags.length === 0
        ? '✅ Patient appears ready for extubation. Proceed with Spontaneous Breathing Trial (SBT) and extubation protocol per institutional guidelines.'
        : `⚠️ High success probability but note: ${flags.join('; ')}. Consider SBT with close monitoring.`,
      borderColor: '#10b981'
    };
  } else if (prob >= 0.55) {
    const top = flags.slice(0, 3).join('; ') || 'marginal parameter values';
    return {
      text: `⚠️ Borderline readiness. Key concerns: ${top}. Optimize these parameters, reassess in 4–6 hours, and consider a supervised SBT.`,
      borderColor: '#f59e0b'
    };
  } else {
    const top = flags.slice(0, 4).join('; ') || 'multiple physiological concerns';
    return {
      text: `❌ Patient not ready for extubation. Key issues: ${top}. Continue ventilatory support, address underlying causes, and reassess when parameters improve.`,
      borderColor: '#ef4444'
    };
  }
}



// ─── MAIN PREDICT FUNCTION ──────────────────────────────────────────────────
async function predict() {
  const get = id => parseFloat(document.getElementById(id).value);
  const getI = id => parseInt(document.getElementById(id).value);
  const getval = id => (document.getElementById(id).value);
  console.log("🚀 Button clicked");
//   console.log(getI('sex'));
//   console.log(getval('sex'));

  const Data = {
    age:       get('age'),
    Sex:       getval('sex'),
    bmi:       get('bmi'),
    rr:        get('rr'),
    vt:        get('vt'),
    RSBI:      get('rr')/get('vt'),
    fio2:      get('fio2'),
    peep:      get('peep'),
    ps:        get('ps'),
    mv:        get('mv'),
    pao2:      get('pao2'),
    paco2:     get('paco2'),
    ph:        get('ph'),
    spo2:      get('spo2'),
    hr:        get('hr'),
    map:       get('map'),
    sbp:       get('sbp'),
    gcs:       getI('gcs'),
    rass:      getI('rass'),
    hb:        get('hb'),
    lactate:   get('lactate'),
    wbc:       get('wbc'),
    Cough_strength: getval('cough'),
    Secretions:getval('secretions'),
    Duration_ventilation_days:  get('duration'),
  };

  try {
        const response = await fetch("http://127.0.0.1:5000/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(Data)
        });

        const result = await response.json();
        // result.score = 100
        console.log("🎯 Prediction Result:");
        console.log("Score:", result.score);
        console.log("Risk:", result.risk);
        console.log("Recommendation:", result.recommendation);
        document.getElementById('placeholder').style.display = 'none';
        document.getElementById('result-content').style.display = 'block';

        // Ring animation
        const circumference = 408.41;
        const offset = circumference - ((result.score/100) * circumference);
        const color = result.score >= 75 ? '#10b981' : (result.score/100) >= 55 ? '#f59e0b' : '#ef4444';
        const circle = document.getElementById('ring-circle');
        circle.style.stroke = color;
        setTimeout(() => { circle.style.strokeDashoffset = offset; }, 50);

        document.getElementById('score-pct').textContent = result.score + '%';
        document.getElementById('score-pct').style.color = color;

        const badge = document.getElementById('risk-badge');
        if (result.score >= 75) {
            badge.textContent = '🟢 LOW RISK — Likely Ready';
            badge.className = 'risk-badge risk-low';
        } else if (result.score >= 55) {
            badge.textContent = '🟡 MODERATE RISK — Borderline';
            badge.className = 'risk-badge risk-moderate';
        } else {
            badge.textContent = '🔴 HIGH RISK — Not Ready';
            badge.className = 'risk-badge risk-high';
        }

        // Recommendation
        // const rec = getRecommendation(result.score, Data);
        document.getElementById('rec-text').textContent = result.recommendation;
        document.querySelector('.recommendation').style.borderColor = color;

    } catch (error) {
        console.error("❌ Error:", error);
    }

}

// Auto-predict on load with defaults
// window.addEventListener('load', () => setTimeout(predict, 300));

function setupValidation() {
  const inputs = document.querySelectorAll("input[type='number']");

  inputs.forEach(input => {

    input.addEventListener("input", function () {
      const min = parseFloat(this.min);
      const max = parseFloat(this.max);
      let value = parseFloat(this.value);

      // Remove red if empty
      if (this.value === "") {
        this.classList.remove("invalid");
        return;
      }

      // If invalid number
      if (isNaN(value)) {
        this.classList.add("invalid");
        return;
      }

      // If out of range → mark red
      if (value < min || value > max) {
        this.classList.add("invalid");
      } else {
        this.classList.remove("invalid");
      }
    });

    // Clamp value when user leaves field
    input.addEventListener("blur", function () {
      const min = parseFloat(this.min);
      const max = parseFloat(this.max);
      let value = parseFloat(this.value);

      if (!isNaN(value)) {
        if (value < min) this.value = min;
        if (value > max) this.value = max;
      }
      this.classList.remove("invalid");
    });

  });
}

// Run when page loads
window.onload = setupValidation;