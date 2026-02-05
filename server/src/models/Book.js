const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema(
  {
    userId: { type: Number, required: true },
    username: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: '' }
  },
  { timestamps: true }
);

const BookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  isbn: { type: String, required: true },
  category: { type: String, required: true },
  collection_id: { type: Number, required: true },
  added_at: { type: Date, default: Date.now },
  reviews: { type: [ReviewSchema], default: [] }
});

// indexes for search + filtering
BookSchema.index({ collection_id: 1, added_at: -1 });
BookSchema.index({ title: 'text', author: 'text', isbn: 'text' });
BookSchema.index({ category: 1 });


module.exports = mongoose.model('Book', BookSchema);
