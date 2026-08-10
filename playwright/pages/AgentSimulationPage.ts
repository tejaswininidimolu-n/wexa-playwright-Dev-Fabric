import { expect, type Locator, type Page } from '@playwright/test';

import { BasePage } from './base.page';

const SIMULATION_PATH = '/simulate/agent';

export class AgentSimulationPage extends BasePage {
  private readonly navigationButton: Locator;
  private readonly heading: Locator;
  private readonly agentSelect: Locator;
  private readonly scenarioInput: Locator;
  private readonly repetitionsInput: Locator;
  private readonly runButton: Locator;

  constructor(page: Page) {
    super(page);
    this.navigationButton = page.getByTestId('nav-simulate/agent');
    this.heading = page.getByRole('heading', {
      name: 'Agent Simulation',
      exact: true,
    });
    this.agentSelect = page.locator('main select').first();
    this.scenarioInput = page.getByPlaceholder(
      'Describe the situation the agent should handle…',
      { exact: true },
    );
    this.repetitionsInput = page.getByLabel('Repetitions', { exact: true });
    this.runButton = page.getByRole('button', {
      name: 'Run simulation',
      exact: true,
    });
  }

  async navigateFromHome(): Promise<void> {
    await this.page.goto('/');
    await this.navigationButton.click();
    await this.waitForReady();
  }

  async waitForReady(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${SIMULATION_PATH}/?$`));
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
    await expect(this.agentSelect).toBeVisible();
    await expect(this.scenarioInput).toBeVisible();
    await expect(this.repetitionsInput).toBeVisible();
    await expect(this.runButton).toBeVisible();
  }

  getAgentSelect(): Locator {
    return this.agentSelect;
  }

  getScenarioInput(): Locator {
    return this.scenarioInput;
  }

  getRepetitionsInput(): Locator {
    return this.repetitionsInput;
  }

  getRunButton(): Locator {
    return this.runButton;
  }

  getRepetitionPreset(value: 1 | 10 | 50): Locator {
    return this.page.getByRole('button', { name: `${value}×`, exact: true });
  }
}
