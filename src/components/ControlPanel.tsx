import React from 'react';
import { GlobalFieldControls, RuleGroupId, RuleGroupState } from '../domain/flux';

interface ControlPanelProps {
  controls: GlobalFieldControls;
  ruleGroups: Record<RuleGroupId, RuleGroupState>;
  onControlsChange: (controls: GlobalFieldControls) => void;
  onRuleGroupChange: (group: RuleGroupState) => void;
}

function Slider({
  label,
  min,
  max,
  step = 0.1,
  value,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <label className="control">
      <div className="control-label">
        <span>{label}</span>
        <span className="control-value">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function ControlPanel({ controls, ruleGroups, onControlsChange, onRuleGroupChange }: ControlPanelProps) {
  return (
    <div className="control-panel">
      <h2>Global Field Controls</h2>
      <Slider
        label="Evolution rate"
        min={0}
        max={2}
        step={0.1}
        value={controls.evolutionRate}
        onChange={(val) => onControlsChange({ ...controls, evolutionRate: val })}
      />
      <Slider
        label="Density bias"
        min={0}
        max={1}
        step={0.05}
        value={controls.densityBias}
        onChange={(val) => onControlsChange({ ...controls, densityBias: val })}
      />
      <Slider
        label="Volatility"
        min={0}
        max={1}
        step={0.05}
        value={controls.volatility}
        onChange={(val) => onControlsChange({ ...controls, volatility: val })}
      />
      <Slider
        label="History surfacing"
        min={0}
        max={1}
        step={0.05}
        value={controls.historySurfacing}
        onChange={(val) => onControlsChange({ ...controls, historySurfacing: val })}
      />

      <h2>Rule Groups</h2>
      <div className="rule-groups">
        {Object.values(ruleGroups).map((group) => (
          <div key={group.id} className="rule-group">
            <div className="rule-top">
              <label>
                <input
                  type="checkbox"
                  checked={group.enabled}
                  onChange={(e) => onRuleGroupChange({ ...group, enabled: e.target.checked })}
                />
                <span>{group.label}</span>
              </label>
              <span className="badge">{group.weight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={group.weight}
              onChange={(e) =>
                onRuleGroupChange({ ...group, weight: Number(e.target.value), enabled: group.enabled })
              }
              disabled={!group.enabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
