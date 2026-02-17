/**
 * Anomaly detector — compares utility bills against rolling averages.
 */

import { getDb } from "../db.js";
import { getConfig } from "../config/loader.js";

export interface AnomalyResult {
  detected: boolean;
  bill_type: string;
  current_amount: number;
  average_amount: number;
  deviation_percent: number;
  message: string;
}

/**
 * Check if a bill amount is anomalous compared to the rolling average.
 */
export function checkBillAnomaly(billType: string, amount: number): AnomalyResult {
  const db = getDb();
  const config = getConfig();
  const threshold = config.scoring.anomaly_deviation_threshold;

  // Get last 3 items with the same bill_type
  const previousBills = db.prepare(`
    SELECT structured_data FROM items
    WHERE domain = 'household' AND source IN ('template', 'manual')
      AND structured_data LIKE ?
    ORDER BY created_at DESC
    LIMIT 3
  `).all(`%"bill_type":"${billType}"%`) as { structured_data: string }[];

  const amounts: number[] = [];
  for (const row of previousBills) {
    try {
      const data = JSON.parse(row.structured_data);
      if (typeof data.amount === "number") {
        amounts.push(data.amount);
      }
    } catch { /* ignore */ }
  }

  if (amounts.length === 0) {
    return {
      detected: false,
      bill_type: billType,
      current_amount: amount,
      average_amount: 0,
      deviation_percent: 0,
      message: `First ${billType} bill recorded — no baseline for comparison yet.`,
    };
  }

  const average = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
  const deviation = (amount - average) / average;

  if (deviation > threshold) {
    return {
      detected: true,
      bill_type: billType,
      current_amount: amount,
      average_amount: Math.round(average * 100) / 100,
      deviation_percent: Math.round(deviation * 100),
      message: `Your ${billType} bill ($${amount}) is ${Math.round(deviation * 100)}% above your 3-month average ($${Math.round(average)}).`,
    };
  }

  return {
    detected: false,
    bill_type: billType,
    current_amount: amount,
    average_amount: Math.round(average * 100) / 100,
    deviation_percent: Math.round(deviation * 100),
    message: `${billType} bill ($${amount}) is within normal range.`,
  };
}
