import { Collection, MongoClient, ObjectId, WithId } from "mongodb";

import { serverConfig } from "../config";
import type { GenerationExampleRecord } from "../ai/examples/store";
import { ensureGenerationExampleIndexes } from "../ai/examples/store";
import type { GenerationRecord } from "../generations/store";
import { ensureGenerationIndexes } from "../generations/store";
import type { AiJobRecord } from "../jobs/store";
import { ensureJobIndexes } from "../jobs/store";

export type UserGeminiApiKey = {
  version?: 1 | 2;
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

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

export type AppSessionData = {
  user?: SessionUser;
  csrfToken?: string;
};

export type SessionRecord = {
  _id: string;
  session: AppSessionData;
  expires: Date;
};

export type AppCollections = {
  usersCollection: Collection<UserRecord>;
  generationsCollection: Collection<GenerationRecord>;
  jobsCollection: Collection<AiJobRecord>;
  sessionsCollection: Collection<SessionRecord>;
  generationExamplesCollection: Collection<GenerationExampleRecord>;
};

const usersDbName = "users";
const usersCollectionName = "user";
const sessionsCollectionName = "sessions";
const generationsCollectionName = "generations";
const jobsCollectionName = "ai_jobs";
const generationExamplesCollectionName = "generation_examples";

let clientPromise: Promise<MongoClient> | null = null;
let collectionsPromise: Promise<AppCollections> | null = null;

async function getMongoClient(): Promise<MongoClient> {
  if (!serverConfig.mongoUrl) {
    throw new Error("MONGO_DB is required.");
  }

  if (!clientPromise) {
    const mongoClient = new MongoClient(serverConfig.mongoUrl);
    clientPromise = mongoClient.connect();
  }

  return clientPromise;
}

export async function getCollections(): Promise<AppCollections> {
  if (!collectionsPromise) {
    collectionsPromise = (async () => {
      const mongoClient = await getMongoClient();
      const database = mongoClient.db(usersDbName);
      const usersCollection = database.collection<UserRecord>(usersCollectionName);
      await usersCollection.createIndex({ email: 1 }, { unique: true });

      const sessionsCollection = database.collection<SessionRecord>(sessionsCollectionName);
      await sessionsCollection.createIndex({ expires: 1 }, { expireAfterSeconds: 0 });

      const generationsCollection = database.collection<GenerationRecord>(generationsCollectionName);
      await ensureGenerationIndexes(generationsCollection);

      const jobsCollection = database.collection<AiJobRecord>(jobsCollectionName);
      await ensureJobIndexes(jobsCollection);

      const generationExamplesCollection = database.collection<GenerationExampleRecord>(generationExamplesCollectionName);
      await ensureGenerationExampleIndexes(generationExamplesCollection);

      return {
        usersCollection,
        generationsCollection,
        jobsCollection,
        sessionsCollection,
        generationExamplesCollection,
      };
    })();
  }

  return collectionsPromise;
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
