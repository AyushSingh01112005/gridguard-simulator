// import mongoose from "mongoose";

// const MONGODB_URI = process.env.MONGODB_URI;

// if (!MONGODB_URI) {
//   throw new Error("Please define MONGODB_URI in .env.local");
// }

// const connectDB = async () => {
//   try {
//     await mongoose.connect(MONGODB_URI);
//     console.log("MongoDB connected");
//   } catch (error) {
//     console.error("MongoDB connection failed:", error);
//     throw error;
//   }
// };

// export default connectDB;

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define MONGODB_URI in .env.local");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached = global.mongooseCache || {
  conn: null,
  promise: null,
};

global.mongooseCache = cached;

const connectDB = async () => {
  // Already connected
  if (cached.conn) {
    return cached.conn;
  }

  // Connection is already being established
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI);
  }

  try {
    cached.conn = await cached.promise;
    console.log("MongoDB connected");
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    console.error("MongoDB connection failed:", error);
    throw error;
  }
};

export default connectDB;