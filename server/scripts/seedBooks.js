require('dotenv').config();

const { faker } = require('@faker-js/faker');
const mongoose = require('mongoose');
const { connectMongo } = require('../src/services/mongo');
const { query, pool } = require('../src/services/postgres');
const Book = require('../src/models/Book');

// keep in sync with the admin form
const categories = ['Fiction', 'Programming', 'Philosophy', 'Self Help', 'Science', 'Design', 'History', 'Systems'];

function randomBook(collectionId) {
  return {
    title: faker.book.title(),
    author: faker.book.author(),
    isbn: faker.commerce.isbn(),
    category: faker.helpers.arrayElement(categories),
    collection_id: collectionId,
    added_at: faker.date.recent({ days: 14 })
  };
}

// random reviews for testing
function randomReview(userId, username) {
  return {
    userId,
    username,
    rating: faker.number.int({ min: 1, max: 5 }),
    comment: faker.helpers.maybe(function generateComment() {
      return faker.lorem.sentence({ min: 4, max: 12 });
    }, { probability: 0.6 }) || ''
  };
}

async function run() {
  const count = Number(process.argv[2]) || 15;

  await connectMongo();

  const result = await query(
    'SELECT uc.id FROM user_collections uc JOIN users u ON u.id = uc.user_id WHERE u.is_admin = true ORDER BY uc.created_at ASC LIMIT 1'
  );

  if (!result.rows.length) {
    console.error('no admin collection found, run seedAdmin.js first');
    process.exit(1);
  }

  const collectionId = result.rows[0].id;

  const adminResult = await query('SELECT id, username FROM users WHERE is_admin = true LIMIT 1');
  const admin = adminResult.rows[0];

  // skip if already seeded
  const existing = await Book.countDocuments({ collection_id: collectionId });
  if (existing > 0) {
    console.log(`collection already has ${existing} books, skipping`);
    await mongoose.disconnect();
    await pool.end();
    return;
  }

  let books = [];
  for (let i = 0; i < count; i++) {
    const book = randomBook(collectionId);

    const reviews = [];
    const reviewCount = faker.number.int({ min: 0, max: 3 });
    for (let r = 0; r < reviewCount; r++) {
      reviews.push(randomReview(admin.id, admin.username));
    }
    book.reviews = reviews;

    books.push(book);
  }

  await Book.insertMany(books);
  console.log(`seeded ${books.length} books into collection ${collectionId}`);

  await mongoose.disconnect();
  await pool.end();
}

run().catch(function onError(err) {
  console.error(err);
  process.exit(1);
});
