import { within } from '@testing-library/react';
import { render, screen, userEvent, waitFor } from 'test/test-utils';
import { byLabelText, byRole, byText } from 'testing-library-selector';

import { setPluginLinksHook } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';
import { CombinedRule, RuleIdentifier } from 'app/types/unified-alerting';

import {
  getCloudRule,
  getGrafanaRule,
  getVanillaPromRule,
  grantUserPermissions,
  mockCombinedCloudRuleNamespace,
  mockDataSource,
  mockPluginLinkExtension,
  mockPromAlertingRule,
} from '../../mocks';
import { grafanaRulerRule } from '../../mocks/grafanaRulerApi';
import { grantPermissionsHelper } from '../../test/test-utils';
import { setupDataSources } from '../../testSetup/datasources';
import { Annotation } from '../../utils/constants';
import { DataSourceType } from '../../utils/datasource';
import * as ruleId from '../../utils/rule-id';
import { stringifyIdentifier } from '../../utils/rule-id';

import { AlertRuleProvider } from './RuleContext';
import RuleViewer, { ActiveTab } from './RuleViewer';

// metadata and interactive elements
const ELEMENTS = {
  loading: byText(/Loading rule/i),
  metadata: {
    summary: (text: string) => byText(text),
    runbook: (url: string) => byRole('link', { name: url }),
    dashboardAndPanel: byRole('link', { name: 'View panel' }),
    evaluationInterval: (interval: string) => byText(`Every ${interval}`),
    label: ([key, value]: [string, string]) => byRole('listitem', { name: `${key}: ${value}` }),
  },
  details: {
    pendingPeriod: byLabelText(/Pending period/i),
  },
  actions: {
    edit: byRole('link', { name: 'Edit' }),
    more: {
      button: byRole('button', { name: /More/i }),
      actions: {
        silence: byRole('menuitem', { name: /Silence/i }),
        duplicate: byRole('menuitem', { name: /Duplicate/i }),
        copyLink: byRole('menuitem', { name: /Copy link/i }),
        export: byRole('menuitem', { name: /Export/i }),
        delete: byRole('menuitem', { name: /Delete/i }),
      },
      pluginActions: {
        sloDashboard: byRole('menuitem', { name: /SLO dashboard/i }),
        declareIncident: byRole('link', { name: /Declare incident/i }),
        assertsWorkbench: byRole('menuitem', { name: /Open workbench/i }),
      },
    },
  },
};

setupMswServer();

setPluginLinksHook(() => ({
  links: [
    mockPluginLinkExtension({ pluginId: 'grafana-slo-app', title: 'SLO dashboard', path: '/a/grafana-slo-app' }),
    mockPluginLinkExtension({
      pluginId: 'grafana-asserts-app',
      title: 'Open workbench',
      path: '/a/grafana-asserts-app',
    }),
  ],
  isLoading: false,
}));

const openSilenceDrawer = async () => {
  const user = userEvent.setup();
  await user.click(ELEMENTS.actions.more.button.get());
  await user.click(ELEMENTS.actions.more.actions.silence.get());
  await screen.findByText(/Configure silences/i);
};

beforeAll(() => {
  grantPermissionsHelper([
    AccessControlAction.AlertingRuleCreate,
    AccessControlAction.AlertingRuleRead,
    AccessControlAction.AlertingRuleUpdate,
    AccessControlAction.AlertingRuleDelete,
    AccessControlAction.AlertingInstanceCreate,
  ]);
});

const dataSources = {
  am: mockDataSource<AlertManagerDataSourceJsonData>(
    {
      name: 'Alertmanager',
      type: DataSourceType.Alertmanager,
      jsonData: { handleGrafanaManagedAlerts: true },
    },
    { module: 'core:plugin/alertmanager' }
  ),
  mimir: mockDataSource({ uid: 'mimir', name: 'Mimir' }, { module: 'core:plugin/prometheus' }),
  prometheus: mockDataSource({ uid: 'prometheus', name: 'Prometheus' }, { module: 'core:plugin/prometheus' }),
};

