
      const BASE_RUNS = [];
      const BASE_MONTHLY = [];
      const BASE_YEARLY = [];
      const BASE_PRS = {
        short_5k: { pace: 4.3, dist: 5.81, date: "2021-06-25", hr: 182 },
        mid_10k: { pace: 4.478, dist: 8.69, date: "2021-06-06", hr: 153 },
        half: { pace: 4.62, dist: 21.14, date: "2025-04-13", hr: 179 },
        longest: { dist: 24.0, date: "2025-03-09", pace: 5.545, hr: 139 },
        highest_trimp: { val: 335.1, date: "2024-09-08", dist: 21.1 },
      };
      const BASE_WEEKLY = [];

      // ─── LIVE SHEET INTEGRATION ──────────────────────────────────────────────────────
      const SHEET_CSV =
        "https://docs.google.com/spreadsheets/d/1JsMpsy1cirnbGR5dn4Y9Hx-pRfR-M_pkuZui914t_jU/edit?gid=1#gid=1";
      const HEALTH_CSV =
        "https://docs.google.com/spreadsheets/d/1O-muv1OnvPOS_edO1hcb0qD0ojWGLE4J/export?format=csv&gid=593995936";
      let RUNS = [],
        MONTHLY = [],
        YEARLY = [],
        WEEKLY = [],
        PRS = {},
        PR_DATES = {},
        HEALTH = [];

      function _tMin(s) {
        if (!s) return null;
        const m = s.match(/(\d+)h:(\d+)m:(\d+)s/);
        return m ? +m[1] * 60 + +m[2] + +m[3] / 60 : null;
      }
      function _tSec(s) {
        if (!s) return 0;
        const m = s.match(/(\d+)h:(\d+)m:(\d+)s/);
        return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
      }
      function _hun(s) {
        return s && s.trim() ? parseFloat(s.trim().replace(",", ".")) : null;
      }
      function _unit(s, u) {
        return s && s.trim() ? _hun(s.replace(u, "").trim()) : null;
      }
      function _shDate(s) {
        const m = s && s.match(/(\d{4})\.(\d{2})\.(\d{2})/);
        return m ? m[1] + "-" + m[2] + "-" + m[3] : null;
      }

      function _row2run(c) {
        const date = _shDate(c[0]);
        if (!date) return null;
        if (!(c[2] || "").toLowerCase().includes("run")) {
          if (c[2] && c[2].trim()) console.log("RunDB skip [type]", c[2], "→", date);
          return null;
        }
        const dur = _tMin(c[3]);
        if (!dur || dur < 0.5) return null;
        const dist = _unit(c[8], "km");
        if (!dist || dist < 0.1) {
          console.log("RunDB skip [dist]", c[8], "→", date);
          return null;
        }
        const pace = +(dur / dist).toFixed(3);
        const avg_hr = Math.round(_unit(c[12], "bpm") || _hun(c[12]) || 0) || null;
        const max_hr = Math.round(_unit(c[13], "bpm") || _hun(c[13]) || 0) || null;
        const trimp = +(_hun(c[14]) || 0).toFixed(1);
        const hrzS = [18, 19, 20, 21, 22, 23].map((i) => _tSec(c[i]));
        const tot = hrzS.reduce((s, v) => s + v, 0) || dur * 60;
        const hrPct = hrzS.map((v) => +((v / tot) * 100).toFixed(1));
        const z1 = hrPct[1],
          z2 = hrPct[2],
          z3 = hrPct[3],
          z4 = hrPct[4],
          z5 = hrPct[5];
        const aei = avg_hr && pace ? +((60 / pace / avg_hr) * 100).toFixed(3) : null;
        const elev = _unit(c[9], "m");
        const cal = _unit(c[10], "kcal") || _hun(c[10]);
        const gct = _unit(c[28], "ms");
        const vo = _unit(c[29], "cm");
        const sl = _unit(c[30], "cm");
        const steps = _hun(c[31]);
        const [yr, mo] = date.split("-").map(Number);
        return {
          date,
          year: yr,
          month: mo,
          ym: date.slice(0, 7),
          dist: +dist.toFixed(2),
          pace,
          avg_hr,
          max_hr,
          duration: +dur.toFixed(1),
          trimp,
          z1,
          z2,
          z3,
          z4,
          z5,
          aei,
          elevation: elev != null ? +elev.toFixed(0) : null,
          temp: _hun(c[6]),
          calories: cal != null ? +cal.toFixed(0) : null,
          vo,
          sl,
          gct,
          cadence: steps && dur ? +(steps / dur).toFixed(1) : null,
        };
      }

      function _parseCSV(text) {
        const runs = [],
          lines = text.trim().replace(/\r/g, "").split("\n");
        console.log("RunDB: sheet sorok száma:", lines.length - 1);
        for (let i = 1; i < lines.length; i++) {
          const cols = [];
          let cur = "",
            inQ = false;
          for (const ch of lines[i]) {
            if (ch === '"') {
              inQ = !inQ;
            } else if (ch === "," && !inQ) {
              cols.push(cur);
              cur = "";
            } else cur += ch;
          }
          cols.push(cur);
          const r = _row2run(cols);
          if (r) runs.push(r);
        }
        console.log(
          "RunDB: sikeresen parsolt futások:",
          runs.length,
          "· összes km:",
          +runs.reduce((s, r) => s + r.dist, 0).toFixed(1),
        );
        return runs;
      }

      function _merge(base, sheet) {
        const sheetDates = new Set(sheet.map((r) => r.date));
        const result = [...base.filter((r) => !sheetDates.has(r.date)), ...sheet].sort((a, b) =>
          a.date.localeCompare(b.date),
        );
        console.log(
          "RunDB: merge → base kept:",
          base.filter((r) => !sheetDates.has(r.date)).length,
          "+ sheet:",
          sheet.length,
          "= total runs:",
          result.length,
          ", km:",
          +result.reduce((s, r) => s + r.dist, 0).toFixed(1),
        );
        return result;
      }

      function _wStart(d) {
        const dt = new Date(d),
          day = dt.getDay(),
          diff = day === 0 ? -6 : 1 - day;
        dt.setDate(dt.getDate() + diff);
        return dt.toISOString().slice(0, 10);
      }
      function _wEnd(d) {
        const dt = new Date(_wStart(d));
        dt.setDate(dt.getDate() + 6);
        return dt.toISOString().slice(0, 10);
      }

      function _compute(runs) {
        const mM = {};
        runs.forEach((r) => {
          (mM[r.ym] = mM[r.ym] || []).push(r);
        });
        const MONTHLY = Object.keys(mM)
          .sort()
          .map((ym) => {
            const rs = mM[ym],
              n = rs.length;
            const hrV = rs.filter((r) => r.avg_hr).map((r) => r.avg_hr);
            const aeiV = rs.filter((r) => r.aei).map((r) => r.aei);
            const calV = rs.filter((r) => r.calories).map((r) => r.calories);
            const [yr, mo] = ym.split("-").map(Number);
            return {
              ym,
              year: yr,
              month: mo,
              km: +rs.reduce((s, r) => s + r.dist, 0).toFixed(2),
              runs: n,
              avg_pace: +rs.reduce((s, r) => s + r.pace, 0) / n,
              avg_hr: hrV.length ? +(hrV.reduce((s, v) => s + v, 0) / hrV.length).toFixed(1) : null,
              max_dist: +Math.max(...rs.map((r) => r.dist)).toFixed(2),
              best_pace: +Math.min(...rs.map((r) => r.pace)).toFixed(3),
              total_trimp: +rs.reduce((s, r) => s + r.trimp, 0).toFixed(1),
              avg_z1: +rs.reduce((s, r) => s + r.z1, 0) / n,
              avg_z4: +rs.reduce((s, r) => s + (r.z4 || 0), 0) / n,
              avg_aei: aeiV.length ? +(aeiV.reduce((s, v) => s + v, 0) / aeiV.length).toFixed(3) : null,
              total_cal: calV.length ? +calV.reduce((s, v) => s + v, 0) : null,
              total_elev: +rs.reduce((s, r) => s + (r.elevation || 0), 0),
            };
          });
        const yM = {};
        runs.forEach((r) => {
          (yM[r.year] = yM[r.year] || []).push(r);
        });
        const YEARLY = Object.keys(yM)
          .sort()
          .map((yr) => {
            const rs = yM[yr],
              n = rs.length;
            const bpR = rs.reduce((a, r) => (r.pace < a.pace ? r : a));
            const lrR = rs.reduce((a, r) => (r.dist > a.dist ? r : a));
            const htR = rs.reduce((a, r) => (r.trimp > a.trimp ? r : a));
            const hrV = rs.filter((r) => r.avg_hr).map((r) => r.avg_hr);
            const aeiV = rs.filter((r) => r.aei).map((r) => r.aei);
            const calV = rs.filter((r) => r.calories).map((r) => r.calories);
            return {
              year: parseInt(yr),
              runs: n,
              km: +rs.reduce((s, r) => s + r.dist, 0).toFixed(1),
              avg_pace: +rs.reduce((s, r) => s + r.pace, 0) / n,
              avg_hr: hrV.length ? +(hrV.reduce((s, v) => s + v, 0) / hrV.length).toFixed(1) : null,
              max_dist: +lrR.dist.toFixed(2),
              best_pace: +bpR.pace.toFixed(3),
              total_trimp: +rs.reduce((s, r) => s + r.trimp, 0).toFixed(1),
              avg_z1: +rs.reduce((s, r) => s + r.z1, 0) / n,
              avg_z4: +rs.reduce((s, r) => s + (r.z4 || 0), 0) / n,
              avg_aei: aeiV.length ? +(aeiV.reduce((s, v) => s + v, 0) / aeiV.length).toFixed(3) : null,
              total_cal: calV.length ? +calV.reduce((s, v) => s + v, 0) : null,
              total_elev: +rs.reduce((s, r) => s + (r.elevation || 0), 0),
              longest_run: +lrR.dist.toFixed(2),
              longest_run_date: lrR.date,
              best_pace_date: bpR.date,
              highest_trimp: +htR.trimp.toFixed(1),
              highest_trimp_date: htR.date,
            };
          });
        const wM = {};
        runs.forEach((r) => {
          const ws = _wStart(r.date);
          (wM[ws] = wM[ws] || []).push(r);
        });
        const WEEKLY = Object.keys(wM)
          .sort()
          .map((ws) => {
            const rs = wM[ws];
            return {
              w: ws + "/" + _wEnd(ws),
              km: +rs.reduce((s, r) => s + r.dist, 0).toFixed(1),
              trimp: +rs.reduce((s, r) => s + r.trimp, 0).toFixed(1),
              runs: rs.length,
              date: rs[0].date,
            };
          });
        const bp = (arr) => (arr.length ? arr.reduce((a, r) => (r.pace < a.pace ? r : a)) : null);
        const p5 = bp(runs.filter((r) => r.dist >= 4.5 && r.dist <= 7));
        const p10 = bp(runs.filter((r) => r.dist > 7 && r.dist <= 12));
        const pH = bp(runs.filter((r) => r.dist >= 18));
        const lng = runs.reduce((a, r) => (r.dist > a.dist ? r : a));
        const ht = runs.reduce((a, r) => (r.trimp > a.trimp ? r : a));
        const PRS = {
          short_5k: p5 ? { pace: p5.pace, dist: p5.dist, date: p5.date, hr: p5.avg_hr } : null,
          mid_10k: p10 ? { pace: p10.pace, dist: p10.dist, date: p10.date, hr: p10.avg_hr } : null,
          half: pH ? { pace: pH.pace, dist: pH.dist, date: pH.date, hr: pH.avg_hr } : null,
          longest: { dist: lng.dist, date: lng.date, pace: lng.pace, hr: lng.avg_hr },
          highest_trimp: { val: ht.trimp, date: ht.date, dist: ht.dist },
        };
        const PR_DATES = {
          [PRS.half && PRS.half.date]: "Félmaraton PR",
          [PRS.short_5k && PRS.short_5k.date]: "Legjobb 5k",
          [PRS.mid_10k && PRS.mid_10k.date]: "Legjobb 10k",
          [PRS.longest && PRS.longest.date]: "Leghosszabb futás",
          [PRS.highest_trimp && PRS.highest_trimp.date]: "Max TRIMP",
        };
        return { MONTHLY, YEARLY, WEEKLY, PRS, PR_DATES };
      }

      async function _fetchSheet() {
        const r = await fetch(SHEET_CSV);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return _parseCSV(await r.text());
      }

      function _parseHealth(text) {
        const records = [],
          lines = text.trim().replace(/\r/g, "").split("\n");
        for (let i = 1; i < lines.length; i++) {
          const cols = [];
          let cur = "",
            inQ = false;
          for (const ch of lines[i]) {
            if (ch === '"') {
              inQ = !inQ;
            } else if (ch === "," && !inQ) {
              cols.push(cur);
              cur = "";
            } else cur += ch;
          }
          cols.push(cur);
          const _mdy = cols[0] && cols[0].trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          const date =
            _shDate(cols[0]) ||
            (_mdy ? _mdy[3] + "-" + _mdy[1].padStart(2, "0") + "-" + _mdy[2].padStart(2, "0") : null) ||
            (cols[0] && cols[0].trim().match(/^\d{4}-\d{2}-\d{2}$/) ? cols[0].trim() : null);
          if (!date) continue;
          records.push({
            date,
            active_cal: _hun(cols[1]),
            resting_cal: _hun(cols[2]),
            resting_hr: _hun(cols[3]),
            hrv: _hun(cols[4]),
            steps: _hun(cols[5]),
            vo2max: _hun(cols[6]),
            exercise_min: _hun(cols[7]),
            stand_hours: _hun(cols[8]),
          });
        }
        console.log("RunDB: health records:", records.length);
        return records.sort((a, b) => a.date.localeCompare(b.date));
      }
      async function _fetchHealth() {
        const r = await fetch(HEALTH_CSV);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return _parseHealth(await r.text());
      }

      function _clearDOM() {
        ["heatmap", "month-names"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.innerHTML = "";
        });
        ["filter-year", "monthly-year-filter"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.innerHTML = '<option value="">\u00d6sszes év</option>';
        });
        ["year-a", "year-b", "month-a", "month-b"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.innerHTML = "";
        });
        const calBody = document.getElementById("cal-body");
        if (calBody) calBody.innerHTML = "";
      }

      function _render(runs) {
        ({ MONTHLY, YEARLY, WEEKLY, PRS, PR_DATES } = _compute(runs));
        RUNS = runs;
        filteredRuns = runs.slice();
        _clearDOM();
        initOverview();
        initRunsTab();
        initCalendarTab();
        initMonthlyTab();
        initYearlyTab();
        initCompareTab();
      }

      async function _bootstrap() {
        const [runsResult, healthResult] = await Promise.allSettled([_fetchSheet(), _fetchHealth()]);
        HEALTH = healthResult.status === "fulfilled" ? healthResult.value : [];
        if (healthResult.status !== "fulfilled")
          console.warn("RunDB: health fetch failed:", healthResult.reason?.message);
        const runs = runsResult.status === "fulfilled" ? _merge(BASE_RUNS, runsResult.value) : BASE_RUNS.slice();
        if (runsResult.status !== "fulfilled")
          console.warn("RunDB: sheet fetch sikertelen:", runsResult.reason?.message);
        _render(runs);
      }
      // ─────────────────────────────────────────────────────────────────────────────
      const MONTHS_HU = ["jan", "feb", "már", "ápr", "máj", "jún", "júl", "aug", "szep", "okt", "nov", "dec"];
      const LIME = "#C8F135";
      function getLime() {
        return document.documentElement.classList.contains("light") ? "#7a9a00" : "#C8F135";
      }
      function getLimeDim() {
        return document.documentElement.classList.contains("light") ? "rgba(120,154,0,.15)" : "rgba(200,241,53,.08)";
      }
      function gv(v) {
        return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      }
      function gridColor() {
        return gv("--grid-line");
      }
      function axisColor() {
        return gv("--axis-text");
      }
      function tipBg() {
        return gv("--tip-bg");
      }
      function tipBorder() {
        return gv("--tip-border");
      }
      function toggleTheme() {
        const isLight = document.documentElement.classList.toggle("light");
        document.getElementById("theme-icon").textContent = isLight ? "🌙" : "☀️";
        document.getElementById("theme-label").textContent = isLight ? "Dark" : "Light";
        localStorage.setItem("rundb-theme", isLight ? "light" : "dark");
        // Redraw all active charts
        const activeTab = document.querySelector(".page.active")?.id?.replace("page-", "");
        if (activeTab) redrawTab(activeTab);
      }
      // Init theme from localStorage
      (function () {
        const saved = localStorage.getItem("rundb-theme");
        if (saved === "light") {
          document.documentElement.classList.add("light");
          document.getElementById("theme-icon").textContent = "🌙";
          document.getElementById("theme-label").textContent = "Dark";
        }
      })();

      function fmtPace(v) {
        if (!v || isNaN(v)) return "—";
        const m = Math.floor(v),
          s = Math.round((v - m) * 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
      }
      function fmtDur(min) {
        if (!min) return "—";
        const h = Math.floor(min / 60),
          m = Math.round(min % 60);
        return h > 0 ? `${h}ó ${m}p` : `${m}p`;
      }
      function getZoneClass(r) {
        if (r.z1 >= 50) return "is-z1";
        if (r.z3 + r.z4 >= 50) return "is-z4";
        return "";
      }
      function zonePill(r) {
        return `<div class="zone-pill"><div class="zp1" style="width:${r.z1}%;min-width:${r.z1 > 0 ? 2 : 0}px"></div><div class="zp2" style="width:${r.z2}%;min-width:${r.z2 > 0 ? 2 : 0}px"></div><div class="zp3" style="width:${r.z3}%;min-width:${r.z3 > 0 ? 2 : 0}px"></div><div class="zp4" style="width:${r.z4}%;min-width:${r.z4 > 0 ? 2 : 0}px"></div><div class="zp5" style="width:${r.z5}%;min-width:${r.z5 > 0 ? 2 : 0}px"></div></div>`;
      }

      // Check if a run is a PR

      // ── NATIVE CANVAS ──
      function drawDonut(id, segments) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const dpr = Math.max(window.devicePixelRatio || 1, 2);
        const W = canvas.offsetWidth || 400;
        if (!canvas.dataset.logicalH) canvas.dataset.logicalH = canvas.getAttribute("height") || "200";
        const H = parseInt(canvas.dataset.logicalH);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);
        const total = segments.reduce((s, sg) => s + sg.value, 0);
        if (!total) return;
        const R = Math.min(H, W * 0.4) * 0.46,
          cx = R + 28,
          cy = H / 2,
          inner = R * 0.56;
        let ang = -Math.PI / 2;
        segments.forEach((sg) => {
          const sweep = (sg.value / total) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(cx, cy, R, ang, ang + sweep);
          ctx.arc(cx, cy, inner, ang + sweep, ang, true);
          ctx.closePath();
          ctx.fillStyle = sg.color;
          ctx.fill();
          ang += sweep;
        });
        // donut hole bg
        ctx.beginPath();
        ctx.arc(cx, cy, inner - 1, 0, Math.PI * 2);
        ctx.fillStyle = gv("--surface");
        ctx.fill();
        // center label
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = gv("--text");
        ctx.font = `bold ${Math.round(R * 0.44)}px Inter,sans-serif`;
        ctx.fillText(total, cx, cy - R * 0.12);
        ctx.fillStyle = gv("--text3");
        ctx.font = `${Math.round(R * 0.28)}px DM Mono,monospace`;
        ctx.fillText("futás", cx, cy + R * 0.26);
        // legend
        let ly = cy - segments.length * 22;
        const lx = cx + R + 24;
        segments.forEach((sg) => {
          ctx.fillStyle = sg.color;
          ctx.beginPath();
          ctx.arc(lx + 7, ly + 7, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = gv("--text");
          ctx.font = "bold 13px Inter,sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText(sg.label, lx + 20, ly);
          ctx.fillStyle = gv("--text3");
          ctx.font = "10px DM Mono,monospace";
          ctx.fillText(`${Math.round((sg.value / total) * 100)}%  ·  ${sg.value} futás`, lx + 20, ly + 17);
          ly += 44;
        });
      }

      function drawBar(id, labels, datasets, opts = {}) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const dpr = Math.max(window.devicePixelRatio || 1, 2);
        const W = canvas.offsetWidth || canvas.parentElement.offsetWidth || 700;
        if (!canvas.dataset.logicalH) canvas.dataset.logicalH = canvas.getAttribute("height") || "180";
        const H = parseInt(canvas.dataset.logicalH);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);
        const pad = { top: 12, right: 12, bottom: opts.rotateLabels ? 48 : 24, left: 44 };
        const cW = W - pad.left - pad.right,
          cH = H - pad.top - pad.bottom;
        const allV = datasets.flatMap((ds) => ds.data.filter((v) => v != null && !isNaN(v)));
        if (!allV.length) return;
        const maxV = opts.maxVal || Math.max(...allV),
          minV = opts.minVal || 0,
          range = maxV - minV || 1;
        const n = labels.length,
          gW = cW / n,
          nDs = datasets.length;
        const bW = Math.max(2, (gW * 0.72) / nDs);
        // grid
        ctx.strokeStyle = "#1e1e1e";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
          const y = pad.top + cH * (1 - i / 4);
          ctx.beginPath();
          ctx.moveTo(pad.left, y);
          ctx.lineTo(pad.left + cW, y);
          ctx.stroke();
          const val = minV + (range * i) / 4;
          ctx.fillStyle = "#444";
          ctx.font = "9px DM Mono,monospace";
          ctx.textAlign = "right";
          ctx.fillText(opts.yFmt ? opts.yFmt(val) : Math.round(val), pad.left - 4, y + 3);
        }
        // bars
        datasets.forEach((ds, di) => {
          ds.data.forEach((val, i) => {
            if (val == null || isNaN(val)) return;
            const x = pad.left + i * gW + (gW * (1 - 0.72)) / 2 + di * (bW + 1);
            const bH = Math.max(1, ((val - minV) / range) * cH);
            const y = pad.top + cH - bH;
            ctx.fillStyle = Array.isArray(ds.color) ? ds.color[i] : ds.color || LIME;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, y, bW, bH, 2);
            else ctx.rect(x, y, bW, bH);
            ctx.fill();
          });
        });
        // x labels
        ctx.fillStyle = axisColor();
        ctx.font = "8px DM Mono,monospace";
        ctx.textAlign = "center";
        const step = Math.ceil(n / 36);
        labels.forEach((lbl, i) => {
          if (i % step !== 0) return;
          const x = pad.left + i * gW + gW / 2;
          if (opts.rotateLabels) {
            ctx.save();
            ctx.translate(x, pad.top + cH + 6);
            ctx.rotate(Math.PI / 4);
            ctx.textAlign = "left";
            ctx.fillText(lbl, 0, 0);
            ctx.restore();
          } else ctx.fillText(lbl, x, pad.top + cH + 14);
        });
        // Tooltip & click
        let _bTip = document.getElementById("bar-tip");
        if (!_bTip) {
          _bTip = document.createElement("div");
          _bTip.id = "bar-tip";
          _bTip.style.cssText =
            "position:fixed;font-family:DM Mono,monospace;font-size:10px;padding:6px 10px;border-radius:6px;pointer-events:none;display:none;z-index:300;line-height:1.6;white-space:nowrap";
          document.body.appendChild(_bTip);
        }
        canvas.onmousemove = function (e) {
          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const i = Math.floor((mx - pad.left) / gW);
          if (i >= 0 && i < n) {
            const vals = datasets.map((ds) => ds.data[i]);
            const anyVal = vals.some((v) => v != null && !isNaN(v));
            if (anyVal) {
              _bTip.style.background = tipBg();
              _bTip.style.color = gv("--tip-text");
              _bTip.style.border = "1px solid " + tipBorder();
              _bTip.innerHTML =
                "<b>" +
                labels[i] +
                "</b><br>" +
                datasets
                  .map((ds, di) => (ds.label ? ds.label + ": " : "") + (opts.yFmt ? opts.yFmt(vals[di]) : vals[di]))
                  .join("<br>") +
                (opts.extraTip ? "<br>" + opts.extraTip(i) : "");
              _bTip.style.display = "block";
              _bTip.style.left = e.clientX + 14 + "px";
              _bTip.style.top = e.clientY - 8 + "px";
              canvas.style.cursor = opts.onClick ? "pointer" : "default";
              return;
            }
          }
          _bTip.style.display = "none";
          canvas.style.cursor = "default";
        };
        canvas.onmouseleave = () => {
          _bTip.style.display = "none";
        };
        canvas.onclick = function (e) {
          if (!opts.onClick) return;
          const rect = canvas.getBoundingClientRect();
          const i = Math.floor((e.clientX - rect.left - pad.left) / gW);
          if (i >= 0 && i < n) opts.onClick(labels[i], i);
        };
      }

      function drawLine(id, labels, datasets, opts = {}) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const dpr = Math.max(window.devicePixelRatio || 1, 2);
        const W = canvas.offsetWidth || canvas.parentElement.offsetWidth || 700;
        if (!canvas.dataset.logicalH) canvas.dataset.logicalH = canvas.getAttribute("height") || "150";
        const H = parseInt(canvas.dataset.logicalH);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);
        const pad = { top: 12, right: 12, bottom: opts.rotateLabels ? 48 : 24, left: 44 };
        const cW = W - pad.left - pad.right,
          cH = H - pad.top - pad.bottom;
        const allV = datasets.flatMap((ds) => ds.data.filter((v) => v != null && !isNaN(v)));
        if (!allV.length) return;
        const maxV = opts.maxVal || Math.max(...allV) * 1.06,
          minV = opts.minVal || Math.min(...allV) * 0.94,
          range = maxV - minV || 1;
        const n = labels.length;
        // grid
        ctx.strokeStyle = "#1e1e1e";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
          const y = pad.top + cH * (1 - i / 4);
          ctx.beginPath();
          ctx.moveTo(pad.left, y);
          ctx.lineTo(pad.left + cW, y);
          ctx.stroke();
          ctx.fillStyle = "#444";
          ctx.font = "9px DM Mono,monospace";
          ctx.textAlign = "right";
          ctx.fillText(
            opts.yFmt ? opts.yFmt(minV + (range * i) / 4) : (minV + (range * i) / 4).toFixed(1),
            pad.left - 4,
            y + 3,
          );
        }
        datasets.forEach((ds) => {
          const pts = ds.data.map((v, i) =>
            v != null && !isNaN(v)
              ? { x: pad.left + (i / (n - 1 || 1)) * cW, y: pad.top + cH - ((v - minV) / range) * cH }
              : null,
          );
          if (ds.fill) {
            ctx.beginPath();
            const vp = pts.filter(Boolean);
            if (vp.length) {
              ctx.moveTo(vp[0].x, pad.top + cH);
              vp.forEach((p) => ctx.lineTo(p.x, p.y));
              ctx.lineTo(vp[vp.length - 1].x, pad.top + cH);
              ctx.closePath();
              ctx.fillStyle = ds.fillColor || "rgba(200,241,53,.08)";
              ctx.fill();
            }
          }
          ctx.strokeStyle = ds.color || LIME;
          ctx.lineWidth = 2;
          ctx.lineJoin = "round";
          ctx.beginPath();
          let first = true;
          pts.forEach((p) => {
            if (!p) return;
            first ? (ctx.moveTo(p.x, p.y), (first = false)) : ctx.lineTo(p.x, p.y);
          });
          ctx.stroke();
          pts.forEach((p) => {
            if (!p) return;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = ds.color || LIME;
            ctx.fill();
          });
        });
        // reference lines
        if (opts.refLines) {
          opts.refLines.forEach((rl) => {
            const ry = pad.top + cH - ((rl.value - minV) / range) * cH;
            if (ry < pad.top || ry > pad.top + cH) return;
            ctx.save();
            ctx.strokeStyle = rl.color || "#888";
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(pad.left, ry);
            ctx.lineTo(pad.left + cW, ry);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = rl.color || "#888";
            ctx.font = "8px DM Mono,monospace";
            ctx.textAlign = "left";
            ctx.fillText(rl.label || rl.value, pad.left + 4, ry - 3);
            ctx.restore();
          });
        }
        ctx.fillStyle = axisColor();
        ctx.font = "8px DM Mono,monospace";
        ctx.textAlign = "center";
        const step = Math.ceil(n / 30);
        labels.forEach((lbl, i) => {
          if (i % step !== 0) return;
          const x = pad.left + (i / (n - 1 || 1)) * cW;
          if (opts.rotateLabels) {
            ctx.save();
            ctx.translate(x, pad.top + cH + 6);
            ctx.rotate(Math.PI / 4);
            ctx.textAlign = "left";
            ctx.fillText(lbl, 0, 0);
            ctx.restore();
          } else ctx.fillText(lbl, x, pad.top + cH + 14);
        });
        // Tooltip — hover snaps to nearest label index
        let _lTip = document.getElementById("line-tip");
        if (!_lTip) {
          _lTip = document.createElement("div");
          _lTip.id = "line-tip";
          _lTip.style.cssText =
            "position:fixed;font-family:DM Mono,monospace;font-size:10px;padding:6px 10px;border-radius:6px;pointer-events:none;display:none;z-index:300;line-height:1.6;white-space:nowrap";
          document.body.appendChild(_lTip);
        }
        // Store data for hover
        canvas._lineLabels = labels;
        canvas._lineDatasets = datasets;
        canvas._linePad = pad;
        canvas._lineCW = cW;
        canvas._lineCH = cH;
        canvas._lineN = n;
        canvas._lineMinV = minV;
        canvas._lineRange = range;
        canvas._lineOpts = opts;
        canvas.onmousemove = function (e) {
          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const i = Math.round(((mx - pad.left) / cW) * (n - 1));
          if (i >= 0 && i < n) {
            const vals = datasets.map((ds) => ds.data[i]);
            _lTip.style.background = tipBg();
            _lTip.style.color = gv("--tip-text");
            _lTip.style.border = "1px solid " + tipBorder();
            _lTip.innerHTML =
              "<b>" +
              labels[i] +
              "</b><br>" +
              datasets
                .map(
                  (ds, di) =>
                    (ds.label ? ds.label + ": " : "") +
                    (vals[di] != null ? (opts.yFmt ? opts.yFmt(vals[di]) : vals[di].toFixed(2)) : "—"),
                )
                .join("<br>");
            _lTip.style.display = "block";
            _lTip.style.left = e.clientX + 14 + "px";
            _lTip.style.top = e.clientY - 8 + "px";
          } else {
            _lTip.style.display = "none";
          }
        };
        canvas.onmouseleave = () => {
          _lTip.style.display = "none";
        };
      }

      function drawScatterChart(id, points, opts = {}) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const dpr = Math.max(window.devicePixelRatio || 1, 2);
        const W = canvas.offsetWidth || canvas.parentElement.offsetWidth || 700;
        if (!canvas.dataset.logicalH) canvas.dataset.logicalH = canvas.getAttribute("height") || "280";
        const H = parseInt(canvas.dataset.logicalH);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
        const pad = { top: 12, right: 12, bottom: 36, left: 52 };
        const cW = W - pad.left - pad.right,
          cH = H - pad.top - pad.bottom;
        const minX = opts.minX || 110,
          maxX = opts.maxX || 190,
          minY = opts.minY || 4,
          maxY = opts.maxY || 9;
        const rX = maxX - minX,
          rY = maxY - minY;

        function doRedraw(hiIdx = -1) {
          ctx.clearRect(0, 0, W, H);
          ctx.strokeStyle = gridColor();
          ctx.lineWidth = 1;
          for (let i = 0; i <= 4; i++) {
            const y = pad.top + cH * (i / 4);
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(pad.left + cW, y);
            ctx.stroke();
            ctx.fillStyle = axisColor();
            ctx.font = "9px DM Mono,monospace";
            ctx.textAlign = "right";
            ctx.fillText(fmtPace(maxY - (rY * i) / 4), pad.left - 4, y + 3);
          }
          for (let i = 0; i <= 5; i++) {
            const x = pad.left + cW * (i / 5);
            ctx.beginPath();
            ctx.moveTo(x, pad.top);
            ctx.lineTo(x, pad.top + cH);
            ctx.stroke();
            ctx.fillStyle = axisColor();
            ctx.font = "9px DM Mono,monospace";
            ctx.textAlign = "center";
            ctx.fillText(Math.round(minX + (rX * i) / 5), x, pad.top + cH + 14);
          }
          ctx.fillStyle = axisColor();
          ctx.font = "8px DM Mono,monospace";
          ctx.textAlign = "center";
          ctx.fillText("Átl. HR (bpm)", pad.left + cW / 2, H - 4);
          ctx.save();
          ctx.translate(11, pad.top + cH / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText("Tempó (min/km)", 0, 0);
          ctx.restore();
          pixelPts.forEach((p, i) => {
            const r = i === hiIdx ? p.r + 4 : p.r;
            ctx.beginPath();
            ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
            ctx.fillStyle = points[i].color;
            ctx.fill();
            if (i === hiIdx) {
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          });
          // legend
          const leg = [
            [getLime(), "Z1 futás"],
            ["rgba(255,140,0,.8)", "Szürke zóna"],
            ["rgba(96,165,250,.85)", "2026"],
          ];
          let lx = pad.left;
          leg.forEach(([c, l]) => {
            ctx.beginPath();
            ctx.arc(lx + 5, H - 7, 4, 0, Math.PI * 2);
            ctx.fillStyle = c;
            ctx.fill();
            ctx.fillStyle = "#555";
            ctx.font = "9px DM Mono,monospace";
            ctx.textAlign = "left";
            ctx.fillText(l, lx + 12, H - 3);
            lx += ctx.measureText(l).width + 26;
          });
        }

        const pixelPts = points.map((p) => ({
          px: pad.left + ((p.x - minX) / rX) * cW,
          py: pad.top + ((maxY - p.y) / rY) * cH,
          r: p.r || 4,
          run: p.run,
        }));
        doRedraw();

        // tooltip
        let tip = document.getElementById("scatter-tip");
        if (!tip) {
          tip = document.createElement("div");
          tip.id = "scatter-tip";
          tip.style.cssText =
            "position:fixed;font-family:DM Mono,monospace;font-size:10px;padding:7px 11px;border-radius:7px;pointer-events:none;display:none;z-index:300;line-height:1.7;white-space:nowrap";
          document.body.appendChild(tip);
        }
        function findHit(mx, my) {
          return pixelPts.findIndex((p) => Math.hypot(mx - p.px, my - p.py) <= p.r + 6);
        }
        canvas.onmousemove = function (e) {
          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left,
            my = e.clientY - rect.top;
          const i = findHit(mx, my);
          if (i >= 0 && pixelPts[i].run) {
            canvas.style.cursor = "pointer";
            doRedraw(i);
            const r = pixelPts[i].run;
            const prName = PR_DATES[r.date];
            tip.style.background = tipBg();
            tip.style.color = gv("--tip-text");
            tip.style.border = "1px solid " + tipBorder();
            tip.innerHTML =
              (prName ? `<span style="color:${getLime()};font-weight:700">${prName}</span><br>` : "") +
              `<b>${r.date}</b> &nbsp;${r.dist.toFixed(1)}km<br>${fmtPace(r.pace)}/km &nbsp;·&nbsp; ${r.avg_hr} bpm &nbsp;·&nbsp; Z1:${r.z1.toFixed(0)}%`;
            tip.style.display = "block";
            tip.style.left = e.clientX + 16 + "px";
            tip.style.top = e.clientY - 8 + "px";
          } else {
            canvas.style.cursor = "default";
            tip.style.display = "none";
            doRedraw();
          }
        };
        canvas.onmouseleave = () => {
          tip.style.display = "none";
          doRedraw();
        };
        canvas.onclick = function (e) {
          const rect = canvas.getBoundingClientRect(),
            sc = canvas.width / rect.width;
          const i = findHit((e.clientX - rect.left) * sc, (e.clientY - rect.top) * sc);
          if (i >= 0 && pixelPts[i].run) showRunDetail(pixelPts[i].run);
        };
      }

      // ── TAB ──
      function showTab(id, btn) {
        document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.getElementById("page-" + id).classList.add("active");
        btn.classList.add("active");
        setTimeout(() => redrawTab(id), 40);
      }
      function redrawTab(id) {
        if (id === "overview") {
          drawOverviewCharts();
        }
        if (id === "monthly") {
          drawBar(
            "monthlyTRIMPChart",
            MONTHLY.map((m) => m.ym.slice(2)),
            [
              {
                data: MONTHLY.map((m) => m.total_trimp),
                color: MONTHLY.map((m) =>
                  m.total_trimp > 1000
                    ? getLime()
                    : document.documentElement.classList.contains("light")
                      ? "rgba(120,154,0,.3)"
                      : "rgba(200,241,53,.3)",
                ),
              },
            ],
            { rotateLabels: true, yFmt: (v) => Math.round(v) },
          );
        }
        if (id === "yearly") {
          drawYearlyCharts();
        }
        if (id === "trends") {
          drawTrendCharts();
        }
        if (id === "health") {
          drawHealthCharts();
        }
      }

      // ── CALENDAR ──
      function initCalendarTab() {
        const s = document.getElementById("cal-year");
        s.innerHTML = '<option value="">Összes év</option>';
        [...new Set(RUNS.map((r) => r.year))]
          .sort((a, b) => b - a)
          .forEach((y) => {
            const o = document.createElement("option");
            o.value = y;
            o.textContent = y;
            s.appendChild(o);
          });
        // default to most recent year
        if (s.options.length > 1) s.value = s.options[1].value;
        renderCalendar();
      }

      function renderCalendar() {
        const yr = document.getElementById("cal-year").value;
        const runs = yr ? RUNS.filter((r) => r.year == yr) : RUNS;
        document.getElementById("cal-run-count").textContent = runs.length + " futás";

        // group by date
        const byDate = {};
        runs.forEach((r) => {
          (byDate[r.date] = byDate[r.date] || []).push(r);
        });

        const dates = Object.keys(byDate).sort();
        const body = document.getElementById("cal-body");
        body.innerHTML = "";
        if (!dates.length) return;

        const maxDist = Math.max(...runs.map((r) => r.dist));
        const isLight = document.documentElement.classList.contains("light");

        // week start (Monday) of a date string
        function monOf(d) {
          const dt = new Date(d),
            day = dt.getDay(),
            diff = day === 0 ? -6 : 1 - day;
          dt.setDate(dt.getDate() + diff);
          return dt.toISOString().slice(0, 10);
        }

        // all run-weeks (for lookup)
        const weekSet = new Set(dates.map(monOf));
        const sortedRunWeeks = [...weekSet].sort();

        // generate every consecutive week from first to last run-week
        const firstWeek = sortedRunWeeks[0];
        const lastWeek = sortedRunWeeks[sortedRunWeeks.length - 1];
        const weeks = [];
        for (let d = new Date(lastWeek); d >= new Date(firstWeek); d.setDate(d.getDate() - 7))
          weeks.push(d.toISOString().slice(0, 10));

        const MONTHS = ["jan", "feb", "már", "ápr", "máj", "jún", "júl", "aug", "szep", "okt", "nov", "dec"];
        function shortDate(d) {
          const dt = new Date(d);
          return MONTHS[dt.getMonth()] + " " + dt.getDate() + ".";
        }

        weeks.forEach((mon) => {
          const sun = new Date(mon);
          sun.setDate(sun.getDate() + 6);
          const sunStr = sun.toISOString().slice(0, 10);

          // 7 days of this week
          const days = [];
          for (let i = 0; i < 7; i++) {
            const dt = new Date(mon);
            dt.setDate(dt.getDate() + i);
            days.push(dt.toISOString().slice(0, 10));
          }

          const weekRuns = days.flatMap((d) => byDate[d] || []);
          const weekKm = weekRuns.reduce((s, r) => s + r.dist, 0);

          const row = document.createElement("div");
          row.className = "cal-week";

          // week info
          const info = document.createElement("div");
          info.className = "cal-week-info";
          const monDt = new Date(mon),
            sunDt = new Date(sunStr);
          const sameMonth = monDt.getMonth() === sunDt.getMonth();
          const rangeLabel = sameMonth
            ? MONTHS[monDt.getMonth()] + " " + monDt.getDate() + "–" + sunDt.getDate() + "."
            : shortDate(mon) + " – " + shortDate(sunStr);
          info.innerHTML =
            '<div class="cal-week-range">' +
            rangeLabel +
            "</div>" +
            (weekKm > 0
              ? '<div class="cal-week-km' + (isLight ? " light-lime" : "") + '">' + weekKm.toFixed(1) + " km</div>"
              : "");
          row.appendChild(info);

          // day cells
          days.forEach((dateStr) => {
            const cell = document.createElement("div");
            cell.className = "cal-cell";
            const dayRuns = byDate[dateStr] || [];

            if (dayRuns.length === 0) {
              // subtle dot for empty days — only show if within run date range
              const inRange = dateStr >= dates[0] && dateStr <= dates[dates.length - 1];
              if (inRange) {
                const dot = document.createElement("div");
                dot.className = "cal-empty";
                cell.appendChild(dot);
              }
            } else {
              dayRuns.forEach((r) => {
                // bubble size 34–70px
                const size = Math.round(34 + (r.dist / maxDist) * 36);
                // color by zone
                let bg, textCol;
                if (r.z1 >= 50) {
                  bg = isLight ? "#8ab000" : "#C8F135";
                  textCol = isLight ? "#fff" : "#0a0a0a";
                } else if (r.z3 + r.z4 >= 50) {
                  bg = "#ff6622";
                  textCol = "#fff";
                } else {
                  bg = "#6dbf6d";
                  textCol = "#fff";
                }

                const bubble = document.createElement("div");
                bubble.className = "cal-bubble";
                bubble.style.cssText =
                  "width:" +
                  size +
                  "px;height:" +
                  size +
                  "px;background:" +
                  bg +
                  ";font-size:" +
                  (size > 48 ? "10" : "9") +
                  "px;color:" +
                  textCol +
                  ";";
                bubble.textContent = r.dist.toFixed(1);
                bubble.title =
                  r.date + " · " + r.dist.toFixed(1) + "km · " + fmtPace(r.pace) + "/km · " + r.avg_hr + " bpm";
                bubble.onclick = () => showRunDetail(r);
                cell.appendChild(bubble);

                // label below bubble
                const lbl = document.createElement("div");
                lbl.className = "cal-bubble-label";
                lbl.textContent = r.z1 >= 50 ? "Z1 futás" : r.z3 + r.z4 >= 50 ? "Kemény" : fmtPace(r.pace) + "/km";
                cell.appendChild(lbl);
              });
            }
            row.appendChild(cell);
          });

          body.appendChild(row);
        });
      }

      // ── OVERVIEW ──
      let _overviewKmYear = "";
      let _vo2Year = "";
      const _MONTHS_SHORT = ["Jan", "Feb", "Már", "Ápr", "Máj", "Jún", "Júl", "Aug", "Sze", "Okt", "Nov", "Dec"];

      function _buildOverviewKmNav() {
        const nav = document.getElementById("overview-km-nav");
        if (!nav || nav.dataset.built) return;
        nav.dataset.built = "1";
        const years = [...new Set(MONTHLY.map((m) => m.ym.slice(0, 4)))].sort();
        const pills = ["Teljes", ...years];
        const isLight = () => document.documentElement.classList.contains("light");
        pills.forEach((p) => {
          const btn = document.createElement("button");
          btn.dataset.yr = p === "Teljes" ? "" : p;
          btn.textContent = p;
          btn.style.cssText =
            'font-size:10px;font-weight:700;letter-spacing:.5px;font-family:"Inter",sans-serif;border-radius:20px;padding:4px 12px;cursor:pointer;border:1px solid var(--border);transition:all .15s;background:var(--surface);color:var(--text3)';
          btn.onclick = () => {
            _overviewKmYear = btn.dataset.yr;
            nav.querySelectorAll("button").forEach((b) => {
              const active = b.dataset.yr === _overviewKmYear;
              b.style.background = active ? "var(--lime)" : "var(--surface)";
              b.style.color = active ? "var(--bg)" : "var(--text3)";
              b.style.borderColor = active ? "var(--lime)" : "var(--border)";
            });
            drawOverviewKmChart();
          };
          if (p === "Teljes") {
            btn.style.background = "var(--lime)";
            btn.style.color = "var(--bg)";
            btn.style.borderColor = "var(--lime)";
          }
          nav.appendChild(btn);
        });
      }

      function drawOverviewKmChart() {
        const isLight = document.documentElement.classList.contains("light");
        const data = _overviewKmYear ? MONTHLY.filter((m) => m.ym.startsWith(_overviewKmYear)) : MONTHLY;
        const labels = _overviewKmYear
          ? data.map((m) => _MONTHS_SHORT[parseInt(m.ym.slice(5)) - 1])
          : data.map((m) => m.ym.slice(2));
        drawBar(
          "overviewKmChart",
          labels,
          [
            {
              data: data.map((m) => m.km),
              color: data.map((m) =>
                m.km >= 150
                  ? getLime()
                  : m.ym.startsWith("2026")
                    ? "rgba(96,165,250,.6)"
                    : isLight
                      ? "rgba(120,154,0,.18)"
                      : "rgba(200,241,53,.22)",
              ),
              label: "km",
            },
          ],
          {
            rotateLabels: !_overviewKmYear,
            yFmt: (v) => Math.round(v) + "km",
            extraTip: (i) => data[i].runs + " futás",
            onClick: (_, i) => filterAndShowRuns(data[i].ym),
          },
        );
      }

      function _buildVo2Nav() {
        const nav = document.getElementById("vo2-nav");
        if (!nav || nav.dataset.built) return;
        nav.dataset.built = "1";
        const all = HEALTH.filter((h) => h.vo2max > 0);
        const years = [...new Set(all.map((h) => h.date.slice(0, 4)))].sort();
        const pills = ["Teljes", ...years];
        const rangeFor = (yr) => {
          const d = yr ? all.filter((h) => h.date.startsWith(yr)) : all;
          if (!d.length) return null;
          const vals = d.map((h) => h.vo2max);
          return { min: Math.min(...vals), max: Math.max(...vals) };
        };
        pills.forEach((p) => {
          const yr = p === "Teljes" ? "" : p;
          const r = rangeFor(yr);
          const btn = document.createElement("button");
          btn.dataset.yr = yr;
          btn.style.cssText =
            'font-family:"Inter",sans-serif;border-radius:12px;padding:5px 11px;cursor:pointer;border:1px solid var(--border);transition:all .15s;background:var(--surface);color:var(--text3);display:flex;flex-direction:column;align-items:center;gap:1px;line-height:1.2';
          const top = document.createElement("span");
          top.textContent = p;
          top.style.cssText = "font-size:10px;font-weight:700;letter-spacing:.5px";
          btn.appendChild(top);
          if (r) {
            const sub = document.createElement("span");
            sub.textContent = r.min.toFixed(1) + "–" + r.max.toFixed(1);
            sub.style.cssText = "font-size:8.5px;font-weight:500;opacity:.75;letter-spacing:0";
            btn.appendChild(sub);
          }
          btn.onclick = () => {
            _vo2Year = btn.dataset.yr;
            nav.querySelectorAll("button").forEach((b) => {
              const active = b.dataset.yr === _vo2Year;
              b.style.background = active ? "var(--lime)" : "var(--surface)";
              b.style.color = active ? "var(--bg)" : "var(--text3)";
              b.style.borderColor = active ? "var(--lime)" : "var(--border)";
            });
            drawVo2Chart();
          };
          if (p === "Teljes") {
            btn.style.background = "var(--lime)";
            btn.style.color = "var(--bg)";
            btn.style.borderColor = "var(--lime)";
          }
          nav.appendChild(btn);
        });
      }

      function drawVo2Chart() {
        const all = HEALTH.filter((h) => h.vo2max > 0);
        const vo2D = _vo2Year ? all.filter((h) => h.date.startsWith(_vo2Year)) : all;
        if (!vo2D.length) return;
        const labels = _vo2Year ? vo2D.map((h) => h.date.slice(5)) : vo2D.map((h) => h.date.slice(2));
        drawLine(
          "vo2Chart",
          labels,
          [
            {
              data: vo2D.map((h) => h.vo2max),
              color: "#f87171",
              fill: true,
              fillColor: "rgba(248,113,113,.08)",
              label: "ml/kg/min",
            },
          ],
          { rotateLabels: true, yFmt: (v) => v.toFixed(1) },
        );
      }

      function drawOverviewCharts() {
        _buildOverviewKmNav();
        drawOverviewKmChart();
        // weekly km (last 52 weeks)
        const wk52 = WEEKLY.slice(-52);
        const isLight = document.documentElement.classList.contains("light");
        drawBar(
          "weeklyKmChart",
          wk52.map((w) => w.date.slice(5)),
          [
            {
              data: wk52.map((w) => w.km),
              color: wk52.map((w) =>
                w.km >= 50
                  ? getLime()
                  : w.km >= 25
                    ? isLight
                      ? "rgba(120,154,0,.45)"
                      : "rgba(200,241,53,.45)"
                    : isLight
                      ? "rgba(120,154,0,.2)"
                      : "rgba(200,241,53,.2)",
              ),
              label: "km",
            },
          ],
          { rotateLabels: true, yFmt: (v) => Math.round(v) + "km", extraTip: (i) => (wk52[i].runs || "?") + " futás" },
        );
        const aD = MONTHLY.filter((m) => m.avg_aei);
        drawLine(
          "aeiChart",
          aD.map((m) => m.ym.slice(2)),
          [{ data: aD.map((m) => m.avg_aei), color: getLime(), fill: true, fillColor: getLimeDim(), label: "AEI" }],
          { rotateLabels: true, yFmt: (v) => v.toFixed(2) },
        );
      }

      function _computeStreaks() {
        const weekSet = new Set(RUNS.map((r) => _wStart(r.date)));
        const weeks = [...weekSet].sort();
        let longest = 0,
          cur = 0,
          prev = null;
        weeks.forEach((w) => {
          if (prev) {
            const nxt = new Date(prev);
            nxt.setDate(nxt.getDate() + 7);
            cur = w === nxt.toISOString().slice(0, 10) ? cur + 1 : 1;
          } else cur = 1;
          if (cur > longest) longest = cur;
          prev = w;
        });
        const today = new Date().toISOString().slice(0, 10);
        let wk = _wStart(today),
          current = 0;
        while (weekSet.has(wk)) {
          current++;
          const d = new Date(wk);
          d.setDate(d.getDate() - 7);
          wk = d.toISOString().slice(0, 10);
        }
        return { current, longest };
      }

      function _computeACWR() {
        const td = {};
        RUNS.forEach((r) => {
          td[r.date] = (td[r.date] || 0) + r.trimp;
        });
        const dates = Object.keys(td).sort();
        if (!dates.length) return [];
        const all = [];
        for (let d = new Date(dates[0]), end = new Date(); d <= end; d.setDate(d.getDate() + 1)) {
          all.push({ date: d.toISOString().slice(0, 10), t: td[d.toISOString().slice(0, 10)] || 0 });
        }
        // weekly points only (every 7th day), need ≥28 days of history
        const result = [];
        for (let i = 27; i < all.length; i += 7) {
          const atl = all.slice(i - 6, i + 1).reduce((s, x) => s + x.t, 0) / 7;
          const ctl = all.slice(i - 27, i + 1).reduce((s, x) => s + x.t, 0) / 28;
          if (ctl > 0) result.push({ date: all[i].date, value: +(atl / ctl).toFixed(2) });
        }
        return result;
      }

      let _intPeriod = 90;
      function _drawIntensity(days) {
        _intPeriod = days;
        document.querySelectorAll(".int-pill").forEach((b) => {
          const active = +b.dataset.d === days;
          b.style.background = active ? "var(--lime)" : "var(--surface)";
          b.style.color = active ? "var(--bg)" : "var(--text3)";
          b.style.borderColor = active ? "var(--lime)" : "var(--border)";
        });
        const cutoff =
          days === 0 ? null : new Date(new Date().setDate(new Date().getDate() - days)).toISOString().slice(0, 10);
        const runs = cutoff ? RUNS.filter((r) => r.date >= cutoff) : RUNS;
        const easy = runs.filter((r) => r.z1 >= 50).length;
        const hard = runs.filter((r) => r.z3 + r.z4 >= 50).length;
        const mixed = runs.length - easy - hard;
        const isLight = document.documentElement.classList.contains("light");
        drawDonut("intensityDonut", [
          { label: "Könnyű (Z1)", value: easy, color: isLight ? "#8ab000" : "#C8F135" },
          { label: "Vegyes", value: mixed, color: "#6dbf6d" },
          { label: "Kemény (Z3–4)", value: hard, color: "#ff6622" },
        ]);
      }

      function initOverview() {
        const totKm = RUNS.reduce((s, r) => s + r.dist, 0);
        const avgPace = RUNS.reduce((s, r) => s + r.pace, 0) / RUNS.length;
        const totTrimp = RUNS.reduce((s, r) => s + r.trimp, 0);
        const totCal = RUNS.reduce((s, r) => s + (r.calories || 0), 0);
        document.getElementById("overview-stats").innerHTML = `
    <div class="stat-box"><div class="stat-lbl">Összes km</div><div class="stat-num lime">${Math.round(totKm).toLocaleString()}</div><div class="stat-unit">km · 2020–2026</div></div>
    <div class="stat-box"><div class="stat-lbl">Futások</div><div class="stat-num">${RUNS.length}</div><div class="stat-unit">edzés</div></div>
    <div class="stat-box"><div class="stat-lbl">Átl. tempó</div><div class="stat-num">${fmtPace(avgPace)}</div><div class="stat-unit">min/km</div></div>
    <div class="stat-box"><div class="stat-lbl">Összes TRIMP</div><div class="stat-num">${Math.round(totTrimp).toLocaleString()}</div><div class="stat-unit">terhelési pont</div></div>
    <div class="stat-box"><div class="stat-lbl">Kalória</div><div class="stat-num">${Math.round(totCal / 1000)}k</div><div class="stat-unit">aktív kcal</div></div>`;
        const { current, longest } = _computeStreaks();
        document.getElementById("streak-stats").innerHTML = `
    <div class="stat-box"><div class="stat-lbl">Jelenlegi sorozat</div><div class="stat-num lime">${current}</div><div class="stat-unit">egymást követő hét</div></div>
    <div class="stat-box"><div class="stat-lbl">Leghosszabb sorozat</div><div class="stat-num">${longest}</div><div class="stat-unit">egymást követő hét</div></div>`;

        const p = PRS;
        function prCard(label, numHtml, meta, run) {
          return `<div class="pr-card" onclick='${run ? `showRunDetail(${JSON.stringify(run)})` : ""}'>
      <div class="pr-lbl">${label}</div>
      <div class="pr-num">${numHtml}</div>
      <div class="pr-meta">${meta}</div>
      <div class="pr-link">Futáshoz ugrás</div>
    </div>`;
        }
        const halfRun = RUNS.find((r) => r.date === p.half?.date);
        const shortRun = RUNS.find((r) => r.date === p.short_5k?.date);
        const midRun = RUNS.find((r) => r.date === p.mid_10k?.date);
        const longRun = RUNS.find((r) => r.date === p.longest?.date);
        const trimpRun = RUNS.find((r) => r.date === p.highest_trimp?.date);
        const vo2vals = HEALTH.filter((h) => h.vo2max > 0);
        const bestVo2 = vo2vals.length ? Math.max(...vo2vals.map((h) => h.vo2max)) : null;
        const curVo2 = vo2vals.length ? vo2vals[vo2vals.length - 1].vo2max : null;
        document.getElementById("pr-grid").innerHTML =
          prCard(
            "Félmaraton PR",
            `${fmtPace(p.half?.pace)}<span class="unit">/km</span>`,
            `${p.half?.dist}km · ${p.half?.date}<br>Átl. HR: ${p.half?.hr} bpm`,
            halfRun,
          ) +
          prCard(
            "Legjobb 5k tempó",
            `${fmtPace(p.short_5k?.pace)}<span class="unit">/km</span>`,
            `${p.short_5k?.dist}km · ${p.short_5k?.date}<br>Átl. HR: ${p.short_5k?.hr} bpm`,
            shortRun,
          ) +
          prCard(
            "Legjobb 10k tempó",
            `${fmtPace(p.mid_10k?.pace)}<span class="unit">/km</span>`,
            `${p.mid_10k?.dist}km · ${p.mid_10k?.date}<br>Átl. HR: ${p.mid_10k?.hr} bpm`,
            midRun,
          ) +
          prCard(
            "Leghosszabb futás",
            `${p.longest?.dist}<span class="unit">km</span>`,
            `${fmtPace(p.longest?.pace)}/km · ${p.longest?.date}<br>Átl. HR: ${p.longest?.hr} bpm`,
            longRun,
          ) +
          prCard(
            "Max TRIMP",
            `${p.highest_trimp?.val}<span class="unit">pt</span>`,
            `${p.highest_trimp?.dist}km · ${p.highest_trimp?.date}`,
            trimpRun,
          ) +
          prCard(
            "VO₂ Max csúcs",
            bestVo2 ? `${bestVo2.toFixed(1)}<span class="unit">ml/kg/min</span>` : "—",
            bestVo2
              ? `Jelenlegi: ${curVo2?.toFixed(1)} · ${vo2vals.find((h) => h.vo2max === bestVo2)?.date}`
              : "Apple Health adat betöltése...",
            null,
          );

        // heatmap
        const mn = document.getElementById("month-names");
        MONTHS_HU.forEach((m) => {
          const d = document.createElement("div");
          d.className = "month-name";
          d.textContent = m;
          mn.appendChild(d);
        });
        const years = [...new Set(MONTHLY.map((m) => m.year))].sort();
        const maxKm = Math.max(...MONTHLY.map((m) => m.km));
        const hm = document.getElementById("heatmap");
        years.forEach((yr) => {
          const row = document.createElement("div");
          row.className = "heatmap-row";
          const lbl = document.createElement("div");
          lbl.className = "heatmap-year";
          lbl.textContent = yr;
          const cells = document.createElement("div");
          cells.className = "heatmap-cells";
          for (let mo = 1; mo <= 12; mo++) {
            const found = MONTHLY.find((m) => m.year === yr && m.month === mo);
            const cell = document.createElement("div");
            cell.className = "hm-cell";
            if (found) {
              const alpha = 0.1 + (found.km / maxKm) * 0.9;
              cell.style.background = document.documentElement.classList.contains("light")
                ? `rgba(100,140,0,${alpha.toFixed(2)})`
                : `rgba(200,241,53,${alpha.toFixed(2)})`;
              cell.title = `${found.ym}: ${found.km}km · ${found.runs} futás`;
              cell.onclick = () => filterAndShowRuns(found.ym);
            } else {
              cell.style.background = "var(--border)";
              cell.style.opacity = ".4";
            }
            cells.appendChild(cell);
          }
          row.appendChild(lbl);
          row.appendChild(cells);
          hm.appendChild(row);
        });
        drawOverviewCharts();
      }

      // ── RUNS TABLE ──
      let filteredRuns = [...RUNS],
        sortKey = "date",
        sortDir = -1,
        currentPage = 1;
      const PAGE_SIZE = 25;

      function initRunsTab() {
        const s = document.getElementById("filter-year");
        [...new Set(RUNS.map((r) => r.year))]
          .sort((a, b) => b - a)
          .forEach((y) => {
            const o = document.createElement("option");
            o.value = y;
            o.textContent = y;
            s.appendChild(o);
          });
        filterRuns();
      }
      function filterRuns() {
        const q = document.getElementById("search-input").value.toLowerCase();
        const yr = document.getElementById("filter-year").value;
        const zone = document.getElementById("filter-zone").value;
        const dist = document.getElementById("filter-dist").value;
        filteredRuns = RUNS.filter((r) => {
          if (q && !r.date.includes(q)) return false;
          if (yr && r.year != yr) return false;
          if (zone === "z1" && r.z1 < 50) return false;
          if (zone === "z4" && r.z3 + r.z4 < 50) return false;
          if (dist === "short" && r.dist >= 7) return false;
          if (dist === "mid" && (r.dist < 7 || r.dist > 12)) return false;
          if (dist === "long" && r.dist <= 12) return false;
          return true;
        });
        sortRuns();
        currentPage = 1;
        renderRunsTable();
      }
      function clearFilters() {
        document.getElementById("search-input").value = "";
        document.getElementById("filter-year").value = "";
        document.getElementById("filter-zone").value = "";
        document.getElementById("filter-dist").value = "";
        filterRuns();
      }
      function sortTable(key) {
        if (sortKey === key) sortDir *= -1;
        else {
          sortKey = key;
          sortDir = -1;
        }
        document
          .querySelectorAll(".data-table thead th")
          .forEach((th) => th.classList.remove("sorted-asc", "sorted-desc"));
        event.target.classList.add(sortDir === 1 ? "sorted-asc" : "sorted-desc");
        sortRuns();
        renderRunsTable();
      }
      function sortRuns() {
        filteredRuns.sort((a, b) => {
          const av = a[sortKey] ?? -Infinity,
            bv = b[sortKey] ?? -Infinity;
          return (av > bv ? 1 : -1) * sortDir;
        });
      }
      function renderRunsTable() {
        const total = filteredRuns.length,
          pages = Math.ceil(total / PAGE_SIZE) || 1;
        currentPage = Math.min(currentPage, pages);
        const slice = filteredRuns.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
        document.getElementById("result-count").textContent = `${total} futás`;
        document.getElementById("page-info").textContent = `${currentPage} / ${pages}`;
        document.getElementById("prev-btn").disabled = currentPage <= 1;
        document.getElementById("next-btn").disabled = currentPage >= pages;
        const rdata = JSON.stringify;
        document.getElementById("runs-tbody").innerHTML = slice
          .map((r) => {
            const isPR = PR_DATES[r.date];
            return `<tr class="${getZoneClass(r)}" onclick='showRunDetail(${rdata(r)})'>
      <td class="primary">${r.date}${isPR ? `<span class="best-badge">${isPR}</span>` : ""}</td>
      <td class="primary">${r.dist.toFixed(1)}km</td>
      <td class="${r.z1 >= 50 ? "lime" : ""}">${fmtPace(r.pace)}</td>
      <td>${r.avg_hr ?? "—"}</td><td>${r.max_hr ?? "—"}</td>
      <td>${fmtDur(r.duration)}</td><td>${r.trimp.toFixed(0)}</td>
      <td>${zonePill(r)}</td>
      <td>${r.aei != null ? r.aei.toFixed(2) : "—"}</td>
      <td>${r.elevation != null ? r.elevation + "m" : "—"}</td>
      <td>${r.cadence != null ? r.cadence.toFixed(0) + " spm" : "—"}</td>
    </tr>`;
          })
          .join("");
      }
      function changePage(d) {
        currentPage += d;
        renderRunsTable();
      }

      // ── RUN DETAIL MODAL ──
      function showRunDetail(r) {
        const isPR = PR_DATES[r.date];
        document.getElementById("modal-content").innerHTML = `
    ${isPR ? `<div class="pr-tag">🏆 ${isPR}</div>` : ""}
    <div class="modal-date">${r.date}</div>
    <div class="modal-dist">${r.dist.toFixed(2)}<span>km</span></div>
    <div class="modal-pace">${fmtPace(r.pace)}/km</div>
    <div class="modal-stats">
      <div class="modal-stat"><div class="modal-stat-lbl">Átl. HR</div><div class="modal-stat-val">${r.avg_hr ?? "—"} bpm</div></div>
      <div class="modal-stat"><div class="modal-stat-lbl">Max HR</div><div class="modal-stat-val">${r.max_hr ?? "—"} bpm</div></div>
      <div class="modal-stat"><div class="modal-stat-lbl">Időtartam</div><div class="modal-stat-val">${fmtDur(r.duration)}</div></div>
      <div class="modal-stat"><div class="modal-stat-lbl">TRIMP</div><div class="modal-stat-val">${r.trimp.toFixed(1)}</div></div>
      <div class="modal-stat"><div class="modal-stat-lbl">AEI</div><div class="modal-stat-val">${r.aei != null ? r.aei.toFixed(3) : "—"}</div></div>
      <div class="modal-stat"><div class="modal-stat-lbl">Szint</div><div class="modal-stat-val">${r.elevation != null ? r.elevation + "m" : "—"}</div></div>
      <div class="modal-stat"><div class="modal-stat-lbl">Kalória</div><div class="modal-stat-val">${r.calories ?? "—"} kcal</div></div>
      <div class="modal-stat"><div class="modal-stat-lbl">Hőmérséklet</div><div class="modal-stat-val">${r.temp != null ? r.temp + "°C" : "—"}</div></div>
      <div class="modal-stat"><div class="modal-stat-lbl">Kadencia</div><div class="modal-stat-val">${r.cadence != null ? r.cadence.toFixed(0) + " spm" : "—"}</div></div>
      ${r.vo ? `<div class="modal-stat"><div class="modal-stat-lbl">Vert. oszcill.</div><div class="modal-stat-val">${r.vo} mm</div></div>` : ""}
      ${r.sl ? `<div class="modal-stat"><div class="modal-stat-lbl">Lépéshossz</div><div class="modal-stat-val">${r.sl} m</div></div>` : ""}
    </div>
    <div class="modal-zone-lbl">HR zóna megoszlás</div>
    <div class="modal-zone-bar">
      <div class="zp1" style="width:${r.z1}%;min-width:${r.z1 > 0 ? 3 : 0}px;border-radius:5px 0 0 5px"></div>
      <div class="zp2" style="width:${r.z2}%;min-width:${r.z2 > 0 ? 3 : 0}px"></div>
      <div class="zp3" style="width:${r.z3}%;min-width:${r.z3 > 0 ? 3 : 0}px"></div>
      <div class="zp4" style="width:${r.z4}%;min-width:${r.z4 > 0 ? 3 : 0}px"></div>
      <div class="zp5" style="width:${r.z5}%;min-width:${r.z5 > 0 ? 3 : 0}px;border-radius:0 5px 5px 0"></div>
    </div>
    <div class="modal-zone-tags">
      <span class="modal-zone-tag" style="color:var(--lime)">Z1 ${r.z1.toFixed(0)}%</span>
      <span class="modal-zone-tag" style="color:#6dbf6d">Z2 ${r.z2.toFixed(0)}%</span>
      <span class="modal-zone-tag" style="color:var(--orange)">Z3 ${r.z3.toFixed(0)}%</span>
      <span class="modal-zone-tag" style="color:#ff6622">Z4 ${r.z4.toFixed(0)}%</span>
      <span class="modal-zone-tag" style="color:var(--red)">Z5 ${r.z5.toFixed(0)}%</span>
    </div>`;
        document.getElementById("modal").classList.add("open");
      }
      function closeModal(e) {
        if (e.target === document.getElementById("modal")) closeModalBtn();
      }
      function closeModalBtn() {
        document.getElementById("modal").classList.remove("open");
      }
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModalBtn();
      });

      // ── MONTHLY ──
      function initMonthlyTab() {
        const s = document.getElementById("monthly-year-filter");
        [...new Set(MONTHLY.map((m) => m.year))]
          .sort((a, b) => b - a)
          .forEach((y) => {
            const o = document.createElement("option");
            o.value = y;
            o.textContent = y;
            s.appendChild(o);
          });
        renderMonthlyTable();
      }
      function renderMonthlyTable() {
        const yr = document.getElementById("monthly-year-filter").value;
        const [sk, sd] = document.getElementById("monthly-sort").value.split("-");
        let data = MONTHLY.filter((m) => !yr || m.year == yr);
        data.sort((a, b) => {
          const av = a[sk] ?? -Infinity,
            bv = b[sk] ?? -Infinity;
          return (av > bv ? 1 : -1) * (sd === "desc" ? -1 : 1);
        });
        document.getElementById("monthly-count").textContent = `${data.length} hónap`;
        const bKm = Math.max(...data.map((m) => m.km)),
          bPace = Math.min(...data.map((m) => m.best_pace)),
          bTrimp = Math.max(...data.map((m) => m.total_trimp));
        document.getElementById("monthly-tbody").innerHTML = data
          .map(
            (m) => `
    <tr onclick="filterAndShowRuns('${m.ym}')" style="cursor:pointer">
      <td class="primary">${m.ym}</td>
      <td>${m.runs}</td>
      <td class="${m.km === bKm ? "best" : ""}">${m.km.toFixed(1)}km</td>
      <td>${fmtPace(m.avg_pace)}</td>
      <td class="${m.best_pace === bPace ? "best" : ""}">${fmtPace(m.best_pace)}</td>
      <td>${m.max_dist.toFixed(1)}km</td>
      <td>${m.avg_hr != null ? m.avg_hr.toFixed(0) + " bpm" : "—"}</td>
      <td class="${m.total_trimp === bTrimp ? "best" : ""}">${m.total_trimp.toFixed(0)}</td>
      <td>${m.avg_z1.toFixed(0)}%</td>
      <td>${m.avg_aei != null ? m.avg_aei.toFixed(2) : "—"}</td>
      <td>${m.total_cal != null ? Math.round(m.total_cal).toLocaleString() + " kcal" : "—"}</td>
    </tr>`,
          )
          .join("");
      }
      function filterAndShowRuns(ym) {
        document.getElementById("search-input").value = ym;
        ["filter-year", "filter-zone", "filter-dist"].forEach((id) => (document.getElementById(id).value = ""));
        filterRuns();
        document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.getElementById("page-runs").classList.add("active");
        document.querySelectorAll(".tab-btn")[1].classList.add("active");
      }

      // ── YEARLY ──
      function drawYearlyCharts() {
        drawBar(
          "yearlyKmChart",
          YEARLY.map((y) => y.year + ""),
          [
            {
              data: YEARLY.map((y) => y.km),
              color: YEARLY.map((y) =>
                y.km === Math.max(...YEARLY.map((y) => y.km))
                  ? getLime()
                  : document.documentElement.classList.contains("light")
                    ? "rgba(120,154,0,.3)"
                    : "rgba(200,241,53,.3)",
              ),
            },
          ],
          { yFmt: (v) => Math.round(v) + "km" },
        );
        const a = YEARLY.filter((y) => y.avg_aei);
        drawLine(
          "yearlyAEIChart",
          a.map((y) => y.year + ""),
          [{ data: a.map((y) => y.avg_aei), color: getLime(), fill: true, fillColor: getLimeDim() }],
          { yFmt: (v) => v.toFixed(2) },
        );
      }
      function initYearlyTab() {
        const bKm = Math.max(...YEARLY.map((y) => y.km)),
          bPace = Math.min(...YEARLY.map((y) => y.best_pace)),
          bAei = Math.max(...YEARLY.filter((y) => y.avg_aei).map((y) => y.avg_aei));
        document.getElementById("yearly-tbody").innerHTML = YEARLY.map(
          (y) => `
    <tr>
      <td class="primary">${y.year}</td>
      <td>${y.runs}</td>
      <td class="${y.km === bKm ? "best" : ""}">${y.km.toFixed(0)}km</td>
      <td>${fmtPace(y.avg_pace)}</td>
      <td class="${y.best_pace === bPace ? "best" : ""}">${fmtPace(y.best_pace)}<br><span style="font-size:9px;color:var(--text3)">${y.best_pace_date}</span></td>
      <td>${y.longest_run.toFixed(1)}km<br><span style="font-size:9px;color:var(--text3)">${y.longest_run_date}</span></td>
      <td>${y.avg_hr != null ? y.avg_hr.toFixed(0) + " bpm" : "—"}</td>
      <td>${y.total_trimp.toFixed(0)}</td>
      <td>${y.avg_z1.toFixed(0)}%</td>
      <td class="${y.avg_aei === bAei ? "best" : ""}">${y.avg_aei != null ? y.avg_aei.toFixed(2) : "—"}</td>
      <td>${y.total_cal != null ? Math.round(y.total_cal / 1000).toFixed(1) + "k kcal" : "—"}</td>
    </tr>`,
        ).join("");
        drawYearlyCharts();
      }

      // ── COMPARE ──
      function initCompareTab() {
        const mA = document.getElementById("month-a"),
          mB = document.getElementById("month-b");
        const yA = document.getElementById("year-a"),
          yB = document.getElementById("year-b");
        MONTHLY.slice()
          .reverse()
          .forEach((m) => {
            [mA, mB].forEach((s) => {
              const o = document.createElement("option");
              o.value = m.ym;
              o.textContent = `${m.ym} · ${m.km.toFixed(0)}km`;
              s.appendChild(o);
            });
          });
        YEARLY.slice()
          .reverse()
          .forEach((y) => {
            [yA, yB].forEach((s) => {
              const o = document.createElement("option");
              o.value = y.year;
              o.textContent = `${y.year} · ${y.km.toFixed(0)}km`;
              s.appendChild(o);
            });
          });
        if (MONTHLY.length >= 2) {
          mA.value = MONTHLY[MONTHLY.length - 1].ym;
          mB.value = MONTHLY[MONTHLY.length - 2].ym;
        }
        if (YEARLY.length >= 2) {
          yA.value = YEARLY[YEARLY.length - 1].year;
          yB.value = YEARLY[YEARLY.length - 2].year;
        }
        renderMonthCompare();
        renderYearCompare();
      }
      function cmpRows(metrics, a, b, lA, lB) {
        return metrics
          .map(([key, label, fmt, low]) => {
            const av = a[key],
              bv = b[key];
            let w = "";
            if (av != null && bv != null) {
              const aW = low ? av < bv : av > bv;
              w = aW
                ? `<span class="winner-badge winner-a">${lA}</span>`
                : `<span class="winner-badge winner-b">${lB}</span>`;
            }
            return `<tr><td class="metric">${label}</td><td class="val-a">${av != null ? fmt(av) : "—"}</td><td class="val-b">${bv != null ? fmt(bv) : "—"}</td><td>${w}</td></tr>`;
          })
          .join("");
      }
      function renderMonthCompare() {
        const a = MONTHLY.find((m) => m.ym === document.getElementById("month-a").value);
        const b = MONTHLY.find((m) => m.ym === document.getElementById("month-b").value);
        if (!a || !b) return;
        const m = [
          ["km", "Összes km", (v) => v.toFixed(1) + "km", false],
          ["runs", "Futások", (v) => v, false],
          ["avg_pace", "Átl. tempó", (v) => fmtPace(v), true],
          ["best_pace", "Legjobb tempó", (v) => fmtPace(v), true],
          ["max_dist", "Leghosszabb", (v) => v.toFixed(1) + "km", false],
          ["avg_hr", "Átl. HR", (v) => v.toFixed(0) + " bpm", true],
          ["total_trimp", "TRIMP", (v) => v.toFixed(0), false],
          ["avg_z1", "Z1%", (v) => v.toFixed(0) + "%", false],
          ["avg_aei", "AEI", (v) => (v != null ? v.toFixed(2) : "—"), false],
        ];
        document.getElementById("month-compare-table").innerHTML =
          `<thead><tr><th>Mutató</th><th style="color:#60a5fa">${a.ym}</th><th style="color:${getLime()}">${b.ym}</th><th>Jobb</th></tr></thead><tbody>${cmpRows(m, a, b, a.ym, b.ym)}</tbody>`;
      }
      function renderYearCompare() {
        const a = YEARLY.find((y) => y.year == document.getElementById("year-a").value);
        const b = YEARLY.find((y) => y.year == document.getElementById("year-b").value);
        if (!a || !b) return;
        const m = [
          ["km", "Összes km", (v) => v.toFixed(0) + "km", false],
          ["runs", "Futások", (v) => v, false],
          ["avg_pace", "Átl. tempó", (v) => fmtPace(v), true],
          ["best_pace", "Legjobb tempó", (v) => fmtPace(v), true],
          ["longest_run", "Leghosszabb", (v) => v.toFixed(1) + "km", false],
          ["avg_hr", "Átl. HR", (v) => v.toFixed(0) + " bpm", true],
          ["total_trimp", "TRIMP", (v) => v.toFixed(0), false],
          ["avg_z1", "Z1%", (v) => v.toFixed(0) + "%", false],
          ["avg_aei", "AEI", (v) => (v != null ? v.toFixed(2) : "—"), false],
          ["total_cal", "Kalória", (v) => Math.round(v).toLocaleString() + " kcal", false],
        ];
        document.getElementById("year-compare-table").innerHTML =
          `<thead><tr><th>Mutató</th><th style="color:#60a5fa">${a.year}</th><th style="color:${getLime()}">${b.year}</th><th>Jobb</th></tr></thead><tbody>${cmpRows(m, a, b, a.year, b.year)}</tbody>`;
      }

      // ── TRENDS ──
      function drawTrendCharts() {
        const isLight = document.documentElement.classList.contains("light");
        const pts = RUNS.map((r) => {
          if (!r.avg_hr || !r.pace || r.avg_hr < 80 || r.pace > 9.5) return null;
          const isZ1 = r.z1 >= 50;
          return {
            x: r.avg_hr,
            y: r.pace,
            r: Math.max(3, Math.min(8, r.dist * 0.35)),
            color:
              r.year >= 2026
                ? "rgba(96,165,250,.85)"
                : isZ1
                  ? isLight
                    ? "rgba(100,130,0,.8)"
                    : "rgba(200,241,53,.75)"
                  : "rgba(255,140,0,.5)",
            run: r,
          };
        }).filter(Boolean);
        drawScatterChart("scatterChart", pts, { minX: 110, maxX: 190, minY: 4, maxY: 9 });
        drawBar(
          "zoneTimeChart",
          MONTHLY.map((m) => m.ym.slice(2)),
          [
            { data: MONTHLY.map((m) => m.avg_z1), color: LIME, label: "Z1%" },
            { data: MONTHLY.map((m) => m.avg_z4), color: "rgba(255,140,0,.7)", label: "Z4%" },
          ],
          { rotateLabels: true, yFmt: (v) => Math.round(v) + "%", maxVal: 100 },
        );
        const wk = WEEKLY.slice(-60);
        drawBar(
          "weeklyTRIMPChart",
          wk.map((w) => w.date.slice(5)),
          [
            {
              data: wk.map((w) => w.trimp),
              color: wk.map((w) =>
                w.trimp > 300
                  ? getLime()
                  : w.trimp > 150
                    ? isLight
                      ? "rgba(100,140,0,.45)"
                      : "rgba(200,241,53,.5)"
                    : isLight
                      ? "rgba(100,140,0,.2)"
                      : "rgba(200,241,53,.2)",
              ),
            },
          ],
          { rotateLabels: true, yFmt: (v) => Math.round(v) },
        );
        // ACWR
        const acwr = _computeACWR();
        if (acwr.length) {
          drawLine(
            "acwrChart",
            acwr.map((a) => a.date.slice(5)),
            [{ data: acwr.map((a) => a.value), color: "#60a5fa", fill: false, label: "ACWR" }],
            {
              rotateLabels: true,
              yFmt: (v) => v.toFixed(2),
              minVal: 0,
              maxVal: Math.max(2, Math.max(...acwr.map((a) => a.value)) * 1.1),
              refLines: [
                { value: 1.5, color: "#ff4444", label: "1.5 — túlterhelés kockázata" },
                { value: 0.8, color: "#ff8c00", label: "0.8 — alulterhelés" },
              ],
            },
          );
        }
        // Cadence trend
        const cadM = MONTHLY.map((m) => {
          const rs = RUNS.filter((r) => r.ym === m.ym && r.cadence > 0);
          return rs.length ? +(rs.reduce((s, r) => s + r.cadence, 0) / rs.length).toFixed(1) : null;
        });
        const cadLabels = MONTHLY.map((m) => m.ym.slice(2));
        if (cadM.some((v) => v)) {
          drawLine(
            "cadenceChart",
            cadLabels,
            [{ data: cadM, color: getLime(), fill: true, fillColor: getLimeDim(), label: "lépés/perc" }],
            { rotateLabels: true, yFmt: (v) => Math.round(v) },
          );
        }
        // Intensity donut — build period pills once
        const nav = document.getElementById("int-nav");
        if (!nav.dataset.built) {
          nav.dataset.built = "1";
          [
            [30, "30 nap"],
            [90, "90 nap"],
            [365, "1 év"],
            [0, "Összes"],
          ].forEach(([d, lbl]) => {
            const btn = document.createElement("button");
            btn.className = "int-pill";
            btn.dataset.d = d;
            btn.textContent = lbl;
            btn.onclick = () => _drawIntensity(d);
            nav.appendChild(btn);
          });
        }
        _drawIntensity(_intPeriod);
      }

      // ── EGÉSZSÉG ──
      function drawHealthCharts() {
        if (!HEALTH.length) {
          document
            .getElementById("page-health")
            .querySelectorAll("canvas")
            .forEach((c) => {
              const ctx = c.getContext("2d");
              ctx.clearRect(0, 0, c.width, c.height);
              ctx.fillStyle = gv("--text3");
              ctx.font = "13px Inter,sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(
                "Egészség adatok betöltése...",
                c.offsetWidth / 2,
                (parseInt(c.getAttribute("height")) || 150) / 2,
              );
            });
          return;
        }
        const isLight = document.documentElement.classList.contains("light");
        const today = new Date().toISOString().slice(0, 10);
        const cut90 = new Date();
        cut90.setDate(cut90.getDate() - 90);
        const c90 = cut90.toISOString().slice(0, 10);
        const cut60 = new Date();
        cut60.setDate(cut60.getDate() - 60);
        const c60 = cut60.toISOString().slice(0, 10);

        // Resting HR (last 90 days)
        const hrD = HEALTH.filter((h) => h.date >= c90 && h.resting_hr > 0);
        if (hrD.length)
          drawLine(
            "restingHRChart",
            hrD.map((h) => h.date.slice(5)),
            [
              {
                data: hrD.map((h) => h.resting_hr),
                color: "#ff6622",
                fill: true,
                fillColor: "rgba(255,102,34,.1)",
                label: "bpm",
              },
            ],
            { rotateLabels: true, yFmt: (v) => Math.round(v) + " bpm" },
          );

        // HRV (last 90 days)
        const hrvD = HEALTH.filter((h) => h.date >= c90 && h.hrv > 0);
        if (hrvD.length)
          drawLine(
            "hrvChart",
            hrvD.map((h) => h.date.slice(5)),
            [{ data: hrvD.map((h) => h.hrv), color: getLime(), fill: true, fillColor: getLimeDim(), label: "ms" }],
            { rotateLabels: true, yFmt: (v) => Math.round(v) + " ms" },
          );

        // Forma Index (last 90 days, baseline from all history)
        const allHRV = HEALTH.filter((h) => h.hrv > 0).map((h) => h.hrv);
        const allHR = HEALTH.filter((h) => h.resting_hr > 0).map((h) => h.resting_hr);
        if (allHRV.length && allHR.length) {
          const avgHRV = allHRV.reduce((s, v) => s + v, 0) / allHRV.length;
          const avgHR = allHR.reduce((s, v) => s + v, 0) / allHR.length;
          const formaD = HEALTH.filter((h) => h.date >= c90 && h.hrv > 0 && h.resting_hr > 0);
          const formaVals = formaD.map((h) => {
            const hrvScore = ((h.hrv - avgHRV) / avgHRV) * 40; // ±40 based on deviation from avg
            const hrScore = (-(h.resting_hr - avgHR) / avgHR) * 20; // ±20 (lower HR = higher score)
            return Math.min(100, Math.max(0, Math.round(50 + hrvScore + hrScore)));
          });
          drawLine(
            "formaChart",
            formaD.map((h) => h.date.slice(5)),
            [{ data: formaVals, color: "#60a5fa", fill: true, fillColor: "rgba(96,165,250,.08)", label: "Forma" }],
            {
              rotateLabels: true,
              yFmt: (v) => Math.round(v),
              minVal: 0,
              maxVal: 100,
              refLines: [
                { value: 70, color: getLime(), label: "70 — jó forma" },
                { value: 30, color: "#ff4444", label: "30 — fáradt" },
              ],
            },
          );
        }

        // VO2 Max
        _buildVo2Nav();
        drawVo2Chart();

        // Steps (last 60 days)
        const stepsD = HEALTH.filter((h) => h.date >= c60 && h.steps > 0);
        if (stepsD.length)
          drawBar(
            "stepsChart",
            stepsD.map((h) => h.date.slice(5)),
            [
              {
                data: stepsD.map((h) => h.steps),
                color: stepsD.map((h) =>
                  h.steps >= 10000 ? getLime() : isLight ? "rgba(120,154,0,.3)" : "rgba(200,241,53,.3)",
                ),
                label: "lépés",
              },
            ],
            { rotateLabels: true, yFmt: (v) => Math.round(v / 1000) + "k" },
          );

        // Active calories (last 60 days)
        const calD = HEALTH.filter((h) => h.date >= c60 && h.active_cal > 0);
        if (calD.length)
          drawBar(
            "activeCalChart",
            calD.map((h) => h.date.slice(5)),
            [
              {
                data: calD.map((h) => h.active_cal),
                color: calD.map((h) =>
                  h.active_cal >= 500 ? getLime() : isLight ? "rgba(120,154,0,.3)" : "rgba(200,241,53,.3)",
                ),
                label: "kcal",
              },
            ],
            { rotateLabels: true, yFmt: (v) => Math.round(v) + "kcal" },
          );
      }

      // ── INIT ──
      _bootstrap();
    