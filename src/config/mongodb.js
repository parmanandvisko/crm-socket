import mongoose from "mongoose";

export const connectMongoDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MongoDB disabled: MONGODB_URI is not configured");
    return false;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log("MongoDB connected");
    return true;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    return false;
  }
};

export const isMongoReady = () => mongoose.connection.readyState === 1;
