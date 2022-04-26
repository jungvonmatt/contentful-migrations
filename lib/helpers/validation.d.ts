import type Migration from "contentful-migration";
import type { MigrationContext } from "contentful-migration";

export type ValueMappingFunction = (values: string[]) => string[];

export type AddValuesOptionMode = 'sorted' | 'start' | 'end' | 'before' | 'after';

export interface AddValuesOptions {
  mode?: AddValuesOptionMode;
  ref?: string;
}

export interface ValidationHelpers {
  addLinkContentTypeValues(contentTypeId: string, fieldId: string, values: string | string[]): Promise<void>;
  addInValues(contentTypeId: string, fieldId: string, values: string | string[], options?: AddValuesOptions): Promise<void>;
  removeLinkContentTypeValues(contentTypeId: string, fieldId: string, values: string | string[]): Promise<void>;
  removeInValues(contentTypeId: string, fieldId: string, values: string | string[]): Promise<void>;
  modifyLinkContentTypeValues(contentTypeId: string, fieldId: string, valueMappingFunction: ValueMappingFunction): Promise<void>;
  modifyInValues(contentTypeId: string, fieldId: string, valueMappingFunction: ValueMappingFunction): Promise<void>;
}

export function getValidationHelpers(migration: Migration, context: MigrationContext): ValidationHelpers;
