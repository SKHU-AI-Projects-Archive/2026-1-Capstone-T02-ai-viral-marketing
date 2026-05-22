import { Collection, MongoClient } from "mongodb";

import { GenerationRecord, ensureGenerationIndexes } from "./generationStore";

export type UserRecord = {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
};

export type AppCollections = {
  usersCollection: Collection<UserRecord>;
  generationsCollection: Collection<GenerationRecord>;
};

const usersDbName = "users";
const usersCollectionName = "user";
const generationsCollectionName = "generations";

export async function connectDatabase(mongoUrl: string): Promise<AppCollections> {
  const mongoClient = new MongoClient(mongoUrl);
  await mongoClient.connect();

  const database = mongoClient.db(usersDbName);
  const usersCollection = database.collection<UserRecord>(usersCollectionName);
  await usersCollection.createIndex({ email: 1 }, { unique: true });

  const generationsCollection = database.collection<GenerationRecord>(generationsCollectionName);
  await ensureGenerationIndexes(generationsCollection);

  console.log(`[bootstrap] generations collection ready: ${usersDbName}.${generationsCollectionName}`);

  return {
    usersCollection,
    generationsCollection,
  };
}

