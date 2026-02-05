'use client';
import { useState, useEffect } from 'react';
import mqtt from 'mqtt';

export default function Home() {
  const [client, setClient] = useState(null);
  const [connectStatus, setConnectStatus] = useState('Connecting...');

  // --- STATES ---
  // 4 Outputs: M20, M21, M22, M23 (Initial state: all false/OFF)
  const [plcOutputState, setPlcOutputState] = useState({
    M20: false,
    M21: false,
    M22: false,
    M23: false
  });

  // 8 Inputs: I1 to I8 (Initial state: all 0)
  const [plcInputState, setPlcInputState] = useState(new Array(8).fill(0));

  useEffect(() => {
    // --- MQTT CONFIGURATION ---
    const mqttOption = {
      protocol: 'wss',
      hostname: process.env.NEXT_PUBLIC_HIVEMQ_HOST,
      port: Number(process.env.NEXT_PUBLIC_HIVEMQ_PORT),
      username: process.env.NEXT_PUBLIC_HIVEMQ_USER,
      password: process.env.NEXT_PUBLIC_HIVEMQ_PASS,
      path: '/mqtt', // Important for HiveMQ
      clean: true,
      connectTimeout: 4000,
      clientId: 'WebClient_' + Math.random().toString(16).substr(2, 8),
    };

    console.log('Connecting to:', mqttOption.hostname);
    const mqttClient = mqtt.connect(mqttOption);

    mqttClient.on('connect', () => {
      setConnectStatus('Connected');
      console.log('Connected via WebSockets');
      mqttClient.subscribe('plc/feedback'); // Receives states of M20-M23
      mqttClient.subscribe('plc/inputs');   // Receives states of I1-I8
    });

    mqttClient.on('error', (err) => {
      console.error('Connection error: ', err);
      setConnectStatus('Error');
    });

    mqttClient.on('message', (topic, message) => {
      const msgString = message.toString();

      // --- HANDLE FEEDBACK (Outputs M20-M23) ---
      if (topic === 'plc/feedback') {
        try {
          // Expected JSON: {"M20": true, "M21": false, ...}
          const data = JSON.parse(msgString);
          setPlcOutputState(prevState => ({ ...prevState, ...data }));
        } catch (e) {
          console.error("Error parsing feedback JSON:", e);
        }
      }

      // --- HANDLE INPUTS (I1-I8) ---
      if (topic === 'plc/inputs') {
        try {
          // Expected JSON: [1, 0, 0, 1, 0, 0, 0, 0]
          const inputs = JSON.parse(msgString);
          if (Array.isArray(inputs) && inputs.length >= 8) {
            setPlcInputState(inputs);
          }
        } catch (e) {
          console.error("Error parsing inputs JSON:", e);
        }
      }
    });

    setClient(mqttClient);

    return () => {
      if (mqttClient) mqttClient.end();
    };
  }, []);

  // --- SEND COMMAND ---
  const toggleOutput = (outputId) => {
    if (client && connectStatus === 'Connected') {
      const currentState = plcOutputState[outputId];
      const command = !currentState ? 'ON' : 'OFF';
      
      // We send a JSON object: { "output": "M20", "value": "ON" }
      const payload = JSON.stringify({ output: outputId, value: command });
      
      client.publish('plc/control', payload);
      console.log(`Sent to plc/control: ${payload}`);
    } else {
      alert("Not connected!");
    }
  };

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#111', color: 'white', fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid #333', textAlign: 'center' }}>
        <h1>PLC Dashboard (CM5)</h1>
        <div style={{ 
          display: 'inline-block', 
          padding: '5px 10px', 
          borderRadius: '5px',
          backgroundColor: connectStatus === 'Connected' ? '#064e3b' : '#7f1d1d',
          color: connectStatus === 'Connected' ? '#34d399' : '#fca5a5'
        }}>
          Status: {connectStatus}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
        
        {/* CENTER AREA: Control & Feedback */}
        <div style={{ flex: 1, display: 'flex', overflowY: 'auto' }}>
          
          {/* LEFT: Controls (Buttons) */}
          <div style={{ flex: 1, borderRight: '1px solid #333', padding: '20px' }}>
            <h2 style={{textAlign: 'center', marginBottom: '20px'}}>Control (M20-M23)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
              {Object.keys(plcOutputState).map((key) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <span style={{ width: '50px', fontWeight: 'bold' }}>{key}</span>
                  <button 
                    onClick={() => toggleOutput(key)}
                    style={{
                      width: '120px',
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: plcOutputState[key] ? '#ef4444' : '#22c55e',
                      color: 'white',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    TURN {plcOutputState[key] ? 'OFF' : 'ON'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Feedback (Status Lamps) */}
          <div style={{ flex: 1, backgroundColor: '#0a0a0a', padding: '20px' }}>
            <h2 style={{textAlign: 'center', marginBottom: '20px'}}>PLC State</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
              {Object.keys(plcOutputState).map((key) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: plcOutputState[key] ? '#22c55e' : '#333',
                    boxShadow: plcOutputState[key] ? '0 0 15px #22c55e' : 'inset 0 0 5px #000',
                    border: '2px solid #555'
                  }}></div>
                  <span style={{ fontSize: '18px', color: plcOutputState[key] ? '#fff' : '#666' }}>
                    {key} is {plcOutputState[key] ? 'ON' : 'OFF'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BOTTOM: Inputs (I1 - I8) */}
        <div style={{ height: '180px', borderTop: '1px solid #333', backgroundColor: '#1a1a1a', padding: '20px' }}>
          <h3 style={{textAlign: 'center', margin: '0 0 20px 0'}}>Input Status (I1 - I8)</h3>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '20px' }}>
            {plcInputState.map((val, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: val === 1 ? '#3b82f6' : '#262626',
                  border: val === 1 ? '2px solid #60a5fa' : '2px solid #444',
                  boxShadow: val === 1 ? '0 0 15px #3b82f6' : 'none',
                  margin: '0 auto 10px auto',
                  transition: 'background-color 0.3s'
                }} />
                <span style={{color: '#aaa', fontWeight: 'bold', fontSize: '14px'}}>I{i+1}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
