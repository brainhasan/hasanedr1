'use client';
import { useState, useEffect } from 'react';
import mqtt from 'mqtt';

export default function Home() {
  const [client, setClient] = useState(null);
  const [connectStatus, setConnectStatus] = useState('Connecting...');

  // --- STATES ---
  // Wir speichern Status als Boolean (true/false), konvertieren aber von 1/0
  const [plcOutputState, setPlcOutputState] = useState({
    M20: false,
    M21: false,
    M22: false,
    M23: false
  });

  const [plcInputState, setPlcInputState] = useState(new Array(8).fill(0));

  useEffect(() => {
    const mqttOption = {
      protocol: 'wss',
      hostname: process.env.NEXT_PUBLIC_HIVEMQ_HOST,
      port: Number(process.env.NEXT_PUBLIC_HIVEMQ_PORT),
      username: process.env.NEXT_PUBLIC_HIVEMQ_USER,
      password: process.env.NEXT_PUBLIC_HIVEMQ_PASS,
      path: '/mqtt',
      clean: true,
      connectTimeout: 4000,
      clientId: 'WebClient_' + Math.random().toString(16).substr(2, 8),
    };

    const mqttClient = mqtt.connect(mqttOption);

    mqttClient.on('connect', () => {
      setConnectStatus('Connected');
      mqttClient.subscribe('plc/feedback'); 
      mqttClient.subscribe('plc/inputs');   
    });

    mqttClient.on('message', (topic, message) => {
      const msgString = message.toString();

      // --- NEU: LOGIK FÜR OUTPUTS (M20-M23) ---
      // Akzeptiert jetzt [1,0,0,1] ODER {"M20": 1}
      if (topic === 'plc/feedback') {
        try {
          const data = JSON.parse(msgString);

          if (Array.isArray(data)) {
            // FALL 1: Array empfangen -> [1, 0, 1, 0]
            // Wir mappen die Positionen fest auf M20, M21, M22, M23
            setPlcOutputState({
              M20: data[0] === 1,
              M21: data[1] === 1,
              M22: data[2] === 1,
              M23: data[3] === 1
            });
          } else {
            // FALL 2: Objekt empfangen (Einzel-Update) -> {"M21": 1}
            // Wir bauen ein neues State-Objekt basierend auf den empfangenen Keys
            setPlcOutputState(prevState => {
              const newState = { ...prevState };
              // Iteriere über alle empfangenen Keys (z.B. nur "M21")
              Object.keys(data).forEach(key => {
                if (newState.hasOwnProperty(key)) {
                  // Konvertiere 1 zu true, 0 zu false
                  newState[key] = data[key] === 1;
                }
              });
              return newState;
            });
          }
        } catch (e) {
          console.error("JSON Error bei feedback:", e);
        }
      }

      // --- LOGIK FÜR INPUTS (I1-I8) ---
      if (topic === 'plc/inputs') {
        try {
          const inputs = JSON.parse(msgString);
          if (Array.isArray(inputs)) setPlcInputState(inputs);
        } catch (e) { console.error("JSON Error inputs:", e); }
      }
    });

    setClient(mqttClient);
    return () => { if (mqttClient) mqttClient.end(); };
  }, []);

  const toggleOutput = (outputId) => {
    if (client && connectStatus === 'Connected') {
      const currentState = plcOutputState[outputId];
      // Wir senden weiterhin ON/OFF als Befehl (eindeutiger zu lesen)
      const command = !currentState ? 'ON' : 'OFF';
      const payload = JSON.stringify({ output: outputId, value: command });
      client.publish('plc/control', payload);
    }
  };

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#111', color: 'white', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid #333', textAlign: 'center' }}>
        <h1>PLC Dashboard</h1>
        <div style={{ color: connectStatus === 'Connected' ? '#34d399' : '#fca5a5' }}>
          Status: {connectStatus}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
        
        {/* MITTE */}
        <div style={{ flex: 1, display: 'flex' }}>
          {/* LINKS: Buttons */}
          <div style={{ flex: 1, borderRight: '1px solid #333', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2>Control</h2>
            {Object.keys(plcOutputState).map((key) => (
              <div key={key} style={{ margin: '10px 0' }}>
                <button 
                  onClick={() => toggleOutput(key)}
                  style={{
                    padding: '10px 20px', width: '150px',
                    backgroundColor: plcOutputState[key] ? '#ef4444' : '#22c55e',
                    color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'
                  }}>
                  {key}: {plcOutputState[key] ? 'OFF' : 'ON'}
                </button>
              </div>
            ))}
          </div>

          {/* RECHTS: Lampen */}
          <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
            <h2>State</h2>
            {Object.keys(plcOutputState).map((key) => (
              <div key={key} style={{ margin: '10px 0', display: 'flex', alignItems: 'center' }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%', marginRight: '10px',
                  backgroundColor: plcOutputState[key] ? '#22c55e' : '#333',
                  boxShadow: plcOutputState[key] ? '0 0 10px #22c55e' : 'none'
                }} />
                <span>{key} ({plcOutputState[key] ? '1' : '0'})</span>
              </div>
            ))}
          </div>
        </div>

        {/* UNTEN: Inputs */}
        <div style={{ padding: '20px', borderTop: '1px solid #333', textAlign: 'center' }}>
           <h3>Inputs (1/0)</h3>
           <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
             {plcInputState.map((val, i) => (
               <div key={i} style={{ 
                 width: '40px', height: '40px', borderRadius: '50%', 
                 backgroundColor: val === 1 ? '#3b82f6' : '#222',
                 display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #444'
               }}>
                 I{i+1}
               </div>
             ))}
           </div>
        </div>

      </div>
    </main>
  );
}
