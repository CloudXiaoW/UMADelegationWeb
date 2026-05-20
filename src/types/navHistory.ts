export interface NavHistoryPoint {
  label: string
  /** UMA per UMA-V (same convention as dashboard NAV). */
  nav: number
}

export interface NavHistoryConfig {
  points: NavHistoryPoint[]
}
