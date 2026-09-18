const User = require("../models/user");

exports.getNotifications = async (req, res, next) => {
  if (!req.session.isLoggedIn || !req.session.user) {
    return res.redirect("/login");
  }

  const user = await User.findById(req.session.user._id).populate(
    "notifications.home",
  );

  const notifications = [...user.notifications]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((n) => ({
      _id: n._id,
      message: n.message,
      type: n.type,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt,
      home: n.home || null,
    }));

  user.notifications.forEach((n) => {
    n.read = true;
  });
  await user.save();
  req.session.user = user.toObject();

  res.render("notifications/list", {
    notifications,
    pageTitle: "Notifications",
    currentPage: "Notifications",
    isLoggedIn: req.session.isLoggedIn,
    user: req.session.user,
  });
};
