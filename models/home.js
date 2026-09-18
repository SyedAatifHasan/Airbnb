const mongoose = require("mongoose");

const homeSchema = mongoose.Schema({
  houseName: {type: String, required:true},
  location: { type: String, required: true },
  price: {type: Number, required: true},
  image: String,
  description: String,
  ratting: { type: Number, default: 0 },
  rules: [String],
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});
module.exports = mongoose.model('Home', homeSchema);