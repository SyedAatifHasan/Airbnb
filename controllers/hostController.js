const path = require("path");
const fs = require("fs");
const rootDir = require("../utils/pathUtil");
const Home = require("../models/home");
const Booking = require("../models/booking");

const ALLOWED_TRANSITIONS = {
  pending: ["confirmed", "rejected"],
  confirmed: ["cancelled", "arrived"],
  arrived: ["returned"],
};
const User = require("../models/user");
const { sendMail } = require("../utils/mailer");
exports.getAddHome = (req, res, next) => {
  res.render("host/edit-home", {
    pageTitle: "Add Home",
    currentPage: "Add Home",
    editing: false,
    isLoggedIn: req.session.isLoggedIn,
    user: req.session.user,
  });
};

exports.getHostHomes = async (req, res, next) => {
  try {
    const hostId = req.session.user._id;

    const registeredHome = await Home.find({ hostId });

    const homeIds = registeredHome.map((h) => h._id);
    const now = new Date();

    const bookings = await Booking.find({
      home: { $in: homeIds },
      status: { $in: ["pending", "confirmed", "arrived", "returned"] },
    })
      .populate("guest", "fname lname")
      .sort({ checkIn: 1 });

    const statsByHome = {};
    registeredHome.forEach((h) => {
      statsByHome[h._id.toString()] = {
        totalBookings: 0,
        currentGuestName: null,
        currentCheckOut: null,
        nextCheckIn: null,
        nextGuestName: null,
      };
    });

    bookings.forEach((b) => {
      const stat = statsByHome[b.home.toString()];
      if (!stat) return;

      stat.totalBookings++;

      const guestName = b.guest ? `${b.guest.fname} ${b.guest.lname}` : "Guest";

      if (
        ["confirmed", "arrived"].includes(b.status) &&
        b.checkIn <= now &&
        b.checkOut >= now
      ) {
        stat.currentGuestName = guestName;
        stat.currentCheckOut = b.checkOut;
      }

      if (["pending", "confirmed"].includes(b.status) && b.checkIn > now) {
        if (!stat.nextCheckIn || b.checkIn < stat.nextCheckIn) {
          stat.nextCheckIn = b.checkIn;
          stat.nextGuestName = guestName;
        }
      }
    });

    const homesWithStats = registeredHome.map((h) => {
      const stat = statsByHome[h._id.toString()];
      return {
        ...h.toObject(),
        totalBookings: stat.totalBookings,
        currentGuestName: stat.currentGuestName,
        currentCheckOut: stat.currentCheckOut,
        nextCheckIn: stat.nextCheckIn,
        nextGuestName: stat.nextGuestName,
      };
    });

    res.render("host/host-home-list", {
      registeredHome: homesWithStats,
      pageTitle: "Host Home List",
      currentPage: "Host Homes",
      isLoggedIn: req.session.isLoggedIn,
      user: req.session.user,
    });
  } catch (err) {
    next(err);
  }
};
exports.getEditHome = (req, res, next) => {
  const homeId = req.params.homeId;
  const editing = req.query.editing === "true";

  Home.findById(homeId)
    .then((home) => {
      if (!home || home.length === 0) {
        console.log("Home not Found");
        return res.redirect("/host/host-homes");
      }
      res.render("host/edit-home", {
        home: home,
        pageTitle: "Edit Your Home",
        currentPage: "Host Homes",
        editing: editing,
        isLoggedIn: req.session.isLoggedIn,
        user: req.session.user,
      });
    })
    .catch((err) => console.log(err));
};

function parseRules(rulesRaw) {
  return (rulesRaw || "")
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
}

exports.postAddHome = (req, res, next) => {
  const { houseName, location, price, description, rules } = req.body;

  if (!req.file) {
    return res.status(400).send("No image provided");
  }

  const image = "/uploads/" + req.file.filename;

  const home = new Home({
    houseName,
    location,
    price,
    image,
    description,
    rules: parseRules(rules),
    hostId: req.session.user._id,
  });

  home
    .save()
    .then(() => {
      console.log("Home Added Successfully");
      res.redirect("/host/host-homes");
    })
    .catch((err) => {
      console.log("Error while saving home:", err);
      res.redirect("/host/add-home");
    });
};

