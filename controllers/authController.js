const { check, validationResult } = require("express-validator");
const User = require("../models/user");
const bcrypt = require("bcryptjs");

exports.getSignup = (req, res, next) => {
  res.render("auth/signup", {
    pageTitle: "Signup",
    currentPage: "Signup",
    isLoggedIn: false,
    errorMessages: [], 
    oldInput: {
      fname: "",
      mname: "",
      lname: "",
      phone: "",
      email: "",
      usertype: "",
    },
    user: {},
  });
};
exports.getTerms = (req, res, next) => {
  res.render("auth/terms", {
    pageTitle: "Terms",
    currentPage: "Terms",
    isLoggedIn: false,
  });
};
exports.postSignup = [
  check("fname")
    .notEmpty()
    .withMessage("First name is required")
    .trim()
    .isLength({ min: 3 })
    .withMessage("First name must be at least 3 characters long")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("First name can only contain letters"),

  check("mname")
    .matches(/^[a-zA-Z\s]*$/)
    .withMessage("Middle name can only contain letters"),

  check("lname")
    .notEmpty()
    .withMessage("Last name is required")
    .trim()
    .isLength({ min: 3 })
    .withMessage("Last name must be at least 3 characters long")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("last name can only contain letters"),

  check("email")
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),

  check("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage("Phone number must contain a valid phone number"),

  check("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Password must contain at least one special character")
    .trim(),

  check("cpassword")
    .trim()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Password do not match");
      }
      return true;
    }),

  check("usertype")
    .notEmpty()
    .withMessage("User type is required")
    .isIn(["guest", "host"])
    .withMessage("Invalid user type"),

  check("terms")
    .notEmpty()
    .withMessage("You must accept the terms and conditions")
    .custom((value) => {
      if (value !== "on") {
        throw new Error("You must accept the terms and conditions");
      }
      return true;
    }),
  (req, res, next) => {
    const { fname, mname, lname, email, phone, password, usertype } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("auth/signup", {
        pageTitle: "Signup",
        currentPage: "Signup",
        isLoggedIn: false,
        errorMessages: errors.array().map((err) => err.msg),
        oldInput: { fname, mname, lname, email, phone, password, usertype },
        user: {},
      });
    }
    bcrypt
      .hash(password, 15)
      .then((hashedPassword) => {
        const user = new User({
          fname,
          mname,
          lname,
          email,
          password: hashedPassword,
          usertype,
        });
        return user.save();
      })
      .then(() => {
        res.redirect("/login");
      })
      .catch((err) => {
        return res.status(422).render("auth/signup", {
          pageTitle: "Signup",
          currentPage: "Signup",
          isLoggedIn: false,
          errorMessages: [err.message],
          oldInput: { fname, mname, lname, email, phone, usertype },
          user: {},
        });
      });
  },
];
exports.getLogin = (req, res, next) => {
  res.render("auth/login", {
    pageTitle: "Login",
    currentPage: "Login",
    isLoggedIn: false,
    errorMessages: [],
    oldInput: { email: "" },
    user: {},
  });
};

exports.postLogin = async (req, res, next) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(422).render("auth/login", {
      pageTitle: "Login",
      currentPage: "Login",
      isLoggedIn: false,
      errorMessages: ["User does not exist"],
      oldInput: { email },
      user: {},
    });
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(422).render("auth/login", {
      pageTitle: "Login",
      currentPage: "Login",
      isLoggedIn: false,
      errorMessages: ["Invalid Password"],
      oldInput: { email },
      user: {},
    });
  }
  req.session.isLoggedIn = true;
  req.session.user = {
    _id: user._id.toString(),
    fname: user.fname,
    mname: user.mname,
    lname: user.lname,
    email: user.email,
    usertype: user.usertype,
  };

  req.session.save((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
};
exports.postLogout = (req, res, next) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
};
