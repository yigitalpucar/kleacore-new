export interface CronJobResult {
  processed: number;
  skipped?: number;
  ids?: string[];
}