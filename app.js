const { useEffect, useMemo, useRef, useState } = React;

const COMPONENT_LIBRARY = [
  {
    type: "pid",
    label: "PID Controller",
    description: "Closed-loop control element with P/I/D tuning.",
    defaults: { kp: 1.2, ki: 0.4, kd: 0.05 },
  },
  {
    type: "plant",
    label: "Plant",
    description: "Generic process model (first-order lag).",
    defaults: { gain: 1.0, tau: 3.0 },
  },
  {
    type: "sensor",
    label: "Sensor",
    description: "Measurement block with sampling rate.",
    defaults: { rate: 10 },
  },
  {
    type: "sum",
    label: "Sum Junction",
    description: "Signal addition/subtraction node.",
    defaults: { sign: "+ -" },
  },
  {
    type: "filter",
    label: "Low-Pass Filter",
    description: "Noise reduction and smoothing.",
    defaults: { cutoff: 2.5 },
  },
];

const INITIAL_COMPONENTS = [
  { id: "c1", type: "sensor", x: 90, y: 160, params: { rate: 10 } },
  { id: "c2", type: "sum", x: 280, y: 160, params: { sign: "+ -" } },
  { id: "c3", type: "pid", x: 470, y: 160, params: { kp: 1.2, ki: 0.4, kd: 0.05 } },
  { id: "c4", type: "plant", x: 660, y: 160, params: { gain: 1.0, tau: 3.0 } },
];

const INITIAL_CONNECTIONS = [
  { id: "l1", from: "c1", to: "c2" },
  { id: "l2", from: "c2", to: "c3" },
  { id: "l3", from: "c3", to: "c4" },
];

