const Booking = require("../models/booking");
const Home = require("../models/home");
const User = require("../models/user");
const { sendMail } = require("../utils/mailer");

exports.postCreateBooking = async (req, res, next) => {
  if (!req.session.isLoggedIn || !req.session.user) {
    return res.redirect("/login");
  }
  try {
    const { homeId, checkIn, checkOut, familyCount, offeredPrice } = req.body;
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    const home = await Home.findById(homeId);
    if (!home) return res.redirect("/homes");
    if (checkOutDate <= checkInDate) {
      req.flash("toast", "Check-out must be after check-in.");
      return res.redirect(`/homes/${homeId}`);
    }

    const overlapping = await Booking.findOne({
      home: homeId,
      status: { $in: ["pending", "confirmed", "arrived"] },
      checkIn: { $lt: checkOutDate },
      checkOut: { $gt: checkInDate },
    });

    if (overlapping) {
      req.flash("toast", "This home is already booked for those dates.");
      return res.redirect(`/homes/${homeId}`);
    }
    const booking = new Booking({
      home: home._id,
      guest: req.session.user._id,
      host: home.hostId,
      checkIn,
      checkOut,
      familyCount,
      offeredPrice,
    });
    await booking.save();

    await User.findByIdAndUpdate(home.hostId, {
      $push: {
        notifications: {
          message: `New booking request for ${home.houseName} from ${req.session.user.fname} ${req.session.user.lname}`,
          type: "booking",
          link: `/host/bookings?bookingId=${booking._id}`,
          home: home._id,
          booking: booking._id,
        },
      },
    });

    const host = await User.findById(home.hostId);
    sendMail(
      host.email,
      "New Booking Request",
      `You have a new booking request for ${home.houseName} from ${req.session.user.fname}.`,
      {
        link: `/host/bookings?bookingId=${booking._id}`,
        buttonText: "View Booking Request",
      },
    );

    req.flash("toast", "Booking request sent!");
    res.redirect("/bookings");
  } catch (err) {
    next(err);
  }
};

exports.getGuestBookings = async (req, res, next) => {
  if (!req.session.isLoggedIn || !req.session.user) {
    return res.redirect("/login");
  }
  const bookings = await Booking.find({ guest: req.session.user._id })
    .populate("home")
    .populate("host", "fname mname lname email phone profileImage");
  res.render("store/bookings", {
    bookings,
    pageTitle: "My Bookings",
    currentPage: "Bookings",
    isLoggedIn: req.session.isLoggedIn,
    user: req.session.user,
  });
};

exports.postCancelBooking = async (req, res, next) => {
  if (!req.session.isLoggedIn || !req.session.user) {
    return res.redirect("/login");
  }
  const booking = await Booking.findById(req.params.bookingId).populate(
    "home host",
  );
  if (booking && booking.guest.toString() === req.session.user._id.toString()) {
    booking.status = "cancelled";
    await booking.save();
    await User.findByIdAndUpdate(booking.host._id, {
      $push: {
        notifications: {
          message: `Booking for ${booking.home.houseName} was cancelled by ${req.session.user.fname} ${req.session.user.lname}.`,
          type: "booking",
          link: `/host/bookings?bookingId=${booking._id}`,
          home: booking.home._id,
          booking: booking._id,
        },
      },
    });

    sendMail(
      booking.host.email,
      "Booking Cancelled",
      `The booking for ${booking.home.houseName} was cancelled by the guest.`,
      {
        link: `/host/bookings?bookingId=${booking._id}`,
        buttonText: "View Bookings",
      },
    );

    req.flash("toast", "Booking cancelled.");
  }
  res.redirect("/bookings");
};
