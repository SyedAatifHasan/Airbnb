const Home = require("../models/home");
const User = require("../models/user");
const Booking = require("../models/booking");

async function enrichHomesWithStats(homes, req) {
  const homeIds = homes.map((h) => h._id);
  const now = new Date();

  const bookings = await Booking.find({
    home: { $in: homeIds },
    status: { $in: ["pending", "confirmed", "arrived", "returned"] },
  }).select("home status checkIn checkOut");

  const statsByHome = {};
  homes.forEach((h) => {
    statsByHome[h._id.toString()] = { totalBookings: 0, occupied: false };
  });

  bookings.forEach((b) => {
    const stat = statsByHome[b.home.toString()];
    if (!stat) return;
    stat.totalBookings++;
    if (
      ["confirmed", "arrived"].includes(b.status) &&
      b.checkIn <= now &&
      b.checkOut >= now
    ) {
      stat.occupied = true;
    }
  });

  let lovedHomeIds = new Set();
  let hostsWhoRatedYouWell = new Set();

  if (req.session.user && req.session.user.usertype === "guest") {
    const guestId = req.session.user._id;

    const goodStays = await Booking.find({
      guest: guestId,
      "guestFeedback.rating": { $gte: 4 },
    }).select("home");
    lovedHomeIds = new Set(goodStays.map((b) => b.home.toString()));

    const hostRatingsOfYou = await Booking.find({
      guest: guestId,
      "hostFeedback.rating": { $gte: 4 },
    }).select("host");
    hostsWhoRatedYouWell = new Set(
      hostRatingsOfYou.map((b) => b.host.toString()),
    );
  }

  return homes.map((h) => {
    const stat = statsByHome[h._id.toString()];
    return {
      ...h.toObject(),
      totalBookings: stat.totalBookings,
      occupied: stat.occupied,
      guestLovedThisHome: lovedHomeIds.has(h._id.toString()),
      hostRatedYouWell: hostsWhoRatedYouWell.has(h.hostId.toString()),
    };
  });
}

exports.getHomes = async (req, res, next) => {
  const homes = await Home.find();
  const registeredHome = await enrichHomesWithStats(homes, req);

  res.render("store/home-list", {
    registeredHome,
    pageTitle: "Home List",
    currentPage: "Home",
    isLoggedIn: req.session.isLoggedIn,
    user: req.session.user,
  });
};
exports.getIndex = async (req, res, next) => {
  const homes = await Home.find();
  const registeredHome = await enrichHomesWithStats(homes, req);

  res.render("store/index", {
    registeredHome,
    pageTitle: "Airbnb",
    currentPage: "Index",
    isLoggedIn: req.session.isLoggedIn,
    user: req.session.user,
  });
};

exports.getFavouriteList = async (req, res, next) => {
  if (!req.session.isLoggedIn || !req.session.user) {
    return res.redirect("/login");
  }
  const userId = req.session.user._id;
  const user = await User.findById(userId).populate("favourites");
  const favouriteHome = await enrichHomesWithStats(user.favourites, req);

  res.render("store/favourite-list", {
    favouriteHome,
    pageTitle: "My Favourites",
    currentPage: "Favourites",
    isLoggedIn: req.session.isLoggedIn,
    user: req.session.user,
  });
};
exports.postAddToFavourite = async (req, res, next) => {
  if (!req.session.isLoggedIn || !req.session.user) {
    return res.redirect("/login");
  }

  const homeId = req.body.id;
  const userId = req.session.user._id;
  const user = await User.findById(userId);
  if (!user.favourites.includes(homeId)) {
    user.favourites.push(homeId);
    await user.save();
  }
  res.redirect("/favourite-list");
};
exports.postRemoveFromFavourite = async (req, res, next) => {
  if (!req.session.isLoggedIn || !req.session.user) {
    return res.redirect("/login");
  }
  const homeId = req.params.homeId;
  const userId = req.session.user._id;
  const user = await User.findById(userId);
  if (user.favourites.includes(homeId)) {
    user.favourites = user.favourites.filter((fav) => fav != homeId);
    await user.save();
  }
  res.redirect("/favourite-list");
};
exports.getHomeDetails = (req, res, next) => {
  const homeId = req.params.homeId;
  const now = new Date();

  Promise.all([
    Home.findById(homeId),
    req.session.user
      ? Booking.find({ home: homeId, guest: req.session.user._id }).sort({
          createdAt: -1,
        })
      : Promise.resolve([]),
    Booking.find({ home: homeId, "guestFeedback.rating": { $exists: true } })
      .populate("guest", "fname mname lname")
      .sort({ "guestFeedback.createdAt": -1 }),
    Booking.countDocuments({ home: homeId }),
    Booking.findOne({
      home: homeId,
      status: { $in: ["confirmed", "arrived"] },
      checkIn: { $lte: now },
      checkOut: { $gte: now },
    }),
  ])
    .then(([home, userBookings, reviews, bookingCount, activeStay]) => {
      if (!home) {
        console.log("Home not Found");
        return res.redirect("/homes");
      }
      res.render("store/home-detail", {
        pageTitle: "Home Details",
        currentPage: "Home",
        home: home,
        isLoggedIn: req.session.isLoggedIn,
        user: req.session.user,
        userBookings: userBookings,
        reviews: reviews,
        bookingCount: bookingCount,
        occupied: !!activeStay,
      });
    })
    .catch(next);
};
const path = require("path");
const rootDir = require("../utils/pathUtil");
const PDFDocument = require("pdfkit");

