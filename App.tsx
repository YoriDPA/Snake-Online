import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Trophy, Users, Shield, Zap, Clock, Star, Play, RotateCcw, LogOut } from 'lucide-react';
import { GameState, Point, PowerUp, Particle, PlayerScore } from './types';
import { InstallPrompt } from './components/InstallPrompt';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAiSenlXeewlgk5QIAsDsdnUzDX4oxH_jY",
  authDomain: "snakeonline-yoridpa.firebaseapp.com",
  databaseURL: "https://snakeonline-yoridpa-default-rtdb.firebaseio.com",
  projectId: "snakeonline-yoridpa",
  storageBucket: "snakeonline-yoridpa.firebasestorage.app",
  messagingSenderId: "961197417042",
  appId: "1:961197417042:web:5bd08a66178829e5ebf58b",
  measurementId: "G-QH28JN1KNH"
};

// --- Game Constants ---
const GRID_SIZE = 20;
const POWERUP_LIFESPAN = 7000;
const POWERUP_SPAWN_INTERVAL = 10000;
const ADMIN_USERNAME = "Admin";
const ADMIN_PASSWORD_HASH = btoa("88645912"); 

export default function App() {
  // --- Refs (Mutable Game State) ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const snakeRef = useRef<Point[]>([]);
  const directionRef = useRef<string | null>(null);
  const nextDirectionRef = useRef<string | null>(null);
  const foodRef = useRef<Point | null>(null);
  const powerUpRef = useRef<PowerUp | null>(null);
  const scoreRef = useRef<number>(0);
  const speedRef = useRef<number>(150);
  const particlesRef = useRef<Particle[]>([]);
  const lastUpdateRef = useRef<number>(0);
  const isShieldedRef = useRef<boolean>(false);
  const shieldTimerRef = useRef<any>(null);
  
  // --- React State (UI) ---
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [globalHighScore, setGlobalHighScore] = useState(0);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [playerName, setPlayerName] = useState<string | null>(localStorage.getItem('playerName'));
  const [topScores, setTopScores] = useState<PlayerScore[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<any[]>([]);
  const [showRankings, setShowRankings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [powerUpMessage, setPowerUpMessage] = useState<{ text: string, type: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Input State
  const [inputName, setInputName] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [selectedColor, setSelectedColor] = useState(localStorage.getItem('playerColor') || '#3fff3f');

  // --- Audio Setup ---
  const synthRef = useRef<any>(null);
  
  const initAudio = () => {
    if (window.Tone && !synthRef.current) {
      synthRef.current = new window.Tone.FMSynth({
        harmonicity: 8,
        modulationIndex: 2,
        envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.2 }
      }).toDestination();
    }
  };

  const playSound = (type: string) => {
    if (!isSoundOn || !window.Tone || !synthRef.current) return;
    const now = window.Tone.now();
    try {
      switch (type) {
        case 'eat': synthRef.current.triggerAttackRelease("C6", "16n", now); break;
        case 'powerUp':
          synthRef.current.triggerAttackRelease("C5", "16n", now);
          synthRef.current.triggerAttackRelease("E5", "16n", now + 0.07);
          synthRef.current.triggerAttackRelease("G5", "16n", now + 0.14);
          break;
        case 'shieldBreak': synthRef.current.triggerAttackRelease("A2", "8n", now); break;
        case 'gameOver':
          synthRef.current.triggerAttackRelease("G3", "8n", now);
          synthRef.current.triggerAttackRelease("E3", "8n", now + 0.1);
          synthRef.current.triggerAttackRelease("C3", "8n", now + 0.2);
          break;
      }
    } catch (e) { console.error("Audio error", e); }
  };

  // --- Firebase Init ---
  useEffect(() => {
    if (window.firebase && !window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }
    
    // Presence System
    const setupPresence = () => {
      const pid = localStorage.getItem('playerId');
      const pname = localStorage.getItem('playerName');
      if (!pid || !pname || !window.firebase) return;

      const db = window.firebase.database();
      const userStatusRef = db.ref('/status/' + pid);
      const isOnline = { name: pname, online: true, last_changed: window.firebase.database.ServerValue.TIMESTAMP };
      const isOffline = { name: pname, online: false, last_changed: window.firebase.database.ServerValue.TIMESTAMP };

      db.ref('.info/connected').on('value', (snap: any) => {
        if (snap.val() === false) return;
        userStatusRef.onDisconnect().set(isOffline).then(() => {
          userStatusRef.set(isOnline);
        });
      });
    };

    if (playerName) setupPresence();
    fetchHighScores();
  }, [playerName]);

  const fetchHighScores = () => {
    if (!window.firebase) return;
    const db = window.firebase.database();
    db.ref('scores').orderByChild('score').limitToLast(10).once('value', (snap: any) => {
      const scores: PlayerScore[] = [];
      snap.forEach((child: any) => {
        scores.push({ name: child.val().name, score: child.val().score });
      });
      const sorted = scores.reverse();
      setTopScores(sorted);
      if (sorted.length > 0) setGlobalHighScore(sorted[0].score);
    });

    // Check personal high score
    const pid = localStorage.getItem('playerId');
    if (pid) {
      db.ref('scores/' + pid + '/score').once('value', (snap: any) => {
        setHighScore(snap.val() || 0);
      });
    }
  };

  const saveScore = (finalScore: number) => {
    const pid = localStorage.getItem('playerId');
    if (!pid || !playerName || !window.firebase || isAdmin) return;
    
    const db = window.firebase.database();
    const userRef = db.ref('scores/' + pid);
    userRef.child('score').once('value', (snap: any) => {
      if (finalScore > (snap.val() || 0)) {
        userRef.update({ score: finalScore });
      }
    });
  };

  // --- Game Engine ---
  const initGame = () => {
    const cols = Math.floor(window.innerWidth / GRID_SIZE);
    const rows = Math.floor(window.innerHeight / GRID_SIZE);
    
    snakeRef.current = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }];
    directionRef.current = 'right'; // Auto start movement
    nextDirectionRef.current = 'right';
    scoreRef.current = 0;
    speedRef.current = 150;
    particlesRef.current = [];
    isShieldedRef.current = false;
    
    placeFood();
    setScore(0);
    setGameState(GameState.PLAYING);
    setPowerUpMessage(null);
    
    initAudio();
    if (isSoundOn && window.Tone) window.Tone.start();

    // Start Loops
    lastUpdateRef.current = Date.now();
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const placeFood = () => {
    const cols = Math.floor(window.innerWidth / GRID_SIZE);
    const rows = Math.floor(window.innerHeight / GRID_SIZE);
    let newFood;
    // Simple collision check loop
    do {
      newFood = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows)
      };
    } while (snakeRef.current.some(s => s.x === newFood.x && s.y === newFood.y));
    foodRef.current = newFood;
  };

  const spawnPowerUp = () => {
    if (powerUpRef.current) return;
    const cols = Math.floor(window.innerWidth / GRID_SIZE);
    const rows = Math.floor(window.innerHeight / GRID_SIZE);
    
    const types: PowerUp['type'][] = ['bonus', 'speedup', 'slowdown', 'shield'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    powerUpRef.current = {
      x: Math.floor(Math.random() * cols),
      y: Math.floor(Math.random() * rows),
      type,
      spawnTime: Date.now()
    };
  };

  const createParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 10; i++) {
      particlesRef.current.push({
        x: x * GRID_SIZE + GRID_SIZE / 2,
        y: y * GRID_SIZE + GRID_SIZE / 2,
        color,
        alpha: 1
      });
    }
  };

  const gameLoop = () => {
    if (gameState === GameState.GAMEOVER || gameState === GameState.PAUSED) return;

    const now = Date.now();
    
    // Update Logic based on speed
    if (now - lastUpdateRef.current > speedRef.current) {
      updateGame();
      lastUpdateRef.current = now;
    }
    
    draw();
    
    // PowerUp Spawner
    if (!powerUpRef.current && Math.random() < 0.005) { // Roughly every few seconds check
      spawnPowerUp();
    }
    // PowerUp Expiration
    if (powerUpRef.current && now - powerUpRef.current.spawnTime > POWERUP_LIFESPAN) {
      powerUpRef.current = null;
    }

    if (gameState === GameState.PLAYING) {
      requestRef.current = requestAnimationFrame(gameLoop);
    }
  };

  const updateGame = () => {
    if (!nextDirectionRef.current || !snakeRef.current.length) return;

    directionRef.current = nextDirectionRef.current;
    const head = { ...snakeRef.current[0] };

    switch (directionRef.current) {
      case 'up': head.y--; break;
      case 'down': head.y++; break;
      case 'left': head.x--; break;
      case 'right': head.x++; break;
    }

    // Check Walls
    const cols = Math.floor(window.innerWidth / GRID_SIZE);
    const rows = Math.floor(window.innerHeight / GRID_SIZE);
    let hitWall = head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows;
    
    // Check Self
    let hitSelf = snakeRef.current.some(s => s.x === head.x && s.y === head.y);

    if (hitWall || hitSelf) {
      if (isShieldedRef.current) {
        isShieldedRef.current = false;
        playSound('shieldBreak');
        // Bounce back slightly to avoid instant death next frame
        switch (directionRef.current) {
          case 'up': head.y++; break;
          case 'down': head.y--; break;
          case 'left': head.x++; break;
          case 'right': head.x--; break;
        }
        // Don't move this frame, just lose shield
        return;
      }
      endGame();
      return;
    }

    snakeRef.current.unshift(head);

    // Food Collision
    if (foodRef.current && head.x === foodRef.current.x && head.y === foodRef.current.y) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      playSound('eat');
      createParticles(head.x, head.y, '#ff3333');
      placeFood();
      // Increase speed slightly
      speedRef.current = Math.max(50, speedRef.current - 1);
    } else {
      // Check PowerUp Collision
      if (powerUpRef.current && head.x === powerUpRef.current.x && head.y === powerUpRef.current.y) {
        playSound('powerUp');
        createParticles(head.x, head.y, '#ffff00');
        
        switch(powerUpRef.current.type) {
           case 'bonus': 
             scoreRef.current += 5; 
             setScore(scoreRef.current);
             setPowerUpMessage({ text: '+5 PONTOS!', type: 'text-yellow-400' });
             break;
           case 'speedup':
             speedRef.current = Math.max(40, speedRef.current - 30);
             setPowerUpMessage({ text: 'VELOCIDADE!', type: 'text-red-500' });
             break;
           case 'slowdown':
             speedRef.current += 30;
             setPowerUpMessage({ text: 'LENTO!', type: 'text-blue-400' });
             break;
           case 'shield':
             isShieldedRef.current = true;
             setPowerUpMessage({ text: 'ESCUDO!', type: 'text-cyan-400' });
             if (shieldTimerRef.current) clearTimeout(shieldTimerRef.current);
             shieldTimerRef.current = setTimeout(() => isShieldedRef.current = false, 5000);
             break;
        }
        setTimeout(() => setPowerUpMessage(null), 2000);
        powerUpRef.current = null;
        snakeRef.current.pop(); // Still remove tail as we didn't eat food
      } else {
        snakeRef.current.pop();
      }
    }
  };

  const draw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Draw Food
    if (foodRef.current) {
      ctx.fillStyle = '#ff3333';
      ctx.shadowColor = '#ff3333';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(
        foodRef.current.x * GRID_SIZE + GRID_SIZE/2, 
        foodRef.current.y * GRID_SIZE + GRID_SIZE/2, 
        GRID_SIZE/2.5, 0, Math.PI*2
      );
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw PowerUp
    if (powerUpRef.current) {
      let color = '#fff';
      switch(powerUpRef.current.type) {
        case 'bonus': color = '#fbbf24'; break;
        case 'speedup': color = '#ef4444'; break;
        case 'slowdown': color = '#3b82f6'; break;
        case 'shield': color = '#06b6d4'; break;
      }
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      
      const x = powerUpRef.current.x * GRID_SIZE + GRID_SIZE/2;
      const y = powerUpRef.current.y * GRID_SIZE + GRID_SIZE/2;
      
      // Star shape
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
          ctx.lineTo(Math.cos((18 + i * 72) * 0.0174532925) * 8 + x, 
                     Math.sin((18 + i * 72) * 0.0174532925) * 8 + y);
          ctx.lineTo(Math.cos((54 + i * 72) * 0.0174532925) * 4 + x, 
                     Math.sin((54 + i * 72) * 0.0174532925) * 4 + y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw Snake
    snakeRef.current.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? selectedColor : adjustColor(selectedColor, -20);
      
      // Gradient effect
      const grad = ctx.createLinearGradient(
        segment.x * GRID_SIZE, segment.y * GRID_SIZE,
        (segment.x + 1) * GRID_SIZE, (segment.y + 1) * GRID_SIZE
      );
      grad.addColorStop(0, index === 0 ? selectedColor : adjustColor(selectedColor, -30));
      grad.addColorStop(1, adjustColor(selectedColor, -50));
      ctx.fillStyle = grad;

      ctx.fillRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);

      // Eyes
      if (index === 0) {
        ctx.fillStyle = 'black';
        const eyeSize = GRID_SIZE / 5;
        // Simple eyes logic assuming right direction fallback
        ctx.fillRect(segment.x * GRID_SIZE + eyeSize*2, segment.y * GRID_SIZE + eyeSize, eyeSize, eyeSize);
        ctx.fillRect(segment.x * GRID_SIZE + eyeSize*2, segment.y * GRID_SIZE + eyeSize*3, eyeSize, eyeSize);
        
        // Shield Overlay
        if (isShieldedRef.current) {
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 2;
          ctx.strokeRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
        }
      }
    });

    // Draw Particles
    particlesRef.current.forEach((p, i) => {
      p.alpha -= 0.05;
      if (p.alpha <= 0) particlesRef.current.splice(i, 1);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
      ctx.globalAlpha = 1;
    });
  };

  const endGame = () => {
    cancelAnimationFrame(requestRef.current);
    playSound('gameOver');
    setGameState(GameState.GAMEOVER);
    saveScore(scoreRef.current);
    fetchHighScores();
  };

  // --- Helpers ---
  const adjustColor = (color: string, amount: number) => {
    return color; // Simplified for React port, ideally use a color lib or hex logic
  };

  const handleInput = useCallback((key: string) => {
    const current = directionRef.current;
    if (gameState !== GameState.PLAYING && gameState !== GameState.PAUSED) return;
    
    switch(key) {
      case 'ArrowUp': if (current !== 'down') nextDirectionRef.current = 'up'; break;
      case 'ArrowDown': if (current !== 'up') nextDirectionRef.current = 'down'; break;
      case 'ArrowLeft': if (current !== 'right') nextDirectionRef.current = 'left'; break;
      case 'ArrowRight': if (current !== 'left') nextDirectionRef.current = 'right'; break;
    }
  }, [gameState]);

  // Key Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => handleInput(e.key);
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInput]);

  // Touch/Swipe Listeners
  const touchStart = useRef({ x: 0, y: 0 });
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 30) handleInput(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    } else {
      if (Math.abs(dy) > 30) handleInput(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    }
  };

  // Resize
  useEffect(() => {
    const resize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
      if (bgCanvasRef.current) {
        bgCanvasRef.current.width = window.innerWidth;
        bgCanvasRef.current.height = window.innerHeight;
        // Draw background grid once
        const ctx = bgCanvasRef.current.getContext('2d');
        if (ctx) {
           ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
           ctx.fillStyle = 'rgba(63, 255, 63, 0.05)';
           for(let x=0; x < window.innerWidth; x+=GRID_SIZE) {
             for(let y=0; y < window.innerHeight; y+=GRID_SIZE) {
               ctx.fillRect(x, y, 1, 1);
             }
           }
        }
      }
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, []);

  // --- Auth Handlers ---
  const handleLogin = () => {
    if (!inputName || !inputPassword) {
      alert("Nome e senha são obrigatórios!");
      return;
    }

    const hashed = btoa(inputPassword);
    
    // Check Admin
    if (inputName === ADMIN_USERNAME && hashed === ADMIN_PASSWORD_HASH) {
      setIsAdmin(true);
      setPlayerName(ADMIN_USERNAME);
      localStorage.setItem('playerId', 'admin');
      localStorage.setItem('playerName', ADMIN_USERNAME);
      return;
    }

    // Firebase Auth (simplified based on original code)
    if (!window.firebase) return;
    const db = window.firebase.database();
    
    db.ref('scores').orderByChild('name').equalTo(inputName).once('value', (snap: any) => {
      if (snap.exists()) {
        const id = Object.keys(snap.val())[0];
        const data = snap.val()[id];
        if (data.password === hashed) {
          loginSuccess(id, inputName, data.color);
        } else {
          alert("Senha incorreta!");
        }
      } else {
        // Register
        const ref = db.ref('scores').push();
        ref.set({
          name: inputName,
          password: hashed,
          score: 0,
          color: selectedColor
        });
        loginSuccess(ref.key, inputName, selectedColor);
      }
    });
  };

  const loginSuccess = (id: string, name: string, color: string) => {
    localStorage.setItem('playerId', id);
    localStorage.setItem('playerName', name);
    localStorage.setItem('playerColor', color);
    setPlayerName(name);
    setSelectedColor(color);
  };

  const handleLogout = () => {
    // Remove presence
    const pid = localStorage.getItem('playerId');
    if (pid && window.firebase) {
      window.firebase.database().ref('/status/' + pid).remove();
    }
    localStorage.clear();
    setPlayerName(null);
    setGameState(GameState.START);
  };
  
  const fetchOnlinePlayers = () => {
     setShowAdmin(true);
     if (!window.firebase) return;
     window.firebase.database().ref('status').once('value', (snap: any) => {
        const players: any[] = [];
        snap.forEach((c: any) => {
           if(c.val().online) players.push(c.val());
        });
        setOnlinePlayers(players);
     });
  };

  return (
    <div className="relative w-full h-full font-orbitron bg-black">
      <InstallPrompt />
      
      {/* Background Canvas (Static Grid) */}
      <canvas ref={bgCanvasRef} className="absolute inset-0 z-0" />
      
      {/* Game Canvas (Dynamic) */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 z-10 block"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {/* UI Overlay Container */}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-center items-center">
        
        {/* HUD */}
        {gameState !== GameState.START && (
           <div className="absolute top-4 left-4 text-neon text-xl font-bold animate-pulse-fast pointer-events-auto">
             Score: {score}
           </div>
        )}
        
        {/* Sound Toggle */}
        <button 
          onClick={() => setIsSoundOn(!isSoundOn)}
          className="absolute top-4 right-4 pointer-events-auto text-neon opacity-70 hover:opacity-100 transition-opacity"
        >
          {isSoundOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
        </button>

        {/* PowerUp Message */}
        {powerUpMessage && (
          <div className={`absolute top-1/4 text-2xl font-bold ${powerUpMessage.type} animate-bounce`}>
            {powerUpMessage.text}
          </div>
        )}

        {/* --- START SCREEN --- */}
        {gameState === GameState.START && (
          <div className="bg-black/90 border border-neon p-8 rounded-xl backdrop-blur-md pointer-events-auto flex flex-col items-center gap-6 max-w-md w-full mx-4 shadow-[0_0_30px_rgba(63,255,63,0.2)]">
            <h1 className="text-4xl md:text-6xl text-neon font-bold text-center tracking-tighter" style={{ textShadow: '0 0 20px #3fff3f' }}>
              SNAKE
              <span className="block text-xl md:text-2xl mt-2 text-white font-normal tracking-widest">ONLINE</span>
            </h1>

            {playerName ? (
              <>
                 <div className="text-center space-y-2">
                    <p className="text-gray-400">Bem-vindo,</p>
                    <p className="text-2xl text-neon font-bold">{playerName}</p>
                 </div>
                 
                 {/* Color Picker */}
                 <div className="flex gap-4 my-2">
                    {['#3fff3f', '#ef4444', '#3b82f6', '#fbbf24', '#d946ef'].map(c => (
                       <button
                         key={c}
                         onClick={() => {
                           setSelectedColor(c);
                           localStorage.setItem('playerColor', c);
                         }}
                         className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${selectedColor === c ? 'border-white shadow-[0_0_10px_white]' : 'border-transparent'}`}
                         style={{ backgroundColor: c }}
                       />
                    ))}
                 </div>

                 <button 
                   onClick={initGame}
                   className="w-full bg-neon text-black font-bold py-3 px-6 rounded-lg text-lg hover:bg-white transition-all shadow-[0_0_15px_rgba(63,255,63,0.5)] flex items-center justify-center gap-2"
                 >
                   <Play size={20} /> INICIAR
                 </button>

                 <div className="flex gap-2 w-full">
                    {isAdmin && (
                        <button onClick={fetchOnlinePlayers} className="flex-1 bg-gray-800 border border-neon text-neon py-2 rounded hover:bg-gray-700 text-sm">
                           <Users size={16} className="inline mr-1" /> Admin
                        </button>
                    )}
                    <button onClick={handleLogout} className="flex-1 bg-gray-800 border border-red-500 text-red-500 py-2 rounded hover:bg-gray-700 text-sm">
                       <LogOut size={16} className="inline mr-1" /> Sair
                    </button>
                 </div>
              </>
            ) : (
              <div className="w-full space-y-4">
                 <input 
                   type="text" 
                   placeholder="Seu Nome"
                   className="w-full bg-gray-900 border border-neon text-white p-3 rounded focus:outline-none focus:shadow-[0_0_10px_#3fff3f]"
                   value={inputName}
                   onChange={e => setInputName(e.target.value)}
                 />
                 <input 
                   type="password" 
                   placeholder="Senha"
                   className="w-full bg-gray-900 border border-neon text-white p-3 rounded focus:outline-none focus:shadow-[0_0_10px_#3fff3f]"
                   value={inputPassword}
                   onChange={e => setInputPassword(e.target.value)}
                 />
                 <button 
                   onClick={handleLogin}
                   className="w-full bg-neon text-black font-bold py-3 rounded hover:bg-white transition-colors"
                 >
                   ENTRAR / REGISTRAR
                 </button>
              </div>
            )}
            
            <div className="w-full border-t border-gray-800 pt-4 mt-2">
               <div className="flex justify-between text-sm text-gray-400">
                  <span>Recorde Pessoal:</span>
                  <span className="text-neon">{highScore}</span>
               </div>
               <div className="flex justify-between text-sm text-gray-400 mt-1">
                  <span>Recorde Global:</span>
                  <span className="text-yellow-400">{globalHighScore}</span>
               </div>
            </div>
            
            <button 
              onClick={() => setShowRankings(true)}
              className="text-xs text-gray-500 underline hover:text-neon"
            >
               Ver Top 10 Jogadores
            </button>
          </div>
        )}

        {/* --- GAME OVER SCREEN --- */}
        {gameState === GameState.GAMEOVER && (
          <div className="bg-black/95 border-2 border-red-500 p-8 rounded-xl pointer-events-auto flex flex-col items-center gap-4 animate-in zoom-in duration-300">
             <h2 className="text-4xl text-red-500 font-bold tracking-widest">GAME OVER</h2>
             <div className="text-2xl text-white">Score Final: <span className="text-neon">{score}</span></div>
             
             <div className="flex gap-4 mt-4">
                <button 
                   onClick={initGame}
                   className="bg-white text-black px-6 py-2 rounded font-bold hover:bg-gray-200 flex items-center gap-2"
                >
                   <RotateCcw size={18} /> Tentar Novamente
                </button>
                <button 
                   onClick={() => setGameState(GameState.START)}
                   className="border border-white text-white px-6 py-2 rounded hover:bg-white hover:text-black transition-colors"
                >
                   Menu
                </button>
             </div>
          </div>
        )}

        {/* --- MODALS --- */}
        {showRankings && (
           <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-auto z-50">
              <div className="bg-gray-900 border border-neon p-6 rounded-lg w-80 max-h-[80vh] overflow-y-auto">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-neon text-xl font-bold flex items-center gap-2"><Trophy size={20} /> Rankings</h3>
                    <button onClick={() => setShowRankings(false)} className="text-gray-400 hover:text-white">X</button>
                 </div>
                 <ul className="space-y-2">
                    {topScores.map((p, i) => (
                       <li key={i} className="flex justify-between border-b border-gray-800 pb-1">
                          <span className={`${i===0?'text-yellow-400': 'text-white'}`}>{i+1}. {p.name}</span>
                          <span className="text-gray-400">{p.score}</span>
                       </li>
                    ))}
                 </ul>
              </div>
           </div>
        )}

        {showAdmin && (
           <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-auto z-50">
              <div className="bg-gray-900 border border-blue-500 p-6 rounded-lg w-80">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-blue-400 text-xl font-bold">Jogadores Online</h3>
                    <button onClick={() => setShowAdmin(false)} className="text-gray-400 hover:text-white">X</button>
                 </div>
                 <ul className="space-y-2">
                    {onlinePlayers.length ? onlinePlayers.map((p, i) => (
                       <li key={i} className="text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span> {p.name}
                       </li>
                    )) : <li className="text-gray-500">Ninguém online :(</li>}
                 </ul>
              </div>
           </div>
        )}

      </div>
      
      <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-gray-600 pointer-events-none">
         Feito por YoriDPA • v2.0 React PWA
      </div>
    </div>
  );
}