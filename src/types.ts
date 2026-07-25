export type AgentStatus = 'ONLINE' | 'WORKING' | 'BUSY' | 'OFFLINE';

export type SkillToggle = {
  name: string;
  enabled: boolean;
  installed: boolean;
  healthy: boolean;
};

export type Agent = {
  id: string;
  name: string;
  room: string;
  role: string;
  model: string;
  status: AgentStatus;
  task: string;
  progress: number;
  x: number;
  y: number;
  bubble: string;
  color: string;
  uptime: string;
  queue: string;
  latency: string;
  memory: string;
  currentTaskLabel: string;
  logs: string[];
  telegramGroup: string;
  telegramTopic: string;
  skills: SkillToggle[];
};

export type GatewaySnapshot = {
  status: 'ONLINE' | 'OFFLINE';
  latency: string;
  cpu: string;
  ram: string;
  queue: string;
};
