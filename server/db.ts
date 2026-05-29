import { Collection, MongoClient, ObjectId, WithId } from "mongodb";

import { GenerationRecord, ensureGenerationIndexes } from "./generationStore";
import { AiJobRecord, ensureJobIndexes } from "./jobStore";

export type UserGeminiApiKey = {
  encryptedValue: string;
  iv: string;
  authTag: string;
  keyPreview: string;
  createdAt: Date;
  updatedAt: Date;
  verifiedAt?: Date;
};

export type UserRecord = {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  geminiApiKey?: UserGeminiApiKey;
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

export async function findUserById(
  collection: Collection<UserRecord>,
  userId: string | ObjectId
): Promise<WithId<UserRecord> | null> {
  const objectId = typeof userId === "string" ? (ObjectId.isValid(userId) ? new ObjectId(userId) : null) : userId;
  if (!objectId) {
    return null;
  }

  return collection.findOne({ _id: objectId });
}
