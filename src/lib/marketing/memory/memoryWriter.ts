import "server-only";

import type { MemoryInsertRow, MemoryStore, MemoryUpdateRow } from "@/lib/marketing/memory/types";

export class MemoryWriter {
  constructor(private readonly store: MemoryStore) {}

  async findBySource(input: Parameters<MemoryStore["findBySource"]>[0]) {
    return this.store.findBySource(input);
  }

  async findSourcelessDuplicate(input: Parameters<MemoryStore["findSourcelessDuplicate"]>[0]) {
    return this.store.findSourcelessDuplicate(input);
  }

  async insert(row: MemoryInsertRow): Promise<{ id: string }> {
    return this.store.insert(row);
  }

  async update(id: string, row: MemoryUpdateRow): Promise<void> {
    return this.store.update(id, row);
  }
}
