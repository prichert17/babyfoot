// ============================================
// CHART — Canvas-based ELO line chart
// No external dependencies
// ============================================

const Chart = (() => {

  // Draw global ELO evolution chart on a canvas element
  const drawEloChart = (canvasId, historyMap, players, options = {}) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Responsive sizing
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const W = container.clientWidth || 700;
    const H = options.height || 260;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    const PAD = { top: 20, right: 24, bottom: 40, left: 56 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Filter players with at least 1 match point
    const activePlayers = players.filter(p => historyMap[p.id] && historyMap[p.id].length > 1);
    if (!activePlayers.length) {
      ctx.fillStyle = '#606078';
      ctx.font = '13px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Pas encore assez de matchs', W / 2, H / 2);
      return;
    }

    // Collect all data points to find axis bounds
    let allElos = [1000];
    let allDates = [];
    activePlayers.forEach(p => {
      (historyMap[p.id] || []).forEach(pt => {
        allElos.push(pt.elo);
        allDates.push(new Date(pt.date).getTime());
      });
    });

    const minElo = Math.min(...allElos) - 30;
    const maxElo = Math.max(...allElos) + 30;
    const minDate = Math.min(...allDates);
    const maxDate = Math.max(...allDates);
    const dateRange = maxDate - minDate || 1;
    const eloRange = maxElo - minElo || 1;

    const toX = (ts) => PAD.left + ((ts - minDate) / dateRange) * chartW;
    const toY = (elo) => PAD.top + chartH - ((elo - minElo) / eloRange) * chartH;

    // Grid lines (ELO)
    const gridCount = 5;
    ctx.strokeStyle = '#1c1c22';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#606078';
    ctx.font = `${11 * (W < 500 ? 0.85 : 1)}px JetBrains Mono, monospace`;
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridCount; i++) {
      const elo = minElo + (eloRange * i / gridCount);
      const y = toY(elo);
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + chartW, y);
      ctx.stroke();
      ctx.fillText(Math.round(elo), PAD.left - 6, y + 4);
    }

    // 1000 baseline (dashed)
    if (minElo < 1000 && maxElo > 1000) {
      const y1000 = toY(1000);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#3a3a50';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y1000);
      ctx.lineTo(PAD.left + chartW, y1000);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw each player line
    activePlayers.forEach(player => {
      const pts = historyMap[player.id];
      if (!pts || pts.length < 2) return;
      const color = player.color || '#f0e030';

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash([]);
      ctx.beginPath();

      pts.forEach((pt, i) => {
        const x = toX(new Date(pt.date).getTime());
        const y = toY(pt.elo);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Dots on each point
      pts.forEach(pt => {
        const x = toX(new Date(pt.date).getTime());
        const y = toY(pt.elo);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });

      // End label (current ELO)
      const last = pts[pts.length - 1];
      const lx = toX(new Date(last.date).getTime());
      const ly = toY(last.elo);
      ctx.fillStyle = color;
      ctx.font = 'bold 11px DM Sans, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(last.elo, Math.min(lx + 5, W - PAD.right - 30), ly + 4);
    });

    // X axis dates
    ctx.fillStyle = '#606078';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    const xLabels = 5;
    for (let i = 0; i <= xLabels; i++) {
      const ts = minDate + (dateRange * i / xLabels);
      const d = new Date(ts);
      const label = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
      ctx.fillText(label, toX(ts), H - PAD.bottom + 18);
    }
  };

  // Mini ELO chart for player profile modal
  const drawMiniEloChart = (canvasId, history, color, options = {}) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement?.clientWidth || 500;
    const H = options.height || 180;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    const PAD = { top: 14, right: 16, bottom: 30, left: 50 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);

    if (!history || history.length < 2) {
      ctx.fillStyle = '#606078';
      ctx.font = '12px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Pas encore de matchs', W / 2, H / 2);
      return;
    }

    const elos = history.map(p => p.elo);
    const minElo = Math.min(...elos) - 20;
    const maxElo = Math.max(...elos) + 20;
    const eloRange = maxElo - minElo || 1;

    const toX = (i) => PAD.left + (i / (history.length - 1)) * chartW;
    const toY = (elo) => PAD.top + chartH - ((elo - minElo) / eloRange) * chartH;

    // Grid
    for (let i = 0; i <= 4; i++) {
      const elo = minElo + (eloRange * i / 4);
      const y = toY(elo);
      ctx.strokeStyle = '#1c1c22';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + chartW, y);
      ctx.stroke();
      ctx.fillStyle = '#606078';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(elo), PAD.left - 4, y + 3);
    }

    // Filled area under line
    ctx.beginPath();
    history.forEach((pt, i) => {
      const x = toX(i), y = toY(pt.elo);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(toX(history.length - 1), PAD.top + chartH);
    ctx.lineTo(toX(0), PAD.top + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
    grad.addColorStop(0, color + '44');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    history.forEach((pt, i) => {
      const x = toX(i), y = toY(pt.elo);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
    history.forEach((pt, i) => {
      ctx.beginPath();
      ctx.arc(toX(i), toY(pt.elo), 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    // X labels (match numbers)
    ctx.fillStyle = '#606078';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    const step = Math.ceil(history.length / 8);
    history.forEach((pt, i) => {
      if (i % step === 0 || i === history.length - 1) {
        ctx.fillText(`M${i}`, toX(i), H - PAD.bottom + 16);
      }
    });
  };

  return { drawEloChart, drawMiniEloChart };
})();