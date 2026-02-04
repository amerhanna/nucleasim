const modelSelect = document.getElementById("modelSelect");
const parameterFields = document.getElementById("parameterFields");
const modelDescription = document.getElementById("modelDescription");
const modelCode = document.getElementById("modelCode");
const insightsList = document.getElementById("insightsList");
const runBtn = document.getElementById("runBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const elapsedTimeEl = document.getElementById("elapsedTime");
const stepCountEl = document.getElementById("stepCount");
const energyMetricEl = document.getElementById("energyMetric");
const timeHorizonInput = document.getElementById("timeHorizon");
const stepSizeInput = document.getElementById("stepSize");
const canvas = document.getElementById("plotCanvas");
const canvasStatus = document.getElementById("canvasStatus");
const ctx = canvas ? canvas.getContext("2d") : null;

const models = {
  spring: {
    name: "Mass-Spring-Damper",
    description:
      "Classic second-order dynamics with damping and harmonic forcing. Observe oscillations and energy dissipation.",
    parameters: [
      { key: "mass", label: "Mass (kg)", value: 1.2, min: 0.2, max: 5, step: 0.1 },
      { key: "stiffness", label: "Spring k (N/m)", value: 12, min: 1, max: 40, step: 0.5 },
      { key: "damping", label: "Damping c", value: 0.6, min: 0.1, max: 3, step: 0.05 },
      { key: "force", label: "Driving Force", value: 1.8, min: 0, max: 6, step: 0.1 },
    ],
    state: { x: 1, v: 0 },
    derivatives: (state, params, t) => {
      const { x, v } = state;
      const { mass, stiffness, damping, force } = params;
      const drive = force * Math.sin(1.1 * t);
      const a = (-stiffness * x - damping * v + drive) / mass;
      return { x: v, v: a };
    },
    metric: (state, params) => {
      const { mass, stiffness } = params;
      const kinetic = 0.5 * mass * state.v * state.v;
      const potential = 0.5 * stiffness * state.x * state.x;
      return kinetic + potential;
    },
    code: `model MassSpringDamper
  parameter Real m=1.2;
  parameter Real k=12;
  parameter Real c=0.6;
  parameter Real F=1.8;
  Real x(start=1);
  Real v(start=0);
  equation
    der(x) = v;
    der(v) = (-k*x - c*v + F*sin(1.1*time)) / m;
end MassSpringDamper;`,
    insights: [
      "Increasing damping flattens oscillations and lowers the energy curve.",
      "Driving force can induce steady-state resonance near the natural frequency.",
      "Watch energy decay when damping dominates forcing.",
    ],
    series: (state) => ({ primary: state.x, secondary: state.v }),
  },
  predator: {
    name: "Predator–Prey",
    description:
      "Lotka–Volterra dynamics describing coupled biological populations. Phase cycles emerge with tuned rates.",
    parameters: [
      { key: "alpha", label: "Prey Growth α", value: 1.1, min: 0.1, max: 3, step: 0.05 },
      { key: "beta", label: "Predation β", value: 0.4, min: 0.05, max: 2, step: 0.05 },
      { key: "delta", label: "Predator Gain δ", value: 0.3, min: 0.05, max: 2, step: 0.05 },
      { key: "gamma", label: "Predator Loss γ", value: 0.9, min: 0.1, max: 3, step: 0.05 },
    ],
    state: { prey: 1.4, predator: 0.8 },
    derivatives: (state, params) => {
      const { prey, predator } = state;
      const { alpha, beta, delta, gamma } = params;
      return {
        prey: alpha * prey - beta * prey * predator,
        predator: delta * prey * predator - gamma * predator,
      };
    },
    metric: (state) => state.prey + state.predator,
    code: `model PredatorPrey
  parameter Real alpha=1.1;
  parameter Real beta=0.4;
  parameter Real delta=0.3;
  parameter Real gamma=0.9;
  Real prey(start=1.4);
  Real predator(start=0.8);
  equation
    der(prey) = alpha*prey - beta*prey*predator;
    der(predator) = delta*prey*predator - gamma*predator;
end PredatorPrey;`,
    insights: [
      "Stable cycles appear when growth and loss rates balance.",
      "Reducing predation allows prey to overshoot, increasing predator peaks.",
      "The total population metric reflects ecosystem pressure.",
    ],
    series: (state) => ({ primary: state.prey, secondary: state.predator }),
  },
  thermal: {
    name: "Thermal Network",
    description:
      "Two-room thermal RC network with heat transfer and external gain. Adjust coupling for lag response.",
    parameters: [
      { key: "capA", label: "Capacitance A", value: 6, min: 1, max: 12, step: 0.5 },
      { key: "capB", label: "Capacitance B", value: 4.5, min: 1, max: 12, step: 0.5 },
      { key: "conduct", label: "Conductance", value: 1.6, min: 0.1, max: 5, step: 0.1 },
      { key: "heater", label: "Heater Input", value: 3.2, min: 0, max: 8, step: 0.1 },
    ],
    state: { tempA: 2.2, tempB: 1.1 },
    derivatives: (state, params, t) => {
      const { tempA, tempB } = state;
      const { capA, capB, conduct, heater } = params;
      const external = 1 + 0.6 * Math.sin(0.4 * t);
      const flux = conduct * (tempB - tempA);
      return {
        tempA: (flux + heater * external) / capA,
        tempB: (-flux + 0.4 * external) / capB,
      };
    },
    metric: (state) => (state.tempA + state.tempB) / 2,
    code: `model ThermalNetwork
  parameter Real capA=6;
  parameter Real capB=4.5;
  parameter Real conduct=1.6;
  parameter Real heater=3.2;
  Real tempA(start=2.2);
  Real tempB(start=1.1);
  equation
    der(tempA) = (conduct*(tempB-tempA) + heater*(1+0.6*sin(0.4*time))) / capA;
    der(tempB) = (conduct*(tempA-tempB) + 0.4*(1+0.6*sin(0.4*time))) / capB;
end ThermalNetwork;`,
    insights: [
      "Higher conductance synchronizes the temperatures faster.",
      "Capacitance acts as thermal inertia, slowing response time.",
      "Heater modulation creates periodic thermal cycles.",
    ],
    series: (state) => ({ primary: state.tempA, secondary: state.tempB }),
  },
};

let currentModel = models.spring;
let state = { ...currentModel.state };
let time = 0;
let step = 0;
let running = false;
let history = [];

const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

const rk4Step = (stateObj, params, t, dt, derivativeFn) => {
  const k1 = derivativeFn(stateObj, params, t);
  const k2 = derivativeFn(addState(stateObj, scaleState(k1, dt / 2)), params, t + dt / 2);
  const k3 = derivativeFn(addState(stateObj, scaleState(k2, dt / 2)), params, t + dt / 2);
  const k4 = derivativeFn(addState(stateObj, scaleState(k3, dt)), params, t + dt);
  const combined = addState(
    addState(k1, scaleState(k2, 2)),
    addState(scaleState(k3, 2), k4)
  );
  return addState(stateObj, scaleState(combined, dt / 6));
};

const addState = (a, b) => {
  const result = {};
  Object.keys(a).forEach((key) => {
    result[key] = a[key] + b[key];
  });
  return result;
};

const scaleState = (a, factor) => {
  const result = {};
  Object.keys(a).forEach((key) => {
    result[key] = a[key] * factor;
  });
  return result;
};

const renderParameterFields = () => {
  parameterFields.innerHTML = "";
  currentModel.parameters.forEach((param) => {
    const wrapper = document.createElement("label");
    wrapper.className = "field";
    wrapper.innerHTML = `${param.label}
      <input type="number" step="${param.step}" min="${param.min}" max="${param.max}" value="${param.value}" data-key="${param.key}" />`;
    parameterFields.appendChild(wrapper);
  });

  parameterFields.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", (event) => {
      const key = event.target.dataset.key;
      const value = Number(event.target.value);
      const param = currentModel.parameters.find((item) => item.key === key);
      param.value = value;
      updateMetric();
    });
  });
};

