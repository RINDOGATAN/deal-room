// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Local Document Store
 *
 * Built-in document store that generates documents on-the-fly
 * from deal room data. No persistent file storage.
 * Proprietary providers (SharePoint, Google Drive, iManage)
 * implement IDocumentStore for cloud file storage.
 */

import type { IDocumentStore, StoredDocument } from "./types";

export class LocalDocumentStore implements IDocumentStore {
  readonly id = "local";
  readonly displayName = "Local (On-Demand)";

  async store(params: {
    dealRoomId: string;
    filename: string;
    mimeType: string;
    buffer: Buffer;
    metadata?: Record<string, string>;
  }): Promise<StoredDocument> {
    // Local store doesn't persist — documents are generated on demand
    // via the /api/deals/[id]/document routes.
    return {
      id: `local_${params.dealRoomId}`,
      filename: params.filename,
      mimeType: params.mimeType,
      url: `/api/deals/${params.dealRoomId}/document`,
      size: params.buffer.length,
      storedAt: new Date(),
      metadata: params.metadata,
    };
  }

  async retrieve(_documentId: string): Promise<Buffer | null> {
    // Documents are generated on demand, not stored
    return null;
  }

  async list(dealRoomId: string): Promise<StoredDocument[]> {
    // Return available document formats as virtual entries
    return [
      {
        id: `local_${dealRoomId}_pdf`,
        filename: "contract.pdf",
        mimeType: "application/pdf",
        url: `/api/deals/${dealRoomId}/document`,
        size: 0,
        storedAt: new Date(),
      },
      {
        id: `local_${dealRoomId}_docx`,
        filename: "contract.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        url: `/api/deals/${dealRoomId}/document/docx`,
        size: 0,
        storedAt: new Date(),
      },
      {
        id: `local_${dealRoomId}_txt`,
        filename: "contract.txt",
        mimeType: "text/plain",
        url: `/api/deals/${dealRoomId}/document/txt`,
        size: 0,
        storedAt: new Date(),
      },
    ];
  }
}
