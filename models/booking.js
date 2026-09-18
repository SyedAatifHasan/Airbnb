const mongoose = require("mongoose");

const bookingSchema = mongoose.Schema({
  home: { type: mongoose.Schema.Types.ObjectId, ref: "Home", required: true },
  guest: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  familyCount: { type: Number, required: true, default: 1 },
  offeredPrice: { type: Number, required: true },

  status: {
    type: String,
    enum: [
      "pending",
      "confirmed",
      "rejected",
      "cancelled",
      "arrived",
      "returned",
    ],
    default: "pending",
  },

  createdAt: { type: Date, default: Date.now },

  guestFeedback: {
    rating: Number,
    comment: String,
    createdAt: Date,
    hostReply: {
      comment: String,
      createdAt: Date,
    },
  },
  hostFeedback: {
    rating: Number,
    comment: String,
    createdAt: Date,
  },
});

module.exports = mongoose.model("Booking", bookingSchema);
