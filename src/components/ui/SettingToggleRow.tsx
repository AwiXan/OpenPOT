import React from 'react';
import { Toggle } from './Toggle';

interface SettingToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const SettingToggleRow: React.FC<SettingToggleRowProps> = ({
  icon,
  title,
  description,
  checked,
  onChange,
}) => {
  return (

    <div className="bg-(--op-bg-canvas) p-4 rounded-lg border border-(--op-border) flex items-center justify-between gap-4 transition-colors hover:border-(--op-accent)/27">
      <div>
        <label className="text-white font-semibold flex items-center gap-1.5 cursor-pointer" onClick={() => onChange(!checked)}>
          {icon}
          <span>{title}</span>
        </label>
        <p className="text-[11px] text-(--op-text-muted) mt-0.5">
          {description}
        </p>
      </div>
      
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
};