const renderModelDetails = () => {
  modelDescription.textContent = currentModel.description;
  modelCode.textContent = currentModel.code;
  insightsList.innerHTML = "";
  currentModel.insights.forEach((insight) => {
    const li = document.createElement("li");
    li.textContent = insight;
    insightsList.appendChild(li);
  });
};

const updateMetric = () => {
  const params = getParams();
  const metricValue = currentModel.metric(state, params);
  energyMetricEl.textContent = metricValue.toFixed(2);
};

const getParams = () => {
  const params = {};
  currentModel.parameters.forEach((param) => {
    params[param.key] = param.value;
  });
  return params;
};

const resetSimulation = () => {
  state = deepCopy(currentModel.state);
  time = 0;
  step = 0;
  history = [];
  running = false;
  elapsedTimeEl.textContent = "0.0 s";
  stepCountEl.textContent = "0";
  if (canvasStatus) {
    canvasStatus.textContent = "Ready to simulate. Click “Run Simulation” to stream results.";
  }
  updateMetric();
  drawPlot();
};

const tick = () => {
  if (!running) return;
  const dt = Number(stepSizeInput.value);
  const horizon = Number(timeHorizonInput.value);
  if (time >= horizon) {
    running = false;
    if (canvasStatus) {
      canvasStatus.textContent = "Simulation complete. Adjust parameters or reset to run again.";
    }
    return;
  }
  const params = getParams();
  state = rk4Step(state, params, time, dt, currentModel.derivatives);
  time += dt;
  step += 1;
  history.push({ t: time, ...currentModel.series(state) });
  if (history.length > 800) {
    history.shift();
  }
  elapsedTimeEl.textContent = `${time.toFixed(2)} s`;
  stepCountEl.textContent = step.toString();
  updateMetric();
  drawPlot();
  requestAnimationFrame(tick);
};

const drawPlot = () => {
  if (!ctx) {
    if (canvasStatus) {
      canvasStatus.textContent =
        "Canvas unavailable in this environment. Use a modern browser with canvas support.";
    }
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0c0f17";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i += 1) {
    const y = (height / 6) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  if (history.length < 2) return;

  const values = history.flatMap((entry) => [entry.primary, entry.secondary]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const drawSeries = (key, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((entry, index) => {
      const x = (index / (history.length - 1)) * (width - 20) + 10;
      const y = height - ((entry[key] - min) / range) * (height - 20) - 10;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  };

  drawSeries("primary", "#6ee7ff");
  drawSeries("secondary", "#4c9af1");
};

runBtn.addEventListener("click", () => {
  if (!running) {
    running = true;
    if (canvasStatus) {
      canvasStatus.textContent = "Simulation running…";
    }
    requestAnimationFrame(tick);
  }
});

pauseBtn.addEventListener("click", () => {
  running = false;
  if (canvasStatus) {
    canvasStatus.textContent = "Simulation paused. Resume or reset to continue.";
  }
});

resetBtn.addEventListener("click", resetSimulation);

modelSelect.addEventListener("change", (event) => {
  currentModel = models[event.target.value];
  renderParameterFields();
  renderModelDetails();
  resetSimulation();
});

renderParameterFields();
renderModelDetails();
resetSimulation();