exports.postEditHome = (req, res, next) => {
  const { id, houseName, location, price, description, rules } = req.body;

  Home.findById(id)
    .then((home) => {
      if (!home) {
        return res.redirect("/host/host-homes");
      }

      home.houseName = houseName;
      home.location = location;
      home.price = price;
      home.description = description;
      home.rules = parseRules(rules);

      if (req.file) {
        fs.unlink(home.image, (err) => {
          if (err) {
            console.log("Error while deleting file", err);
          }
        });
        home.image = req.file.path;
      }
      home
        .save()
        .then((result) => {
          console.log("Updated Home:", result);
        })
        .catch((err) => {
          console.log("Error while updating home:", err);
        });
      res.redirect("/host/host-homes");
    })
    .catch((err) => {
      console.log("Error while finding home:", err);
      res.redirect("/host/host-homes");
    });
};
exports.getHomes = (req, res, next) => {
  Home.find().then(([registeredHome]) => {
    res.render("store/home-list", {
      registeredHome: registeredHome,
      pageTitle: "Airbnb Home",
      currentPage: "Home",
      isLoggedIn: req.session.isLoggedIn,
      user: req.session.user,
    });
  });
};
exports.postDeleteHome = (req, res, next) => {
  const homeId = req.params.homeId;

  Home.findByIdAndDelete(homeId)
    .then((home) => {
      if (home && home.image) {
        const diskPath = path.join(rootDir, home.image);
        fs.unlink(diskPath, (err) => {
          if (err) {
            console.log("Error while deleting file", err);
          }
        });
      }
      res.redirect("/host/host-homes");
    })
    .catch((err) => console.log("Error while deleting", err));
};

exports.getHostBookings = async (req, res, next) => {
  const hostId = req.session.user._id;
  const bookings = await Booking.find({ host: hostId })
    .populate("guest")
    .populate("home")
    .sort({ createdAt: -1 });

  const guestIds = [...new Set(bookings.map((b) => b.guest._id.toString()))];
  const feedbackBookings = await Booking.find({
    guest: { $in: guestIds },
    "hostFeedback.rating": { $exists: true },
  }).select("guest hostFeedback");

  const feedbackByGuest = {};
  feedbackBookings.forEach((fb) => {
    const gid = fb.guest.toString();
    (feedbackByGuest[gid] ||= []).push(fb.hostFeedback);
  });

  res.render("host/host-bookings", {
    bookings,
    feedbackByGuest,
    pageTitle: "Booking Requests",
    currentPage: "Host Bookings",
    isLoggedIn: req.session.isLoggedIn,
    user: req.session.user,
  });
};
exports.postUpdateBookingStatus = async (req, res, next) => {
  const { bookingId, status } = req.body;
  const booking = await Booking.findById(bookingId).populate("home guest");

  if (booking && booking.host.toString() === req.session.user._id.toString()) {
    booking.status = status;
    await booking.save();

    await User.findByIdAndUpdate(booking.guest._id, {
      $push: {
        notifications: {
          message: `Your booking for ${booking.home.houseName} was ${status} by ${req.session.user.fname} ${req.session.user.lname}.`,
          type: "booking",
          link: `/bookings?bookingId=${booking._id}`,
          home: booking.home._id,
          booking: booking._id,
        },
      },
    });
    sendMail(
      booking.guest.email,
      `Booking ${status}`,
      `Your booking for ${booking.home.houseName} has been ${status} by the host.`,
      {
        link: `/bookings?bookingId=${booking._id}`,
        buttonText: "View Booking",
      },
    );

    req.flash("toast", `Booking ${status}.`);
  } else {
    req.flash("toast", "Could not update that booking.");
  }
  res.redirect("/host/bookings");
};