const buildComponentTemplate = (type) => {
  const definition = COMPONENT_LIBRARY.find((item) => item.type === type);
  if (!definition) return null;
  return {
    id: `c${Math.random().toString(36).slice(2, 8)}`,
    type: definition.type,
    x: 120,
    y: 120,
    params: { ...definition.defaults },
  };
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const CANVAS_DIMENSIONS = { width: 1400, height: 900 };
const ZOOM_RANGE = { min: 0.6, max: 1.6 };

const App = () => {
  const [components, setComponents] = useState(INITIAL_COMPONENTS);
  const [connections, setConnections] = useState(INITIAL_CONNECTIONS);
  const [selectedComponent, setSelectedComponent] = useState("pid");
  const [selectedNode, setSelectedNode] = useState(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectStart, setConnectStart] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [panDrag, setPanDrag] = useState(null);
  const [activity, setActivity] = useState("Ready. Drag components onto the canvas.");
  const canvasRef = useRef(null);

  const componentMap = useMemo(() => {
    const map = new Map();
    components.forEach((item) => map.set(item.id, item));
    return map;
  }, [components]);

  const nodeRects = useMemo(() => {
    return components.reduce((acc, node) => {
      acc[node.id] = { x: node.x, y: node.y, width: 150, height: 84 };
      return acc;
    }, {});
  }, [components]);

  const handlePaletteDragStart = (event, type) => {
    event.dataTransfer.setData("component-type", type);
    event.dataTransfer.effectAllowed = "copy";
  };

  const handleCanvasDrop = (event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("component-type");
    if (!type) return;
    const template = buildComponentTemplate(type);
    if (!template) return;
    const { x, y } = getCanvasPoint(event);
    template.x = clamp(x - 70, 20, CANVAS_DIMENSIONS.width - 180);
    template.y = clamp(y - 30, 20, CANVAS_DIMENSIONS.height - 120);
    setComponents((prev) => [...prev, template]);
    setActivity(`${COMPONENT_LIBRARY.find((item) => item.type === type).label} added.`);
  };

  const handleCanvasDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleNodeMouseDown = (event, nodeId) => {
    event.stopPropagation();
    if (connectMode) return;
    const { x, y } = getCanvasPoint(event);
    const node = componentMap.get(nodeId);
    setDragState({
      nodeId,
      offsetX: x - node.x,
      offsetY: y - node.y,
    });
  };

  const handleCanvasMouseDown = (event) => {
    if (event.target !== canvasRef.current) return;
    setPanDrag({
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    });
  };

  const getCanvasPoint = (event) => {
    const bounds = canvasRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left - pan.x) / zoom,
      y: (event.clientY - bounds.top - pan.y) / zoom,
    };
  };

  const handleCanvasWheel = (event) => {
    event.preventDefault();
    const bounds = canvasRef.current.getBoundingClientRect();
    const point = getCanvasPoint(event);
    const zoomDelta = -event.deltaY * 0.001;
    const nextZoom = clamp(zoom + zoomDelta, ZOOM_RANGE.min, ZOOM_RANGE.max);
    const nextPanX = event.clientX - bounds.left - point.x * nextZoom;
    const nextPanY = event.clientY - bounds.top - point.y * nextZoom;
    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });
  };

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (dragState) {
        const { x, y } = getCanvasPoint(event);
        const nextX = clamp(x - dragState.offsetX, 20, CANVAS_DIMENSIONS.width - 180);
        const nextY = clamp(y - dragState.offsetY, 20, CANVAS_DIMENSIONS.height - 120);
        setComponents((prev) =>
          prev.map((node) => (node.id === dragState.nodeId ? { ...node, x: nextX, y: nextY } : node))
        );
        return;
      }
      if (panDrag) {
        const nextX = panDrag.originX + (event.clientX - panDrag.startX);
        const nextY = panDrag.originY + (event.clientY - panDrag.startY);
        setPan({ x: nextX, y: nextY });
      }
    };
    const handleMouseUp = () => {
      if (dragState) setDragState(null);
      if (panDrag) setPanDrag(null);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, panDrag, pan, zoom]);

  const handleNodeClick = (nodeId) => {
    if (!connectMode) return;
    if (!connectStart) {
      setConnectStart(nodeId);
      setActivity("Select the destination component to complete the link.");
      return;
    }
    if (connectStart === nodeId) {
      setConnectStart(null);
      setActivity("Connection canceled.");
      return;
    }
    const newConnection = { id: `l${Date.now()}`, from: connectStart, to: nodeId };
    setConnections((prev) => [...prev, newConnection]);
    setConnectStart(null);
    setActivity("Connection created.");
  };

  const handleSelectNode = (nodeId) => {
    setSelectedNode(nodeId);
  };

  const updateParams = (nodeId, key, value) => {
    setComponents((prev) =>
      prev.map((node) =>
        node.id === nodeId ? { ...node, params: { ...node.params, [key]: value } } : node
      )
    );
  };

  const selectedNodeData = selectedNode ? componentMap.get(selectedNode) : null;

  const clearConnections = () => {
    setConnections([]);
    setActivity("All connections cleared.");
  };

  const toggleConnectMode = () => {
    setConnectMode((prev) => {
      const next = !prev;
      setActivity(next ? "Connection mode enabled. Click two components to link." : "Connection mode off.");
      setConnectStart(null);
      return next;
    });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-kicker">NucleaSim Studio</p>
          <h1>React-Based Control System Builder</h1>
          <p className="subtitle">
            Drag control components onto the canvas, connect signal paths, and tune parameters.
          </p>
        </div>
        <div className="header-actions">
          <button className={connectMode ? "primary" : ""} onClick={toggleConnectMode}>
            {connectMode ? "Exit Connect" : "Connect Nodes"}
          </button>
          <button onClick={clearConnections}>Clear Links</button>
        </div>
      </header>

      <main className="app-grid">
        <section className="panel palette-panel">
          <div className="panel-header">
            <h2>Component Palette</h2>
            <span className="tag">Drag & Drop</span>
          </div>
          <div className="palette-list">
            {COMPONENT_LIBRARY.map((item) => (
              <div
                key={item.type}
                className={`palette-card ${selectedComponent === item.type ? "active" : ""}`}
                draggable
                onDragStart={(event) => handlePaletteDragStart(event, item.type)}
                onClick={() => setSelectedComponent(item.type)}
              >
                <div className="palette-title">{item.label}</div>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
          <div className="panel-section">
            <h3>Activity Feed</h3>
            <p className="activity">{activity}</p>
          </div>
        </section>

        <section className="panel canvas-panel">
          <div className="panel-header">
            <h2>System Canvas</h2>
            <span className="tag">{connectMode ? "Connect Mode" : "Layout Mode"}</span>
          </div>
          <div
            ref={canvasRef}
            className={`canvas-area ${connectMode ? "connect" : ""} ${panDrag ? "panning" : ""}`}
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
            onMouseDown={handleCanvasMouseDown}
            onWheel={handleCanvasWheel}
          >
            <div
              className="canvas-content"
              style={{
                width: `${CANVAS_DIMENSIONS.width}px`,
                height: `${CANVAS_DIMENSIONS.height}px`,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              <svg className="connection-layer">
                {connections.map((link) => {
                  const from = nodeRects[link.from];
                  const to = nodeRects[link.to];
                  if (!from || !to) return null;
                  const startX = from.x + from.width;
                  const startY = from.y + from.height / 2;
                  const endX = to.x;
                  const endY = to.y + to.height / 2;
                  const midX = (startX + endX) / 2;
                  return (
                    <path
                      key={link.id}
                      d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                      className="connection-line"
                    />
                  );
                })}
              </svg>
              {components.map((node) => {
                const definition = COMPONENT_LIBRARY.find((item) => item.type === node.type);
                return (
                  <div
                    key={node.id}
                    className={`node-card ${selectedNode === node.id ? "selected" : ""}`}
                    style={{ left: node.x, top: node.y }}
                    onMouseDown={(event) => handleNodeMouseDown(event, node.id)}
                    onClick={() => {
                      handleNodeClick(node.id);
                      handleSelectNode(node.id);
                    }}
                  >
                    <div className="node-title">{definition?.label}</div>
                    <div className="node-meta">ID: {node.id}</div>
                    <div className="node-tags">
                      {Object.entries(node.params).map(([key, value]) => (
                        <span key={key}>
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="canvas-hint">
            {connectMode
              ? "Click a source component, then click a target component to draw a signal link."
              : "Drag components from the palette. Drag empty space to pan, scroll to zoom."}
          </p>
        </section>

        <section className="panel inspector-panel">
          <div className="panel-header">
            <h2>Component Inspector</h2>
            <span className="tag">Properties</span>
          </div>
          {selectedNodeData ? (
            <div className="inspector-body">
              <h3>{COMPONENT_LIBRARY.find((item) => item.type === selectedNodeData.type)?.label}</h3>
              <p className="muted">ID: {selectedNodeData.id}</p>
              {Object.entries(selectedNodeData.params).map(([key, value]) => (
                <label key={key} className="field">
                  {key}
                  <input
                    type="number"
                    step="0.1"
                    value={value}
                    onChange={(event) => updateParams(selectedNodeData.id, key, Number(event.target.value))}
                  />
                </label>
              ))}
            </div>
          ) : (
            <div className="inspector-empty">
              <p>Select a component on the canvas to view and edit its parameters.</p>
            </div>
          )}
          <div className="panel-section">
            <h3>Connection Summary</h3>
            <ul className="summary-list">
              {connections.length === 0 && <li>No links created yet.</li>}
              {connections.map((link) => (
                <li key={link.id}>
                  {link.from} → {link.to}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
