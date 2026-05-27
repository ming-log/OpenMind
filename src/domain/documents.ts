import { createDefaultDocument } from "./markdown";
import type { DocumentState } from "./types";

export interface DeleteDocumentResult {
  documents: DocumentState[];
  activeDocument: DocumentState;
  deleted: boolean;
  deletedActiveDocument: boolean;
}

export function deleteDocumentById(documents: DocumentState[], activeDocumentId: string, documentId: string): DeleteDocumentResult {
  const activeDocument = documents.find((document) => document.id === activeDocumentId)
    ?? documents[0]
    ?? createDefaultDocument("OpenMind");
  const deletedIndex = documents.findIndex((document) => document.id === documentId);

  if (deletedIndex === -1) {
    return {
      documents: documents.length ? documents : [activeDocument],
      activeDocument,
      deleted: false,
      deletedActiveDocument: false,
    };
  }

  const remainingDocuments = documents.filter((document) => document.id !== documentId);
  const fallbackDocument = remainingDocuments.length
    ? remainingDocuments[Math.min(deletedIndex, remainingDocuments.length - 1)]
    : createDefaultDocument("OpenMind");
  const nextDocuments = remainingDocuments.length ? remainingDocuments : [fallbackDocument];
  const deletedActiveDocument = activeDocumentId === documentId;

  return {
    documents: nextDocuments,
    activeDocument: deletedActiveDocument
      ? fallbackDocument
      : nextDocuments.find((document) => document.id === activeDocument.id) ?? activeDocument,
    deleted: true,
    deletedActiveDocument,
  };
}
