'use client'; // WICHTIG: Das muss ganz oben stehen, damit React Hooks funktionieren

import { useState, useEffect } from 'react';
import mqtt from 'mqtt';

export default function Home() {
  const [client, setClient] = useState(null);
  const [connectStatus, setConnectStatus] = useState('Connecting...');
  
  // States
  const [plcOutputState, setPlcOutputState] = useState(false); // Feedback von rechts
  const [plcInputState, setPlcInputState] = useState([0, 0, 0, 0]); // Inputs unten

  useEffect(() => {
    // Lade Variablen sicher aus der Umgebung (oder .env.local)
    const mqttOption = {
      protocol: 'wss', // WebSockets Secure
      hostname: process.env.NEXT_PUBLIC_HIVEMQ_HOST,
      port: Number(process.env.NEXT_PUBLIC_HIVEMQ_PORT),
      username: process.env.NEXT_PUBLIC_HIVEMQ_USER,
      password: process.env.NEXT_PUBLIC_HIVEMQ_PASS,
      path: '/mqtt',
      clean: true,
      connectTimeout: 4000,
      clientId: 'WebClient_' + Math.random().toString(16).substr(2, 8),
    };

    console.log('Verbinde zu:', mqttOption.hostname);

    const mqttClient = mqtt.connect(mqttOption);

    mqttClient.on('connect', () => {
      setConnectStatus('Connected');
      console.log('Connected via WebSockets');
      mqttClient.subscribe('plc/feedback');
      mqttClient.subscribe('plc/inputs');
    });

    mqttClient.on('error', (err) => {
      console.error('Connection error: ', err);
      setConnectStatus('Error');
    });

    mqttClient.on('message', (topic, message) => {
      const msgString = message.toString();
      
      if (topic === 'plc/feedback') {
        setPlcOutputState(msgString === 'ON');
      }
      
      if (topic === 'plc/inputs') {
        try {
          const inputs = JSON.parse(msgString);
          if(Array.isArray(inputs)) setPlcInputState(inputs);
        } catch (e) {
          console.error("JSON Error", e);
        }
      }
    });

    setClient(mqttClient);

    return () => {
      if (mqttClient) mqttClient.end();
    };
  }, []);

  const toggleOutput = () => {
    if (client && connectStatus === 'Connected') {
      const command = !plcOutputState ? 'ON' : 'OFF';
      client.publish('plc/control', command);
    } else {
      alert("Nicht verbunden!");
    }
  };

  // Einfaches Styling direkt hier im Code
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
        
        {/* MITTE: Links (Schalter) und Rechts (Feedback) */}
        <div style={{ flex: 1, display: 'flex' }}>
          
          {/* LINKS: Control */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #333' }}>
            <h2 style={{marginBottom: '30px'}}>Output Control</h2>
            <button 
              onClick={toggleOutput}
              style={{
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: plcOutputState ? '#ef4444' : '#22c55e', // Rot = Stop drücken, Grün = Start drücken
                color: 'white',
                fontSize: '24px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                transition: 'transform 0.1s'
              }}
            >
              TURN {plcOutputState ? 'OFF' : 'ON'}
            </button>
          </div>

          {/* RECHTS: Feedback (Echter Zustand) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' }}>
            <h2 style={{marginBottom: '30px'}}>PLC Feedback</h2>
            <div style={{
              width: '150px',
              height: '150px',
              borderRadius: '10px',
              backgroundColor: plcOutputState ? '#22c55e' : '#333',
              boxShadow: plcOutputState ? '0 0 30px #22c55e' : 'inset 0 0 20px #000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px',
              fontWeight: 'bold',
              border: '2px solid #555'
            }}>
              {plcOutputState ? 'AN' : 'AUS'}
            </div>
            <p style={{color: '#888', marginTop: '20px'}}>Empfangen von 'plc/feedback'</p>
          </div>
        </div>

        {/* UNTEN: Inputs */}
        <div style={{ height: '150px', borderTop: '1px solid #333', backgroundColor: '#1a1a1a', padding: '20px' }}>
          <h3 style={{textAlign: 'center', margin: '0 0 20px 0'}}>Input Status (I1 - I4)</h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '40px' }}>
            {plcInputState.map((val, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  backgroundColor: val === 1 ? '#3b82f6' : '#262626',
                  border: val === 1 ? '2px solid #60a5fa' : '2px solid #444',
                  boxShadow: val === 1 ? '0 0 15px #3b82f6' : 'none',
                  margin: '0 auto 10px auto'
                }} />
                <span style={{color: '#aaa', fontWeight: 'bold'}}>I{i+1}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
