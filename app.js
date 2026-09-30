(() => {
  const gravity = 9.81;
  const heroCanvas = document.getElementById('hero-canvas');
  const simCanvas = document.getElementById('sim-canvas');
  const chartCanvas = document.getElementById('chart-canvas');
  const heroContext = heroCanvas.getContext('2d');
  const simContext = simCanvas.getContext('2d');
  const chartContext = chartCanvas.getContext('2d');
  const angleInput = document.getElementById('angle-input');
  const lengthInput = document.getElementById('length-input');
  const massInput = document.getElementById('mass-input');
  const startButton = document.getElementById('start-button');
  const resetButton = document.getElementById('reset-button');
  const simulationStatus = document.getElementById('sim-status');
  const elapsedReadout = document.getElementById('elapsed-readout');
  const angleReadout = document.getElementById('angle-readout');
  const periodOutput = document.getElementById('period-output');
  const tensionOutput = document.getElementById('tension-output');
  const chartTimeLabel = document.getElementById('chart-time-label');
  const history = [];
  let angle = Number(angleInput.value) * Math.PI / 180;
  let angularVelocity = 0;
  let elapsed = 0;
  let running = false;
  let lastFrame = 0;
  let sampleTime = 0;
  let lastUpwardCrossing = null;
  let measuredPeriod = null;
  let heroStart = performance.now();

  const format = (value, digits = 2) => value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const parameters = () => ({
    initialAngle: Number(angleInput.value) * Math.PI / 180,
    length: Number(lengthInput.value),
    mass: Number(massInput.value)
  });
  const period = (length) => 2 * Math.PI * Math.sqrt(length / gravity);
  const setCanvasSize = (canvas, context) => {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width: rect.width, height: rect.height };
  };
  const drawPendulum = (context, width, height, theta, length, mass, velocity, hero = false) => {
    context.clearRect(0, 0, width, height);
    const originX = width * (hero ? .52 : .5);
    const originY = height * (hero ? .13 : .17);
    const armLength = Math.min(height * (hero ? .65 : .63), width * .34) * Math.sqrt(length / 1.2);
    const bobX = originX + Math.sin(theta) * armLength;
    const bobY = originY + Math.cos(theta) * armLength;
    const bobRadius = (hero ? 15 : 14) + Math.sqrt(mass) * 3.2;

    if (hero) {
      for (let index = 0; index < 44; index += 1) {
        const x = (index * 83 + 17) % width;
        const y = (index * 47 + 9) % height;
        const pulse = .22 + .2 * (1 + Math.sin(performance.now() / 1200 + index)) / 2;
        context.fillStyle = `rgba(221, 232, 212, ${pulse})`;
        context.beginPath();
        context.arc(x, y, index % 7 === 0 ? 1.25 : .7, 0, Math.PI * 2);
        context.fill();
      }
    }

    context.save();
    context.setLineDash([3, 7]);
    context.strokeStyle = hero ? 'rgba(199, 239, 105, .19)' : 'rgba(199, 239, 105, .22)';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(originX, originY, armLength, Math.PI / 2 - Math.min(.8, Math.abs(theta) + .18), Math.PI / 2 + Math.min(.8, Math.abs(theta) + .18));
    context.stroke();
    context.setLineDash([]);
    context.strokeStyle = hero ? 'rgba(199, 239, 105, .25)' : 'rgba(199, 239, 105, .3)';
    context.beginPath();
    context.moveTo(originX, originY);
    context.lineTo(originX, originY + armLength * 1.07);
    context.stroke();
    context.restore();

    context.fillStyle = '#d9e1d2';
    context.fillRect(originX - 28, originY - 8, 56, 5);
    context.fillStyle = '#7f8c7d';
    context.beginPath();
    context.arc(originX, originY, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = hero ? 'rgba(232, 238, 223, .82)' : 'rgba(232, 238, 223, .88)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(originX, originY);
    context.lineTo(bobX, bobY);
    context.stroke();

    const glow = context.createRadialGradient(bobX, bobY, 1, bobX, bobY, bobRadius * 2.9);
    glow.addColorStop(0, 'rgba(199, 239, 105, .26)');
    glow.addColorStop(1, 'rgba(199, 239, 105, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(bobX, bobY, bobRadius * 2.9, 0, Math.PI * 2);
    context.fill();
    const metal = context.createLinearGradient(bobX - bobRadius, bobY - bobRadius, bobX + bobRadius, bobY + bobRadius);
    metal.addColorStop(0, '#edfaa9');
    metal.addColorStop(.45, '#c7ef69');
    metal.addColorStop(1, '#83a844');
    context.fillStyle = metal;
    context.beginPath();
    context.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(240, 250, 197, .85)';
    context.lineWidth = 1;
    context.stroke();

    if (!hero) {
      const angleDegrees = theta * 180 / Math.PI;
      const tension = mass * (gravity * Math.cos(theta) + length * velocity * velocity);
      const labelX = Math.max(18, Math.min(width - 100, bobX + (theta >= 0 ? 18 : -87)));
      const labelY = Math.max(42, Math.min(height - 20, bobY - 12));
      context.fillStyle = '#9da99b';
      context.font = '11px "DM Mono", monospace';
      context.fillText(`${format(length, 2)} m`, originX + 12, originY + armLength * .48);
      context.fillStyle = '#c7ef69';
      context.fillText(`T ${format(tension, 2)} N`, labelX, labelY);
      context.strokeStyle = 'rgba(239, 128, 90, .7)';
      context.lineWidth = 1;
      context.beginPath();
      context.arc(originX, originY, 34, Math.PI / 2 - Math.min(Math.abs(theta), .95), Math.PI / 2);
      context.stroke();
      context.fillStyle = '#ef805a';
      context.fillText(`${format(Math.abs(angleDegrees), 0)}°`, originX + (theta >= 0 ? 39 : -63), originY + 43);
    }
  };
  const updateRangeProgress = (input) => {
    const min = Number(input.min);
    const max = Number(input.max);
    const progress = ((Number(input.value) - min) / (max - min)) * 100;
    input.style.setProperty('--range-progress', `${progress}%`);
  };
  const refreshLabels = () => {
    const { length, mass } = parameters();
    document.getElementById('angle-value').textContent = `${angleInput.value}°`;
    document.getElementById('length-value').textContent = `${format(length)} m`;
    document.getElementById('mass-value').textContent = `${format(mass)} kg`;
    periodOutput.textContent = `${format(period(length))} s`;
    [angleInput, lengthInput, massInput].forEach(updateRangeProgress);
    if (!running && elapsed === 0) angle = parameters().initialAngle;
    angleReadout.textContent = `${format(angle * 180 / Math.PI, 1)}°`;
    const tension = mass * (gravity * Math.cos(angle) + length * angularVelocity * angularVelocity);
    tensionOutput.textContent = `${format(Math.max(0, tension))} N`;
  };
  const resetSimulation = () => {
    const values = parameters();
    angle = values.initialAngle;
    angularVelocity = 0;
    elapsed = 0;
    sampleTime = 0;
    lastUpwardCrossing = null;
    measuredPeriod = null;
    history.length = 0;
    history.push({ time: 0, angle: angle * 180 / Math.PI });
    running = false;
    lastFrame = 0;
    simulationStatus.textContent = 'Pronto para iniciar';
    startButton.innerHTML = '<span class="icon" aria-hidden="true">▶</span><span>Iniciar simulação</span>';
    elapsedReadout.textContent = '0,00 s';
    chartTimeLabel.textContent = 't = 0,00 s';
    refreshLabels();
    render();
  };
  const derivative = (theta, velocity, length) => ({ theta: velocity, velocity: -(gravity / length) * Math.sin(theta) - .008 * velocity });
  const integrate = (delta, length) => {
    const first = derivative(angle, angularVelocity, length);
    const second = derivative(angle + first.theta * delta / 2, angularVelocity + first.velocity * delta / 2, length);
    const third = derivative(angle + second.theta * delta / 2, angularVelocity + second.velocity * delta / 2, length);
    const fourth = derivative(angle + third.theta * delta, angularVelocity + third.velocity * delta, length);
    const oldAngle = angle;
    angle += delta / 6 * (first.theta + 2 * second.theta + 2 * third.theta + fourth.theta);
    angularVelocity += delta / 6 * (first.velocity + 2 * second.velocity + 2 * third.velocity + fourth.velocity);
    elapsed += delta;
    if (oldAngle < 0 && angle >= 0 && angularVelocity > 0) {
      if (lastUpwardCrossing !== null) measuredPeriod = elapsed - lastUpwardCrossing;
      lastUpwardCrossing = elapsed;
    }
    sampleTime += delta;
    if (sampleTime >= .035) {
      history.push({ time: elapsed, angle: angle * 180 / Math.PI });
      sampleTime = 0;
      if (history.length > 1200) history.shift();
    }
  };
  const drawChart = () => {
    const { width, height } = setCanvasSize(chartCanvas, chartContext);
    const context = chartContext;
    context.clearRect(0, 0, width, height);
    const left = 42;
    const right = width - 12;
    const top = 15;
    const bottom = height - 31;
    const plotWidth = Math.max(1, right - left);
    const plotHeight = Math.max(1, bottom - top);
    const maxTime = Math.max(4, Math.ceil(elapsed / 2) * 2);
    const maxAngle = Math.max(30, Math.ceil(Number(angleInput.value) / 10) * 10 + 10);
    context.font = '10px "DM Mono", monospace';
    context.lineWidth = 1;
    for (let step = -2; step <= 2; step += 1) {
      const y = top + plotHeight * (2 - step) / 4;
      context.strokeStyle = step === 0 ? 'rgba(239, 128, 90, .72)' : 'rgba(215, 226, 209, .10)';
      context.setLineDash(step === 0 ? [4, 5] : []);
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(right, y);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = '#849087';
      context.textAlign = 'right';
      context.fillText(`${step * maxAngle / 2}°`, left - 8, y + 3);
    }
    const timeSteps = 4;
    for (let step = 0; step <= timeSteps; step += 1) {
      const x = left + plotWidth * step / timeSteps;
      context.strokeStyle = 'rgba(215, 226, 209, .08)';
      context.beginPath();
      context.moveTo(x, top);
      context.lineTo(x, bottom);
      context.stroke();
      context.fillStyle = '#849087';
      context.textAlign = 'center';
      context.fillText(`${format(maxTime * step / timeSteps, 0)}s`, x, height - 10);
    }
    const visibleHistory = history.filter((point) => point.time <= maxTime);
    if (visibleHistory.length > 0) {
      context.beginPath();
      visibleHistory.forEach((point, index) => {
        const x = left + Math.min(1, point.time / maxTime) * plotWidth;
        const y = top + plotHeight * (.5 - point.angle / (maxAngle * 2));
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      if (!running && visibleHistory.length === 1) {
        const first = visibleHistory[0];
        context.lineTo(left + Math.min(1, first.time / maxTime) * plotWidth + 2, top + plotHeight * (.5 - first.angle / (maxAngle * 2)));
      }
      context.strokeStyle = '#c7ef69';
      context.lineWidth = 2;
      context.lineJoin = 'round';
      context.stroke();
    }
    context.fillStyle = '#849087';
    context.textAlign = 'left';
    context.fillText(`T teórico ${format(period(parameters().length))} s.`, left + 3, top + 12);
    context.textAlign = 'left';
    chartTimeLabel.textContent = `t = ${format(elapsed)} s${measuredPeriod ? ` · T medido ≈ ${format(measuredPeriod)} s` : ''}`;
  };
  const render = (now = performance.now()) => {
    const heroSize = setCanvasSize(heroCanvas, heroContext);
    const simSize = setCanvasSize(simCanvas, simContext);
    const values = parameters();
    const heroTheta = .38 * Math.sin((now - heroStart) / 1100);
    drawPendulum(heroContext, heroSize.width, heroSize.height, heroTheta, 1.2, .5, 0, true);
    drawPendulum(simContext, simSize.width, simSize.height, angle, values.length, values.mass, angularVelocity);
    drawChart();
    if (running) {
      if (lastFrame) {
        const delta = Math.min((now - lastFrame) / 1000, .04);
        const steps = Math.max(1, Math.ceil(delta / .008));
        for (let index = 0; index < steps; index += 1) integrate(delta / steps, values.length);
      }
      lastFrame = now;
      elapsedReadout.textContent = `${format(elapsed)} s`;
      angleReadout.textContent = `${format(angle * 180 / Math.PI, 1)}°`;
      simulationStatus.textContent = 'Simulação em andamento';
      const tension = values.mass * (gravity * Math.cos(angle) + values.length * angularVelocity * angularVelocity);
      tensionOutput.textContent = `${format(Math.max(0, tension))} N`;
    }
    requestAnimationFrame(render);
  };

  [angleInput, lengthInput, massInput].forEach((input) => input.addEventListener('input', resetSimulation));
  startButton.addEventListener('click', () => {
    running = !running;
    lastFrame = 0;
    if (running) {
      simulationStatus.textContent = 'Simulação em andamento';
      startButton.innerHTML = '<span class="icon" aria-hidden="true">Ⅱ</span><span>Pausar simulação</span>';
    } else {
      simulationStatus.textContent = 'Simulação pausada';
      startButton.innerHTML = '<span class="icon" aria-hidden="true">▶</span><span>Continuar simulação</span>';
    }
  });
  resetButton.addEventListener('click', resetSimulation);
  document.getElementById('menu-toggle').addEventListener('click', (event) => {
    const button = event.currentTarget;
    const nav = document.getElementById('site-nav');
    const isOpen = nav.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(isOpen));
    button.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
    button.textContent = isOpen ? '×' : '☰';
  });
  document.querySelectorAll('.site-nav a').forEach((link) => link.addEventListener('click', () => {
    document.getElementById('site-nav').classList.remove('is-open');
    document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
    document.getElementById('menu-toggle').setAttribute('aria-label', 'Abrir menu');
    document.getElementById('menu-toggle').textContent = '☰';
  }));
  refreshLabels();
  resetSimulation();
  requestAnimationFrame(render);
})();
