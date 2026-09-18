// Core Module
const path = require("path");
// External Module
const express = require("express");
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const rootDir = require("./utils/pathUtil");
const app = express();
const flash = require('connect-flash');
require('dotenv').config();
const DB_PATH = process.env.MONGO_URI;

// Internal Module
app.use(flash());
const storeRouter = require("./routes/storeRouter");
const authRouter = require("./routes/authRouter");
const errorController = require("./controllers/erros");
const hostRouter = require("./routes/hostRouter");
const User = require("./models/user"); 
const {default: mongoose} = require("mongoose");

app.set("view engine", "ejs");
app.set("views", "views");
const store = new MongoDBStore({
  uri: DB_PATH,
  collection: 'sessions'
})
app.use(express.urlencoded());
app.use(express.static(path.join(rootDir, "public")));
app.use("/uploads",express.static(path.join(rootDir, "uploads")));
app.use("/host/uploads",express.static(path.join(rootDir, "uploads")));
app.use("/homes/uploads",express.static(path.join(rootDir, "uploads")));
app.use(session({
  secret: "!bml4o1",
  resave: false,
  saveUninitialized: true,
  store
}));
app.use((req, res, next) => {
  req.session.isLoggedIn = req.session.isLoggedIn || false;
  next();
})
app.use(authRouter);

app.use((req, res, next) => {
  res.locals.toastMessages = req.flash('toast');
  next();
});
app.use(async (req, res, next) => {
  if (req.session.isLoggedIn && req.session.user) {
    try {
      const freshUser = await User.findById(req.session.user._id);
      if (freshUser) {
        req.session.user = freshUser.toObject();
      } else {
        req.session.isLoggedIn = false;
        req.session.user = null;
      }
    } catch (err) {
      console.log("Error refreshing session user:", err);
    }
  }
  next();
});
app.use(storeRouter);
app.use("/host", (req, res, next) =>{
  if (req.session.isLoggedIn){
    next();
  }
  else{
    res.redirect("/login")
  }
});
app.use("/host", hostRouter);

app.use(errorController.get404);
const PORT = 3000;

mongoose.connect( DB_PATH).then(() => {
  console.log("Connected to MongoDB");
  app.listen(PORT, () => {
    console.log(`Server is running on address http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.log("Error connecting to MongoDB", err);
});

