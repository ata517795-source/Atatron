export type Verdict = 'dangerous' | 'suspicious' | 'likely_safe' | 'unreachable';

export interface ScanReport {
  verdict: Verdict;
  risk_score: number;
  confidence: 'low' | 'medium' | 'high';
  site_title: string;
  scam_type: string | null;
  summary: string;
  who_is_behind: string;
  what_they_want: string[];
  red_flags: string[];
  good_signs: string[];
  advice: string[];
}

export interface ScanResponse {
  url: string;
  report: ScanReport;
  model?: string;
  error?: string;
}
