import type { Locale } from "contentful-management/dist/typings/export-types";
import type Migration, { ContentType, Field, MigrationContext, MigrationFunction } from "contentful-migration";

//   { Field, ContentType, MigrationContext, MigrationFunction } = require('contentful-migration');
// const { Locale } = require('contentful-management/dist/typings/export-types');

export interface MigrationUtils {
  getLocales(): [Locale];
  getDefaultLocale(): Locale;
  getContentType(contentTypeId: string): ContentType;
  getField(contentType: ContentType, fieldId: string): Field;
  addLinkContentTypeValues(contentTypeId: string, fieldId: string, values: string | [string]): void;
  addInValues(contentTypeId: string, fieldId: string, values: string | [string]): void;
  removeLinkContentTypeValues(contentTypeId: string, fieldId: string, values: string | [string]): void;
  removeInValues(contentTypeId: string, fieldId: string, values: string | [string]): void;
}

export type EnhancedMigrationFunction = (
  migration: Migration,
  context?: MigrationContext,
  utils?: MigrationUtils
) => void;

export function withUtils(cb: EnhancedMigrationFunction): MigrationFunction;
