
export interface AnalysisStep {
  title: string;
  law: string[];
  sub: string;
  res: string;
}

export interface Question {
  id: number;
  text: string;
  req: string[];
  targets: string;
  analysis: AnalysisStep[];
  image?: string;
}

export interface DiagnosisResult {
  title: string;
  isLawFound: boolean;
  isSubCorrect: boolean;
  isResCorrect: boolean;
  feedback?: string;
}

export enum ViewState {
  START,
  EXAM,
  RESULT
}
