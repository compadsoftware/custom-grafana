import { css } from '@emotion/css';
import { formatDuration } from 'date-fns';
import { PureComponent } from 'react';

import { SelectableValue, parseDuration } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { t } from '../../utils/i18n';
import { ButtonGroup } from '../Button';
import { ButtonSelect } from '../Dropdown/ButtonSelect';
import { ToolbarButtonVariant, ToolbarButton } from '../ToolbarButton';

// Default intervals used in the refresh picker component
export const defaultIntervals = ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'];

export interface Props {
  intervals?: string[];
  onRefresh?: () => void;
  onIntervalChanged: (interval: string) => void;
  value?: string;
  tooltip?: string;
  isLoading?: boolean;
  isLive?: boolean;
  text?: string;
  noIntervalPicker?: boolean;
  showAutoInterval?: boolean;
  width?: string;
  primary?: boolean;
  isOnCanvas?: boolean;
}

export class RefreshPicker extends PureComponent<Props> {
  static offOption = {
    label: 'Uit',
    value: '',
    ariaLabel: 'Automatisch vernieuwen uitschakelen',
  };
  static liveOption = {
    label: 'Live',
    value: 'LIVE',
    ariaLabel: 'Live streaming inschakelen',
  };
  static autoOption = {
    label: 'Auto',
    value: 'auto',
    ariaLabel: 'Selecteer vernieuwen vanuit het query bereik',
  };

  static isLive = (refreshInterval?: string): boolean => refreshInterval === RefreshPicker.liveOption.value;

  constructor(props: Props) {
    super(props);
  }

  onChangeSelect = (item: SelectableValue<string>) => {
    const { onIntervalChanged } = this.props;
    if (onIntervalChanged && item.value != null) {
      onIntervalChanged(item.value);
    }
  };

  getVariant(): ToolbarButtonVariant {
    if (this.props.isLive) {
      return 'primary';
    }

    if (this.props.primary) {
      return 'primary';
    }

    return this.props.isOnCanvas ? 'canvas' : 'default';
  }

  render() {
    const { onRefresh, intervals, tooltip, value, isLoading, noIntervalPicker, width, showAutoInterval } = this.props;
    const text = 'Vernieuwen';
    const newWidth = width * 1.2;

    const currentValue = value || '';
    const variant = this.getVariant();
    const options = intervalsToOptions({ intervals, showAutoInterval });
    const option = options.find(({ value }) => value === currentValue);
    const translatedOffOption = translateOption(RefreshPicker.offOption.value);
    let selectedValue = option || translatedOffOption;

    if (selectedValue.label === translatedOffOption.label) {
      selectedValue = { value: '' };
    }

    const durationAriaLabel = selectedValue.ariaLabel;
    const ariaLabelDurationSelectedMessage = `Kies vernieuwingsinterval met huidig interval ${durationAriaLabel} geselecteerd`;
    const ariaLabelChooseIntervalMessage = 'Automatisch vernieuwen uitgeschakeld. Kies vernieuwingsinterval';
    const ariaLabel = selectedValue.value === '' ? ariaLabelChooseIntervalMessage : ariaLabelDurationSelectedMessage;

    const tooltipIntervalSelected = 'Stel automatisch vernieuwingsinterval in';
    const tooltipAutoRefreshOff = 'Automatisch vernieuwen uitgeschakeld';
    const tooltipAutoRefresh = selectedValue.value === '' ? tooltipAutoRefreshOff : tooltipIntervalSelected;

    return (
      <ButtonGroup className="refresh-picker">
        <ToolbarButton
          aria-label={text}
          tooltip={tooltip}
          onClick={onRefresh}
          variant={variant}
          icon={isLoading ? 'spinner' : 'sync'}
          style={newWidth ? { newWidth } : undefined}
          data-testid={selectors.components.RefreshPicker.runButtonV2}
        >
          {text}
        </ToolbarButton>
        {!noIntervalPicker && (
          <ButtonSelect
            className={css({
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            })}
            value={currentValue}
            options={options}
            onChange={this.onChangeSelect}
            variant={variant}
            data-testid={selectors.components.RefreshPicker.intervalButtonV2}
            aria-label={ariaLabel}
            tooltip={tooltipAutoRefresh}
          />
        )}
      </ButtonGroup>
    );
  }
}

export function translateOption(option: string) {
  switch (option) {
    case RefreshPicker.liveOption.value:
      return {
        label: 'Live',
        value: option,
        ariaLabel: 'Live streaming inschakelen',
      };
    case RefreshPicker.offOption.value:
      return {
        label: 'Uit',
        value: option,
        ariaLabel: 'Automatisch vernieuwen uitschakelen',
      };
    case RefreshPicker.autoOption.value:
      return {
        label: 'Auto',
        value: option,
        ariaLabel: 'Selecteer vernieuwen vanuit het query bereik',
      };
  }
  return {
    label: option,
    value: option,
  };
}

export function intervalsToOptions({
  intervals = defaultIntervals,
  showAutoInterval = false,
}: { intervals?: string[]; showAutoInterval?: boolean } = {}): Array<SelectableValue<string>> {
  const options: Array<SelectableValue<string>> = intervals.map((interval) => {
    const duration = parseDuration(interval);
    const ariaLabel = formatDuration(duration);

    return {
      label: interval,
      value: interval,
      ariaLabel: ariaLabel,
    };
  });

  if (showAutoInterval) {
    options.unshift(translateOption(RefreshPicker.autoOption.value));
  }
  options.unshift(translateOption(RefreshPicker.offOption.value));
  return options;
}