describe('RuleViewer', () => {
  beforeEach(() => {
    setupDataSources(...Object.values(dataSources));
  });

  describe('Grafana managed alert rule', () => {
    const mockRule = getGrafanaRule(
      {
        name: 'Test alert',
        annotations: {
          [Annotation.dashboardUID]: 'dashboard-1',
          [Annotation.panelID]: 'panel-1',
          [Annotation.summary]: 'This is the summary for the rule',
          [Annotation.runbookURL]: 'https://runbook.site/',
        },
        labels: {
          team: 'operations',
          severity: 'low',
        },
        group: {
          name: 'my-group',
          interval: '15m',
          rules: [],
          totals: { alerting: 1 },
        },
      },
      { uid: grafanaRulerRule.grafana_alert.uid }
    );
    const mockRuleIdentifier = ruleId.fromCombinedRule('grafana', mockRule);

    beforeAll(() => {
      grantPermissionsHelper([
        AccessControlAction.AlertingRuleCreate,
        AccessControlAction.AlertingRuleRead,
        AccessControlAction.AlertingRuleUpdate,
        AccessControlAction.AlertingRuleDelete,
        AccessControlAction.AlertingInstanceRead,
        AccessControlAction.AlertingInstanceCreate,
        AccessControlAction.AlertingInstanceRead,
        AccessControlAction.AlertingInstancesExternalRead,
        AccessControlAction.AlertingInstancesExternalWrite,
      ]);
    });

    it('should render a Grafana managed alert rule', async () => {
      await renderRuleViewer(mockRule, mockRuleIdentifier);

      // assert on basic info to be visible
      expect(screen.getByText('Test alert')).toBeInTheDocument();
      expect(screen.getByText('Firing')).toBeInTheDocument();

      // alert rule metadata
      const ruleSummary = mockRule.annotations[Annotation.summary];
      const runBookURL = mockRule.annotations[Annotation.runbookURL];
      const groupInterval = mockRule.group.interval;
      const labels = mockRule.labels;

      expect(ELEMENTS.metadata.summary(ruleSummary).get()).toBeInTheDocument();
      expect(ELEMENTS.metadata.dashboardAndPanel.get()).toBeInTheDocument();
      expect(ELEMENTS.metadata.runbook(runBookURL).get()).toBeInTheDocument();
      expect(ELEMENTS.metadata.evaluationInterval(groupInterval!).get()).toBeInTheDocument();

      for (const label in labels) {
        expect(ELEMENTS.metadata.label([label, labels[label]]).get()).toBeInTheDocument();
      }

      // actions
      expect(await ELEMENTS.actions.edit.find()).toBeInTheDocument();
      expect(ELEMENTS.actions.more.button.get()).toBeInTheDocument();

      // check the "more actions" button
      await userEvent.click(ELEMENTS.actions.more.button.get());
      const menuItems = Object.values(ELEMENTS.actions.more.actions);
      for (const menuItem of menuItems) {
        expect(menuItem.get()).toBeInTheDocument();
      }
    });

    it('renders silencing form correctly and shows alert rule name', async () => {
      await renderRuleViewer(mockRule, mockRuleIdentifier);
      await openSilenceDrawer();

      const silenceDrawer = await screen.findByRole('dialog', { name: 'Drawer title Silence alert rule' });
      expect(await within(silenceDrawer).findByLabelText(/^alert rule/i)).toHaveValue(
        grafanaRulerRule.grafana_alert.title
      );
    });
  });

  describe('Data source managed alert rule', () => {
    const { mimir } = dataSources;

    const mockRule = getCloudRule(
      {
        name: 'cloud test alert',
        annotations: { [Annotation.summary]: 'cloud summary', [Annotation.runbookURL]: 'https://runbook.example.com' },
        group: { name: 'Cloud group', interval: '15m', rules: [], totals: { alerting: 1 } },
      },
      { rulesSource: mimir }
    );
    const mockRuleIdentifier = ruleId.fromCombinedRule(mimir.name, mockRule);

    beforeAll(() => {
      grantUserPermissions([
        AccessControlAction.AlertingRuleExternalRead,
        AccessControlAction.AlertingRuleExternalWrite,
      ]);
    });

    it('should render a data source managed alert rule', () => {
      renderRuleViewer(mockRule, mockRuleIdentifier);

      // assert on basic info to be vissible
      expect(screen.getByText('cloud test alert')).toBeInTheDocument();
      expect(screen.getByText('Firing')).toBeInTheDocument();

      expect(screen.getByText(mockRule.annotations[Annotation.summary])).toBeInTheDocument();
      expect(screen.getByRole('link', { name: mockRule.annotations[Annotation.runbookURL] })).toBeInTheDocument();
      expect(screen.getByText(`Every ${mockRule.group.interval}`)).toBeInTheDocument();
    });

    it('should render custom plugin actions for a plugin-provided rule', async () => {
      const sloRule = getCloudRule(
        { name: 'slo test alert', labels: { __grafana_origin: 'plugin/grafana-slo-app' } },
        { rulesSource: mimir }
      );
      const sloRuleIdentifier = ruleId.fromCombinedRule(mimir.name, sloRule);

      const user = userEvent.setup();

      renderRuleViewer(sloRule, sloRuleIdentifier);

      expect(ELEMENTS.actions.more.button.get()).toBeInTheDocument();

      await user.click(ELEMENTS.actions.more.button.get());

      expect(ELEMENTS.actions.more.pluginActions.sloDashboard.get()).toBeInTheDocument();
      expect(ELEMENTS.actions.more.pluginActions.assertsWorkbench.query()).not.toBeInTheDocument();

      await waitFor(() => expect(ELEMENTS.actions.more.pluginActions.declareIncident.get()).toBeEnabled());
    });

    it('should render different custom plugin actions for a different plugin-provided rule', async () => {
      const assertsRule = getCloudRule(
        { name: 'asserts test alert', labels: { __grafana_origin: 'plugin/grafana-asserts-app' } },
        { rulesSource: mimir }
      );
      const assertsRuleIdentifier = ruleId.fromCombinedRule(mimir.name, assertsRule);

      renderRuleViewer(assertsRule, assertsRuleIdentifier);

      expect(ELEMENTS.actions.more.button.get()).toBeInTheDocument();

      await userEvent.click(ELEMENTS.actions.more.button.get());

      expect(ELEMENTS.actions.more.pluginActions.assertsWorkbench.get()).toBeInTheDocument();
      expect(ELEMENTS.actions.more.pluginActions.sloDashboard.query()).not.toBeInTheDocument();

      await waitFor(() => expect(ELEMENTS.actions.more.pluginActions.declareIncident.get()).toBeEnabled());
    });
  });

  describe('Vanilla Prometheus rule', () => {
    const { prometheus } = dataSources;

    const mockRule = getVanillaPromRule({
      name: 'prom test alert',
      namespace: mockCombinedCloudRuleNamespace({ name: 'prometheus' }, prometheus.name),
      annotations: { [Annotation.summary]: 'prom summary', [Annotation.runbookURL]: 'https://runbook.example.com' },
      promRule: {
        ...mockPromAlertingRule(),
        duration: 900, // 15 minutes
      },
    });

    const mockRuleIdentifier = ruleId.fromCombinedRule(prometheus.name, mockRule);

    it('should render pending period for vanilla Prometheus alert rule', async () => {
      renderRuleViewer(mockRule, mockRuleIdentifier, ActiveTab.Details);

      expect(screen.getByText('prom test alert')).toBeInTheDocument();

      // One summary is rendered by the Title component, and the other by the DetailsTab component
      expect(ELEMENTS.metadata.summary(mockRule.annotations[Annotation.summary]).getAll()).toHaveLength(2);

      expect(ELEMENTS.details.pendingPeriod.get()).toHaveTextContent(/15m/i);
    });
  });
});

const renderRuleViewer = async (rule: CombinedRule, identifier: RuleIdentifier, tab: ActiveTab = ActiveTab.Query) => {
  const path = `/alerting/${identifier.ruleSourceName}/${stringifyIdentifier(identifier)}/view?tab=${tab}`;
  render(
    <AlertRuleProvider identifier={identifier} rule={rule}>
      <RuleViewer />
    </AlertRuleProvider>,
    { historyOptions: { initialEntries: [path] } }
  );

  await waitFor(() => expect(ELEMENTS.loading.query()).not.toBeInTheDocument());
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useReturnToPrevious: jest.fn(),
}));
