const mongoose = require('mongoose');

// *** add retry logic
async function connectMongo() {
  const mongoUri = process.env.MONGO_URL;
  if (!mongoUri) {
    throw new Error('MONGO_URL is not set');
  }
  await mongoose.connect(mongoUri);
}

module.exports = { connectMongo };
