export type DirectiveType =
  | 'solar_reduction'
  | 'minimum_battery_reserve'
  | 'no_charge_window'
  | 'no_discharge_window'
  | 'max_grid_window'
  | 'no_op';

export interface DirectiveAdjustment {
  hours?: number[];
  factor?: number;
  minimum_energy_kwh?: number;
  max_grid_kwh?: number;
}

export interface InterpretedDirective {
  note_index: number;
  applies: boolean;
  directive_type: DirectiveType;
  structured_adjustment: DirectiveAdjustment | null;
  explanation: string;
}