exports.getHouseRules = [
  (req, res, next) => {
    if (!req.session.isLoggedIn) {
      return res.redirect("/login");
    }
    next();
  },
  (req, res, next) => {
    const homeId = req.params.homeId;

    Home.findById(homeId)
      .then((home) => {
        if (!home) {
          return res.redirect("/homes");
        }

        const safeName = home.houseName.replace(/[^a-z0-9]/gi, "_");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${safeName}-rules.pdf"`,
        );

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        doc.fontSize(22).text("House Rules", { align: "center" });
        doc.moveDown();
        doc
          .fontSize(16)
          .fillColor("#444")
          .text(home.houseName, { align: "center" });
        doc.moveDown(0.5);
        doc
          .fontSize(11)
          .fillColor("#888")
          .text(home.location, { align: "center" });
        doc.moveDown(2);

        doc.fillColor("#000");

        if (home.rules && home.rules.length) {
          home.rules.forEach((rule, i) => {
            doc.fontSize(12).text(`${i + 1}. ${rule}`);
            doc.moveDown(0.6);
          });
        } else {
          doc
            .fontSize(12)
            .fillColor("#888")
            .text("No specific rules have been provided for this home.");
        }

        doc.end();
      })
      .catch((err) => next(err));
  },
];
exports.postGuestFeedback = async (req, res, next) => {
  if (!req.session.user) return res.redirect("/login");
  const { bookingId, rating, comment } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) return res.redirect("/homes");

  if (booking.guest.toString() !== req.session.user._id.toString()) {
    return res.redirect("/homes");
  }
  if (booking.status !== "returned") {
    return res.redirect(`/homes/${booking.home}`);
  }
  if (booking.guestFeedback && booking.guestFeedback.rating) {
    return res.redirect(`/homes/${booking.home}`);
  }
  if (!rating) {
    return res.redirect(`/homes/${booking.home}`);
  }

  booking.guestFeedback = {
    rating: Number(rating),
    comment,
    createdAt: new Date(),
  };
  await booking.save();

  const homeBookings = await Booking.find({
    home: booking.home,
    "guestFeedback.rating": { $exists: true },
  }).select("guestFeedback.rating");

  const avg =
    homeBookings.reduce((sum, b) => sum + b.guestFeedback.rating, 0) /
    homeBookings.length;
  await Home.findByIdAndUpdate(booking.home, {
    ratting: Math.round(avg * 10) / 10,
  });

  res.redirect(`/homes/${booking.home}`);
};

exports.postHostReplyToFeedback = async (req, res, next) => {
  if (!req.session.user) return res.redirect("/login");
  const { bookingId, reply } = req.body;

  const booking = await Booking.findById(bookingId).populate("home");
  if (!booking) return res.redirect("/host/host-homes");

  if (booking.home.hostId.toString() !== req.session.user._id.toString()) {
    return res.redirect(`/homes/${booking.home._id}`);
  }
  if (!booking.guestFeedback || !booking.guestFeedback.rating) {
    return res.redirect(`/homes/${booking.home._id}`);
  }
  if (
    booking.guestFeedback.hostReply &&
    booking.guestFeedback.hostReply.comment
  ) {
    return res.redirect(`/homes/${booking.home._id}`);
  }
  if (!reply || !reply.trim()) {
    return res.redirect(`/homes/${booking.home._id}`);
  }

  booking.guestFeedback.hostReply = {
    comment: reply.trim(),
    createdAt: new Date(),
  };
  await booking.save();
  const guest = await User.findById(booking.guest);
  sendMail(
    guest.email,
    "Host replied to your review",
    `The host replied to your review for ${booking.home.houseName}.`,
    { link: `/homes/${booking.home._id}`, buttonText: "View Reply" },
  );

  res.redirect(`/homes/${booking.home._id}`);
};

