export interface AgentSummary {
  _id: string;
  name: string;
  role: string;
  description: string;
  kind: string;
  image: string;
  isActive: unknown;
  created_at: number;
  updated_at: number;
  last_used: number;
  agents: unknown;
}

export interface AgentListResponse {
  agentflows: AgentSummary[];
  total_count: number;
}

export interface AgentDetail extends AgentSummary {
  projectID: string;
  unique_id: string;
  default_goal: string;
  is_deleted: boolean;
  is_cron_scheduled: boolean;
  organization_id: string;
  initialAgent: string;
}

export interface FabricModel {
  id: string;
  name: string;
  provider: string;
  kind: string;
  contextWindow: number;
  costPer1M: number;
  costLabel: string;
  latencyP50Ms: number;
  health: string;
  sovereign: boolean;
  isDefault: boolean;
  backend: string;
  providerModelId: string;
  providerModelRef: string;
  region: string;
  managed: boolean;
}

export interface ModelListResponse {
  models: FabricModel[];
}

export interface SkillListResponse {
  total_count: number;
  skills: unknown[];
}
