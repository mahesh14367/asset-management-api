import { Model, Schema, Document } from 'mongoose';

/**
 * Prevents "Cannot overwrite model once compiled" errors under tsx/nodemon watch mode,
 * where the module re-executes on every file save but Mongoose's model registry
 * persists across those re-executions within the same process.
 */
export const getOrCreateDiscriminator = <T extends Document>(
  base: Model<any>,
  name: string,
  schema: Schema,
  value?: string
): Model<T> => {
  return (base.discriminators?.[name] as Model<T>) ?? base.discriminator<T>(name, schema, value);
};