exports.getGuestReport = async (req, res, next) => {
  if (!req.session.isLoggedIn || !req.session.user) {
    return res.redirect("/login");
  }
  try {
    const guestId = req.session.user._id;
    const { month, homeId, status } = req.query;

    const allBookings = await Booking.find({ guest: guestId })
      .populate("home", "houseName location image price")
      .populate("host", "fname lname")
      .sort({ checkIn: -1 });
    const homeOptionsMap = {};
    const monthSet = new Set();
    allBookings.forEach((b) => {
      if (b.home) homeOptionsMap[b.home._id.toString()] = b.home.houseName;
      monthSet.add(
        `${b.checkIn.getFullYear()}-${String(b.checkIn.getMonth() + 1).padStart(2, "0")}`,
      );
    });
    const homeOptions = Object.entries(homeOptionsMap).map(([id, name]) => ({
      id,
      name,
    }));
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

    const completedStays = bookings.filter((b) => b.status === "returned");
    const upcoming = bookings.filter((b) =>
      ["pending", "confirmed", "arrived"].includes(b.status),
    );
    const revenueStatuses = ["confirmed", "arrived", "returned"];

    const totalSpent = bookings
      .filter((b) => revenueStatuses.includes(b.status))
      .reduce((sum, b) => sum + b.offeredPrice, 0);

    const totalNights = completedStays.reduce((sum, b) => {
      return sum + Math.round((b.checkOut - b.checkIn) / 86400000);
    }, 0);

    const locationCount = {};
    bookings.forEach((b) => {
      if (!b.home) return;
      locationCount[b.home.location] =
        (locationCount[b.home.location] || 0) + 1;
    });
    const favouriteLocation =
      Object.entries(locationCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    const hostCount = {};
    bookings.forEach((b) => {
      if (!b.host) return;
      const key = b.host._id.toString();
      if (!hostCount[key])
        hostCount[key] = { name: `${b.host.fname} ${b.host.lname}`, count: 0 };
      hostCount[key].count++;
    });
    const favouriteHost =
      Object.values(hostCount).sort((a, b) => b.count - a.count)[0] || null;

    const statusBreakdown = {};
    bookings.forEach((b) => {
      statusBreakdown[b.status] = (statusBreakdown[b.status] || 0) + 1;
    });

    const monthlySpend = {};
    bookings
      .filter((b) => revenueStatuses.includes(b.status))
      .forEach((b) => {
        const key = `${b.checkIn.getFullYear()}-${String(b.checkIn.getMonth() + 1).padStart(2, "0")}`;
        monthlySpend[key] = (monthlySpend[key] || 0) + b.offeredPrice;
      });
    const monthlyLabels = Object.keys(monthlySpend).sort();
    const monthlyValues = monthlyLabels.map((k) => monthlySpend[k]);

    const avgSpendPerStay = completedStays.length
      ? Math.round(
          totalSpent /
            completedStays.filter((b) => revenueStatuses.includes(b.status))
              .length,
        )
      : 0;

    const leadTimes = bookings
      .filter((b) => b.createdAt && b.checkIn)
      .map((b) => Math.round((b.checkIn - b.createdAt) / 86400000))
      .filter((d) => d >= 0);
    const avgLeadTimeDays = leadTimes.length
      ? Math.round(leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length)
      : null;
    const bookingStyle =
      avgLeadTimeDays === null
        ? "—"
        : avgLeadTimeDays >= 21
          ? "Plans well ahead"
          : avgLeadTimeDays >= 7
            ? "Moderate planner"
            : "Last-minute booker";

    const tierCounts = { Budget: 0, "Mid-range": 0, Premium: 0 };
    bookings.forEach((b) => {
      if (!b.home || !b.home.price) return;
      if (b.home.price < 50) tierCounts.Budget++;
      else if (b.home.price < 150) tierCounts["Mid-range"]++;
      else tierCounts.Premium++;
    });
    const preferredTier =
      Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    const cancelledOrRejected = bookings.filter((b) =>
      ["cancelled", "rejected"].includes(b.status),
    ).length;
    const cancellationRate = bookings.length
      ? Math.round((cancelledOrRejected / bookings.length) * 100)
      : 0;
    res.render("store/guest-report", {
      pageTitle: "My Travel Report",
      currentPage: "Report",
      isLoggedIn: req.session.isLoggedIn,
      user: req.session.user,
      bookings,
      upcoming,
      stats: {
        totalBookings: bookings.length,
        completedStays: completedStays.length,
        upcomingCount: upcoming.length,
        totalSpent,
        totalNights,
        favouriteLocation,
        favouriteHost,
        avgSpendPerStay,
        avgLeadTimeDays,
        bookingStyle,
        preferredTier,
        cancellationRate,
      },
      chartData: { statusBreakdown, monthlyLabels, monthlyValues, tierCounts },
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
