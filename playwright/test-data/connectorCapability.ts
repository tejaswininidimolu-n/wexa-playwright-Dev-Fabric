export type ConnectorCapabilityRisk =
  | 'read-only'
  | 'configuration'
  | 'state-changing'
  | 'destructive'
  | 'unknown';

export type ConnectorCapabilitySource =
  | 'card'
  | 'overflow-menu'
  | 'configuration-modal'
  | 'configuration-fields'
  | 'event-triggers';

/** A capability observed without invoking its underlying operation. */
export interface ConnectorCapability {
  readonly name: string;
  readonly source: ConnectorCapabilitySource;
  readonly risk: ConnectorCapabilityRisk;
  readonly available: boolean;
  readonly itemCount?: number;
}

/** Raw availability returned by a rendered action control. */
export interface ConnectorActionAvailability {
  readonly name: string;
  readonly available: boolean;
}

export interface ConnectorCapabilityInventory {
  readonly connectorName: string;
  readonly capabilities: readonly ConnectorCapability[];
}

export const APPROVED_READ_ONLY_CAPABILITIES = [
  'View ontology',
  'View pipeline',
  'Browse data assets',
] as const;

export type ApprovedReadOnlyCapability =
  (typeof APPROVED_READ_ONLY_CAPABILITIES)[number];

/** Conservatively classifies only action terminology verified in the UI. */
export function classifyConnectorCapability(
  name: string,
): ConnectorCapabilityRisk {
  if (/remove|delete|disconnect/i.test(name)) {
    return 'destructive';
  }
  if (/^edit|config|field sensitivity/i.test(name)) {
    return 'configuration';
  }
  if (/save|sync|regenerate|enable|disable|test|event trigger/i.test(name)) {
    return 'state-changing';
  }
  if (/view|browse|cancel|close|show|details|documentation/i.test(name)) {
    return 'read-only';
  }
  return 'unknown';
}
