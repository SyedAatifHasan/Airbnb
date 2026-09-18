const mongoose = require("mongoose");

const usersSchema = mongoose.Schema({
  fname: { type: String, required: [true, 'First name is required'] },
  mname: String,
  lname: { type: String, required: [true, 'Last name is required'] },
  email: { type: String, required: [true, 'Email is required'], unique: true },
  password: { type: String, required: [true, 'Password is required'] },
  usertype: { type: String, enum: ['host', 'guest'], default: 'guest', required: [true, 'User type is required'] },
  favourites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Home' }],

  phone: String,
  profileImage: { type: String, default: '/uploads/default-profile.png' },
  notifications: [{
    message: String,
    type: { type: String, enum: ['booking', 'system'], default: 'booking' },
    link: String,
    home: { type: mongoose.Schema.Types.ObjectId, ref: 'Home' },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }]
});
module.exports = mongoose.model('User', usersSchema);