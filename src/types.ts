// App status (replaces BrowserStatus)
export type AppStatus = 'idle' | 'running' | 'paused' | 'done' | 'error';

// Session configuration from UI
export interface SessionConfig {
  apiKey: string;
  model: string;
  behaviorGoal: string;
  exampleExploits: string;
  systemPrompt: string;
  repoPrefix: string;
  iterations: number;
}

// A single generated repo
export interface GeneratedRepo {
  id: string;
  iterationNumber: number;
  repoName: string;
  readmeContent: string;
  technique: string;
  reasoning: string;
  repoUrl: string | null;
  status: 'pending' | 'generating' | 'creating' | 'created' | 'error';
  error?: string;
  createdAt?: Date;
}

// Overall session
export interface Session {
  id: string;
  config: SessionConfig;
  status: AppStatus;
  repos: GeneratedRepo[];
  currentIteration: number;
  startTime: Date;
  endTime?: Date;
}

// WebSocket message types
export type WSMessageType =
  | 'status_update'
  | 'generation_start'
  | 'generation_complete'
  | 'repo_creating'
  | 'repo_created'
  | 'repo_error'
  | 'session_complete'
  | 'error'
  | 'log';

export interface WSMessage {
  type: WSMessageType;
  payload: any;
  timestamp: Date;
}