exports.postHostFeedback = async (req, res, next) => {
  const { bookingId, rating, comment } = req.body;
  const booking = await Booking.findById(bookingId).populate("home guest");
  if (!booking) return res.redirect("/host/bookings");

  if (booking.host.toString() !== req.session.user._id.toString()) {
    return res.redirect("/host/bookings");
  }
  if (booking.status !== "returned") {
    return res.redirect("/host/bookings");
  }
  if (booking.hostFeedback && booking.hostFeedback.rating) {
    return res.redirect("/host/bookings");
  }
  if (!rating) {
    return res.redirect("/host/bookings");
  }

  booking.hostFeedback = {
    rating: Number(rating),
    comment,
    createdAt: new Date(),
  };
  await booking.save();

  await User.findByIdAndUpdate(booking.guest._id, {
    $push: {
      notifications: {
        message: `The host rated your stay at ${booking.home.houseName} ${booking.hostFeedback.rating}/5.`,
        type: "booking",
        link: `/bookings?bookingId=${booking._id}`,
        home: booking.home._id,
        booking: booking._id,
      },
    },
  });

  res.redirect("/host/bookings");
};

exports.getHostDashboard = async (req, res, next) => {
  try {
    const hostId = req.session.user._id;
    const { month, homeId, status } = req.query;

    const allBookings = await Booking.find({ host: hostId })
      .populate("home", "houseName location")
      .populate("guest", "fname lname");

    const listedHomes = await Home.find({ hostId }).select("houseName");
    const homeOptions = listedHomes.map((h) => ({
      id: h._id.toString(),
      name: h.houseName,
    }));
    const monthSet = new Set();
    allBookings.forEach((b) => {
      monthSet.add(
        `${b.checkIn.getFullYear()}-${String(b.checkIn.getMonth() + 1).padStart(2, "0")}`,
      );
    });
    const monthOptions = [...monthSet].sort().reverse();
    const statusOptions = [
      "pending",
      "confirmed",
      "rejected",
      "cancelled",
      "arrived",
      "returned",
    ];

    let bookings = allBookings;
    if (month) {
      bookings = bookings.filter(
        (b) =>
          `${b.checkIn.getFullYear()}-${String(b.checkIn.getMonth() + 1).padStart(2, "0")}` ===
          month,
      );
    }
    if (homeId) {
      bookings = bookings.filter(
        (b) => b.home && b.home._id.toString() === homeId,
      );
    }
    if (status) {
      bookings = bookings.filter((b) => b.status === status);
    }

    const revenueStatuses = ["confirmed", "arrived", "returned"];
    const revenueBookings = bookings.filter((b) =>
      revenueStatuses.includes(b.status),
    );

    const totalRevenue = revenueBookings.reduce(
      (sum, b) => sum + b.offeredPrice,
      0,
    );
    const homesCount = listedHomes.length;

    const monthlyRevenue = {};
    revenueBookings.forEach((b) => {
      const key = `${b.checkIn.getFullYear()}-${String(b.checkIn.getMonth() + 1).padStart(2, "0")}`;
      monthlyRevenue[key] = (monthlyRevenue[key] || 0) + b.offeredPrice;
    });
    const monthlyLabels = Object.keys(monthlyRevenue).sort();
    const monthlyValues = monthlyLabels.map((k) => monthlyRevenue[k]);
    const avgBookingValue = revenueBookings.length
      ? Math.round(totalRevenue / revenueBookings.length)
      : 0;

    const lastTwoMonths = monthlyValues.slice(-2);
    const revenueGrowthPct =
      lastTwoMonths.length === 2 && lastTwoMonths[0] > 0
        ? Math.round(
            ((lastTwoMonths[1] - lastTwoMonths[0]) / lastTwoMonths[0]) * 100,
          )
        : null;
    const locationRevenue = {};
    revenueBookings.forEach((b) => {
      if (!b.home) return;
      locationRevenue[b.home.location] =
        (locationRevenue[b.home.location] || 0) + b.offeredPrice;
    });
    const locationLabels = Object.keys(locationRevenue);
    const locationValues = locationLabels.map((k) => locationRevenue[k]);

    const homeStats = {};
    revenueBookings.forEach((b) => {
      if (!b.home) return;
      const key = b.home._id.toString();
      if (!homeStats[key])
        homeStats[key] = { name: b.home.houseName, revenue: 0, bookings: 0 };
      homeStats[key].revenue += b.offeredPrice;
      homeStats[key].bookings += 1;
    });
    const topHomes = Object.values(homeStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    const homeQualityStats = {};
    bookings.forEach((b) => {
      if (!b.home) return;
      const key = b.home._id.toString();
      if (!homeQualityStats[key])
        homeQualityStats[key] = { total: 0, cancelled: 0, ratings: [] };
      homeQualityStats[key].total++;
      if (["cancelled", "rejected"].includes(b.status))
        homeQualityStats[key].cancelled++;
      if (b.guestFeedback?.rating)
        homeQualityStats[key].ratings.push(b.guestFeedback.rating);
    });

    topHomes.forEach((h) => {
      const key = Object.keys(homeStats).find(
        (k) => homeStats[k].name === h.name,
      );
      const q = homeQualityStats[key];
      h.cancelRate =
        q && q.total ? Math.round((q.cancelled / q.total) * 100) : 0;
      h.avgRating =
        q && q.ratings.length
          ? (q.ratings.reduce((s, r) => s + r, 0) / q.ratings.length).toFixed(1)
          : null;
    });
    const allPlatformHomes = await Home.find().select("location");
    const allPlatformBookings = await Booking.find({
      status: { $in: ["confirmed", "arrived", "returned"] },
    }).populate("home", "location");
    const locationSupply = {};
    allPlatformHomes.forEach((h) => {
      locationSupply[h.location] = (locationSupply[h.location] || 0) + 1;
    });

    const locationDemand = {};
    allPlatformBookings.forEach((b) => {
      if (!b.home) return;
      locationDemand[b.home.location] =
        (locationDemand[b.home.location] || 0) + 1;
    });
    const locationOpportunity = Object.keys(locationDemand)
      .map((loc) => ({
        location: loc,
        bookings: locationDemand[loc],
        homesListed: locationSupply[loc] || 0,
        demandPerHome: locationSupply[loc]
          ? +(locationDemand[loc] / locationSupply[loc]).toFixed(1)
          : locationDemand[loc],
      }))
      .sort((a, b) => b.demandPerHome - a.demandPerHome)
      .slice(0, 6);
    const bookedHomeIds = new Set(
      bookings.filter((b) => b.home).map((b) => b.home._id.toString()),
    );
    const underperformingHomes = listedHomes
      .filter((h) => !bookedHomeIds.has(h._id.toString()))
      .map((h) => h.houseName);
    const statusBreakdown = {};
    bookings.forEach((b) => {
      statusBreakdown[b.status] = (statusBreakdown[b.status] || 0) + 1;
    });

    const ratedBookings = bookings.filter(
      (b) => b.guestFeedback && b.guestFeedback.rating,
    );
    const avgRating = ratedBookings.length
      ? (
          ratedBookings.reduce((s, b) => s + b.guestFeedback.rating, 0) /
          ratedBookings.length
        ).toFixed(1)
      : null;

    const guestCounts = {};
    bookings.forEach((b) => {
      if (!b.guest) return;
      const key = b.guest._id.toString();
      guestCounts[key] = (guestCounts[key] || 0) + 1;
    });
    const uniqueGuests = Object.keys(guestCounts).length;
    const repeatGuests = Object.values(guestCounts).filter((c) => c > 1).length;
    const repeatGuestRate = uniqueGuests
      ? Math.round((repeatGuests / uniqueGuests) * 100)
      : 0;

    res.render("host/host-dashboard", {
      pageTitle: "Dashboard",
      currentPage: "Dashboard",
      isLoggedIn: req.session.isLoggedIn,
      user: req.session.user,
      stats: {
        totalRevenue,
        totalBookings: bookings.length,
        completedStays: bookings.filter((b) => b.status === "returned").length,
        homesCount,
        avgRating,
        repeatGuestRate,
        avgBookingValue,
        revenueGrowthPct,
      },
      topHomes,
      locationOpportunity,
      underperformingHomes,
      chartData: {
        monthlyLabels,
        monthlyValues,
        locationLabels,
        locationValues,
        statusBreakdown,
      },
      filters: {
        month: month || "",
        homeId: homeId || "",
        status: status || "",
      },
      filterOptions: { homeOptions, monthOptions, statusOptions },
    });
  } catch (err) {
    next(err);
  }
};
