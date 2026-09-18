const User = require("../models/user");
const path = require("path");
const fs = require("fs");
const rootDir = require("../utils/pathUtil");
const { check, validationResult } = require("express-validator");

exports.getProfile = (req, res) => {
  if (!req.session.isLoggedIn || !req.session.user) {
    return res.redirect("/login");
  }
  res.render("profile/edit-profile", {
    pageTitle: "My Profile",
    currentPage: "Profile",
    isLoggedIn: req.session.isLoggedIn,
    user: req.session.user,
  });
};

exports.postUpdateProfileValidators = [
  check("fname")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ max: 50 })
    .withMessage("First name is too long")
    .matches(/^[A-Za-z\s'-]+$/)
    .withMessage("First name contains invalid characters"),

  check("mname")
    .trim()
    .optional({ checkFalsy: true })
    .isLength({ max: 50 })
    .withMessage("Middle name is too long")
    .matches(/^[A-Za-z\s'-]+$/)
    .withMessage("Middle name contains invalid characters"),

  check("lname")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ max: 50 })
    .withMessage("Last name is too long")
    .matches(/^[A-Za-z\s'-]+$/)
    .withMessage("Last name contains invalid characters"),

  check("phone")
    .trim()
    .optional({ checkFalsy: true })
    .isMobilePhone("any")
    .withMessage("Enter a valid phone number"),
];

exports.postUpdateProfile = async (req, res, next) => {
  if (!req.session.isLoggedIn || !req.session.user) {
    return res.redirect("/login");
  }

  const errors = validationResult(req);
  const { fname, mname, lname, phone } = req.body;

  if (!errors.isEmpty()) {
    if (req.file) {
      fs.unlink(
        path.join(rootDir, "uploads/profile", req.file.filename),
        () => {},
      );
    }
    return res.status(422).render("profile/edit-profile", {
      pageTitle: "My Profile",
      currentPage: "Profile",
      isLoggedIn: req.session.isLoggedIn,
      user: req.session.user,
      errors: errors.array(),
      oldInput: { fname, mname, lname, phone },
    });
  }

  const user = await User.findById(req.session.user._id);

  user.fname = fname;
  user.mname = mname;
  user.lname = lname;
  user.phone = phone;

  if (req.file) {
    const oldImage = user.profileImage;
    user.profileImage = "/uploads/profile/" + req.file.filename;

    if (oldImage && oldImage !== "/uploads/default-profile.png") {
      const oldImagePath = path.join(rootDir, oldImage);
      fs.unlink(oldImagePath, (err) => {
        if (err) console.log("Error deleting old profile image:", err);
      });
    }
  }

  await user.save();
  req.session.user = user.toObject();
  req.flash("toast", "Profile updated!");
  res.redirect("/profile");
};
