import type { LedgerEntryDraft, SettlementLineDraft } from "../../models/records.js";

export class LedgerPostingService {
  public buildPostingPlan(lines: SettlementLineDraft[]): LedgerEntryDraft[] {
    return lines.map((line, index) => ({
      sourceAccountId: line.sourceAccountId,
      destinationAccountId: line.destinationAccountId,
      amountVnd: line.amountVnd,
      reasonText: line.reasonText,
      lineNo: index + 1
    }));
  }
}
