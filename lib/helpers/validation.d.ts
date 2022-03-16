import type Migration, { MigrationContext } from "contentful-migration";

export interface ValidationHelpers {
  addLinkContentTypeValues(contentTypeId: string, fieldId: string, values: string | [string]): Promise<void>;
  addInValues(contentTypeId: string, fieldId: string, values: string | [string]): Promise<void>;
  removeLinkContentTypeValues(contentTypeId: string, fieldId: string, values: string | [string]): Promise<void>;
  removeInValues(contentTypeId: string, fieldId: string, values: string | [string]): Promise<void>;
}

export function getValidationHelpers(migration: Migration, context: MigrationContext): ValidationHelpers;
