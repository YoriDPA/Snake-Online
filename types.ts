export interface Point {
  x: number;
  y: number;
}

export interface PowerUp extends Point {
  type: 'bonus' | 'speedup' | 'slowdown' | 'shield';
  spawnTime: number;
}

export interface Particle {
  x: number;
  y: number;
  color: string;
  alpha: number;
}

export interface PlayerScore {
  name: string;
  score: number;
}

export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAMEOVER = 'GAMEOVER'
}

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface Message {
  role: Role;
  text: string;
  imageUrl?: string;
  isError?: boolean;
  timestamp: Date;
}

// Helper to access global libraries
declare global {
  interface Window {
    firebase: any;
    Tone: any;
  }
}