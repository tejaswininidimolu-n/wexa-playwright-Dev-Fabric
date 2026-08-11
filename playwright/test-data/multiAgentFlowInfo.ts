export interface MultiAgentFlowMutation {
  method: string;
  path: string;
  status: number;
  requestKeys: string[];
  responseKeys: string[];
  id?: string;
  name?: string;
  type?: string;
}

export interface MultiAgentPostCreateInspection {
  url: string;
  mainText: string;
  headings: string[];
  buttons: string[];
  labels: string[];
  inputs: Array<{
    type: string | null;
    placeholder: string | null;
  }>;
}

export interface EmbeddedFlowAgent {
  _id: string;
  title: string;
  role: string;
  role_description: string;
  agent_type: 'skilled_agent' | 'decider_agent';
  next_agent: string | null;
  conditions?: Array<{
    decision: string;
    condition: string;
  }>;
  next_agents?: Record<string, string>;
  prompt: {
    template: string;
    display_template: string | null;
  };
}

export interface MultiAgentGraphInspection {
  nodes: Array<{
    id: string | null;
    text: string;
  }>;
  edges: Array<{
    id: string | null;
    testId: string | null;
  }>;
}

export interface MultiAgentRunPageInspection extends MultiAgentPostCreateInspection {
  controls: Array<{
    tag: string;
    type: string | null;
    name: string | null;
    placeholder: string | null;
    text: string;
    disabled: boolean;
  }>;
}

export interface MultiAgentExecutionExchange {
  method: string;
  path: string;
  status: number;
  requestKeys: string[];
  responseKeys: string[];
  executionId?: string;
  statusValue?: string;
  responseBody: Record<string, unknown>;
}
