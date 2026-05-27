import { Collection, MongoClient } from "mongodb";

import { GenerationRecord, ensureGenerationIndexes } from "./generationStore";
import { AiJobRecord, ensureJobIndexes } from "./jobStore";

export type UserRecord = {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
};

export type AppCollections = {
  usersCollection: Collection<UserRecord>;
  generationsCollection: Collection<GenerationRecord>;
  jobsCollection: Collection<AiJobRecord>;
};

const usersDbName = "users";
const usersCollectionName = "user";
const generationsCollectionName = "generations";
const jobsCollectionName = "ai_jobs";

export async function connectDatabase(mongoUrl: string): Promise<AppCollections> {
  const mongoClient = new MongoClient(mongoUrl);
  await mongoClient.connect();

  const database = mongoClient.db(usersDbName);
  const usersCollection = database.collection<UserRecord>(usersCollectionName);
  await usersCollection.createIndex({ email: 1 }, { unique: true });

  const generationsCollection = database.collection<GenerationRecord>(generationsCollectionName);
  await ensureGenerationIndexes(generationsCollection);

  const jobsCollection = database.collection<AiJobRecord>(jobsCollectionName);
  await ensureJobIndexes(jobsCollection);

  console.log(`[bootstrap] generations collection ready: ${usersDbName}.${generationsCollectionName}`);
  console.log(`[bootstrap] jobs collection ready: ${usersDbName}.${jobsCollectionName}`);

  return {
    usersCollection,
    generationsCollection,
    jobsCollection,
  };
}
