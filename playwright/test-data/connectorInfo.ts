/** Connector fields verified in the rendered Connectors card UI. */
export interface ConnectorInfo {
  readonly runtimeId: string;
  readonly name: string;
  readonly description?: string;
  readonly status?: string;
}
